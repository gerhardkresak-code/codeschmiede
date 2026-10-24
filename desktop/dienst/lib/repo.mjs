// GitHub-Repository für ein neues Projekt anlegen (Gerhard 2026-10-23 18:38, Antworten 18:40):
// Konto gerhardkresak-code, öffentlich (per Klick privat), Grundgerüst aus dem Regelwerk ai-dev-os/project-template.
// Läuft nur in der Werkstatt des Admins mit dessen GitHub-Anmeldung (gh). Es wird kein Projekt-Code ausgeführt:
// nur „gh repo create“, Dateien schreiben, „git commit/push“ ohne Hooks – darum auch auf dem Admin-PC zulässig.
import { copyFile, lstat, mkdir, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_KONTO = "gerhardkresak-code";
export const REGELWERK = "gerhardkresak-code/ai-dev-os";
/** GitHub-Name aus der Projekt-Kennung (Kennung ist schon klein, a–z, 0–9 und Bindestrich). */
export const repoName = (id) => String(id || "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 100);
export const repoOk = (r) => /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/.test(r || "") && !/\/\.\.?$/.test(r);

/** Platzhalter der Vorlage füllen (Text-Dateien). art = Dateiendung, damit der Name dort sicher steht (JSON, HTML, JSX, Rust/TOML). */
export function vorlageFuellen(text, { name, repo, inhaber, kennung = "" }, art = "md") {
  const roh = String(name || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80) || "Neue App";
  const html = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const sicher = art === "json" || art === "webmanifest" ? JSON.stringify(roh).slice(1, -1)
    : art === "html" ? html(roh)
    : art === "jsx" ? html(roh).replace(/\{/g, "&#123;").replace(/\}/g, "&#125;")
    : art === "rs" || art === "toml" || art === "js" || art === "mjs" || art === "yml" || art === "yaml" ? roh.replace(/[^\p{L}\p{N} ._()-]/gu, "")
    : roh;
  // Ersetzungsfunktionen: Sonderzeichen wie $' im Namen werden nicht als Muster gelesen (Prüfung N4)
  return String(text)
    .replaceAll("[KENNUNG]", () => kennung)
    // Rust-Paketname: a–z, 0–9, _ und -, Buchstabe vorn; Tauri-Kennung: a–z, 0–9 und -, Buchstabe vorn
    .replaceAll("[CRATE]", () => { const c = kennung.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^[-_]+|[-_]+$/g, ""); return /^[a-z]/.test(c) ? c : `app-${c || "programm"}`; })
    .replaceAll("[IDENTIFIER]", () => { const c = kennung.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""); return /^[a-z]/.test(c) ? c : `app-${c || "programm"}`; })
    // Programmname (Fenster, Installation, Windows-Ressourcen): nur Buchstaben, Ziffern, Leerzeichen, Punkt, Bindestrich, Unterstrich
    .replaceAll("[PROGRAMMNAME]", () => roh.replace(/[^\p{L}\p{N} ._-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 60) || "Programm")
    .replaceAll("[PROJEKTNAME]", () => sicher)
    .replaceAll("[OWNER/REPO]", () => repo)
    .replaceAll("[NAME]", () => inhaber || "Inhaber")
    .replaceAll("[ENTWICKLUNG / STAGING / PRODUKTION]", () => "ENTWICKLUNG");
}

// Nur echte Dateien und Ordner INNERHALB der Vorlage – keine Verknüpfungen, auch nicht der Vorlagen-Ordner selbst (Prüfung M1)
async function alleDateien(o, grenze, basis = o) {
  const r = [];
  for (const e of await readdir(o, { withFileTypes: true })) {
    const p = path.join(o, e.name);
    const l = await lstat(p);
    if (l.isSymbolicLink()) continue;
    const echt = await realpath(p);
    if (echt !== grenze && !echt.startsWith(grenze + path.sep)) continue;
    if (l.isDirectory()) r.push(...(await alleDateien(p, grenze, basis))); else if (l.isFile() && l.nlink === 1) r.push(path.relative(basis, p));
  }
  return r;
}
async function vorlageSicher(vorlage, regel) {
  const l = await lstat(vorlage);
  if (!l.isDirectory() || l.isSymbolicLink()) throw new Error("Vorlage ist kein echter Ordner");
  const echt = await realpath(vorlage); const wurzel = await realpath(regel);
  if (!echt.startsWith(wurzel + path.sep)) throw new Error("Vorlage liegt außerhalb des Regelwerks");
  return echt;
}

/**
 * Grundgerüst in ziel schreiben: Vorlage (vorlageOrdner = …/project-template) + README, Konzept, Wissen.
 * github/ der Vorlage wird zu .github/. Gibt die Liste der geschriebenen Dateien zurück.
 */
/** Grundgerüste je Technik-Art (Entwurf 1.0 „Neues Projekt“, 2026-10-24) – liegen im Programm unter dienst/vorlagen/<art>. */
export const ARTEN = ["web", "programm", "handy", "werkzeug"];
export const ART_ORDNER = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "vorlagen");
const TEXT = /\.(md|txt|json|ya?ml|html|jsx?|mjs|css|rs|toml|webmanifest|example)$|(^|[\\/])\.gitignore$/i;

