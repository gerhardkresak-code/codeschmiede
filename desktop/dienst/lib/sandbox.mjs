// Betriebssystem-Sandbox für fremde KI-Programme (ChatGPT/Codex, Gemini) – Nachprüfung 2026-10-23, Gerhard 15:53 „Punkt 1 fertig machen“.
// Ziel: Das fremde Programm sieht vom PC nur seinen leeren Arbeitsordner, sein eigenes Programmverzeichnis und eine KOPIE seiner
// Anmeldedaten – nicht das Benutzerverzeichnis (Projekte, GitHub-/Claude-/Supabase-Zugänge, SSH-Schlüssel), nicht den Schlüsselbund.
//   macOS: sandbox-exec mit Profil (Benutzerverzeichnis + Temp gesperrt, Programmstarts nur node/Anbieter, kein Schlüsselbund)
//   Linux: bubblewrap (bwrap) mit leerem Dateisystem und nur den nötigen Ordnern (vorher einmal getestet)
//   Windows: keine eingebaute Sandbox ohne eigenes Windows-Konto → nicht verfügbar; dort prüft weiterhin nur Claude.
// Prüfung 0.8.0 (A1–A4): Rückkopie der Anmeldung nur als echte, kleine Datei ohne Symlink; Freigaben nie das Benutzerverzeichnis
// oder darüber; macOS ohne Schlüsselbund/fremde Programme/Temp; bwrap mit Namensauflösung und Selbsttest.
import { constants, existsSync, realpathSync } from "node:fs";
import { copyFile, lstat, mkdir, open, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const imPfad = (name) => (process.env.PATH || "").split(path.delimiter).filter(Boolean).map((o) => path.join(o, name)).find((p) => existsSync(p)) || null;

let bwrapOk = null;
/** bwrap startet auf manchen Systemen nicht (z. B. Ubuntu 24.04 sperrt Namensräume) – einmal ausprobieren statt still zu scheitern. */
function bwrapLaeuft() {
  if (bwrapOk !== null) return bwrapOk;
  const b = imPfad("bwrap");
  if (!b) return (bwrapOk = false);
  try {
    const r = spawnSync(b, ["--die-with-parent", "--unshare-all", "--ro-bind", "/", "/", "--", "/bin/true"], { timeout: 4000, stdio: "ignore" });
    bwrapOk = r.status === 0;
  } catch { bwrapOk = false; }
  return bwrapOk;
}

/** Welche Sandbox gibt es auf diesem PC? "macos" | "linux" | null */
export function sandboxArt() {
  if (process.platform === "darwin" && existsSync("/usr/bin/sandbox-exec")) return "macos";
  if (process.platform === "linux" && bwrapLaeuft()) return "linux";
  return null;
}

const echt = (p) => { try { return realpathSync(p); } catch { return p; } };
const sb = (p) => String(p).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/** Liegt das Benutzerverzeichnis in p (oder ist p = Benutzerverzeichnis / Wurzel)? Dann wäre die Freigabe zu weit (Prüfung A2). */
export function zuWeit(p, home = os.homedir()) {
  if (!p) return false;
  const r = path.relative(echt(p), echt(home));
  return r === "" || (r !== ".." && !r.startsWith(`..${path.sep}`) && !path.isAbsolute(r));
}

/** macOS-Profil: Benutzerverzeichnis und Temp gesperrt außer den freigegebenen Ordnern; Programmstarts nur aus den Freigaben; kein Schlüsselbund. */
/** Alle Elternordner eines Pfads (für file-read-metadata: node löst Pfade stufenweise auf, Nachprüfung 0.8.0 M6). */
function eltern(p) { const r = []; let d = path.dirname(p); while (d && d !== path.dirname(d)) { r.push(d); d = path.dirname(d); } return r; }

export function macProfil({ home, frei = [], schreibbar = [], temp = os.tmpdir(), starten = frei }) {
  const h = sb(echt(home));
  // Temp: auch der Elternordner (/var/folders/xx/yyy mit C = Caches anderer Programme) ist gesperrt
  const t = sb(path.dirname(echt(temp)));
  const meta = [...new Set([...frei, ...schreibbar].flatMap((p) => eltern(echt(p))))];
  return [
    "(version 1)", "(allow default)",
    // Schreiben überall gesperrt – sonst könnte ein fremdes Programm z. B. /opt/homebrew/bin/git austauschen (Nachprüfung 0.8.0 M4)
    `(deny file-write* (subpath "/"))`,
    `(allow file-write* (literal "/dev/null") (literal "/dev/zero") (literal "/dev/tty") (literal "/dev/dtracehelper") (regex #"^/dev/fd/") (regex #"^/dev/ttys[0-9]+$"))`,
    `(deny file-read* (subpath "${h}"))`,
    `(deny file-read* (subpath "${t}"))`,
    `(deny file-read* (subpath "/Volumes"))`, `(deny file-read* (subpath "/Users/Shared"))`,
    `(allow file-read-metadata (literal "${h}"))`,
    ...meta.map((p) => `(allow file-read-metadata (literal "${sb(p)}"))`),
    // Schlüsselbund (dort liegen Claude-/GitHub-Zugänge) und fremde Programme gesperrt (Prüfung A3)
    `(deny mach-lookup (global-name "com.apple.SecurityServer") (global-name "com.apple.securityd") (global-name "com.apple.security.agent"))`,
    "(deny process-exec)",
    ...starten.map((p) => `(allow process-exec (subpath "${sb(echt(p))}"))`),
    ...frei.map((p) => `(allow file-read* (subpath "${sb(echt(p))}"))`),
    ...schreibbar.map((p) => `(allow file-read* file-write* (subpath "${sb(echt(p))}"))`),
  ].join("\n");
}

/** Linux-Aufruf für bwrap: nur Systemordner (nur lesen), Programmordner, Arbeitsordner und Anmelde-Kopie. */
export function bwrapArgs({ frei = [], schreibbar = [], arbeit, home }) {
  const a = ["--die-with-parent", "--unshare-all", "--share-net", "--new-session", "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp"];
  // /run/systemd/resolve: dorthin zeigt /etc/resolv.conf unter Ubuntu (Prüfung A4)
  for (const p of ["/usr", "/bin", "/lib", "/lib64", "/etc", "/sbin", "/opt", "/run/systemd/resolve"]) a.push("--ro-bind-try", p, p);
  for (const p of frei) a.push("--ro-bind-try", echt(p), echt(p));
  for (const p of schreibbar) a.push("--bind", echt(p), echt(p));
  a.push("--setenv", "HOME", home, "--setenv", "TMPDIR", "/tmp", "--chdir", arbeit);
  return a;
}

/**
 * Liest eine Datei, die ein fremdes Programm im Arbeitsordner geschrieben hat – sicher (Prüfung A1):
 * nur eine echte Datei (kein Symlink, kein Hardlink) innerhalb des Arbeitsordners, höchstens max Bytes.
 * Liefert den Inhalt als Buffer oder null.
 */
export async function sicherLesen(datei, arbeit, max = 64 * 1024) {
  try {
    const basis = await realpath(arbeit);
    const rel = path.relative(path.resolve(arbeit), path.resolve(datei));
    if (!rel || rel.startsWith(`..${path.sep}`) || rel === ".." || path.isAbsolute(rel)) return null;
    // Jede Stufe vom Arbeitsordner bis zur Datei: echter Ordner, kein Symlink – vor UND nach dem Öffnen gleich (Nachprüfung 0.8.0 M5)
    const stufen = rel.split(path.sep).slice(0, -1).reduce((a, t) => [...a, path.join(a.length ? a[a.length - 1] : basis, t)], []);
    const kette = async () => { const r = []; for (const o of stufen) { const l = await lstat(o); if (!l.isDirectory() || l.isSymbolicLink()) return null; r.push(`${l.dev}:${l.ino}`); } return r.join("|"); };
    const vorher = await kette(); if (vorher === null) return null;
    const ziel = path.join(basis, rel);
    const l = await lstat(ziel);
    if (!l.isFile() || l.isSymbolicLink() || l.nlink !== 1 || l.size > max) return null;
    const fh = await open(ziel, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const s = await fh.stat();
      if (!s.isFile() || s.nlink !== 1 || s.size > max || s.ino !== l.ino || s.dev !== l.dev) return null;
      const b = Buffer.alloc(s.size); await fh.read(b, 0, s.size, 0);
      if ((await kette()) !== vorher) return null;
      const l2 = await lstat(ziel); if (l2.ino !== s.ino || l2.dev !== s.dev) return null;
      return b;
    } finally { await fh.close(); }
  } catch { return null; }
}

// Erwarteter Aufbau der Anmeldedateien – zurück geht nur, was dazu passt, und nur diese Felder (Nachprüfung 0.8.0 M5)
const KURZ = (v) => v == null || typeof v === "number" || typeof v === "boolean" || (typeof v === "string" && v.length <= 8192);
const AUFBAU = {
  "auth.json": (j) => {
    const o = {}; let ok = false;
    for (const k of ["OPENAI_API_KEY", "last_refresh", "auth_mode"]) if (k in j) { if (!KURZ(j[k])) return null; o[k] = j[k]; }
    if (j.tokens != null) {
      if (typeof j.tokens !== "object" || Array.isArray(j.tokens)) return null;
      o.tokens = {}; for (const k of ["id_token", "access_token", "refresh_token", "account_id"]) if (k in j.tokens) { if (!KURZ(j.tokens[k])) return null; o.tokens[k] = j.tokens[k]; ok = true; }
    }
    return ok || typeof o.OPENAI_API_KEY === "string" ? o : null;
  },
  "oauth_creds.json": (j) => {
    const o = {}; for (const k of ["access_token", "refresh_token", "scope", "token_type", "id_token", "expiry_date"]) if (k in j) { if (!KURZ(j[k])) return null; o[k] = j[k]; }
    return typeof o.refresh_token === "string" || typeof o.access_token === "string" ? o : null;
  },
  "google_accounts.json": (j) => {
    const o = {}; if ("active" in j) { if (!KURZ(j.active)) return null; o.active = j.active; }
    if ("old" in j) { if (!Array.isArray(j.old) || j.old.length > 20 || !j.old.every((x) => typeof x === "string" && x.length <= 320)) return null; o.old = j.old; }
    return o;
  },
};
/** Prüft eine zurückgeschriebene Anmeldedatei; liefert den bereinigten Inhalt oder null. */
export function anmeldungBereinigen(name, buf, original = null) {
  const s = buf.toString("utf8");
  if (name === "installation_id") return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\s*$/i.test(s) ? Buffer.from(s) : null;   // UUID
  const f = AUFBAU[name]; if (!f) return null;
  try { const j = JSON.parse(s); if (!j || typeof j !== "object" || Array.isArray(j)) return null; const o = f(j); if (!o) return null;
    // Einen API-Schlüssel nur behalten, wenn schon vorher einer drinstand (sonst könnte ein Programm die Anmeldung umstellen, Nachprüfung N4)
    if ("OPENAI_API_KEY" in o) { let vorher = null; try { vorher = original ? JSON.parse(original.toString("utf8")) : null; } catch { /* ohne */ } if (!vorher || !("OPENAI_API_KEY" in vorher)) delete o.OPENAI_API_KEY; }
    if (name === "auth.json" && !o.tokens && typeof o.OPENAI_API_KEY !== "string") return null;
    return Buffer.from(JSON.stringify(o, null, 2)); } catch { return null; }
}

/** Freigabe-Ordner für ein Programm: bei npm-Paketen der globale node_modules-Ordner, sonst der Ordner der Datei. */
function ordnerVon(pfad) {
  if (!pfad) return null;
  const nm = pfad.lastIndexOf(`${path.sep}node_modules${path.sep}`);
  return nm >= 0 ? pfad.slice(0, nm + "/node_modules".length) : path.dirname(pfad);
}

/**
 * Bereitet einen Sandbox-Lauf vor. anbieter: "chatgpt" | "gemini".
 * Liefert { befehl, vorne, env, nachher } oder null, wenn keine (sichere) Sandbox möglich ist – dann prüft Claude.
 * - Codex: eigener CODEX_HOME im Arbeitsordner mit Kopie von auth.json (danach geprüft zurückkopiert, falls erneuert)
 * - Gemini: eigenes HOME im Arbeitsordner mit Kopie der Anmeldung, danach geprüft zurück
 */
export async function sandboxLauf({ anbieter, prog, arbeit, env }) {
  const art = sandboxArt();
  if (!art) return null;
  const home = os.homedir();
  const pfad = prog.vorne.length ? echt(prog.vorne[0]) : (imPfad(prog.befehl) ? echt(imPfad(prog.befehl)) : null);
  if (!pfad) return null;
  const progOrdner = ordnerVon(pfad);
  const nodeOrdner = path.dirname(path.dirname(echt(process.execPath)));
  // Direkt starten (ohne /usr/bin/env aus der Shebang-Zeile): Node-Skripte mit dem eigenen node, sonst die echte Datei
  let start = { befehl: pfad, vorne: [] };
  if (prog.vorne.length) start = { befehl: echt(prog.befehl), vorne: [pfad, ...prog.vorne.slice(1)] };
  else { try { const k = (await readFile(pfad)).subarray(0, 128).toString("utf8"); if (/^#!.*\bnode\b/.test(k)) start = { befehl: echt(process.execPath), vorne: [pfad] }; } catch { return null; } }
  // Zertifikate (Firmen-Proxy) nur als einzelne Datei freigeben
  const zert = [process.env.NODE_EXTRA_CA_CERTS, process.env.SSL_CERT_FILE].filter((p) => p && existsSync(p)).map(echt);
  const frei = [...new Set([progOrdner, nodeOrdner, ordnerVon(start.befehl)].filter(Boolean))];
  if ([...frei, arbeit].some((p) => zuWeit(p, home) || p === "/") || frei.some((p) => zuWeit(p, os.tmpdir()))) return null;   // Prüfung A2: lieber keine Sandbox als eine offene
  const kiHome = path.join(arbeit, "home"); await mkdir(kiHome, { recursive: true });
  const kiTemp = path.join(arbeit, "tmp"); await mkdir(kiTemp, { recursive: true });
  const nachher = [];
  const neueEnv = { ...env, HOME: kiHome, USERPROFILE: kiHome, XDG_CONFIG_HOME: path.join(kiHome, ".config"), XDG_CACHE_HOME: path.join(kiHome, ".cache"),
    TMPDIR: art === "linux" ? "/tmp" : kiTemp, TMP: kiTemp, TEMP: kiTemp };
  for (const k of ["NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE"]) if (process.env[k] && existsSync(process.env[k])) neueEnv[k] = echt(process.env[k]);
  const kopiere = async (von, nach) => { if (existsSync(von)) { await mkdir(path.dirname(nach), { recursive: true }); await copyFile(von, nach); return true; } return false; };
  // Zurück nur, was sich wie die erwartete Anmeldedatei verhält (JSON bzw. kurze Kennung) – nie einem Symlink folgen (Prüfung A1)
  const zurueck = (von, nach) => nachher.push(async () => {
    try {
      const roh = await sicherLesen(von, arbeit); if (!roh) return;
      let alt = null; try { alt = await readFile(nach); } catch { /* neu */ }
      if (alt && alt.equals(roh)) return;                   // unverändert
      const b = anmeldungBereinigen(path.basename(nach), roh, alt); if (!b) return;
      const tmp = `${nach}.cs-${process.pid}`;
      await writeFile(tmp, b, { mode: 0o600, flag: "wx" }); await rename(tmp, nach);
    } catch { /* bleibt wie es war */ }
  });
  if (anbieter === "chatgpt") {
    const quelle = env.CODEX_HOME || path.join(home, ".codex");
    const ziel = path.join(kiHome, ".codex");
    if (await kopiere(path.join(quelle, "auth.json"), path.join(ziel, "auth.json"))) zurueck(path.join(ziel, "auth.json"), path.join(quelle, "auth.json"));
    await mkdir(ziel, { recursive: true });
    await writeFile(path.join(ziel, "config.toml"), '# Codeschmiede-Sandbox: keine MCP-Server; Anmeldung nur aus der Datei (kein Schlüsselbund)\ncli_auth_credentials_store = "file"\n');
    neueEnv.CODEX_HOME = ziel;
  } else if (anbieter === "gemini") {
    const quelle = path.join(home, ".gemini"); const ziel = path.join(kiHome, ".gemini");
    for (const f of ["oauth_creds.json", "google_accounts.json", "installation_id"]) {
      if (await kopiere(path.join(quelle, f), path.join(ziel, f))) zurueck(path.join(ziel, f), path.join(quelle, f));
    }
    // Nur das Nötigste aus den Einstellungen übernehmen (Art der Anmeldung), keine MCP-Server/Werkzeuge der Person
    try {
      const s = JSON.parse(await readFile(path.join(quelle, "settings.json"), "utf8"));
      const auth = s?.security?.auth || (s?.selectedAuthType ? { selectedType: s.selectedAuthType } : null);
      await mkdir(ziel, { recursive: true });
      await writeFile(path.join(ziel, "settings.json"), JSON.stringify(auth ? { security: { auth }, selectedAuthType: auth.selectedType } : {}));
    } catch { /* ohne Einstellungen */ }
  }
  if (art === "macos") {
    const profil = macProfil({ home, frei: [...frei, ...zert], schreibbar: [arbeit], temp: os.tmpdir(), starten: frei });
    return { befehl: "/usr/bin/sandbox-exec", vorne: ["-p", profil, start.befehl, ...start.vorne], env: neueEnv, nachher, art };
  }
  const args = bwrapArgs({ frei: [...frei, ...zert], schreibbar: [arbeit], arbeit, home: kiHome });
  return { befehl: imPfad("bwrap"), vorne: [...args, "--", start.befehl, ...start.vorne], env: neueEnv, nachher, art };
}
