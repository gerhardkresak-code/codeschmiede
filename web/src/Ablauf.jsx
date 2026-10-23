import React, { useEffect, useMemo, useState } from "react";
import {
  GitBranch, Tag, Search, Loader2, Info, ShieldCheck, CircleCheck, CircleAlert, Clock, ExternalLink, BookOpen, History, Download, FileText, RefreshCw,
} from "lucide-react";
import { supabase } from "./supabase";
import { KiProtokoll } from "./KiAnbieter";

// Ablauf & Dokumentation (Anweisung Gerhard 2026-10-23 14:11 „Mache einfach alles fertig“):
// Zweige & Versionen, Prüfstand, Wissensdatenbank, Änderungsprotokoll, Dokumentation.
// Quelle: Projekt-Abgleich der Werkstatt (ws_zweige, ws_dokumente, ws_abgleich – Datenbank 0011) und die Aufträge.

const card = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const ghost = "inline-flex items-center justify-center gap-2 h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50";
const input = "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500";
const fmt = (d) => (d ? new Date(d).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–");
const ghUrl = (projekt, rest) => (projekt?.repo ? `https://github.com/${projekt.repo}${rest}` : null);

// ---------- Daten aus dem Abgleich ----------
function useAbgleich(projektId, mitInhalt = false) {
  const [st, setSt] = useState({ laden: true, zweige: [], dokumente: [], abgleich: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let aus = false;
    (async () => {
      const [z, dk, ab] = await Promise.all([
        supabase.from("ws_zweige").select("*").eq("projekt_id", projektId).order("datum", { ascending: false }),
        supabase.from("ws_dokumente").select(mitInhalt ? "pfad, sha, aktualisiert, inhalt" : "pfad, sha, aktualisiert").eq("projekt_id", projektId).order("pfad"),
        supabase.from("ws_abgleich").select("*").eq("projekt_id", projektId).maybeSingle(),
      ]);
      if (!aus) setSt({ laden: false, zweige: z.data || [], dokumente: dk.data || [], abgleich: ab.data || null, fehlt: !!(z.error && /does not exist|schema cache/i.test(z.error.message)) });
    })();
    const kanal = supabase.channel(`abgleich-${projektId}-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ws_abgleich", filter: `projekt_id=eq.${projektId}` }, () => setTick((t) => t + 1)).subscribe();
    return () => { aus = true; supabase.removeChannel(kanal); };
  }, [projektId, mitInhalt, tick]);
  return st;
}

function AbgleichHinweis({ st }) {
  if (st.fehlt) return <p className="text-xs text-amber-700 dark:text-amber-300">Die Datenbank-Erweiterung 0011 (Projekt-Abgleich) ist noch nicht eingespielt.</p>;
  if (!st.abgleich) return <p className="text-xs text-slate-500 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />Noch kein Abgleich – sobald eine Werkstatt (Admin oder Entwickler) eingeschaltet ist, kommt der Stand innerhalb weniger Minuten.</p>;
  return <p className="text-xs text-slate-500 flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" />Stand aus GitHub: {fmt(st.abgleich.zeit)} · main <span className="font-mono">{st.abgleich.main_sha?.slice(0, 7)}</span> · alle 10 Minuten automatisch</p>;
}

function Kopf({ icon: I, titel, text, children }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1"><h2 className="font-display font-bold text-xl leading-tight flex items-center gap-2"><I className="w-5 h-5 text-emerald-700" />{titel}</h2>
        {text && <p className="text-sm text-slate-500">{text}</p>}</div>
      {children}
    </div>);
}

// ---------- Markdown (eigene, sichere Darstellung: kein HTML aus dem Text, Links nur http/https) ----------
function inline(text, k = "i") {
  const teile = []; let rest = text; let n = 0;
  const muster = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))|(~~([^~]+)~~)|(\*([^*\s][^*]*)\*)/;
  while (rest) {
    const m = rest.match(muster);
    if (!m) { teile.push(rest); break; }
    if (m.index) teile.push(rest.slice(0, m.index));
    const key = `${k}-${n++}`;
    if (m[1]) teile.push(<b key={key}>{inline(m[2], key)}</b>);
    else if (m[3]) teile.push(<code key={key} className="font-mono text-[0.85em] bg-slate-100 dark:bg-slate-800 rounded px-1">{m[4]}</code>);
    else if (m[5]) teile.push(/^https?:\/\//i.test(m[7]) ? <a key={key} href={m[7]} target="_blank" rel="noopener noreferrer" className="text-emerald-700 dark:text-emerald-400 underline">{m[6]}</a> : <span key={key} className="underline decoration-dotted">{m[6]}</span>);
    else if (m[8]) teile.push(<s key={key}>{m[9]}</s>);
    else if (m[10]) teile.push(<i key={key}>{m[11]}</i>);
    rest = rest.slice(m.index + m[0].length);
  }
  return teile;
}
export function Markdown({ text, suche }) {
  const bloecke = useMemo(() => {
    const z = (text || "").replace(/\r/g, "").split("\n"); const out = []; let i = 0;
    while (i < z.length) {
      const l = z[i];
      if (/^```/.test(l)) { const code = []; i++; while (i < z.length && !/^```/.test(z[i])) code.push(z[i++]); i++; out.push({ t: "code", v: code.join("\n") }); continue; }
      const h = l.match(/^(#{1,4})\s+(.*)/); if (h) { out.push({ t: "h", n: h[1].length, v: h[2] }); i++; continue; }
      if (/^\s*\|/.test(l)) { const rows = []; while (i < z.length && /^\s*\|/.test(z[i])) rows.push(z[i++]); out.push({ t: "table", v: rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map((r) => r.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim())) }); continue; }
      if (/^\s*([-*]|\d+\.)\s+/.test(l)) { const it = []; const nr = /^\s*\d+\./.test(l); while (i < z.length && /^\s*([-*]|\d+\.)\s+/.test(z[i])) { it.push({ tief: (z[i].match(/^\s*/)[0].length >= 2), v: z[i].replace(/^\s*([-*]|\d+\.)\s+/, "") }); i++; } out.push({ t: nr ? "ol" : "ul", v: it }); continue; }
      if (/^>\s?/.test(l)) { const q = []; while (i < z.length && /^>\s?/.test(z[i])) q.push(z[i++].replace(/^>\s?/, "")); out.push({ t: "q", v: q.join(" ") }); continue; }
      if (/^\s*(---|\*\*\*)\s*$/.test(l)) { out.push({ t: "hr" }); i++; continue; }
      if (!l.trim()) { i++; continue; }
      const p = []; while (i < z.length && z[i].trim() && !/^(#{1,4}\s|```|\s*\||\s*([-*]|\d+\.)\s+|>)/.test(z[i])) p.push(z[i++]);
      out.push({ t: "p", v: p.join(" ") });
    }
    return out;
  }, [text]);
  const treffer = (s) => !suche || String(s).toLowerCase().includes(suche.toLowerCase());
  return (
    <div className="text-sm leading-relaxed text-slate-800 dark:text-slate-200 flex flex-col gap-2.5 min-w-0">
      {bloecke.map((b, k) => {
        if (b.t === "h") { const C = `h${Math.min(4, b.n + 1)}`; return <C key={k} className={`font-display font-bold ${b.n === 1 ? "text-xl" : b.n === 2 ? "text-lg mt-2" : "text-base mt-1"}`}>{inline(b.v, `h${k}`)}</C>; }
        if (b.t === "code") return <pre key={k} className="font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 overflow-x-auto whitespace-pre">{b.v}</pre>;
        if (b.t === "table") {
          const [kopf, ...rows] = b.v; const zeigen = rows.filter((r) => treffer(r.join(" ")));
          return (
            <div key={k} className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-950"><tr>{kopf.map((c, j) => <th key={j} className="text-left font-semibold px-2.5 py-2 align-top">{inline(c, `t${k}${j}`)}</th>)}</tr></thead>
                <tbody>{zeigen.map((r, j) => <tr key={j} className="border-t border-slate-100 dark:border-slate-800">{r.map((c, x) => <td key={x} className="px-2.5 py-2 align-top">{inline(c, `t${k}-${j}-${x}`)}</td>)}</tr>)}</tbody></table>
              {suche && zeigen.length < rows.length && <p className="text-[11px] text-slate-500 px-2.5 py-1.5 border-t border-slate-100 dark:border-slate-800">{zeigen.length} von {rows.length} Zeilen passen zur Suche</p>}
            </div>);
        }
        if (b.t === "ul" || b.t === "ol") { const L = b.t; return <L key={k} className={`${L === "ol" ? "list-decimal" : "list-disc"} pl-5 flex flex-col gap-1`}>{b.v.map((x, j) => <li key={j} className={x.tief ? "ml-4" : ""}>{inline(x.v, `l${k}${j}`)}</li>)}</L>; }
        if (b.t === "q") return <blockquote key={k} className="border-l-4 border-emerald-600 pl-3 text-slate-600 dark:text-slate-300">{inline(b.v, `q${k}`)}</blockquote>;
        if (b.t === "hr") return <hr key={k} className="border-slate-200 dark:border-slate-800" />;
        return <p key={k}>{inline(b.v, `p${k}`)}</p>;
      })}
    </div>);
}

