// Ersatz beim Programmieren (Gerhard 2026-10-23 „Nur als Ersatz“, Prüfung 0.8.6 R1/R4/O2):
// Codex arbeitet NIE im echten Auftragsordner, sondern in einer Kopie ohne .git (in der Sandbox). Danach vergleicht die Werkstatt
// Datei für Datei selbst (ohne git auf fremden Dateien), prüft die Sperrliste und übernimmt erlaubte Änderungen mit eigenen Dateizugriffen.
import { lstat, mkdir, readdir, readFile, writeFile, unlink, copyFile, realpath } from "node:fs/promises";
import { sicherLesen } from "./sandbox.mjs";
import path from "node:path";

const UEBERSPRINGEN = new Set([".git", "node_modules", "dist", "build", ".next", ".vite", "coverage"]);
const MAX_DATEIEN = 20000;
const MAX_BYTES = 200 * 1024 * 1024;

// Was ein Ersatz nie ändern darf: Abläufe, Einstellungen, Pakete/Installationsdateien, Anweisungen an KI-Prüfer, Git, Geheimnisse
const SPERRE = [/^\.github\//, /(^|\/)\.claude(\/|$)/, /(^|\/)\.codex(\/|$)/, /(^|\/)\.mcp\.json$/, /(^|\/)\.git(attributes|modules|ignore)?$/, /(^|\/)\.git\//,
  /(^|\/)package(-lock)?\.json$/, /(^|\/)npm-shrinkwrap\.json$/, /(^|\/)(yarn\.lock|pnpm-lock\.yaml|\.yarnrc(\.yml)?|\.pnpmfile\.cjs|\.npmrc)$/,
  /(^|\/)\.husky(\/|$)/, /(^|\/)\.env/, /\.(pem|key|p12)$/i, /(^|\/)(AGENTS|CLAUDE)\.md$/i];
export const gesperrt = (rel) => SPERRE.some((r) => r.test(rel.split(path.sep).join("/")));

/** Alle normalen Dateien unter basis (relativ, mit „/“), ohne Symlinks und ohne die großen Ordner. */
export async function dateien(basis, { symlinks = [] } = {}) {
  const liste = []; let bytes = 0;
  const geh = async (ordner, rel) => {
    for (const e of await readdir(ordner, { withFileTypes: true })) {
      if (UEBERSPRINGEN.has(e.name)) continue;
      const r = rel ? `${rel}/${e.name}` : e.name; const voll = path.join(ordner, e.name);
      const l = await lstat(voll);
      if (l.isSymbolicLink()) { symlinks.push(r); continue; }
      if (l.isDirectory()) { await geh(voll, r); continue; }
      if (!l.isFile()) continue;
      bytes += l.size; liste.push(r);
      if (liste.length > MAX_DATEIEN || bytes > MAX_BYTES) throw new Error("Projekt zu groß für den Ersatz");
    }
  };
  await geh(basis, "");
  return liste;
}

/** Auftragsordner in eine leere Kopie übertragen (ohne .git, node_modules, Build-Ordner, Symlinks). */
export async function kopiereProjekt(quelle, ziel) {
  // Geheimnisse (z. B. eine lokale .env) bekommt der Ersatz nicht zu sehen
  const liste = (await dateien(quelle)).filter((r) => !/(^|\/)\.env/.test(r) && !/\.(pem|key|p12)$/i.test(r));
  for (const r of liste) { const z = path.join(ziel, ...r.split("/")); await mkdir(path.dirname(z), { recursive: true }); await copyFile(path.join(quelle, ...r.split("/")), z); }
  return liste;
}

/** Was hat Codex in der Kopie geändert? Die Kopie ist fremd: Verknüpfungen und harte Links gelten als verbotene Änderung. */
export async function vergleiche(quelle, kopie, original) {
  const symlinks = [];
  const jetzt = await dateien(kopie, { symlinks });
  const vorher = new Set(original);
  const geaendert = [];
  for (const r of jetzt) {
    // Fremde Kopie: nur sicher lesen (kein Symlink, kein harter Link, Ordnerkette vor/nach dem Öffnen gleich – Prüfung 0.8.6 N1)
    const neu = await sicherLesen(path.join(kopie, ...r.split("/")), kopie, 20 * 1024 * 1024);
    if (!neu) { symlinks.push(r); continue; }
    if (vorher.has(r)) { const alt = await readFile(path.join(quelle, ...r.split("/"))); if (!alt.equals(neu)) geaendert.push({ r, neu }); }
    else geaendert.push({ r, neu });
  }
  const da = new Set(jetzt);
  const geloescht = original.filter((r) => !da.has(r));
  return { geaendert, geloescht, symlinks };
}

/** Erlaubte Änderungen in den echten Auftragsordner schreiben. Gesperrtes → Fehler (nichts wird übernommen). */
// Jede Stufe vom Auftragsordner bis zum Ziel muss ein echter Ordner sein (kein Symlink) – sonst ginge Schreiben/Löschen nach draußen (Prüfung 0.8.6 N2)
async function zielSicher(quelle, r) {
  const basis = path.resolve(quelle); let o = basis;
  const teile = r.split("/");
  for (const t of teile.slice(0, -1)) {
    o = path.join(o, t);
    try { const l = await lstat(o); if (l.isSymbolicLink() || !l.isDirectory()) return null; } catch { break; }   // fehlt: wird neu angelegt
  }
  const z = path.join(basis, ...teile);
  if (!z.startsWith(basis + path.sep)) return null;
  try { const l = await lstat(z); if (l.isSymbolicLink() || !l.isFile()) return null; } catch { /* neu */ }
  return z;
}
export async function uebernehmen(quelle, { geaendert, geloescht, symlinks }) {
  const alle = [...geaendert.map((x) => x.r), ...geloescht, ...symlinks];
  const verboten = [...new Set(alle.filter((r) => gesperrt(r) || r.split("/").some((t) => t === ".." || t === "")))];
  if (symlinks.length) verboten.push(...symlinks.map((r) => `${r} (Verknüpfung)`));
  if (verboten.length) return { ok: false, verboten };
  for (const r of [...geaendert.map((x) => x.r), ...geloescht]) if (!(await zielSicher(quelle, r))) return { ok: false, verboten: [`${r} (Ordner ist eine Verknüpfung)`] };
  const echt = await realpath(quelle);
  for (const { r, neu } of geaendert) {
    const z = await zielSicher(quelle, r); if (!z) return { ok: false, verboten: [r] };
    await mkdir(path.dirname(z), { recursive: true });
    const eltern = await realpath(path.dirname(z));
    if (eltern !== echt && !eltern.startsWith(echt + path.sep)) return { ok: false, verboten: [r] };
    await writeFile(z, neu);
  }
  for (const r of geloescht) { const z = await zielSicher(quelle, r); if (z) await unlink(z).catch(() => {}); }
  return { ok: true, anzahl: geaendert.length + geloescht.length, dateien: alle };
}

/** PR-Text aus fremdem Text: keine Erwähnungen/Verweise, als Codeblock (Prüfung 0.8.6 Hinweis). */
export function prText(text) {
  const t = String(text || "").replace(/```/g, "ˋˋˋ").replace(/@/g, "@\u200b").replace(/#(\d)/g, "#\u200b$1").slice(0, 3000);
  return "```text\n" + t + "\n```";
}