async function ordnerKopieren(ziel, quelle, werte, geschrieben) {
  const grenze = await realpath(quelle);
  for (const rel of await alleDateien(grenze, grenze)) {
    const nach = path.join(ziel, rel.split(path.sep)[0] === "github" ? path.join(".github", ...rel.split(path.sep).slice(1)) : rel);
    await mkdir(path.dirname(nach), { recursive: true });
    const q = path.join(grenze, rel);
    if ((await lstat(q)).size > 512 * 1024) continue;
    if (TEXT.test(rel)) await writeFile(nach, vorlageFuellen(await readFile(q, "utf8"), werte, (rel.match(/\.([a-z]+)$/i)?.[1] || "").toLowerCase()));
    else await copyFile(q, nach);
    const r = path.relative(ziel, nach).split(path.sep).join("/");
    if (!geschrieben.includes(r)) geschrieben.push(r);
  }
}

export async function geruestSchreiben(ziel, vorlageOrdner, { name, repo, beschreibung = "", inhaber = "", konzeptMd = "", heute = new Date(), art = null, artOrdner = ART_ORDNER }) {
  const kennung = String(repo || "").split("/")[1] || "";
  const werte = { name, repo, inhaber, kennung };
  const geschrieben = [];
  if (vorlageOrdner) await ordnerKopieren(ziel, vorlageOrdner, werte, geschrieben);
  // Grundgerüst der Technik-Art darüber (Code, Prüf- und Build-Abläufe)
  if (art) {
    if (!ARTEN.includes(art)) throw new Error("Unbekannte Projekt-Art");
    await ordnerKopieren(ziel, path.join(artOrdner, art), werte, geschrieben);
  }
  const datum = heute.toISOString().slice(0, 10);
  const extra = {
    "README.md": `# ${name}\n\n${beschreibung ? `${beschreibung}\n\n` : ""}Angelegt mit der Codeschmiede am ${datum}${art ? ` als ${{ web: "Web-App", programm: "Programm (Windows/Mac)", handy: "Handy-App (PWA)", werkzeug: "Werkzeug / Skript" }[art]}` : ""}. Regeln: [AGENTS.md](AGENTS.md) (Grundlage: ${REGELWERK}).${art ? " Technik: [README-ART.md](README-ART.md)." : ""}\n`,
    "docs/KONZEPT.md": konzeptMd || `# Konzept – ${name}\n\nNoch nicht besprochen. Das Grundkonzept entsteht in der Codeschmiede in der Gruppe „Konzept“.\n`,
    "docs/WISSEN.md": `# Wissen – ${name}\n\nWas abgeschlossen und live ist, mit Entscheidungen. Konzept-Entscheidungen stehen in der Codeschmiede (Gruppe „Konzept“) und in docs/KONZEPT.md.\n`,
    ".gitattributes": "* text=auto eol=lf\n*.png binary\n*.jpg binary\n*.ico binary\n",
  };
  for (const [rel, inhalt] of Object.entries(extra)) {
    if (rel === ".gitattributes" && geschrieben.includes(rel)) continue;
    await mkdir(path.dirname(path.join(ziel, rel)), { recursive: true });
    await writeFile(path.join(ziel, rel), inhalt); if (!geschrieben.includes(rel)) geschrieben.push(rel);
  }
  // Erste Zeile im Änderungsprotokoll
  const cl = path.join(ziel, "docs", "CHANGELOG.md");
  try {
    const t = await readFile(cl, "utf8");
    const zeile = `| 0.0.1 | ${datum} | Codeschmiede (Werkstatt des Admins) | Repository angelegt: Grundgerüst nach dem Regelwerk ${REGELWERK}, README, Konzept aus der Codeschmiede. |`;
    const i = t.indexOf("\n|---"); const j = i >= 0 ? t.indexOf("\n", i + 1) : -1;
    await writeFile(cl, j >= 0 ? `${t.slice(0, j + 1)}${zeile}\n${t.slice(j + 1)}` : `${t.trimEnd()}\n\n${zeile}\n`);
  } catch { /* ohne Änderungsprotokoll-Vorlage */ }
  return geschrieben.sort();
}

/**
 * Repository anlegen und Grundgerüst hochladen.
 * sh(befehl, args, opts) führt ohne Shell aus; arbeit = leerer Ordner; keineHooks = leerer Ordner für core.hooksPath.
 */
