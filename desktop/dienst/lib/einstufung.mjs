// Automatische Erlaubnis (Neue Anweisung Gerhard 2026-10-23 10:34, Entscheidung 10:36):
// Harmloses wird automatisch erlaubt, Gefährliches ist immer gesperrt, gefragt wird nur noch bei Unklarem.
// Ergebnis: { stufe: "erlaubt" | "gesperrt" | "fragen", grund }
//
// Gesperrt (nie, auch nicht auf Nachfrage): in main zusammenführen (gh pr merge), Push auf main/fremde Zweige/Tags,
// Zweige löschen, Erzwingen, harte Resets auf den Online-Stand, Geheimnisse, Releases, Repository löschen, sudo,
// Git-Einstellungen, die Code ausführen können, und auf dem Admin-PC jeder Befehl, der Code ausführt (Bauen/Testen nur in der Cloud).

import { fuehrtCodeAus } from "./ergebnis.mjs";

// Geschützte Pfade (wie die Verbote für Edit/Write): Abläufe, Einstellungen, Hooks, package.json, Git-Interna
const GESCHUETZT = /(^|[\s'"=/])(\.github\/|\.claude\/|\.husky\/|\.git\/|\.mcp\.json|package\.json)/;
const AUSSERHALB = /(^|\s)(\/|~|\.\.\/)/;   // absoluter Pfad, Heimordner, Ordner darüber

// Befehl in Teilbefehle zerlegen (&&, ||, ;, |, Zeilenumbruch, $( ), Backticks) – grob, aber vorsichtig:
// Was nicht sicher erkannt wird, landet bei „fragen“.
export function teile(befehl) {
  let s = String(befehl || "");
  // Heredoc-Inhalt nicht als Befehle lesen, aber den Kopf behalten (python - <<'E' … E)
  s = s.replace(/<<-?\s*['"]?(\w+)['"]?[^\n]*\n[\s\S]*?\n\s*\1\s*(?=\n|$)/g, (m) => m.split("\n")[0].replace(/<<-?\s*['"]?\w+['"]?/, "<<HEREDOC"));
  // Umleitungen von Ausgaben (2>&1, >&2, &>/dev/null) sind kein Trenner
  s = s.replace(/\d*>&\d/g, " ").replace(/&>\s*\/dev\/null/g, " ");
  // Trennen an && || ; | Zeilenumbruch $( ) ` – außerhalb von Anführungszeichen; $( und ` auch in "…" (Befehlsersetzung)
  const out = []; let cur = ""; let q = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i], zwei = s.slice(i, i + 2);
    if (q === "'") { cur += ch; if (ch === "'") q = null; continue; }
    if (ch === "\\" && i + 1 < s.length) { cur += ch + s[i + 1]; i++; continue; }
    if (zwei === "$(" || ch === "`") { out.push(cur); cur = ""; if (zwei === "$(") i++; continue; }
    if (q === '"') { cur += ch; if (ch === '"') q = null; continue; }
    if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; }
    if (zwei === "&&" || zwei === "||") { out.push(cur); cur = ""; i++; continue; }
    if (ch === ";" || ch === "|" || ch === "\n" || ch === ")" || ch === "&") { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

const LESEN = /^(ls|pwd|cat|head|tail|wc|grep|egrep|rg|sort|uniq|cut|tr|diff|echo|printf|true|false|test|\[|date|basename|dirname|realpath|stat|file|which|jq|column|seq|nl|tee -a docs\/|sleep \d{1,2}$)\b/;

function eineStufe(t, { adminPc }) {
  let c = t.replace(/\s+/g, " ").trim();
  // Umgebungsvariablen nur für Git-Autor/-Committer zulassen
  const env = c.match(/^export ((?:\w+=(?:"[^"]*"|\S+) ?)+)$/);
  if (env) return /^(?:(?:GIT_(?:AUTHOR|COMMITTER)_(?:NAME|EMAIL))=(?:"[^"]*"|\S+) ?)+$/.test(env[1]) ? ok("Git-Autor setzen") : frage("Umgebungsvariable");
  while (/^GIT_(AUTHOR|COMMITTER)_(NAME|EMAIL)=("[^"]*"|\S+) /.test(c)) c = c.replace(/^\S+=("[^"]*"|\S+) /, "");
  if (/^sudo\b/.test(c)) return sperre("sudo");
  if (/\.ssh\/|\.aws\/|\.config\/gh|\.codeschmiede|zugriff\.token|(^|[\s/])\.env\b|\.pem\b|\.key\b|\.claude\/|\.credentials|\.netrc|\.npmrc|\.git-credentials/.test(c)) return sperre("Anmeldedaten sind tabu");
  if (/\bcurl\b|\bwget\b|Invoke-WebRequest/i.test(c)) return frage("Netzwerkzugriff");

  // Git
  if (/^git\b/.test(c)) {
    const WERT = /(?:"[^"]*"|'[^']*'|\S+)/.source;
    const opts = [...c.matchAll(/ -c ([\w.-]+)=/g)].map((m) => m[1]);
    if (opts.some((o) => !/^user\.(name|email)$/.test(o))) return sperre("Git-Einstellung, die Code ausführen kann");
    const g = c.replace(new RegExp(` -c [\\w.-]+=${WERT}`, "g"), "");
    if (/^git (config|remote (add|set-url|remove))\b/.test(g)) return sperre("Git-Einstellungen ändern");
    if (/--output|--exec|--upload-pack|--receive-pack|core\.|-F |--file|--template/.test(g)) return sperre("Git-Option, die Dateien schreibt oder Code ausführt");
    if (/^git push\b/.test(g)) {
      if (/:| \+| -f\b| --force| --delete| -d\b| --mirror| --all| --tags| main\b| master\b|version\/|--no-verify/.test(g)) return sperre("Push nur auf den eigenen Zweig");
      return /^git push( -u| -q| --set-upstream)* origin (HEAD|feature\/cs-[0-9]+-[a-z0-9-]+)$/.test(g) ? ok("Push auf den eigenen Zweig") : frage("Push");
    }
    if (/^git reset --hard (origin|@\{u\})/.test(g)) return sperre("Harter Reset auf den Online-Stand");
    if (/^git (branch|tag) .*(-D|-d|--delete)\b|^git tag\b/.test(g)) return sperre("Zweige/Tags löschen oder setzen");
    if (/^git (status|diff|log|show|fetch|rev-parse|ls-files|ls-remote|merge-base|merge-tree|blame|shortlog|describe|cat-file|grep|branch( -a| -r| --show-current| -vv)?$|branch$|stash list|remote -v|worktree list)\b/.test(g)) return ok("Git lesen");
    if (/^git (add|commit|restore|mv|rm|stash( push| pop| apply)?|cherry-pick|revert)\b/.test(g)) return GESCHUETZT.test(g) ? frage("Geschützte Datei") : ok("Git im Arbeitsordner");
    if (/^git (switch -c|checkout -b) feature\/cs-/.test(g) || /^git (switch|checkout) (feature\/cs-\S+|-- \S+)$/.test(g)) return ok("Eigener Zweig");
    if (/^git (merge|rebase) (origin\/main|main)( --no-edit| -m .*)?$/.test(g)) return ok("Stand von main übernehmen");
    return frage("Git-Befehl");
  }
  // GitHub
  if (/^gh\b/.test(c)) {
    if (/^gh pr (merge|close|reopen|ready|edit)|^gh (release|secret|repo (delete|edit|rename|archive)|variable|workflow (run|enable|disable)|run (rerun|cancel|delete)|ruleset|auth)\b/.test(c)) return sperre("Zusammenführen, Freigaben und Einstellungen macht nur die Codeschmiede (Stationen)");
    if (/^gh api\b/.test(c)) return / -X (?!GET)| --method (?!GET)| -f | -F | --field| --raw-field| --input/.test(c) ? sperre("Schreibender GitHub-Zugriff") : ok("GitHub lesen");
    if (/^gh pr create\b/.test(c)) return /--body-file|(^| )-F /.test(c) ? sperre("Datei einlesen") : ok("Pull Request öffnen");
    if (/^gh (pr (view|checks|list|diff|status)|run (view|list|watch)|issue (view|list)|repo view|search)\b/.test(c)) return ok("GitHub lesen");
    return frage("GitHub-Befehl");
  }
  if (/^rm\b/.test(c)) return AUSSERHALB.test(c.replace(/^rm( -\S+)*/, "")) || / -\S*r\S*f| -\S*f\S*r/.test(c) && AUSSERHALB.test(c) ? sperre("Löschen außerhalb des Arbeitsordners") : GESCHUETZT.test(c) ? frage("Geschützte Datei") : ok("Datei im Arbeitsordner löschen");
  if (/^(sed|perl) .*-i/.test(c)) return GESCHUETZT.test(c) || AUSSERHALB.test(c.replace(/^(sed|perl) /, "").replace(/'[^']*'|"[^"]*"/g, "")) ? frage("Bearbeitung geschützter/fremder Datei") : ok("Datei im Arbeitsordner bearbeiten");
  if (/^(mkdir|touch|cp|mv)\b/.test(c)) return GESCHUETZT.test(c) || AUSSERHALB.test(c.replace(/^\S+( -\S+)*/, "")) ? frage("Datei außerhalb/geschützt") : ok("Datei im Arbeitsordner");
  if (/^find\b/.test(c)) return /-exec|-delete|-ok\b|-fprint/.test(c) ? frage("find mit Ausführen/Löschen") : ok("Suchen");
  if (/^awk\b/.test(c)) return /system\s*\(|\|\s*"|getline|>\s*"/.test(c) ? frage("awk mit Ausführen/Schreiben") : ok("Lesen");
  if (/^sed\b/.test(c)) return ok("Lesen");
  if (/^timeout \d+ /.test(c)) return eineStufe(c.replace(/^timeout \d+ /, ""), { adminPc });
  if (fuehrtCodeAus(c)) return adminPc ? sperre("Auf dem Admin-PC wird kein Code ausgeführt – Bauen und Testen läuft in der Cloud (Cloudflare-Bau). Dateien mit Edit/Write ändern.") : frage("Führt Code aus");
  if (LESEN.test(c)) {
    const ohne = c.replace(/\d?>\s*\/dev\/null/g, "").replace(/'[^']*'|"[^"]*"/g, "");
    if (/>/.test(ohne)) return AUSSERHALB.test(ohne.split(">").pop()) || GESCHUETZT.test(ohne.split(">").pop()) ? frage("Schreibt außerhalb/geschützt") : ok("Datei im Arbeitsordner schreiben");
    return AUSSERHALB.test(ohne.replace(/^\S+/, "")) ? frage("Liest außerhalb des Arbeitsordners") : ok("Lesen");
  }
  return frage("Unbekannter Befehl");
}
const ok = (grund) => ({ stufe: "erlaubt", grund });
const sperre = (grund) => ({ stufe: "gesperrt", grund });
const frage = (grund) => ({ stufe: "fragen", grund });

export function einstufung(werkzeug, eingabe, { adminPc = false } = {}) {
  if (werkzeug === "Bash") {
    const teileListe = teile(eingabe);
    if (!teileListe.length) return frage("Leerer Befehl");
    const st = teileListe.map((t) => eineStufe(t, { adminPc }));
    const gesperrt = st.find((x) => x.stufe === "gesperrt"); if (gesperrt) return gesperrt;
    const offen = st.find((x) => x.stufe === "fragen"); if (offen) return offen;
    return ok(st.map((x) => x.grund).filter((v, i, a) => a.indexOf(v) === i).join(", "));
  }
  const pfad = String(eingabe || "");
  if (["Read", "Grep", "Glob", "Edit", "Write", "NotebookEdit", "TodoWrite"].includes(werkzeug)) {
    if (/\.claude\/|\.ssh\/|\.codeschmiede\/|\.config\/gh|\.aws\/|zugriff\.token|\.env|\.pem$|\.key$/.test(pfad)) return sperre("Anmeldedaten und Einstellungen sind tabu");
    return frage("Datei außerhalb des Arbeitsordners");
  }
  if (werkzeug === "WebSearch") return ok("Im Internet suchen");
  if (werkzeug === "WebFetch") return frage("Webseite abrufen");
  if (/^mcp__/.test(werkzeug)) return sperre("Fremde Werkzeuge");
  return frage("Werkzeug");
}
