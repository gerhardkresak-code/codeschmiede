// Datenbank-Station (Gerhard 2026-10-24: „Test automatisch, Live nach Freigabe“, Datenbank 0034).
// Der Ablauf „Datenbank“ (.github/workflows/datenbank.yml) im Projekt-Repository spielt neue Dateien aus supabase/migrations/ ein:
// main → Test-Datenbank, live → Live-Datenbank. Die Werkstatt des Admins richtet ihn ein (Variablen per gh, Ablauf-Datei als Auftrag –
// die Werkstatt führt nie selbst zusammen), prüft ihn für die Ampel und meldet, welche Datenbank-Dateien noch nicht live sind.
// Keine Zugangsdaten: der Supabase-Zugang liegt nur als GitHub-Geheimnis im Repository (trägt Gerhard selbst ein).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ohneGeheimnisse } from "./geheim.mjs";

const REPO = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
const REF = /^[a-z]{20}$/;
const SHA = /^[0-9a-f]{40}$/;
export const ABLAUF_PFAD = ".github/workflows/datenbank.yml";
export const ABLAUF_VORLAGE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "vorlagen", "_datenbank", "datenbank.yml");
const repoPruefen = (r) => { if (!REPO.test(r || "") || /\/\.\.?$/.test(r)) throw new Error("Ungültiges Repository"); };
const kurz = (t, n = 200) => String(t || "").replace(/\s+/g, " ").trim().slice(0, n);

/** Ablauf-Datei auf main: { inhalt, blob } oder null. */
export async function ablaufAufMain(sh, repo) {
  repoPruefen(repo);
  try {
    const { stdout } = await sh("gh", ["api", `repos/${repo}/contents/${ABLAUF_PFAD}?ref=main`, "--jq", "[.sha, .content] | @tsv"]);
    const [blob, b64] = stdout.trim().split("\t");
    if (!SHA.test(blob || "")) return null;
    return { blob, inhalt: Buffer.from(String(b64 || "").replace(/\\n/g, ""), "base64").toString("utf8") };
  } catch (e) {
    if (/HTTP 404|Not Found/i.test(`${e?.stderr || ""}${e?.message || ""}`)) return null;
    throw e;
  }
}

/** Ist das Geheimnis SUPABASE_ACCESS_TOKEN im Repository hinterlegt? (nur der Name wird gelesen) */
export async function zugangDa(sh, repo) {
  repoPruefen(repo);
  const { stdout } = await sh("gh", ["secret", "list", "--repo", repo, "--json", "name", "--jq", ".[].name"]);
  return stdout.split(/\s+/).includes("SUPABASE_ACCESS_TOKEN");
}

/**
 * Datenbank-Station einrichten: Variablen setzen und – falls die Ablauf-Datei fehlt oder veraltet ist – einen Auftrag dafür anlegen.
 * auftragAnlegen({ pfad, inhalt, basis_blob, basis_sha }) legt den Auftrag an (Hand-Änderung des Admins). Rückgabe: Hinweistext.
 */
export async function dbEinrichten({ sh, projekt, auftragAnlegen, vorlage = null }) {
  const repo = projekt.repo; repoPruefen(repo);
  for (const r of [projekt.db_test_ref, projekt.db_live_ref]) if (r != null && !REF.test(r)) throw new Error("Ungültige Datenbank-Kennung");
  const variablen = {
    SUPABASE_TEST_REF: projekt.db_test_ref || null, SUPABASE_LIVE_REF: projekt.db_live_ref || null,
    SUPABASE_TEST_BESTEHEND: projekt.db_test_bestehend ? "ja" : "nein", SUPABASE_LIVE_BESTEHEND: projekt.db_live_bestehend ? "ja" : "nein",
  };
  for (const [name, wert] of Object.entries(variablen)) {
    if (wert) await sh("gh", ["variable", "set", name, "--repo", repo, "--body", wert]);
    else await sh("gh", ["variable", "delete", name, "--repo", repo]).catch(() => {});
  }
  const teile = ["Variablen gesetzt"];
  const inhalt = vorlage ?? (await readFile(ABLAUF_VORLAGE, "utf8"));
  const jetzt = await ablaufAufMain(sh, repo);
  if (jetzt && jetzt.inhalt === inhalt) teile.push("Ablauf „Datenbank“ ist schon auf main");
  else {
    const { stdout } = await sh("gh", ["api", `repos/${repo}/git/ref/heads/main`, "--jq", ".object.sha"]);
    const basis = stdout.trim();
    if (!SHA.test(basis)) throw new Error("Stand von main nicht lesbar");
    const nr = await auftragAnlegen({ pfad: ABLAUF_PFAD, inhalt, basis_blob: jetzt?.blob || "", basis_sha: basis });
    teile.push(`Auftrag #${nr} für den Ablauf „Datenbank“ angelegt – nach Freigabe und Zusammenführen läuft er`);
  }
  if (!(await zugangDa(sh, repo).catch(() => false))) teile.push("Es fehlt noch das Geheimnis SUPABASE_ACCESS_TOKEN im Repository (trägst du selbst ein)");
  return teile.join(" · ");
}