// Nie auf eine Eingabe warten (Anmeldefenster, Passwort) und nie ewig hängen (Prüfung M2)
const OHNE_FRAGEN = { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never", GH_PROMPT_DISABLED: "1" };
const mitGrenze = (sh) => (b, a, o = {}) => sh(b, a, { timeout: 120000, env: OHNE_FRAGEN, maxBuffer: 20 * 1024 * 1024, ...o });

export async function repoAnlegen({ sh: shRoh, arbeit, keineHooks, projekt, privat, inhaber, konzeptMd, melde = () => {} }) {
  const sh = mitGrenze(shRoh);
  const name = repoName(projekt.projekt_id || projekt.id);
  if (!name) throw new Error("Ungültige Projekt-Kennung für GitHub");
  const repo = `${REPO_KONTO}/${name}`;
  if (!repoOk(repo)) throw new Error("Ungültiger Repository-Name");
  // Gibt es den Namen schon? Dann nicht überschreiben – der Admin trägt ihn selbst ein oder wählt eine andere Kennung
  const schonDa = await sh("gh", ["repo", "view", repo, "--json", "name"]).then(() => true, () => false);
  if (schonDa) throw new Error(`Bei GitHub gibt es ${repo} schon. Bitte unter „Projekte verwalten“ selbst eintragen oder eine andere Kennung wählen.`);
  // Regelwerk-Vorlage holen (nur lesen, ohne Hooks)
  const regel = path.join(arbeit, "regelwerk");
  let vorlage = null;
  try {
    await sh("gh", ["repo", "clone", REGELWERK, regel, "--", "--depth", "1", "-c", `core.hooksPath=${keineHooks}`], { maxBuffer: 50 * 1024 * 1024 });
    vorlage = await vorlageSicher(path.join(regel, "project-template"), regel);
  } catch { vorlage = null; melde("Regelwerk-Vorlage nicht erreichbar – Grundgerüst ohne Regelkapitel"); }
  const ziel = path.join(arbeit, "neu");
  await mkdir(ziel, { recursive: true });
  const dateien = await geruestSchreiben(ziel, vorlage, { name: projekt.name, repo, beschreibung: projekt.beschreibung || "", inhaber, konzeptMd, art: projekt.technik_art || null });
  await rm(regel, { recursive: true, force: true }).catch(() => {});
  // Erst lokal committen, dann Anlegen und Hochladen in EINEM Schritt (gh repo create --source --push, Prüfung M3).
  // Der Zugang kommt nur für diesen Aufruf aus gh (Credential-Helfer per -c), die globale Git-Einstellung bleibt unverändert (N3).
  const g = (...a) => sh("git", ["-c", `core.hooksPath=${keineHooks}`, ...a], { cwd: ziel });
  await g("init", "-q", "-b", "main");
  const { stdout: login } = await sh("gh", ["api", "user", "--jq", ".login"]).catch(() => ({ stdout: "codeschmiede" }));
  await g("config", "user.name", String(login).trim() || "Codeschmiede");
  await g("config", "user.email", `${String(login).trim() || "codeschmiede"}@users.noreply.github.com`);
  await g("config", "credential.helper", "");
  await g("config", "--add", "credential.helper", "!gh auth git-credential");
  await g("add", "-A");
  await g("commit", "-q", "--no-verify", "-m", `Grundgerüst aus der Codeschmiede (Regelwerk ${REGELWERK})`);
  try {
    await sh("gh", ["repo", "create", repo, privat ? "--private" : "--public", "--description", String(projekt.name).slice(0, 300), "--disable-wiki", "--source", ziel, "--remote", "origin", "--push"], { cwd: ziel });
  } catch (e) {
    // Angelegt, aber Hochladen gescheitert? Repo trotzdem melden und das Hochladen einmal ohne Prüf-Workflow wiederholen
    const da = await sh("gh", ["repo", "view", repo, "--json", "name"]).then(() => true, () => false);
    if (!da) throw e;
    melde("Hochladen beim ersten Versuch gescheitert – zweiter Versuch");
    try { await g("remote", "add", "origin", `https://github.com/${repo}.git`); } catch { /* schon da */ }
    try { await g("push", "-q", "-u", "origin", "main"); }
    catch {
      await rm(path.join(ziel, ".github", "workflows"), { recursive: true, force: true });
      await g("add", "-A"); await g("commit", "-q", "--no-verify", "--amend", "-m", `Grundgerüst aus der Codeschmiede (Regelwerk ${REGELWERK}; Prüf-Workflow bitte später ergänzen)`);
      await g("push", "-q", "-u", "origin", "main");
    }
  }
  return { repo, dateien };
}

export async function repoSichtbarkeit({ sh: shRoh, repo, privat }) {
  const sh = mitGrenze(shRoh);
  if (!repoOk(repo)) throw new Error("Ungültiges Repository");
  await sh("gh", ["repo", "edit", repo, "--visibility", privat ? "private" : "public", "--accept-visibility-change-consequences"]);
}
/** Tatsächliche Sichtbarkeit bei GitHub (true = privat, null = unbekannt). */
export async function repoIstPrivat({ sh: shRoh, repo }) {
  const sh = mitGrenze(shRoh);
  if (!repoOk(repo)) return null;
  try { const { stdout } = await sh("gh", ["repo", "view", repo, "--json", "visibility", "--jq", ".visibility"]); const v = String(stdout).trim().toUpperCase(); return v === "PRIVATE" || v === "INTERNAL" ? true : v === "PUBLIC" ? false : null; } catch { return null; }
}
