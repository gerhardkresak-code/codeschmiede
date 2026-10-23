import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { KATALOG, katalogFuer, installText, findeKatalogProgramm, anmeldeDaten, imFenster, oeffneSeite } from "../lib/einrichten.mjs";

test("Katalog: nur bekannte Programme, Befehle fest im Programm", () => {
  assert.equal(katalogFuer("cursor-agent").id, "cursor-agent");
  assert.equal(katalogFuer("agent").id, "cursor-agent");
  assert.equal(katalogFuer("codex").name, "ChatGPT (Codex)");
  assert.equal(katalogFuer("rm"), null); assert.equal(katalogFuer("__proto__"), null); assert.equal(katalogFuer(undefined), null);
  assert.equal(installText(katalogFuer("copilot")), "npm install -g @github/copilot");
  assert.match(installText(katalogFuer("cursor-agent"), "win32"), /^irm 'https:\/\/cursor\.com\/install\?win32=true' \| iex$/);
  assert.match(installText(katalogFuer("agy")), /^Installer-Seite öffnen: https:\/\//);
  for (const k of Object.values(KATALOG)) { assert.ok(k.login.every((a) => /^[A-Za-z0-9-]+$/.test(a))); if (k.install.seite) assert.match(k.install.seite, /^https:\/\//); }
});

test("Programm wird nur in absoluten Ordnern gesucht", () => {
  const gibt = (p) => p === path.join("/home/x/.local/bin", "agy") || p === path.join("rel", "codex");
  assert.equal(findeKatalogProgramm(katalogFuer("agy"), { env: { PATH: "rel" }, home: "/home/x", plattform: "linux", gibt }).pfad, "/home/x/.local/bin/agy");
  assert.equal(findeKatalogProgramm(katalogFuer("codex"), { env: { PATH: "rel" }, home: "/home/x", plattform: "linux", gibt }), null);
});

test("Anmelde-Code und Seite aus der Ausgabe", () => {
  assert.deepEqual(anmeldeDaten("! First copy your one-time code: AB12-CD34\nThen visit https://github.com/login/device"), { code: "AB12-CD34", url: "https://github.com/login/device" });
  assert.deepEqual(anmeldeDaten("Visit https://evil.example/login now"), { code: null, url: null });
});

test("Fenster und Browser nur mit sicheren Angaben", () => {
  assert.equal(imFenster({ befehl: "/x/agy\"; rm -rf ~" }, []), false);
  assert.equal(imFenster({ befehl: "/x/agy" }, ["; rm"]), false);
  assert.equal(oeffneSeite("javascript:alert(1)"), false);
  assert.equal(oeffneSeite("https://x.ai/cli \" & calc"), false);
});
