// Betriebssystem-Sandbox für fremde KI-Programme (ChatGPT/Codex, Gemini) – Nachprüfung 2026-10-23, Gerhard 15:53 „Punkt 1 fertig machen“.
// Ziel: Das fremde Programm sieht vom PC nur seinen leeren Arbeitsordner, sein eigenes Programmverzeichnis und eine KOPIE seiner
// Anmeldedaten – nicht das Benutzerverzeichnis (Projekte, GitHub-/Claude-/Supabase-Zugänge, SSH-Schlüssel).
//   macOS: sandbox-exec mit Profil (Lesen/Schreiben im Benutzerverzeichnis gesperrt, nur Ausnahmen)
//   Linux: bubblewrap (bwrap) mit leerem Dateisystem und nur den nötigen Ordnern
//   Windows: keine eingebaute Sandbox ohne eigenes Windows-Konto → nicht verfügbar; dort prüft weiterhin nur Claude.
import { existsSync, realpathSync } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const imPfad = (name) => (process.env.PATH || "").split(path.delimiter).filter(Boolean).map((o) => path.join(o, name)).find((p) => existsSync(p)) || null;

/** Welche Sandbox gibt es auf diesem PC? "macos" | "linux" | null */
export function sandboxArt() {
  if (process.platform === "darwin" && existsSync("/usr/bin/sandbox-exec")) return "macos";
  if (process.platform === "linux" && imPfad("bwrap")) return "linux";
  return null;
}

const echt = (p) => { try { return realpathSync(p); } catch { return p; } };
const sb = (p) => String(p).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/** macOS-Profil: Benutzerverzeichnis gesperrt außer den freigegebenen Ordnern. */
export function macProfil({ home, frei = [], schreibbar = [] }) {
  const h = sb(echt(home));
  return [
    "(version 1)", "(allow default)",
    `(deny file-read* (subpath "${h}"))`, `(deny file-write* (subpath "${h}"))`,
    `(allow file-read-metadata (literal "${h}"))`,
    ...frei.map((p) => `(allow file-read* (subpath "${sb(echt(p))}"))`),
    ...schreibbar.map((p) => `(allow file-read* file-write* (subpath "${sb(echt(p))}"))`),
  ].join("\n");
}

/** Linux-Aufruf für bwrap: nur Systemordner (nur lesen), Programmordner, Arbeitsordner und Anmelde-Kopie. */
export function bwrapArgs({ frei = [], schreibbar = [], arbeit, home }) {
  const a = ["--die-with-parent", "--unshare-all", "--share-net", "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp"];
  for (const p of ["/usr", "/bin", "/lib", "/lib64", "/etc", "/sbin", "/opt"]) a.push("--ro-bind-try", p, p);
  for (const p of frei) a.push("--ro-bind-try", echt(p), echt(p));
  for (const p of schreibbar) a.push("--bind", echt(p), echt(p));
  a.push("--setenv", "HOME", home, "--chdir", arbeit);
  return a;
}

/**
 * Bereitet einen Sandbox-Lauf vor. anbieter: "chatgpt" | "gemini".
 * Liefert { befehl, vorne, env, nachher } oder null, wenn keine Sandbox verfügbar ist.
 * - Codex: eigener CODEX_HOME im Arbeitsordner mit Kopie von auth.json (danach zurückkopiert, falls erneuert)
 * - Gemini: eigenes HOME im Arbeitsordner mit Kopie von ~/.gemini (Anmeldung), danach Anmeldung zurück
 */
export async function sandboxLauf({ anbieter, prog, arbeit, env }) {
  const art = sandboxArt();
  if (!art) return null;
  const home = os.homedir();
  // Programmordner: bei npm-Paketen der ganze globale node_modules-Ordner (nur lesen), sonst der Ordner der ausführbaren Datei
  const pfad = prog.vorne.length ? echt(prog.vorne[0]) : (imPfad(prog.befehl) ? echt(imPfad(prog.befehl)) : null);
  const nm = pfad ? pfad.lastIndexOf(`${path.sep}node_modules${path.sep}`) : -1;
  const progOrdner = !pfad ? null : nm >= 0 ? pfad.slice(0, nm + "/node_modules".length) : path.dirname(pfad);
  const nodeOrdner = path.dirname(path.dirname(echt(process.execPath)));
  const kiHome = path.join(arbeit, "home"); await mkdir(kiHome, { recursive: true });
  const nachher = [];
  const neueEnv = { ...env, HOME: kiHome, USERPROFILE: kiHome, XDG_CONFIG_HOME: path.join(kiHome, ".config"), XDG_CACHE_HOME: path.join(kiHome, ".cache") };
  const kopiere = async (von, nach) => { if (existsSync(von)) { await mkdir(path.dirname(nach), { recursive: true }); await copyFile(von, nach); return true; } return false; };
  const zurueck = (von, nach) => nachher.push(async () => {
    try { const a = await stat(von); const b = existsSync(nach) ? await stat(nach) : null; if (!b || a.mtimeMs > b.mtimeMs) await copyFile(von, nach); } catch { /* bleibt */ }
  });
  if (anbieter === "chatgpt") {
    const quelle = env.CODEX_HOME || path.join(home, ".codex");
    const ziel = path.join(kiHome, ".codex");
    if (await kopiere(path.join(quelle, "auth.json"), path.join(ziel, "auth.json"))) zurueck(path.join(ziel, "auth.json"), path.join(quelle, "auth.json"));
    await writeFile(path.join(ziel, "config.toml"), "# Codeschmiede-Sandbox: keine MCP-Server, keine Hinweise an fremde Programme\n");
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
      await writeFile(path.join(ziel, "settings.json"), JSON.stringify(auth ? { security: { auth }, selectedAuthType: auth.selectedType } : {}));
    } catch { /* ohne Einstellungen */ }
  }
  const frei = [progOrdner, nodeOrdner].filter(Boolean);
  if (art === "macos") {
    const profil = macProfil({ home, frei, schreibbar: [arbeit, os.tmpdir()] });
    return { befehl: "/usr/bin/sandbox-exec", vorne: ["-p", profil, prog.befehl, ...prog.vorne], env: neueEnv, nachher, art };
  }
  const args = bwrapArgs({ frei, schreibbar: [arbeit], arbeit, home: kiHome });
  return { befehl: imPfad("bwrap"), vorne: [...args, "--", prog.befehl, ...prog.vorne], env: neueEnv, nachher, art };
}
