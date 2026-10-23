// KI-Anbieter per Klick hinzufügen (Entwurf 1.0, freigegeben von Gerhard 2026-10-23 „Entwurf 1.0 frei“):
// Installieren (falls nötig) → offizielle Anmeldung (Browser bzw. eigenes Fenster) → Kopplung prüfen.
// SICHERHEIT: Was installiert und gestartet wird, steht NUR hier im Programm (fester Katalog) – nie ein Befehl aus der Datenbank.
// Passwörter gibt die Person nur beim Anbieter ein; die Codeschmiede sieht und speichert keine Zugangsdaten.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// art: "browser" = eigener Anmelde-Befehl öffnet den Browser (Ende mit Code 0 = angemeldet); "fenster" = Anmeldung beim ersten Start im Eingabefenster
// install: { npm } = offizielles npm-Paket; { skript: { win, unix } } = offizielles Installationsskript; { seite } = Installer-Seite im Browser öffnen
export const KATALOG = {
  codex: { name: "ChatGPT (Codex)", programme: ["codex"], install: { npm: "@openai/codex" }, art: "browser", login: ["login"],
    status: { args: ["login", "status"], ok: /logged in/i, nein: /api key|not logged/i } },
  gemini: { name: "Gemini CLI", programme: ["gemini"], install: { npm: "@google/gemini-cli" }, art: "fenster", login: [],
    status: { datei: [".gemini", "oauth_creds.json"] } },
  copilot: { name: "GitHub Copilot", programme: ["copilot"], install: { npm: "@github/copilot" }, art: "browser", login: ["login"] },
  opencode: { name: "OpenCode", programme: ["opencode"], install: { npm: "opencode-ai" }, art: "fenster", login: ["auth", "login"],
    status: { args: ["auth", "list"], ok: /\b(oauth|api)\b/i } },
  "cursor-agent": { name: "Cursor", programme: ["cursor-agent", "agent"], art: "browser", login: ["login"],
    install: { skript: { win: "irm 'https://cursor.com/install?win32=true' | iex", unix: "curl https://cursor.com/install -fsS | bash" } },
    status: { args: ["status"], ok: /logged in|authenticated|signed in/i, nein: /not (logged|authenticated|signed)/i } },
  grok: { name: "Grok Build", programme: ["grok"], install: { seite: "https://x.ai/cli" }, art: "browser", login: ["login"] },
  agy: { name: "Google Antigravity", programme: ["agy"], install: { seite: "https://antigravity.google/" }, art: "fenster", login: [] },
  vibe: { name: "Mistral Vibe", programme: ["vibe"], install: { seite: "https://docs.mistral.ai/vibe/code/cli/" }, art: "fenster", login: ["--setup"] },
};

/** Katalog-Eintrag zu einem Programmnamen (eingebaut: codex/gemini, eigene Anbieter: ws_ki_anbieter.programm). */
export function katalogFuer(programm) {
  if (typeof programm !== "string") return null;
  if (Object.hasOwn(KATALOG, programm)) return { id: programm, ...KATALOG[programm] };
  for (const [id, k] of Object.entries(KATALOG)) if (k.programme.includes(programm)) return { id, ...k };
  return null;
}

/** Was „Hinzufügen“ installieren würde (für die Anzeige auf der Karte). */
export function installText(k, plattform = process.platform) {
  if (!k?.install) return null;
  if (k.install.npm) return `npm install -g ${k.install.npm}`;
  if (k.install.skript) return plattform === "win32" ? k.install.skript.win : k.install.skript.unix;
  return `Installer-Seite öffnen: ${k.install.seite}`;
}

const SICHERER_PFAD = /^[A-Za-z0-9 _.:\\/()+-]+$/;   // Pfade, die gefahrlos in ein Fenster übergeben werden können

