// Automatische Erlaubnis (Neue Anweisung Gerhard 2026-10-23 10:34, Entscheidung 10:36), Fassung 2 nach unabhängiger Prüfung (ROT):
// Automatisch ERLAUBT wird nur, was genau einem festen, harmlosen Muster entspricht (Positivliste) – ohne Shell-Sonderzeichen;
// Dateipfade werden auf dem PC echt aufgelöst (Symlinks) und müssen im Arbeitsordner liegen. GESPERRT ist, was nie sein darf.
// Alles andere: FRAGEN (wie bisher). Ergebnis: { stufe: "erlaubt" | "gesperrt" | "fragen", grund }
import { realpathSync } from "node:fs";
import path from "node:path";
import { fuehrtCodeAus } from "./ergebnis.mjs";

const ok = (grund) => ({ stufe: "erlaubt", grund });
const sperre = (grund) => ({ stufe: "gesperrt", grund });
const frage = (grund) => ({ stufe: "fragen", grund });

// ---------- Sperrliste (auf den rohen Text, absichtlich großzügig) ----------
const GEHEIM = /\.ssh|\.aws|\.config[\\/]gh|\.codeschmiede|zugriff\.token|(^|[\s\\/'"=])\.env\b|\.pem\b|\.key\b|\.claude[\\/]|\.credentials|\.netrc|\.npmrc|git-credentials|id_rsa|id_ed25519/i;
const STARTER = /^(npm|npx|pnpm|yarn|bun|node|deno|python\d*(\.\d+)?|py|pip\d*|make|cargo|go|vite|vitest|jest|playwright|tsx|ts-node|sh|bash|zsh|pwsh|powershell|cmd|java|ruby|perl|php)(\.exe|\.cmd)?$/i;
function fuehrtCodeAusIrgendwo(t) {
  const ohneZitate = t.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
  return ohneZitate.split(/&&|\|\||[;|\n\r`&]|\$\(|\(|\)/).some((s) => {
    const w = s.trim().split(/\s+/).filter((x) => !/^\w+=/.test(x));
    while (/^(timeout|env|exec|xargs|nohup|nice|time|command|builtin|then|do|else)$/.test(w[0] || "")) { w.shift(); while (/^-|^\d+$|^\w+=/.test(w[0] || "")) w.shift(); }
    return STARTER.test(w[0] || "") || fuehrtCodeAus(w.join(" ")) || /^(\.|source|eval)$/.test(w[0] || "");
  });
}
function gesperrt(roh, adminPc) {
  const t = String(roh);
  if (GEHEIM.test(t)) return "Anmeldedaten sind tabu";
  if (/\bgh\s+pr\s+(merge|close|reopen|ready|edit)\b|\bgh\s+(release|secret|variable|ruleset|auth)\b|\bgh\s+repo\s+(delete|edit|rename|archive)\b|\bgh\s+workflow\s+(run|enable|disable)\b|\bgh\s+run\s+(rerun|cancel|delete)\b/i.test(t))
    return "Zusammenführen, Freigaben und Einstellungen macht nur die Codeschmiede (Stationen)";
  if (/\bgh\s+api\b[^\n]*(\s-X\s*(?!GET\b)\w|--method\s+(?!GET\b)\w|\/merge\b|\s-f\s|\s-F\s|--field|--raw-field|--input)/i.test(t)) return "Schreibender GitHub-Zugriff";
  if (/\bgit\b[^\n]*\bpush\b[^\n]*(\s(main|master)\b|:|\s\+|\s-f\b|--force|--delete|\s-d\b|--mirror|--all|--tags|version\/|--no-verify)/i.test(t)) return "Push nur auf den eigenen Zweig";
  if (/\bgit\b[^\n]*\breset\s+--hard\b|\bgit\b[^\n]*\b(branch|tag)\b[^\n]*\s(-D|-d|--delete)\b|\bgit\s+config\b|\bgit\b[^\n]*\s-c\s+(?!user\.(name|email)=)[\w.-]+=/i.test(t)) return "Gefährlicher Git-Befehl";
  if (/\bsudo\b|\brm\s+-[a-z]*r[a-z]*\s+(\/|~|\$HOME|\.\.)|\bcurl\b[^\n]*\|\s*(ba|z)?sh\b/i.test(t)) return "Gefährlicher Befehl";
  if (adminPc && fuehrtCodeAusIrgendwo(t)) return "Auf dem Admin-PC wird kein Code ausgeführt – Bauen und Testen läuft in der Cloud (Cloudflare-Bau). Dateien mit Edit/Write ändern";
  return null;
}

// ---------- Erlaubt-Liste ----------
// Wörter: nur harmlose Zeichen; Zitate: '…' (wörtlich) oder "…" ohne $ ` \ !
const WORT = /^[A-Za-z0-9._/=:,@+-]+$/;
function woerter(seg) {
  const out = []; let rest = seg.trim();
  while (rest.length) {
    const kv = rest.match(/^([A-Za-z0-9._-]+=)"([^"$`\\!]*)"/);   // z. B. user.name="Claude (Werkstatt)"
    if (kv) { out.push({ w: kv[1] + kv[2], zitat: "wert" }); rest = rest.slice(kv[0].length); if (rest.length && !/^\s/.test(rest)) return null; rest = rest.trimStart(); continue; }
    const m = rest.match(/^'([^']*)'|^"([^"$`\\!]*)"|^([^\s'"]+)/);
    if (!m) return null;
    if (m[3] !== undefined) { if (!WORT.test(m[3])) return null; out.push({ w: m[3], zitat: false }); }
    else out.push({ w: m[1] ?? m[2], zitat: true });
    rest = rest.slice(m[0].length);
    if (rest.length && !/^\s/.test(rest)) return null;   // Zitat direkt an Wort geklebt: nicht sicher lesbar
    rest = rest.trimStart();
  }
  return out;
}
// Teilbefehle: nur an „&&“ und „;“ (außerhalb von Zitaten); „|“ nur in harmlose Filter
function zerlege(befehl) {
  const sauber = String(befehl).replace(/\s2>&1(?=\s|$)/g, " ").replace(/\s2?>\s*\/dev\/null(?=\s|$)/g, " ");
  const ohneZitate = sauber.replace(/'[^']*'/g, "''").replace(/"[^"$`\\!]*"/g, '""');
  if (/[\r\n`<>$\\()&{}*?\[\]~#!%^]/.test(ohneZitate.replace(/&&/g, ""))) return null;
  if (/["']/.test(ohneZitate.replace(/''|""/g, ""))) return null;   // offenes oder unsicheres Zitat
  const teile = []; let cur = ""; let q = null;
  for (let i = 0; i < sauber.length; i++) {
    const ch = sauber[i];
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; }
    if (sauber.startsWith("&&", i)) { teile.push(cur); cur = ""; i++; continue; }
    if (ch === ";") { teile.push(cur); cur = ""; continue; }
    cur += ch;
  }
  teile.push(cur);
  const ketten = [];
  for (const t of teile.map((x) => x.trim()).filter(Boolean)) {
    const glieder = []; let c = ""; q = null;
    for (const ch of t) { if (q) { c += ch; if (ch === q) q = null; continue; } if (ch === "'" || ch === '"') { q = ch; c += ch; continue; } if (ch === "|") { glieder.push(c.trim()); c = ""; continue; } c += ch; }
    glieder.push(c.trim());
    if (glieder.some((g) => !g)) return null;
    ketten.push(glieder);
  }
  return ketten;
}

const GESCHUETZT = /(^|[\\/])(\.github|\.claude|\.husky|\.git)([\\/]|$)|(^|[\\/])(package\.json|\.mcp\.json|\.gitattributes|\.gitmodules)$/;
function imOrdner(p, cwd, schreiben) {
  if (!p || /^[\\/~]|^[A-Za-z]:|(^|[\\/])\.\.([\\/]|$)/.test(p)) return false;
  let basis; try { basis = realpathSync(cwd); } catch { return false; }
  const voll = path.resolve(basis, p);
  let echt; try { echt = realpathSync(voll); } catch { try { echt = path.join(realpathSync(path.dirname(voll)), path.basename(voll)); } catch { echt = voll; } }
  const rel = path.relative(basis, echt);
  if (rel.startsWith("..") || path.isAbsolute(rel) || GEHEIM.test(echt)) return false;
  return !(schreiben && GESCHUETZT.test(rel));
}
const allePfade = (liste, cwd, schreiben = false) => liste.every((p) => imOrdner(p, cwd, schreiben));

const FILTER = /^(head|tail|wc|sort|uniq|grep|cut)$/;
const filterOk = (w) => FILTER.test(w[0]?.w || "") && !w[0].zitat && w.slice(1).every((x) => x.zitat || /^-[A-Za-z0-9]+$|^\d+$|^[A-Za-z0-9._:,=-]+$/.test(x.w));

function eineKette(kette, cwd) {
  const [erster, ...rest] = kette;
  for (const r of rest) { const w = woerter(r); if (!w || !filterOk(w)) return frage("Weitergabe an unbekannten Befehl"); }
  const w = woerter(erster); if (!w || !w.length || w[0].zitat) return frage("Befehl mit Sonderzeichen");
  const a = w.map((x) => x.w);
  const c0 = a[0];
  const opt = (x) => !x.zitat && x.w.startsWith("-");
  // Lesen im Arbeitsordner (Pfade echt aufgelöst)
  if (/^(ls|cat|head|tail|wc|stat|file)$/.test(c0)) {
    const p = w.slice(1).filter((x) => !opt(x) && !/^\d+$/.test(x.w)).map((x) => x.w);
    return allePfade(p, cwd) ? ok("Lesen im Arbeitsordner") : frage("Liest außerhalb des Arbeitsordners");
  }
  if (c0 === "grep" || c0 === "rg") {
    const args = w.slice(1).filter((x) => !opt(x));
    const p = args.slice(1).map((x) => x.w);   // erstes Nicht-Options-Argument = Suchmuster
    return args.length && allePfade(p, cwd) ? ok("Suchen im Arbeitsordner") : frage("Suche außerhalb des Arbeitsordners");
  }
  if (/^(pwd|true|date)$/.test(c0) && a.length === 1) return ok("Lesen");
  if (c0 === "git") {
    // Autor nur über -c user.name / user.email (Hooks hat die Werkstatt auf einen leeren Ordner gestellt)
    let i = 1; while (a[i] === "-c" && /^user\.(name|email)=/.test(a[i + 1] || "")) i += 2;
    const gw = w.slice(i); const g = gw.map((x) => x.w);
    if (!g.length || gw[0].zitat) return frage("Git-Befehl");
    if (gw.some((x) => !x.zitat && /^--(output|exec|upload-pack|receive-pack|ext-diff|textconv|config-env|git-dir|work-tree|namespace|super-prefix)/.test(x.w))) return frage("Git-Option");
    if (/^(status|fetch|rev-parse|ls-files|ls-remote|merge-base|shortlog|describe|diff|log|show)$/.test(g[0])) return ok("Git lesen");
    if (g[0] === "branch" && (g.length === 1 || (g.length === 2 && /^(-a|-r|-vv|--show-current|--list)$/.test(g[1])))) return ok("Git lesen");
    if (g[0] === "remote" && g[1] === "-v" && g.length === 2) return ok("Git lesen");
    if (g[0] === "add") {
      const p = gw.slice(1).filter((x) => x.w !== "--");
      if (p.every((x) => !x.zitat && /^(-A|-u|\.|--all)$/.test(x.w))) return ok("Git: Dateien vormerken");
      return p.every((x) => !opt(x)) && allePfade(p.map((x) => x.w), cwd, true) ? ok("Git: Dateien vormerken") : frage("Git add außerhalb/geschützt");
    }
    if (g[0] === "commit") {
      const o = gw.slice(1); let mOk = false;
      for (let k = 0; k < o.length; k++) {
        if (!o[k].zitat && /^(-q|--quiet|-a)$/.test(o[k].w)) continue;
        if (!o[k].zitat && /^(-m|-qm|-am)$/.test(o[k].w) && o[k + 1]) { mOk = true; k++; continue; }
        return frage("Commit mit besonderen Optionen");
      }
      return mOk ? ok("Git: Commit") : frage("Commit ohne Nachricht");
    }
    if (g[0] === "push") return /^push( -u| -q| --set-upstream)* origin (HEAD|feature\/cs-[0-9]+-[a-z0-9-]+)$/.test(g.join(" ")) ? ok("Push auf den eigenen Zweig") : frage("Push");
    if ((g[0] === "merge" || g[0] === "rebase") && g.slice(1).filter((x) => !/^(--no-edit|-q)$/.test(x)).join(" ") === "origin/main" && gw.every((x) => !x.zitat)) return ok("Stand von main übernehmen");
    if (/^(switch -c|checkout -b) feature\/cs-[0-9]+-[a-z0-9-]+$/.test(g.join(" "))) return ok("Eigener Zweig");
    if (g[0] === "restore" || (g[0] === "checkout" && g[1] === "--")) {
      const p = g.slice(g[0] === "restore" ? 1 : 2).filter((x) => !x.startsWith("-"));
      return p.length && allePfade(p, cwd, true) ? ok("Datei zurücksetzen") : frage("Git restore");
    }
    return frage("Git-Befehl");
  }
  if (c0 === "gh") {
    const roh = w.filter((x) => !x.zitat).map((x) => x.w);
    if (roh.some((x) => /^(-R|--repo|--web|-w|-F|--body-file|--head|-H|--hostname)$/.test(x))) return frage("GitHub mit besonderen Optionen");
    if (a[1] === "pr" && a[2] === "create") { const b = a.indexOf("--base"); return b > 0 && a[b + 1] === "main" ? ok("Pull Request öffnen") : frage("Pull Request ohne Ziel main"); }
    if ((a[1] === "pr" && /^(view|checks|list|diff|status)$/.test(a[2])) || (a[1] === "run" && /^(view|list)$/.test(a[2])) || (a[1] === "issue" && /^(view|list)$/.test(a[2]))) return ok("GitHub lesen");
    return frage("GitHub-Befehl");
  }
  return frage("Unbekannter Befehl");
}

export function einstufung(werkzeug, eingabe, { adminPc = false, cwd = process.cwd() } = {}) {
  const roh = String(eingabe ?? "");
  const sp = gesperrt(roh, adminPc); if (sp) return sperre(sp);
  if (werkzeug === "Bash") {
    const ketten = zerlege(roh);
    if (!ketten || !ketten.length) return frage("Befehl mit Shell-Sonderzeichen");
    const st = ketten.map((k) => eineKette(k, cwd));
    const offen = st.find((x) => x.stufe !== "erlaubt"); if (offen) return offen;
    return ok([...new Set(st.map((x) => x.grund))].join(", "));
  }
  if (werkzeug === "WebSearch") return ok("Im Internet suchen");
  if (/^mcp__/.test(werkzeug)) return sperre("Fremde Werkzeuge");
  return frage("Werkzeug");
}
