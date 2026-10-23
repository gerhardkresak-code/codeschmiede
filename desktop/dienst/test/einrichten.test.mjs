import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { KATALOG, katalogFuer, installText, findeKatalogProgramm, anmeldeDaten, imFenster, oeffneSeite } from "../lib/einrichten.mjs";

test("Katalog: nur bekannte Programme, Befehle fest im Programm", () => {
  assert.equal(katalogFuer("cursor-agent").id, "cursor-agent");
  assert.equal(katalogFuer("agent"), null);
  assert.equal(katalogFuer("codex").name, "ChatGPT (Codex)");
  assert.equal(katalogFuer("rm"), null); assert.equal(katalogFuer("__proto__"), null); assert.equal(katalogFuer(undefined), null);
  assert.equal(installText(katalogFuer("copilot")), "npm install -g @github/copilot");
  assert.match(installText(katalogFuer("cursor-agent"), "win32"), /^irm 'https:\/\/cursor\.com\/install\?win32=true' \| iex$/);
  assert.match(installText(katalogFuer("agy")), /^Installer-Seite öffnen: https:\/\//);
  for (const k of Object.values(KATALOG)) { assert.ok(k.login.every((a) => /^[A-Za-z0-9.-]+$/.test(a))); if (k.install.seite) assert.match(k.install.seite, /^https:\/\//); }
});

test("Programm wird nur in absoluten Ordnern gesucht", () => {
  const gibt = (p) => p === path.join("/home/x/.local/bin", "agy") || p === path.join("rel", "codex");
  assert.equal(findeKatalogProgramm(katalogFuer("agy"), { env: { PATH: "rel" }, home: "/home/x", plattform: "linux", gibt }).pfad, "/home/x/.local/bin/agy");
  assert.equal(findeKatalogProgramm(katalogFuer("codex"), { env: { PATH: "rel" }, home: "/home/x", plattform: "linux", gibt }), null);
});

test("Anmelde-Code und Seite aus der Ausgabe", () => {
  assert.deepEqual(anmeldeDaten("! First copy your one-time code: AB12-CD34\nThen visit https://github.com/login/device"), { code: "AB12-CD34", url: "https://github.com/login/device" });
  assert.deepEqual(anmeldeDaten("Visit https://evil.example/login now"), { code: null, url: null });
  assert.equal(anmeldeDaten("AB12-CD34 https://evilcursor.com/x https://phish-openai.com/d").url, null);
  assert.equal(anmeldeDaten("https://github.com/evil https://user@cursor.com/x").url, null);
  assert.equal(anmeldeDaten("open https://www.cursor.com/loginDeepControl?x=1").url, "https://www.cursor.com/loginDeepControl?x=1");
});

test("Umgebung ohne Tokens", async () => {
  const { einrichtUmgebung } = await import("../lib/einrichten.mjs");
  const e = einrichtUmgebung({ PATH: "/usr/bin", GH_TOKEN: "x", SUPABASE_KEY: "y", npm_config_prefix: "/p", npm_config__authToken: "z", GEMINI_API_KEY: "k" });
  assert.equal(e.npm_config_prefix, "/p");
  for (const k of ["GH_TOKEN", "SUPABASE_KEY", "npm_config__authToken", "GEMINI_API_KEY"]) assert.ok(!(k in e), k);
});

test("Fenster und Browser nur mit sicheren Angaben", () => {
  assert.equal(imFenster({ befehl: "/x/agy\"; rm -rf ~" }, []), false);
  assert.equal(imFenster({ befehl: "/x/agy" }, ["; rm"]), false);
  assert.equal(oeffneSeite("javascript:alert(1)"), false);
  assert.equal(oeffneSeite("https://x.ai/cli \" & calc"), false);
});

test("Claude-Anmeldung lesen: Abo, API-Schlüssel, nicht angemeldet", async () => {
  const { claudeStatus } = await import("../lib/ki.mjs");
  assert.deepEqual(claudeStatus('{"loggedIn":true,"authMethod":"claude.ai","subscriptionType":"max","email":"x@y"}'), { abo: true, plan: "Max", text: "Mit deinem Claude-Abo angemeldet (Max)" });
  assert.equal(claudeStatus('{"loggedIn":true,"authMethod":"api_key"}').abo, false);
  assert.match(claudeStatus('{"loggedIn":false,"authMethod":"none"}').text, /Nicht angemeldet/);
  assert.match(claudeStatus("Unknown command auth").text, /nicht prüfbar/);
  assert.ok(!JSON.stringify(claudeStatus('{"authMethod":"claude.ai","email":"geheim@x.at"}')).includes("geheim"));
});