async function letzterLauf(sh, repo, zweig) {
  const { stdout } = await sh("gh", ["run", "list", "--repo", repo, "--workflow", "datenbank.yml", "--branch", zweig, "--limit", "5", "--json", "status,conclusion,createdAt"]);
  const l = JSON.parse(stdout || "[]");
  return l.find((x) => x.status === "completed") || l[0] || null;
}
const lauf = (l, wo) => !l ? { stand: "grau", text: `${wo}: noch nichts eingespielt` }
  : l.status !== "completed" ? { stand: "gelb", text: `${wo}: wird gerade eingespielt` }
  : l.conclusion === "success" ? { stand: "gruen", text: `${wo}: zuletzt fehlerfrei eingespielt` }
  : { stand: "rot", text: `${wo}: Einspielen fehlgeschlagen – Ablauf „Datenbank“ bei GitHub ansehen` };

/** Ampel der Datenbank-Station: { datenbank, datenbank_live? } – oder null, wenn keine Datenbanken eingetragen sind. */
export async function dbAmpel({ sh, projekt }) {
  if (!projekt.repo || (!projekt.db_test_ref && !projekt.db_live_ref)) return null;
  const repo = projekt.repo; repoPruefen(repo);
  const a = {};
  try {
    const ablauf = await ablaufAufMain(sh, repo);
    if (!ablauf) return { datenbank: { stand: "gelb", text: "Datenbank-Station noch nicht eingerichtet – unter „Anbindungen“ auf „Einrichten“" } };
    if (!(await zugangDa(sh, repo))) return { datenbank: { stand: "gelb", text: "Geheimnis SUPABASE_ACCESS_TOKEN fehlt im Repository (Settings › Secrets › Actions)" } };
    a.datenbank = projekt.db_test_ref ? lauf(await letzterLauf(sh, repo, "main"), "Test-Datenbank") : { stand: "grau", text: "Keine Test-Datenbank eingetragen" };
    if (projekt.db_live_ref) a.datenbank_live = lauf(await letzterLauf(sh, repo, "live"), "Live-Datenbank");
  } catch (e) {
    a.datenbank = { stand: "grau", text: `Nicht prüfbar: ${kurz(ohneGeheimnisse(String(e?.stderr || e?.message || "")), 120)}` };
  }
  for (const v of Object.values(a)) v.text = kurz(v.text);
  return a;
}

/**
 * Datenbank-Dateien, die auf main liegen, aber noch nicht auf live (Bare-Klon mit refs/heads/main und refs/heads/live).
 * git(dir, ...args) → stdout. Rückgabe [{ datei, sql }] (höchstens 50, SQL gekürzt und ohne Geheimnisse) oder null ohne live.
 */
export async function dbOffen(git, repo) {
  const hat = async (ref) => SHA.test(await git(repo, "rev-parse", "--verify", "--quiet", `refs/heads/${ref}^{commit}`).catch(() => ""));
  if (!(await hat("main")) || !(await hat("live"))) return null;
  const liste = async (ref) => (await git(repo, "ls-tree", "--name-only", `refs/heads/${ref}`, "--", "supabase/migrations/").catch(() => ""))
    .split("\n").map((x) => x.trim()).filter((x) => /^supabase\/migrations\/[A-Za-z0-9._-]{1,120}\.sql$/.test(x));
  const live = new Set(await liste("live"));
  const offen = (await liste("main")).filter((x) => !live.has(x)).sort().slice(0, 50);
  const r = [];
  for (const p of offen) {
    let sql = "";
    try { sql = await git(repo, "cat-file", "blob", `refs/heads/main:${p}`); } catch { sql = "(nicht lesbar)"; }
    sql = ohneGeheimnisse(sql);
    r.push({ datei: p.slice("supabase/migrations/".length), sql: sql.length > 20000 ? `${sql.slice(0, 19980)}\n… (gekürzt)` : sql });
  }
  return r;
}
