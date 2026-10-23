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
  return r === "" || (!r.startsWith("..") && !path.isAbsolute(r));
}

/** macOS-Profil: Benutzerverzeichnis und Temp gesperrt außer den freigegebenen Ordnern; Programmstarts nur aus den Freigaben; kein Schlüsselbund. */
export function macProfil({ home, frei = [], schreibbar = [], temp = os.tmpdir(), starten = frei }) {
  const h = sb(echt(home)); const t = sb(echt(temp));
  return [
    "(version 1)", "(allow default)",
    `(deny file-read* (subpath "${h}"))`, `(deny file-write* (subpath "${h}"))`,
    `(deny file-read* (subpath "${t}"))`, `(deny file-write* (subpath "${t}"))`,
    `(deny file-read* (subpath "/Volumes"))`, `(deny file-read* (subpath "/Users/Shared"))`,
    `(allow file-read-metadata (literal "${h}"))`,
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
    const ordner = await realpath(path.dirname(datei));
    const basis = await realpath(arbeit);
    if (ordner !== basis && !ordner.startsWith(basis + path.sep)) return null;
    const l = await lstat(datei);
    if (!l.isFile() || l.isSymbolicLink() || l.nlink !== 1 || l.size > max) return null;
    const fh = await open(path.join(ordner, path.basename(datei)), constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const s = await fh.stat();
      if (!s.isFile() || s.nlink !== 1 || s.size > max || s.ino !== l.ino) return null;
      const b = Buffer.alloc(s.size); await fh.read(b, 0, s.size, 0);
      return b;
    } finally { await fh.close(); }
  } catch { return null; }
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
  if ([...frei, arbeit].some((p) => zuWeit(p, home) || p === "/")) return null;   // Prüfung A2: lieber keine Sandbox als eine offene
  const kiHome = path.join(arbeit, "home"); await mkdir(kiHome, { recursive: true });
  const kiTemp = path.join(arbeit, "tmp"); await mkdir(kiTemp, { recursive: true });
  const nachher = [];
  const neueEnv = { ...env, HOME: kiHome, USERPROFILE: kiHome, XDG_CONFIG_HOME: path.join(kiHome, ".config"), XDG_CACHE_HOME: path.join(kiHome, ".cache"),
    TMPDIR: art === "linux" ? "/tmp" : kiTemp, TMP: kiTemp, TEMP: kiTemp };
  for (const k of ["NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE"]) if (process.env[k] && existsSync(process.env[k])) neueEnv[k] = echt(process.env[k]);
  const kopiere = async (von, nach) => { if (existsSync(von)) { await mkdir(path.dirname(nach), { recursive: true }); await copyFile(von, nach); return true; } return false; };
  // Zurück nur, was sich wie die erwartete Anmeldedatei verhält (JSON bzw. kurze Kennung) – nie einem Symlink folgen (Prüfung A1)
  const zurueck = (von, nach, art2 = "json") => nachher.push(async () => {
    try {
      const b = await sicherLesen(von, arbeit); if (!b) return;
      const s = b.toString("utf8");
      if (art2 === "json") { const j = JSON.parse(s); if (!j || typeof j !== "object") return; }
      else if (!/^[A-Za-z0-9-]{8,80}\s*$/.test(s)) return;
      let alt = null; try { alt = await readFile(nach); } catch { /* neu */ }
      if (alt && alt.equals(b)) return;
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
    for (const [f, a2] of [["oauth_creds.json", "json"], ["google_accounts.json", "json"], ["installation_id", "id"]]) {
      if (await kopiere(path.join(quelle, f), path.join(ziel, f))) zurueck(path.join(ziel, f), path.join(quelle, f), a2);
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