/** Programm suchen: PATH (nur absolute Ordner) plus die üblichen Ordner der Installer (~/.local/bin, npm global). */
export function findeKatalogProgramm(k, { env = process.env, home = os.homedir(), plattform = process.platform, gibt = existsSync } = {}) {
  const trenner = plattform === "win32" ? ";" : ":";
  const extra = plattform === "win32"
    ? [path.join(env.APPDATA || path.join(home, "AppData", "Roaming"), "npm"), path.join(home, ".local", "bin"), path.join(env.LOCALAPPDATA || path.join(home, "AppData", "Local"), "cursor-agent")]
    : [path.join(home, ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin"];
  const ordner = [...(env.PATH || "").split(trenner), ...extra].filter((o) => o && path.isAbsolute(o));
  for (const name of k.programme) {
    for (const o of ordner) {
      if (plattform !== "win32") { const p = path.join(o, name); if (gibt(p)) return { befehl: p, vorne: [], pfad: p }; continue; }
      const exe = path.join(o, `${name}.exe`); if (gibt(exe)) return { befehl: exe, vorne: [], pfad: exe };
      const cmd = path.join(o, `${name}.cmd`);
      if (gibt(cmd)) {
        // npm-Kurzbefehl: darin steht das Skript – direkt mit Node starten (ohne Shell)
        try { const m = /"%~?dp0%?\\([^"%]+\.(?:js|mjs|cjs))"/i.exec(readFileSync(cmd, "utf8")); if (m) { const js = path.join(o, m[1]); if (gibt(js)) return { befehl: process.execPath, vorne: [js], pfad: cmd }; } } catch { /* weiter */ }
      }
    }
  }
  return null;
}

/** npm finden (ohne Shell): npm-cli.js neben Node bzw. im globalen Ordner. */
export function findeNpm({ gibt = existsSync } = {}) {
  const basis = path.dirname(process.execPath);
  const kandidaten = [path.join(basis, "node_modules", "npm", "bin", "npm-cli.js"), path.join(basis, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
    "/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js", "/usr/local/lib/node_modules/npm/bin/npm-cli.js", "/usr/lib/node_modules/npm/bin/npm-cli.js"];
  const js = kandidaten.find((p) => gibt(p));
  return js ? { befehl: process.execPath, vorne: [js] } : null;
}

function starte(befehl, args, { minuten = 10, env, beiAusgabe } = {}) {
  return new Promise((fertig) => {
    const kind = spawn(befehl, args, { cwd: os.tmpdir(), env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let text = "";
    const uhr = setTimeout(() => { try { kind.kill(); } catch { /* weg */ } }, minuten * 60 * 1000);
    const lies = (d) => { text = (text + d.toString()).slice(-20000); beiAusgabe?.(text); };
    kind.stdout.on("data", lies); kind.stderr.on("data", lies);
    kind.on("error", (e) => { clearTimeout(uhr); fertig({ code: -1, text: `${text}\n${e.message}` }); });
    kind.on("close", (code) => { clearTimeout(uhr); fertig({ code, text }); });
  });
}

/** Einmal-Code aus der Anmeldung (z. B. GitHub „ABCD-1234“) und die Anmeldeseite herausfischen. */
export function anmeldeDaten(text) {
  const code = /\b([A-Z0-9]{4}-[A-Z0-9]{4})\b/.exec(text || "")?.[1] || null;
  const url = /(https:\/\/(?:github\.com\/login\/device|[a-z0-9.-]*(?:cursor\.com|x\.ai|openai\.com|chatgpt\.com)\/[^\s"'<>]*))/i.exec(text || "")?.[1] || null;
  return { code, url };
}

/** Seite im Standard-Browser öffnen (nur feste https-Adressen aus dem Katalog bzw. der Anmeldung). */
export function oeffneSeite(url) {
  if (!/^https:\/\/[A-Za-z0-9.-]+(\/[^\s"'<>]*)?$/.test(url)) return false;
  const [b, a] = process.platform === "win32" ? ["rundll32.exe", ["url.dll,FileProtocolHandler", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try { spawn(b, a, { detached: true, stdio: "ignore", shell: false }).unref(); return true; } catch { return false; }
}

/** Programm in einem sichtbaren Fenster starten (Anmeldung beim ersten Start). */
export function imFenster(prog, args) {
  const pfad = prog.pfad || prog.befehl;
  if (!SICHERER_PFAD.test(pfad) || !args.every((x) => /^[A-Za-z0-9-]+$/.test(x))) return false;
  try {
    if (process.platform === "win32") {
      spawn("cmd.exe", ["/c", "start", "Codeschmiede – Anmeldung", "cmd.exe", "/k", pfad, ...args], { detached: true, stdio: "ignore", shell: false, windowsHide: false }).unref();
    } else if (process.platform === "darwin") {
      const befehl = [pfad, ...args].map((x) => `'${x}'`).join(" ");
      spawn("osascript", ["-e", `tell application "Terminal" to do script "${befehl}"`, "-e", "tell application \"Terminal\" to activate"], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("x-terminal-emulator", ["-e", pfad, ...args], { detached: true, stdio: "ignore" }).unref();
    }
    return true;
  } catch { return false; }
}

/** Ist die Person angemeldet? true / false / null (= lässt sich ohne Aufruf nicht feststellen). */
export async function angemeldet(k, prog, { env, home = os.homedir() } = {}) {
  const s = k.status;
  if (!s) return null;
  if (s.datei) return existsSync(path.join(home, ...s.datei));
  const r = await starte(prog.befehl, [...prog.vorne, ...s.args], { minuten: 1, env });
  if (s.nein && s.nein.test(r.text)) return false;
  return r.code === 0 && s.ok.test(r.text);
}

/**
 * Ganzer Ablauf. melde({ schritt, hinweis, code }) meldet den Fortschritt an die Oberfläche.
 * schritt: installieren | anmelden | pruefen | fertig | fehler
 */
export async function einrichten(k, { melde, env, plattform = process.platform } = {}) {
  let prog = findeKatalogProgramm(k);
  if (!prog) {
    if (k.install?.npm) {
      const npm = findeNpm();
      if (!npm) return melde({ schritt: "fehler", hinweis: "npm wurde nicht gefunden – bitte Node.js installieren (Einrichtung)." });
      await melde({ schritt: "installieren", hinweis: `Installiere ${k.install.npm} …` });
      const r = await starte(npm.befehl, [...npm.vorne, "install", "-g", "--no-fund", "--no-audit", k.install.npm], { minuten: 10, env });
      if (r.code !== 0) return melde({ schritt: "fehler", hinweis: /EACCES|permission/i.test(r.text) ? "Keine Schreibrechte für globale npm-Pakete – bitte npm so einrichten, dass es ohne Administrator installiert (Einrichtung)." : `Installation fehlgeschlagen: ${r.text.trim().split("\n").slice(-2).join(" ").slice(0, 300)}` });
    } else if (k.install?.skript) {
      await melde({ schritt: "installieren", hinweis: "Offizielle Installation läuft …" });
      const r = plattform === "win32"
        ? await starte("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", k.install.skript.win], { minuten: 10, env })
        : await starte("/bin/bash", ["-c", k.install.skript.unix], { minuten: 10, env });
      if (r.code !== 0) return melde({ schritt: "fehler", hinweis: `Installation fehlgeschlagen: ${r.text.trim().split("\n").slice(-2).join(" ").slice(0, 300)}` });
    } else if (k.install?.seite) {
      oeffneSeite(k.install.seite);
      await melde({ schritt: "installieren", hinweis: "Die Installer-Seite ist im Browser offen. Installiere das Programm – danach geht es von selbst weiter." });
      for (let i = 0; i < 60 && !prog; i++) { await new Promise((w) => setTimeout(w, 10000)); prog = findeKatalogProgramm(k); }
      if (!prog) return melde({ schritt: "fehler", hinweis: "Nach 10 Minuten noch nicht installiert – nach der Installation einfach nochmal „Hinzufügen“ klicken." });
    }
    prog = prog || findeKatalogProgramm(k);
    if (!prog) return melde({ schritt: "fehler", hinweis: "Installiert, aber das Programm wird nicht gefunden – bitte das Codeschmiede-Programm neu starten und nochmal versuchen." });
  }
  // Schon angemeldet? Dann nichts öffnen.
  if ((await angemeldet(k, prog, { env }).catch(() => null)) === true) return melde({ schritt: "fertig", hinweis: "Angemeldet und gekoppelt" });
  if (k.art === "browser") {
    await melde({ schritt: "anmelden", hinweis: "Die Anmeldung ist im Browser offen – melde dich dort mit deinem Konto an." });
    let gemeldet = "";
    const r = await starte(prog.befehl, [...prog.vorne, ...k.login], { minuten: 10, env, beiAusgabe: (t) => {
      const { code, url } = anmeldeDaten(t);
      const neu = `${code || ""}|${url || ""}`;
      if ((code || url) && neu !== gemeldet) { gemeldet = neu; if (url && code) oeffneSeite(url); melde({ schritt: "anmelden", code, hinweis: code ? `Gib auf ${url || "der Anmeldeseite"} diesen Code ein.` : "Die Anmeldung ist im Browser offen – melde dich dort an." }); }
    } });
    if (r.code !== 0) return melde({ schritt: "fehler", hinweis: "Anmeldung nicht abgeschlossen (abgebrochen oder nach 10 Minuten ohne Abschluss) – nochmal „Hinzufügen“ klicken." });
  } else {
    if (!imFenster(prog, k.login)) return melde({ schritt: "fehler", hinweis: "Das Anmeldefenster ließ sich nicht öffnen – bitte das Programm einmal selbst starten und anmelden." });
    await melde({ schritt: "anmelden", hinweis: "Ein Fenster mit dem Programm ist offen – melde dich dort an und schließe es danach." });
    const bis = Date.now() + 10 * 60 * 1000; let ok = null;
    while (Date.now() < bis) {
      await new Promise((w) => setTimeout(w, 8000));
      ok = await angemeldet(k, prog, { env }).catch(() => null);
      if (ok !== false) break;   // true = angemeldet; null = nicht feststellbar → Person bestätigt in der Oberfläche
    }
    if (ok === null) return melde({ schritt: "bestaetigen", hinweis: "Wenn du dich im Fenster angemeldet hast, klicke „Ich bin angemeldet“." });
    if (!ok) return melde({ schritt: "fehler", hinweis: "Nach 10 Minuten keine Anmeldung gefunden – nochmal „Hinzufügen“ klicken." });
  }
  await melde({ schritt: "pruefen", hinweis: "Kopplung wird geprüft …" });
  const ok = await angemeldet(k, prog, { env }).catch(() => null);
  if (ok === false) return melde({ schritt: "fehler", hinweis: "Die Anmeldung wurde nicht gefunden – nochmal „Hinzufügen“ klicken." });
  return melde({ schritt: "fertig", hinweis: "Angemeldet und gekoppelt" });
}
