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
  assert.equal(installText(katalogFuer("agy"), "win32"), "irm https://antigravity.google/cli/install.ps1 | iex");
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

test("Grok und Mistral: offizielle Installation, Grok im eigenen Ordner gefunden (Gerhard 22:50)", () => {
  assert.ok(KATALOG.grok.install.skript.unix.startsWith("curl -fsSL https://x.ai/cli/install.sh"));
  assert.ok(KATALOG.vibe.install.skript.unix.startsWith("curl -LsSf https://mistral.ai/vibe/install.sh"));
  assert.deepEqual(KATALOG.grok.status.datei, [".grok", "auth.json"]);
  const gibt = (p) => p === "/home/x/.grok/bin/grok";
  assert.equal(findeKatalogProgramm(katalogFuer("grok"), { env: { PATH: "/usr/bin" }, home: "/home/x", plattform: "linux", gibt }).pfad, "/home/x/.grok/bin/grok");
});

test("Windows-Startdateien: npm-Skript, Programm daneben, nichts außerhalb (OpenCode, Gerhard 22:58)", async () => {
  const { startdateiAufloesen, findeIn } = await import("../lib/ki.mjs");
  const o = "C:\\Users\\g\\AppData\\Roaming\\npm";
  const dateien = {
    [`${o}\\opencode.cmd`]: '@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n"%dp0%\\node_modules\\opencode-ai\\bin\\opencode.exe"   %*\r\n',
    [`${o}\\node_modules\\opencode-ai\\bin\\opencode.exe`]: "",
    [`${o}\\codex.cmd`]: '@IF EXIST "%dp0%\\node.exe" (SET "_prog=%dp0%\\node.exe") ELSE (SET "_prog=node")\r\n"%_prog%"  "%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js" %*\r\n',
    [`${o}\\node_modules\\@openai\\codex\\bin\\codex.js`]: "",
    [`${o}\\boese.cmd`]: '"%dp0%\\..\\..\\Windows\\evil.exe" %*',
    "C:\\Users\\g\\AppData\\Windows\\evil.exe": "",
  };
  const gibt = (p) => Object.hasOwn(dateien, p); const lies = (p) => { if (!gibt(p)) throw new Error("fehlt"); return dateien[p]; };
  assert.equal(startdateiAufloesen(`${o}\\opencode.cmd`, { lies, gibt, realpath: (x) => x }).befehl, `${o}\\node_modules\\opencode-ai\\bin\\opencode.exe`);
  assert.deepEqual(startdateiAufloesen(`${o}\\codex.cmd`, { lies, gibt, realpath: (x) => x }).vorne, [`${o}\\node_modules\\@openai\\codex\\bin\\codex.js`]);
  assert.equal(startdateiAufloesen(`${o}\\boese.cmd`, { lies, gibt, realpath: (x) => x }), null);
  const env = { PATH: "", APPDATA: "C:\\Users\\g\\AppData\\Roaming", LOCALAPPDATA: "C:\\Users\\g\\AppData\\Local" };
  assert.equal(findeIn(["opencode"], { env, home: "C:\\Users\\g", plattform: "win32", gibt, lies, realpath: (x) => x, mitRegistry: false }).befehl, `${o}\\node_modules\\opencode-ai\\bin\\opencode.exe`);
  assert.equal(findeIn(["grok"], { env, home: "C:\\Users\\g", plattform: "win32", gibt: (p) => p === "C:\\Users\\g\\.grok\\bin\\grok.exe", mitRegistry: false }).befehl, "C:\\Users\\g\\.grok\\bin\\grok.exe");
});

test("Prüfung 0.8.7: Hersteller-Ordner nur für den Hersteller, keine Datenströme, keine Shell als Ziel, Sperrliste im Dienst", async () => {
  const { startdateiAufloesen, findeIn, findeFreiesProgramm, programmGesperrt } = await import("../lib/ki.mjs");
  const env = { PATH: "", APPDATA: "C:\\Users\\g\\AppData\\Roaming", LOCALAPPDATA: "C:\\Users\\g\\AppData\\Local" };
  const gibt = (p) => p === "C:\\Users\\g\\.grok\\bin\\agent.exe";
  assert.equal(findeIn(["agent"], { env, home: "C:\\Users\\g", plattform: "win32", gibt, mitRegistry: false }), null);
  const o = "C:\\a\\npm";
  const da = new Set([`${o}\\x.txt:evil.exe`, `${o}\\cmd.exe`, `${o}\\ads.cmd`, `${o}\\shell.cmd`]);
  const lies = (p) => ({ [`${o}\\ads.cmd`]: '"%dp0%\\x.txt:evil.exe" %*', [`${o}\\shell.cmd`]: '"%dp0%\\cmd.exe" %*' })[p];
  assert.equal(startdateiAufloesen(`${o}\\ads.cmd`, { lies, gibt: (p) => da.has(p), realpath: (x) => x }), null);
  assert.equal(startdateiAufloesen(`${o}\\shell.cmd`, { lies, gibt: (p) => da.has(p), realpath: (x) => x }), null);
  // Verknüpfung, die aus dem Ordner herauszeigt
  const lies2 = () => '"%dp0%\\tool.exe" %*';
  assert.equal(startdateiAufloesen(`${o}\\t.cmd`, { lies: lies2, gibt: () => true, realpath: (x) => x.endsWith("tool.exe") ? "C:\\Windows\\tool.exe" : x }), null);
  assert.ok(programmGesperrt("powershell.exe") && programmGesperrt("msiexec") && programmGesperrt("claude") && !programmGesperrt("cursor-agent"));
  assert.equal(findeFreiesProgramm("pwsh"), null);
});

test("Cursor unter Windows: neueste Version aus dem Cursor-Ordner, ohne Skript (Gerhard 24.10.)", async () => {
  const { findeIn } = await import("../lib/ki.mjs");
  const o = "C:\\Users\\g\\AppData\\Local\\cursor-agent";
  const da = new Set([`${o}\\cursor-agent.cmd`, `${o}\\versions\\2026.10.22-27dcf5f\\node.exe`, `${o}\\versions\\2026.10.22-27dcf5f\\index.js`, `${o}\\versions\\2026.9.1-aaaa\\node.exe`, `${o}\\versions\\2026.9.1-aaaa\\index.js`]);
  const lies = () => '@echo off\r\n%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%\\cursor-agent.ps1" %*';
  const env = { PATH: "", APPDATA: "C:\\Users\\g\\AppData\\Roaming", LOCALAPPDATA: "C:\\Users\\g\\AppData\\Local" };
  const r = findeIn(["cursor-agent"], { env, home: "C:\\Users\\g", plattform: "win32", gibt: (p) => da.has(p), lies, realpath: (x) => x, cursorListe: () => ["2026.9.1-aaaa", "2026.10.22-27dcf5f", "boese"], mitRegistry: false });
  assert.equal(r.befehl, `${o}\\versions\\2026.10.22-27dcf5f\\node.exe`);
  assert.deepEqual(r.vorne, [`${o}\\versions\\2026.10.22-27dcf5f\\index.js`]);
  const raus = findeIn(["cursor-agent"], { env, home: "C:\\Users\\g", plattform: "win32", gibt: (p) => da.has(p), lies, realpath: (x) => (x.endsWith("node.exe") ? "C:\\Windows\\node.exe" : x), cursorListe: () => ["2026.10.22-27dcf5f"], mitRegistry: false });
  assert.equal(raus, null);
});