// ---------- Zweige & Versionen ----------
export function ZweigeVersionen({ d }) {
  const projekt = d.projekte.find((p) => p.id === d.projektId);
  const st = useAbgleich(d.projektId);
  const [filter, setFilter] = useState("arbeit"); const [q, setQ] = useState("");
  const auftragZu = useMemo(() => Object.fromEntries(d.auftraege.filter((a) => a.zweig).map((a) => [a.zweig, a])), [d.auftraege]);
  const arten = { arbeit: (z) => !/^(version|ci)\//.test(z.name) && z.name !== "main", version: (z) => /^version\//.test(z.name), alle: () => true };
  const liste = st.zweige.filter(arten[filter]).filter((z) => !q || `${z.name} ${z.betreff}`.toLowerCase().includes(q.toLowerCase()));
  const versionen = st.zweige.filter((z) => /^version\//.test(z.name)).sort((a, b) => b.name.localeCompare(a.name, "de", { numeric: true }));
  return (
    <section className="flex flex-col gap-3" aria-label="Zweige & Versionen">
      <Kopf icon={GitBranch} titel="Zweige & Versionen" text="Alle Zweige des Projekts mit letztem Stand und Abstand zu main. Jede Version ist als eigener Zweig gesichert und kann wiederhergestellt werden." />
      <AbgleichHinweis st={st} />
      <div className="grid gap-3 grid-cols-[minmax(0,1fr)] sm:grid-cols-3">
        {[["Arbeitszweige", st.zweige.filter(arten.arbeit).length, GitBranch], ["Gesicherte Versionen", versionen.length, Tag], ["Neueste Version", versionen[0]?.name.replace("version/", "") || "–", Tag]].map(([t, v, I]) => (
          <div key={t} className={`${card} p-4 flex items-center gap-3`}><I className="w-5 h-5 text-emerald-700" /><div><div className="text-xs text-slate-500">{t}</div><div className="font-display font-bold text-xl">{v}</div></div></div>))}
      </div>
      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-slate-200 dark:border-slate-800">
          {[["arbeit", "Arbeitszweige"], ["version", "Versionen"], ["alle", "Alle"]].map(([k, t]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={`h-8 px-3 rounded-lg text-sm font-semibold border ${filter === k ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "border-slate-200 dark:border-slate-800"}`}>{t}</button>)}
          <label className="relative ml-auto w-full sm:w-64"><Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" /><input className={`${input} pl-8`} placeholder="Zweig suchen" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        </div>
        {st.laden ? <div className="grid place-items-center py-10"><Loader2 className="w-5 h-5 animate-spin text-emerald-700" /></div>
          : !liste.length ? <p className="p-6 text-sm text-slate-500">Keine Zweige in dieser Auswahl.</p>
          : <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500"><tr><th className="text-left px-3 py-2">Zweig</th><th className="text-left px-3 py-2">Letzter Stand</th><th className="text-left px-3 py-2 whitespace-nowrap">Zu main</th><th className="text-left px-3 py-2">Auftrag</th><th /></tr></thead>
            <tbody>{liste.map((z) => {
              const a = auftragZu[z.name];
              const zustand = z.vor === 0 ? <span className="text-green-700 dark:text-green-400">in main enthalten</span> : z.vor != null ? <span>{z.vor} neu{z.hinter ? <span className="text-amber-700 dark:text-amber-400"> · {z.hinter} hinter main</span> : ""}</span> : "–";
              return (
                <tr key={z.name} className="border-t border-slate-100 dark:border-slate-800 align-top">
                  <td className="px-3 py-2"><div className="font-mono text-xs break-all">{z.name}</div></td>
                  <td className="px-3 py-2 min-w-[220px]"><div className="line-clamp-2">{z.betreff || "–"}</div><div className="text-xs text-slate-500">{fmt(z.datum)} · <span className="font-mono">{z.sha.slice(0, 7)}</span></div></td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{zustand}</td>
                  <td className="px-3 py-2 text-xs">{a ? <>#{a.id} {a.pr_nummer ? `· PR #${a.pr_nummer}` : ""}</> : "–"}</td>
                  <td className="px-3 py-2">{ghUrl(projekt, `/tree/${z.name}`) && <a className="text-slate-400 hover:text-emerald-700" href={ghUrl(projekt, `/tree/${encodeURI(z.name)}`)} target="_blank" rel="noopener noreferrer" title="In GitHub öffnen"><ExternalLink className="w-4 h-4" /></a>}</td>
                </tr>);
            })}</tbody></table></div>}
      </div>
      <p className="text-xs text-slate-500">Wiederherstellen einer Version: als Auftrag „Version … wiederherstellen“ an die Gruppe geben – die Werkstatt baut sie über den normalen Weg (Freigabe, Prüfungen) zurück.</p>
    </section>);
}

// ---------- Prüfstand ----------
const STATION = [["freigabe", "Freigabe"], ["sicherheit", "Sicherheitsprüfung"], ["zusammen", "Zusammenführen"], ["feature", "Feature-Prüfung"], ["nacharbeit", "Nacharbeit"]];
function Ergebnis({ p, titel }) {
  if (!p) return null;
  const e = p.ergebnis; const I = e === "gruen" ? CircleCheck : e === "laeuft" ? Loader2 : e === "rot" ? CircleAlert : Clock;
  const cls = e === "gruen" ? "text-green-700 dark:text-green-400" : e === "rot" ? "text-red-600 dark:text-red-400" : "text-slate-500";
  return (
    <div className="text-xs flex flex-col gap-0.5">
      <span className={`inline-flex items-center gap-1.5 font-semibold ${cls}`}><I className={`w-3.5 h-3.5 ${e === "laeuft" ? "animate-spin" : ""}`} />{titel}: {e === "gruen" ? "grün" : e === "rot" ? "rot" : e === "laeuft" ? "läuft" : e || "–"}</span>
      <span className="text-slate-500">{fmt(p.zeit)}{p.pc ? ` · ${p.pc}` : ""}{p.ki ? ` · geprüft von ${p.ki}` : ""}</span>
      {p.befund && <span className="text-slate-600 dark:text-slate-300 line-clamp-3 whitespace-pre-line">{String(p.befund).slice(0, 400)}</span>}
    </div>);
}
export function Pruefstand({ d }) {
  const projekt = d.projekte.find((p) => p.id === d.projektId);
  const gruppe = (id) => d.gruppen.find((g) => g.id === id)?.name || "–";
  const feature = (id) => d.features.find((f) => f.id === id)?.name;
  const offen = d.auftraege.filter((a) => STATION.some(([k]) => k === a.stand));
  const zuletzt = d.auftraege.filter((a) => a.pruefung && Object.keys(a.pruefung).length && ["wissen", "erledigt"].includes(a.stand)).sort((a, b) => Date.parse(b.geaendert) - Date.parse(a.geaendert)).slice(0, 15);
  const zeile = (a) => (
    <div key={a.id} className="border-t border-slate-100 dark:border-slate-800 p-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="min-w-0"><div className="text-xs text-slate-500">#{a.id} · {gruppe(a.gruppe_id)}{feature(a.feature_id) ? ` › ${feature(a.feature_id)}` : ""}</div>
        <div className="font-semibold text-sm">{a.titel}</div>
        <div className="text-xs text-slate-500 flex flex-wrap gap-x-3">{a.zweig && <span className="font-mono break-all">{a.zweig}</span>}{a.pr_nummer && ghUrl(projekt, `/pull/${a.pr_nummer}`) && <a href={ghUrl(projekt, `/pull/${a.pr_nummer}`)} target="_blank" rel="noopener noreferrer" className="text-emerald-700 dark:text-emerald-400 underline">PR #{a.pr_nummer}</a>}</div></div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Ergebnis p={a.pruefung?.lokal} titel="Bauen & Tests" />
        <Ergebnis p={a.pruefung?.sicherheit} titel="Sicherheit" />
        <Ergebnis p={a.pruefung?.feature} titel="Feature" />
        {!a.pruefung?.lokal && !a.pruefung?.sicherheit && !a.pruefung?.feature && <span className="text-xs text-slate-500">Noch keine Prüfung gelaufen.</span>}
      </div>
    </div>);
  return (
    <section className="flex flex-col gap-3" aria-label="Prüfstand">
      <Kopf icon={ShieldCheck} titel="Prüfstand" text="Wo jeder Auftrag auf dem Weg nach live steht und was die Prüfungen ergeben haben. Rot an einer Prüfung = Nacharbeit, live geht nichts." />
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-5">
        {STATION.map(([k, t]) => { const n = offen.filter((a) => a.stand === k).length; return <div key={k} className={`${card} p-3`}><div className="text-xs text-slate-500">{t}</div><div className={`font-display font-bold text-2xl ${n ? "text-emerald-700" : "text-slate-300 dark:text-slate-700"}`}>{n}</div></div>; })}
      </div>
      {STATION.map(([k, t]) => { const l = offen.filter((a) => a.stand === k); return l.length ? <div key={k} className={`${card} overflow-hidden`}><h3 className="px-3 py-2 font-display font-bold bg-slate-50 dark:bg-slate-950">{t} <span className="text-slate-500 font-normal">({l.length})</span></h3>{l.map(zeile)}</div> : null; })}
      {!offen.length && <div className={`${card} p-6 text-sm text-slate-500 flex items-center gap-2`}><CircleCheck className="w-5 h-5 text-green-600" />Gerade wartet kein Auftrag auf eine Prüfung oder Freigabe.</div>}
      {zuletzt.length > 0 && <div className={`${card} overflow-hidden`}><h3 className="px-3 py-2 font-display font-bold bg-slate-50 dark:bg-slate-950">Zuletzt geprüft und abgeschlossen</h3>{zuletzt.map(zeile)}</div>}
      <p className="text-xs text-slate-500">Zusätzlich prüft jeder Cloudflare-Bau der App automatisch Backend-Funktionen und Code-Check; ein roter Bau erzeugt keine Testseite.</p>
    </section>);
}

// ---------- Dokumente (Wissensdatenbank, Änderungsprotokoll, Dokumentation) ----------
function useDokument(projektId, pfad) {
  const [st, setSt] = useState({ laden: true, inhalt: "" });
  useEffect(() => {
    let aus = false; setSt({ laden: true, inhalt: "" });
    if (!pfad) { setSt({ laden: false, inhalt: "" }); return undefined; }
    supabase.from("ws_dokumente").select("inhalt, aktualisiert, sha").eq("projekt_id", projektId).eq("pfad", pfad).maybeSingle()
      .then(({ data }) => { if (!aus) setSt({ laden: false, inhalt: data?.inhalt || "", da: !!data, aktualisiert: data?.aktualisiert }); });
    return () => { aus = true; };
  }, [projektId, pfad]);
  return st;
}
const speichern = (name, text) => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

function DokAnsicht({ d, pfad, icon, titel, text, leer, extra }) {
  const st = useAbgleich(d.projektId);
  const dok = useDokument(d.projektId, pfad);
  const [q, setQ] = useState("");
  const projekt = d.projekte.find((p) => p.id === d.projektId);
  return (
    <section className="flex flex-col gap-3" aria-label={titel}>
      <Kopf icon={icon} titel={titel} text={text}>
        <label className="relative w-full sm:w-64"><Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" /><input className={`${input} pl-8`} placeholder="In Tabellen suchen" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        {dok.da && <button type="button" className={ghost} onClick={() => speichern(`${projekt?.id || "projekt"}-${pfad.split("/").pop()}`, dok.inhalt)}><Download className="w-4 h-4" />Herunterladen</button>}
      </Kopf>
      <AbgleichHinweis st={st} />
      {extra}
      <div className={`${card} p-4 sm:p-6 min-w-0`}>
        {dok.laden ? <Loader2 className="w-5 h-5 animate-spin text-emerald-700" /> : dok.da ? <Markdown text={dok.inhalt} suche={q} /> : <p className="text-sm text-slate-500">{leer}</p>}
      </div>
    </section>);
}

export function Wissensdatenbank({ d }) {
  const gruppe = (id) => d.gruppen.find((g) => g.id === id)?.name || "–";
  const imWissen = d.auftraege.filter((a) => a.stand === "wissen").sort((a, b) => Date.parse(b.geaendert) - Date.parse(a.geaendert)).slice(0, 12);
  const extra = imWissen.length ? (
    <div className={`${card} overflow-hidden`}><h3 className="px-3 py-2 font-display font-bold bg-slate-50 dark:bg-slate-950">Zuletzt live & im Wissen</h3>
      {imWissen.map((a) => <div key={a.id} className="border-t border-slate-100 dark:border-slate-800 px-3 py-2 text-sm flex flex-wrap gap-x-3"><span className="text-slate-500">#{a.id}</span><b className="font-semibold">{a.titel}</b><span className="text-slate-500">{gruppe(a.gruppe_id)} · {fmt(a.geaendert)}</span></div>)}
    </div>) : null;
  return <DokAnsicht d={d} pfad="docs/WISSEN.md" icon={BookOpen} titel="Wissensdatenbank" extra={extra}
    text="Was abgeschlossen und live ist, mit Entscheidungen – damit jeder Chat und jede Werkstatt darauf aufbaut."
    leer="Für dieses Projekt gibt es noch keine docs/WISSEN.md." />;
}

export function Aenderungsprotokoll({ d }) {
  const [quelle, setQuelle] = useState("projekt");
  const [cs, setCs] = useState({ laden: false, inhalt: "" });
  useEffect(() => {
    if (quelle !== "codeschmiede" || cs.inhalt) return undefined;
    setCs({ laden: true, inhalt: "" });
    fetch("https://raw.githubusercontent.com/gerhardkresak-code/codeschmiede/main/docs/CHANGELOG.md", { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : "")).then((t) => setCs({ laden: false, inhalt: t })).catch(() => setCs({ laden: false, inhalt: "" }));
  }, [quelle, cs.inhalt]);
  const schalter = (
    <div className="flex gap-2">{[["projekt", "Projekt"], ["codeschmiede", "Codeschmiede"], ["ki", "KI-Protokoll"]].map(([k, t]) => <button key={k} type="button" aria-pressed={quelle === k} onClick={() => setQuelle(k)} className={`h-8 px-3 rounded-lg text-sm font-semibold border ${quelle === k ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "border-slate-200 dark:border-slate-800"}`}>{t}</button>)}</div>);
  if (quelle === "projekt") return <DokAnsicht d={d} pfad="docs/CHANGELOG.md" icon={History} titel="Änderungsprotokoll" extra={schalter}
    text="Jede Änderung: was, wer, wann. Jede Version ist als eigener Zweig gesichert." leer="Für dieses Projekt gibt es noch kein docs/CHANGELOG.md." />;
  if (quelle === "ki") return (
    <section className="flex flex-col gap-3" aria-label="KI-Protokoll">
      <Kopf icon={History} titel="Änderungsprotokoll" text="Welcher KI-Anbieter hat geantwortet (im Chat bewusst nicht sichtbar)." />
      {schalter}
      <div className={`${card} p-3 min-w-0`}><KiProtokoll /></div>
    </section>);
  return (
    <section className="flex flex-col gap-3" aria-label="Änderungsprotokoll Codeschmiede">
      <Kopf icon={History} titel="Änderungsprotokoll" text="Änderungen an der Codeschmiede selbst." />
      {schalter}
      <div className={`${card} p-4 sm:p-6 min-w-0`}>{cs.laden ? <Loader2 className="w-5 h-5 animate-spin text-emerald-700" /> : cs.inhalt ? <Markdown text={cs.inhalt} /> : <p className="text-sm text-slate-500">Konnte nicht geladen werden.</p>}</div>
    </section>);
}

export function Dokumentation({ d }) {
  const st = useAbgleich(d.projektId);
  const projekt = d.projekte.find((p) => p.id === d.projektId);
  const [pfad, setPfad] = useState(null); const [q, setQ] = useState(""); const [busy, setBusy] = useState(false);
  const dok = useDokument(d.projektId, pfad);
  const liste = st.dokumente.filter((x) => !q || x.pfad.toLowerCase().includes(q.toLowerCase()));
  const alles = async () => {
    setBusy(true);
    const { data } = await supabase.from("ws_dokumente").select("pfad, inhalt, aktualisiert").eq("projekt_id", d.projektId).order("pfad");
    setBusy(false);
    const kopf = `# Dokumentation – ${projekt?.name || d.projektId}\n\nStand aus GitHub (main ${st.abgleich?.main_sha?.slice(0, 7) || "–"}), heruntergeladen ${new Date().toLocaleString("de-AT")}.\n\n## Inhalt\n${(data || []).map((x) => `- ${x.pfad}`).join("\n")}\n`;
    speichern(`${projekt?.id || "projekt"}-dokumentation-${new Date().toISOString().slice(0, 10)}.md`, kopf + (data || []).map((x) => `\n\n---\n\n<!-- Datei: ${x.pfad} -->\n\n${x.inhalt}`).join(""));
  };
  return (
    <section className="flex flex-col gap-3" aria-label="Dokumentation">
      <Kopf icon={FileText} titel="Dokumentation" text="Die komplette Projekt-Dokumentation aus main – jederzeit einsehbar und herunterladbar.">
        <button type="button" className={ghost} disabled={busy || !st.dokumente.length} onClick={alles}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}Alles herunterladen</button>
      </Kopf>
      <AbgleichHinweis st={st} />
      <div className="grid gap-3 grid-cols-[minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className={`${card} p-2 flex flex-col gap-1 max-h-[70vh] overflow-auto`}>
          <label className="relative mb-1"><Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" /><input className={`${input} pl-8`} placeholder="Datei suchen" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          {st.laden ? <Loader2 className="w-5 h-5 animate-spin text-emerald-700 m-3" /> : !liste.length ? <p className="text-sm text-slate-500 p-2">Keine Dokumente.</p>
            : liste.map((x) => <button key={x.pfad} type="button" aria-current={pfad === x.pfad} onClick={() => setPfad(x.pfad)} className={`text-left px-2.5 py-1.5 rounded-lg text-sm break-all ${pfad === x.pfad ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}>{x.pfad}</button>)}
        </div>
        <div className={`${card} p-4 sm:p-6 min-w-0`}>
          {!pfad ? <p className="text-sm text-slate-500">Links eine Datei wählen.</p> : dok.laden ? <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
            : <><div className="flex items-center gap-2 mb-3"><span className="font-mono text-xs text-slate-500 break-all flex-1">{pfad} · {fmt(dok.aktualisiert)}</span><button type="button" className={ghost} onClick={() => speichern(pfad.split("/").pop(), dok.inhalt)}><Download className="w-4 h-4" />Datei</button></div><Markdown text={dok.inhalt} /></>}
        </div>
      </div>
    </section>);
}
