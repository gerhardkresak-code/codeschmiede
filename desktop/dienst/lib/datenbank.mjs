// Datenbank-Station (Gerhard 2026-10-24: „Test automatisch, Live nach Freigabe“, Datenbank 0034).
// Der Ablauf „Datenbank“ (.github/workflows/datenbank.yml) im Projekt-Repository spielt neue Dateien aus supabase/migrations/ ein:
// main → Test-Datenbank, live → Live-Datenbank. Die Werkstatt des Admins richtet ihn ein (Variablen per gh, Ablauf-Datei als Auftrag –
// die Werkstatt führt nie selbst zusammen), prüft ihn für die Ampel und meldet, welche Datenbank-Dateien noch nicht live sind.
// Keine Zugangsdaten: je Datenbank liegt nur deren Verbindungsadresse als Geheimnis einer GitHub-Umgebung („test“ nur für main,
// „live“ nur für live – nach der Prüfung vom 2026-10-24: kein kontoweiter Zugang, andere Zweige kommen nicht heran). Trägt Gerhard selbst ein.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
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
export async function ablaufAufMain(sh, repo) { return dateiAufMain(sh, repo, ABLAUF_PFAD); }

export const CHANGELOG_PFAD = "docs/CHANGELOG.md";
export async function dateiAufMain(sh, repo, pfad) {
  repoPruefen(repo);
  try {
    const { stdout } = await sh("gh", ["api", `repos/${repo}/contents/${pfad}?ref=main`, "--jq", "[.sha, .content] | @tsv"]);
    const [blob, b64] = stdout.trim().split("\t");
    if (!SHA.test(blob || "")) return null;
    return { blob, inhalt: Buffer.from(String(b64 || "").replace(/\\n/g, ""), "base64").toString("utf8") };
  } catch (e) {
    if (/HTTP 404|Not Found/i.test(`${e?.stderr || ""}${e?.message || ""}`)) return null;
    throw e;
  }
}

/** Neue Zeile oben in die Tabelle des Änderungsprotokolls (AGENTS.md: jede Änderung ins CHANGELOG) – null, wenn keine Tabelle da ist. */
export function changelogZeile(text, datum = new Date().toISOString().slice(0, 10)) {
  if (typeof text !== "string") return null;
  const zeilen = text.split("\n");
  const i = zeilen.findIndex((z) => /^\|\s*:?-{3,}/.test(z.trim()));
  if (i < 0) return null;
  const spalten = (zeilen[i].match(/\|/g) || []).length - 1;
  const werte = ["– (Datenbank-Station)", datum, "Codeschmiede (Datenbank-Station „Einrichten“)",
    "**Datenbank-Station:** Ablauf „Datenbank“ (`.github/workflows/datenbank.yml`) – neue Dateien in `supabase/migrations/` gehen nach dem Zusammenführen automatisch in die Test-Datenbank, in die Live-Datenbank erst beim Live-Schalten (vorher Sicherung des Aufbaus, ohne Daten). Zugang je Umgebung über das GitHub-Geheimnis `SUPABASE_DB_URL`."];
  const zelle = spalten >= 4 ? werte.concat(Array(spalten - 4).fill("")) : [werte[1], werte[3]].slice(0, Math.max(1, spalten));
  zeilen.splice(i + 1, 0, `| ${zelle.join(" | ")} |`);
  return zeilen.join("\n");
}

/** Ist das Geheimnis SUPABASE_DB_URL in der Umgebung hinterlegt? (nur der Name wird gelesen) */
export async function zugangDa(sh, repo, umgebung) {
  repoPruefen(repo);
  if (!["test", "live"].includes(umgebung)) throw new Error("Unbekannte Umgebung");
  const { stdout } = await sh("gh", ["secret", "list", "--repo", repo, "--env", umgebung, "--json", "name", "--jq", ".[].name"]);
  return stdout.split(/\s+/).includes("SUPABASE_DB_URL");
}

