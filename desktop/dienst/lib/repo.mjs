// GitHub-Repository für ein neues Projekt anlegen (Gerhard 2026-10-23 18:38, Antworten 18:40):
// Konto gerhardkresak-code, öffentlich (per Klick privat), Grundgerüst aus dem Regelwerk ai-dev-os/project-template.
// Läuft nur in der Werkstatt des Admins mit dessen GitHub-Anmeldung (gh). Es wird kein Projekt-Code ausgeführt:
// nur „gh repo create“, Dateien schreiben, „git commit/push“ ohne Hooks – darum auch auf dem Admin-PC zulässig.
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const REPO_KONTO = "gerhardkresak-code";
export const REGELWERK = "gerhardkresak-code/ai-dev-os";
/** GitHub-Name aus der Projekt-Kennung (Kennung ist schon klein, a–z, 0–9 und Bindestrich). */
export const repoName = (id) => String(id || "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 100);
export const repoOk = (r) => /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/.test(r || "") && !/\/\.\.?$/.test(r);

/** Platzhalter der Vorlage füllen (nur Markdown/Text-Dateien). */
export function vorlageFuellen(text, { name, repo, inhaber }) {
  return String(text)
    .replaceAll("[PROJEKTNAME]", name)
    .replaceAll("[OWNER/REPO]", repo)
    .replaceAll("[NAME]", inhaber || "Inhaber")
    .replaceAll("[ENTWICKLUNG / STAGING / PRODUKTION]", "ENTWICKLUNG");
}

async function alleDateien(o, basis = o) {
  const r = [];
  for (const e of await readdir(o, { withFileTypes: true })) {
    const p = path.join(o, e.name);
    if (e.isSymbolicLink()) continue;   // Vorlage: keine Verknüpfungen übernehmen
    if (e.isDirectory()) r.push(...(await alleDateien(p, basis))); else if (e.isFile()) r.push(path.relative(basis, p));
  }
  return r;
}

/**
 * Grundgerüst in ziel schreiben: Vorlage (vorlageOrdner = …/project-template) + README, Konzept, Wissen.
 * github/ der Vorlage wird zu .github/. Gibt die Liste der geschriebenen Dateien zurück.
 */
export async function geruestSchreiben(ziel, vorlageOrdner, { name, repo, beschreibung = "", inhaber = "", konzeptMd = "", heute = new Date() }) {
  const dateien = vorlageOrdner ? await alleDateien(vorlageOrdner) : [];
  const geschrieben = [];
  for (const rel of dateien) {
    const nach = path.join(ziel, rel.split(path.sep)[0] === "github" ? path.join(".github", ...rel.split(path.sep).slice(1)) : rel);
    await mkdir(path.dirname(nach), { recursive: true });
    const quelle = path.join(vorlageOrdner, rel);
    if ((await stat(quelle)).size > 512 * 1024) continue;
    if (/\.(md|txt|json|ya?ml)$/i.test(rel)) await writeFile(nach, vorlageFuellen(await readFile(quelle, "utf8"), { name, repo, inhaber }));
    else await cp(quelle, nach);
    geschrieben.push(path.relative(ziel, nach).split(path.sep).join("/"));
  }
  const datum = heute.toISOString().slice(0, 10);
  const extra = {
    "README.md": `# ${name}\n\n${beschreibung ? `${beschreibung}\n\n` : ""}Angelegt mit der Codeschmiede am ${datum}. Regeln: [AGENTS.md](AGENTS.md) (Grundlage: ${REGELWERK}).\n`,
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
export async function repoAnlegen({ sh, arbeit, keineHooks, projekt, privat, inhaber, konzeptMd, melde = () => {} }) {
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
    vorlage = path.join(regel, "project-template");
    await stat(vorlage);
  } catch { vorlage = null; melde("Regelwerk-Vorlage nicht erreichbar – Grundgerüst ohne Regelkapitel"); }
  const ziel = path.join(arbeit, "neu");
  await mkdir(ziel, { recursive: true });
  const dateien = await geruestSchreiben(ziel, vorlage, { name: projekt.name, repo, beschreibung: projekt.beschreibung || "", inhaber, konzeptMd });
  await rm(regel, { recursive: true, force: true }).catch(() => {});
  // Repository anlegen (leer), dann Grundgerüst als ersten Stand auf main
  await sh("gh", ["repo", "create", repo, privat ? "--private" : "--public", "--description", String(projekt.name).slice(0, 300), "--disable-wiki"]);
  const g = (...a) => sh("git", ["-c", `core.hooksPath=${keineHooks}`, ...a], { cwd: ziel });
  await g("init", "-q", "-b", "main");
  const { stdout: login } = await sh("gh", ["api", "user", "--jq", ".login"]).catch(() => ({ stdout: "codeschmiede" }));
  await g("config", "user.name", String(login).trim() || "Codeschmiede");
  await g("config", "user.email", `${String(login).trim() || "codeschmiede"}@users.noreply.github.com`);
  await g("add", "-A");
  await g("commit", "-q", "--no-verify", "-m", `Grundgerüst aus der Codeschmiede (Regelwerk ${REGELWERK})`);
  await g("remote", "add", "origin", `https://github.com/${repo}.git`);
  await sh("gh", ["auth", "setup-git"]).catch(() => {});
  await g("push", "-q", "-u", "origin", "main");
  return { repo, dateien };
}

export async function repoSichtbarkeit({ sh, repo, privat }) {
  if (!repoOk(repo)) throw new Error("Ungültiges Repository");
  await sh("gh", ["repo", "edit", repo, "--visibility", privat ? "private" : "public", "--accept-visibility-change-consequences"]);
}