export const MAIN_SCHUTZ = "Codeschmiede: Zweig main";
export async function mainSchuetzen(sh, repo) {
  repoPruefen(repo);
  const { stdout } = await sh("gh", ["api", `repos/${repo}/rulesets`, "--jq", ".[].name"]);
  if (stdout.split("\n").map((x) => x.trim()).includes(MAIN_SCHUTZ)) return;
  const regel = {
    name: MAIN_SCHUTZ, target: "branch", enforcement: "active",
    conditions: { ref_name: { include: ["refs/heads/main"], exclude: [] } },
    rules: [{ type: "deletion" }, { type: "non_fast_forward" }, { type: "pull_request", parameters: {
      required_approving_review_count: 0, dismiss_stale_reviews_on_push: false, require_code_owner_review: false,
      require_last_push_approval: false, required_review_thread_resolution: false } }],
    bypass_actors: [{ actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" }],
  };
  const ordner = await mkdtemp(path.join(os.tmpdir(), "cs-regel-"));
  try {
    const datei = path.join(ordner, "regel.json");
    await writeFile(datei, JSON.stringify(regel));
    await sh("gh", ["api", "-X", "POST", `repos/${repo}/rulesets`, "--input", datei]);
  } finally { await rm(ordner, { recursive: true, force: true }).catch(() => {}); }
}

/** GitHub-Umgebung anlegen, die nur genau einen Zweig zulässt (main bzw. live). */
export async function umgebungAnlegen(sh, repo, umgebung, zweig) {
  repoPruefen(repo);
  if (!["test", "live"].includes(umgebung) || !["main", "live"].includes(zweig)) throw new Error("Unbekannte Umgebung");
  await sh("gh", ["api", "-X", "PUT", `repos/${repo}/environments/${umgebung}`,
    "-F", "deployment_branch_policy[protected_branches]=false", "-F", "deployment_branch_policy[custom_branch_policies]=true"]);
  const { stdout } = await sh("gh", ["api", `repos/${repo}/environments/${umgebung}/deployment-branch-policies`, "--jq", ".branch_policies[] | [.id, .name, (.type // \"branch\")] | @tsv"]);
  let passt = false;
  for (const z of stdout.split("\n").filter(Boolean)) {
    const [id, name, typ] = z.split("\t");
    if (name === zweig && typ === "branch") { passt = true; continue; }
    if (/^\d+$/.test(id)) await sh("gh", ["api", "-X", "DELETE", `repos/${repo}/environments/${umgebung}/deployment-branch-policies/${id}`]);   // nur genau dieser Zweig
  }
  if (!passt) await sh("gh", ["api", "-X", "POST", `repos/${repo}/environments/${umgebung}/deployment-branch-policies`, "-f", `name=${zweig}`, "-f", "type=branch"]);
}

/**
 * Datenbank-Station einrichten: Variablen setzen und – falls die Ablauf-Datei fehlt oder veraltet ist – einen Auftrag dafür anlegen.
 * auftragAnlegen({ pfad, inhalt, basis_blob, basis_sha }) legt den Auftrag an (Hand-Änderung des Admins). Rückgabe: Hinweistext.
 */
export async function dbEinrichten({ sh, projekt, auftragAnlegen, vorlage = null }) {
  const repo = projekt.repo; repoPruefen(repo);
  for (const r of [projekt.db_test_ref, projekt.db_live_ref]) if (r != null && !REF.test(r)) throw new Error("Ungültige Datenbank-Kennung");
  const teile = [];
  const fehlt = [];
  // Zweig main schützen (Prüfung N3): Änderungen nur über Pull Request, nicht löschen/überschreiben; der Admin darf umgehen
  try { await mainSchuetzen(sh, repo); teile.push("Zweig main geschützt (nur über Pull Request)"); }
  catch (e) { teile.push(`Achtung: Zweig main konnte nicht geschützt werden (${kurz(ohneGeheimnisse(String(e?.stderr || e?.message || "")), 120)})`); }
  for (const [umgebung, zweig, ref, bestehend] of [["test", "main", projekt.db_test_ref, projekt.db_test_bestehend], ["live", "live", projekt.db_live_ref, projekt.db_live_bestehend]]) {
    if (!ref) continue;
    await umgebungAnlegen(sh, repo, umgebung, zweig);
    await sh("gh", ["variable", "set", "BESTEHEND", "--repo", repo, "--env", umgebung, "--body", bestehend ? "ja" : "nein"]);
    teile.push(`Umgebung „${umgebung}“ (nur Zweig ${zweig}) eingerichtet`);
    if (!(await zugangDa(sh, repo, umgebung).catch(() => false))) fehlt.push(umgebung);
  }
  const inhalt = vorlage ?? (await readFile(ABLAUF_VORLAGE, "utf8"));
  const jetzt = await ablaufAufMain(sh, repo);
  if (jetzt && jetzt.inhalt === inhalt) teile.push("Ablauf „Datenbank“ ist schon auf main");
  else {
    const { stdout } = await sh("gh", ["api", `repos/${repo}/git/ref/heads/main`, "--jq", ".object.sha"]);
    const basis = stdout.trim();
    if (!SHA.test(basis)) throw new Error("Stand von main nicht lesbar");
    const dateien = [{ pfad: ABLAUF_PFAD, inhalt, basis_blob: jetzt?.blob || "" }];
    // Die Sicherheitsprüfung verlangt eine Zeile im Änderungsprotokoll – sonst bricht die Hand-Änderung ab (Auftrag #16, 2026-10-24)
    const log = await dateiAufMain(sh, repo, CHANGELOG_PFAD).catch(() => null);
    const neu = log && changelogZeile(log.inhalt);
    if (neu) dateien.push({ pfad: CHANGELOG_PFAD, inhalt: neu, basis_blob: log.blob });
    const nr = await auftragAnlegen({ dateien, basis_sha: basis });
    teile.push(`Auftrag #${nr} für den Ablauf „Datenbank“ angelegt – nach Freigabe und Zusammenführen läuft er`);
  }
  if (fehlt.length) teile.push(`Es fehlt noch das Geheimnis SUPABASE_DB_URL in ${fehlt.map((u) => `„${u}“`).join(" und ")} (trägst du selbst ein)`);
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
    const zugang = (u) => zugangDa(sh, repo, u).catch(() => false);
    a.datenbank = !projekt.db_test_ref ? { stand: "grau", text: "Keine Test-Datenbank eingetragen" }
      : !(await zugang("test")) ? { stand: "gelb", text: "Geheimnis SUPABASE_DB_URL in der Umgebung „test“ fehlt (Settings › Environments)" }
      : lauf(await letzterLauf(sh, repo, "main"), "Test-Datenbank");
    if (projekt.db_live_ref) a.datenbank_live = !(await zugang("live")) ? { stand: "gelb", text: "Geheimnis SUPABASE_DB_URL in der Umgebung „live“ fehlt (Settings › Environments)" }
      : lauf(await letzterLauf(sh, repo, "live"), "Live-Datenbank");
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
/** Haben sich Abläufe (.github/workflows) zwischen live und main geändert? Sie laufen nach dem Live-Schalten mit den Live-Zugängen. */
export async function ablaeufeGeaendert(git, repo) {
  const a = await git(repo, "rev-parse", "--verify", "--quiet", "refs/heads/main:.github/workflows").catch(() => "");
  const b = await git(repo, "rev-parse", "--verify", "--quiet", "refs/heads/live:.github/workflows").catch(() => "");
  return !!(a || b) && a !== b;
}

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

/**
 * Nach dem Live-Schalten: Ablauf „Datenbank“ auf live starten und auf das Ergebnis warten (höchstens warteMs).
 * Rückgabe: Hinweistext oder null (keine Live-Datenbank / kein Ablauf).
 */
export async function dbLiveEinspielen({ sh, projekt, vorher = null, kennung = "", warteMs = 10 * 60 * 1000, pause = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  if (!projekt.repo || !projekt.db_live_ref) return null;
  const repo = projekt.repo; repoPruefen(repo);
  if (!(await ablaufAufMain(sh, repo))) return "Datenbank-Station noch nicht eingerichtet – Live-Datenbank nicht aktualisiert";
  const start = Date.now();
  const k = `cs-${String(kennung).replace(/[^0-9a-z-]/gi, "").slice(0, 30)}-${start}`;
  const args = ["workflow", "run", "datenbank.yml", "--repo", repo, "--ref", "live", "-f", `kennung=${k}`];
  if (vorher && SHA.test(vorher)) args.push("-f", `vorher=${vorher}`);
  await sh("gh", args);
  let lauf = null;
  while (Date.now() - start < warteMs) {
    await pause(15000);
    const { stdout } = await sh("gh", ["run", "list", "--repo", repo, "--workflow", "datenbank.yml", "--branch", "live", "--event", "workflow_dispatch", "--limit", "10", "--json", "databaseId,status,conclusion,createdAt,displayTitle"]);
    lauf = JSON.parse(stdout || "[]").find((l) => String(l.displayTitle || "").includes(k)) || null;
    if (lauf?.status === "completed") break;
  }
  if (!lauf) return "Live-Datenbank: Ablauf nicht gestartet – bitte bei GitHub prüfen";
  if (lauf.status !== "completed") return "Live-Datenbank: Einspielen läuft noch – Ergebnis in der Ampel";
  return lauf.conclusion === "success" ? "Live-Datenbank aktuell"
    : "ACHTUNG: Live-Datenbank konnte nicht aktualisiert werden – der Code ist schon live. Ablauf „Datenbank“ bei GitHub ansehen, ggf. „Zurück“";
}
