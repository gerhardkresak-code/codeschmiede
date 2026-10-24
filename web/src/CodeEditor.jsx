// Code ansehen und von Hand ändern (Entwurf „Code-Editor“ 1.0, freigegeben von Gerhard 2026-10-24 14:57, Datenbank 0031).
// Links Dateien des Zweigs, Mitte Editor, rechts die eigenen Änderungen. Gelesen wird über eine Werkstatt (nur lesen),
// gespeichert als Auftrag „Hand-Änderung“ – eigener Zweig, Pull Request, Prüfungen und Freigabe. Nie direkt in main.
// Ändern dürfen der Admin und Entwickler mit Auftrags-Recht; Texter und Leser sehen nur. Bearbeitet wird nur auf main.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Code2, FileText, Lock, Loader2, Search, GitPullRequest, X, RefreshCw, Info, Check, FolderOpen } from "lucide-react";
import { supabase } from "./supabase";

const fehler = (e) => (e?.message || "Unbekannter Fehler").replace(/^.*?ERROR:\s*/, "");
const btn = "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-display font-bold tracking-wide transition";
const ghost = "inline-flex items-center justify-center gap-2 h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition";
const card = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const input = "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-[15px] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500";

const merk = {
  lies: (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } },
  schreib: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Speicher */ } },
};

/** Anfrage an die Werkstatt stellen und auf die Antwort warten (Realtime + Abfrage als Rückfall). */
async function frage(projekt, zweig, art, pfad, pc) {
  const { data: id, error } = await supabase.rpc("ws_code_anfragen", { p_projekt: projekt, p_zweig: zweig, p_art: art, p_pfad: pfad || null, p_pc: pc || null });
  if (error) throw error;
  const ende = Date.now() + 45000;
  while (Date.now() < ende) {
    await new Promise((r) => setTimeout(r, 700));
    const { data } = await supabase.from("ws_code_anfragen").select("*").eq("id", id).maybeSingle();
    if (data?.stand === "fertig") return data;
    if (data?.stand === "fehler") throw new Error(data.hinweis || "Die Werkstatt konnte die Datei nicht lesen");
  }
  throw new Error("Keine Antwort – läuft eine Werkstatt? (Admin-PC oder dein eigener Werkstatt-PC muss an sein)");
}

/** Einfache Zeilen-Gegenüberstellung: nur geänderte Zeilen mit je einer Zeile Umgebung. */
function diffZeilen(alt, neu) {
  const a = alt.split("\n"); const b = neu.split("\n"); const out = []; let i = 0; let j = 0;
  if (a.length * b.length > 4e6) return [["k", "(Datei zu lang für die Gegenüberstellung)"]];
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { out.push(["k", `  ${a[i]}`]); i++; j++; }
    else if (j < b.length && a.indexOf(b[j], i) < 0) { out.push(["p", `+ ${b[j]}`]); j++; }
    else if (i < a.length) { out.push(["m", `- ${a[i]}`]); i++; }
    else { out.push(["p", `+ ${b[j]}`]); j++; }
  }
  return out.filter((z, k) => z[0] !== "k" || (out[k - 1] && out[k - 1][0] !== "k") || (out[k + 1] && out[k + 1][0] !== "k")).slice(0, 400);
}

export default function CodeEditor({ d, ich, toast, onAuftrag }) {
  const projekt = d.projekte.find((p) => p.id === d.projektId);
  const rolle = ich.rolle === "admin" ? "admin" : d.mitglieder.find((m) => m.projekt_id === d.projektId && m.benutzer_id === ich.id)?.rolle;
  const gruppen = useMemo(() => d.gruppen.filter((g) => rolle === "admin" || (rolle === "entwickler" && d.rechte.some((r) => r.benutzer_id === ich.id && r.bereich_id === g.bereich_id && r.auftraege))), [d.gruppen, d.rechte, rolle, ich.id]);
  const darfAendern = rolle === "admin" || (rolle === "entwickler" && gruppen.length > 0);
  const meinPc = (d.pcs || []).find((p) => p.benutzer_id === ich.id && p.an && Date.now() - new Date(p.zuletzt).getTime() < 180000)?.id || null;
  const [zweige, setZweige] = useState(["main"]);
  const [zweig, setZweig] = useState("main");
  const [baum, setBaum] = useState(null); const [stand, setStand] = useState(null); const [laedt, setLaedt] = useState(false); const [baumFehler, setBaumFehler] = useState("");
  const [q, setQ] = useState("");
  const [offen, setOffen] = useState([]); const [aktiv, setAktiv] = useState(null);
  const [dateien, setDateien] = useState({});   // pfad -> { inhalt, blob_sha, nur_lesen, hinweis, laedt, fehler }
  const kEntwurf = `cs-code-entwurf-${d.projektId}`;
  const [entwurf, setEntwurf] = useState(() => merk.lies(kEntwurf) || {});   // pfad -> { inhalt, basis_blob, basis_sha }
  const [dialog, setDialog] = useState(false);
  const textRef = useRef(null); const zeilenRef = useRef(null);
  useEffect(() => { merk.schreib(kEntwurf, Object.keys(entwurf).length ? entwurf : null); }, [entwurf, kEntwurf]);

  useEffect(() => {
    supabase.from("ws_zweige").select("name").eq("projekt_id", d.projektId).order("datum", { ascending: false }).limit(200)
      .then(({ data }) => setZweige(["main", ...(data || []).map((z) => z.name).filter((n) => n !== "main" && !/^ci\//.test(n))]));
  }, [d.projektId]);

  const ladeBaum = useCallback(async () => {
    if (!projekt?.repo) return;
    setLaedt(true); setBaumFehler("");
    try { const r = await frage(projekt.id, zweig, "baum", null, meinPc); setBaum(r.baum || []); setStand(r.stand_sha); }
    catch (e) { setBaumFehler(fehler(e)); setBaum(null); }
    finally { setLaedt(false); }
  }, [projekt?.id, projekt?.repo, zweig, meinPc]);
  useEffect(() => { setDateien({}); setOffen([]); setAktiv(null); ladeBaum(); }, [ladeBaum]);

  const oeffne = async (p) => {
    setOffen((o) => (o.includes(p) ? o : [...o, p])); setAktiv(p);
    if (dateien[p] && !dateien[p].fehler) return;
    setDateien((x) => ({ ...x, [p]: { laedt: true } }));
    try { const r = await frage(projekt.id, zweig, "datei", p, meinPc); setDateien((x) => ({ ...x, [p]: r })); }
    catch (e) { setDateien((x) => ({ ...x, [p]: { fehler: fehler(e) } })); }
  };
  const schliesse = (p) => { setOffen((o) => o.filter((x) => x !== p)); if (aktiv === p) setAktiv(offen.filter((x) => x !== p).slice(-1)[0] || null); };

  const datei = aktiv ? dateien[aktiv] : null;
  const bearbeitbar = !!datei && !datei.laedt && !datei.fehler && datei.inhalt != null && !datei.nur_lesen && darfAendern && zweig === "main";
  const wert = aktiv && entwurf[aktiv] ? entwurf[aktiv].inhalt : datei?.inhalt ?? "";
  const aendern = (v) => {
    if (!bearbeitbar) return;
    setEntwurf((e) => {
      const n = { ...e };
      if (v === datei.inhalt && (!e[aktiv] || e[aktiv].basis_blob === datei.blob_sha)) delete n[aktiv]; else n[aktiv] = { inhalt: v, basis_blob: e[aktiv]?.basis_blob ?? datei.blob_sha, basis_sha: e[aktiv]?.basis_sha ?? stand };
      return n;
    });
  };
  const geaendert = Object.keys(entwurf);
  const zeilen = useMemo(() => Array.from({ length: Math.max(1, String(wert).split("\n").length) }, (_, i) => i + 1).join("\n"), [wert]);
  const liste = useMemo(() => (baum || []).filter((x) => !q || x.p.toLowerCase().includes(q.toLowerCase())).slice(0, 3000), [baum, q]);
  const ordnerVon = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");

  if (!projekt) return null;
  if (!projekt.repo) return <p className={`${card} p-4 text-sm text-slate-500`}>Das Projekt hat noch kein GitHub-Repository – unter „Projekte verwalten“ anlegen.</p>;
  return (
    <section className="flex flex-col gap-3" aria-label="Code">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display font-bold text-xl leading-tight flex items-center gap-2"><Code2 className="w-5 h-5 text-emerald-700" />Code</h2>
        <label className="sr-only" htmlFor="cs-code-zweig">Zweig</label>
        <select id="cs-code-zweig" className={`${input} w-auto max-w-[260px] py-1.5 text-sm font-mono`} value={zweig} onChange={(e) => setZweig(e.target.value)}>
          {zweige.map((z) => <option key={z} value={z}>{z === "main" ? "main (Testfassung)" : z}</option>)}</select>
        <button type="button" className={ghost} onClick={ladeBaum} disabled={laedt} title="Neu laden">{laedt ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}</button>
        <span className="flex-1" />
        <span className="text-xs text-slate-500">{!darfAendern ? "Nur ansehen (deine Rolle)" : zweig !== "main" ? "Andere Zweige nur ansehen – bearbeitet wird auf main" : "Änderungen werden als Auftrag gespeichert"}</span>
      </div>
      <div className={`${card} grid grid-cols-[minmax(0,1fr)] md:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_300px] min-h-[600px] lg:h-[calc(100vh-200px)] overflow-hidden`}>
        <nav className="border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-col min-h-0 max-h-[260px] md:max-h-none" aria-label="Dateien">
          <div className="p-2 border-b border-slate-200 dark:border-slate-800 relative"><Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${input} pl-8 py-1.5 text-sm`} placeholder="Datei suchen …" aria-label="Datei suchen" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="flex-1 overflow-auto p-1.5 text-sm">
            {laedt && <p className="p-3 text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Werkstatt liest den Zweig …</p>}
            {baumFehler && <p className="p-3 text-red-700 dark:text-red-300 text-xs">{baumFehler}</p>}
            {!laedt && liste.map((x, i) => {
              const o = ordnerVon(x.p); const neuOrdner = i === 0 || ordnerVon(liste[i - 1].p) !== o;
              return (<React.Fragment key={x.p}>
                {neuOrdner && o && <div className="px-2 pt-2 pb-0.5 text-[11px] uppercase tracking-wider text-slate-400 truncate flex items-center gap-1"><FolderOpen className="w-3 h-3" />{o}</div>}
                <button type="button" disabled={!!x.x} onClick={() => oeffne(x.p)} title={x.x ? "Geheime Datei – gesperrt" : x.p}
                  className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left ${aktiv === x.p ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"} ${x.x ? "opacity-50 cursor-not-allowed" : ""}`}>
                  {x.x ? <Lock className="w-3.5 h-3.5 shrink-0" /> : <FileText className="w-3.5 h-3.5 shrink-0" />}<span className="truncate">{x.p.split("/").pop()}</span>
                  {entwurf[x.p] && <span className="ml-auto w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-label="geändert" />}
                </button></React.Fragment>);
            })}
            {!laedt && baum && liste.length === 0 && <p className="p-3 text-slate-500 text-xs">Keine Datei gefunden</p>}
            {!laedt && (baum || []).length > 3000 && !q && <p className="p-2 text-xs text-slate-500">Zeige 3000 von {baum.length} Dateien – Suche nutzen.</p>}
          </div>
        </nav>

        <div className="flex flex-col min-w-0 min-h-0">
          <div className="flex gap-1 px-2 pt-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto" role="tablist">
            {offen.map((p) => (
              <span key={p} className={`inline-flex items-center gap-1 rounded-t-lg border border-b-0 px-2.5 py-1 text-xs whitespace-nowrap ${aktiv === p ? "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 font-semibold" : "border-transparent text-slate-500"}`}>
                <button type="button" role="tab" aria-selected={aktiv === p} onClick={() => setAktiv(p)} className="inline-flex items-center gap-1.5">{p.split("/").pop()}{entwurf[p] && <i className="w-1.5 h-1.5 rounded-full bg-amber-500" />}</button>
                <button type="button" onClick={() => schliesse(p)} aria-label={`${p} schließen`} className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800"><X className="w-3 h-3" /></button>
              </span>))}
          </div>
          {!aktiv ? <div className="flex-1 grid place-items-center text-sm text-slate-500 p-6 text-center">Links eine Datei wählen.</div>
            : datei?.laedt ? <div className="flex-1 grid place-items-center text-sm text-slate-500"><span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Datei wird gelesen …</span></div>
            : datei?.fehler ? <div className="flex-1 p-4 text-sm text-red-700 dark:text-red-300">{datei.fehler}</div>
            : datei?.inhalt == null ? <div className="flex-1 p-4 text-sm text-slate-500 flex items-start gap-2"><Info className="w-4 h-4 mt-0.5" />{datei?.hinweis || "Kein Inhalt"}</div>
            : (<div className="flex-1 min-h-[360px] grid grid-cols-[52px_minmax(0,1fr)] bg-slate-50 dark:bg-[#0a1613] font-mono text-[13px] leading-5">
                <pre ref={zeilenRef} aria-hidden="true" className="m-0 py-2.5 pr-2.5 text-right text-slate-400 dark:text-slate-600 select-none overflow-hidden">{zeilen}</pre>
                <textarea ref={textRef} value={wert} readOnly={!bearbeitbar} spellCheck={false} aria-label={`Inhalt von ${aktiv}`} wrap="off"
                  onChange={(e) => aendern(e.target.value)} onScroll={(e) => { if (zeilenRef.current) zeilenRef.current.scrollTop = e.target.scrollTop; }}
                  onKeyDown={(e) => { if (e.key === "Tab" && bearbeitbar) { e.preventDefault(); const t = e.target; const s = t.selectionStart; const v = t.value.slice(0, s) + "  " + t.value.slice(t.selectionEnd); aendern(v); requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; }); } }}
                  className={`w-full h-full resize-none bg-transparent border-0 py-2.5 px-3 outline-none whitespace-pre overflow-auto [tab-size:2] ${bearbeitbar ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"}`} />
              </div>)}
          <div className="flex flex-wrap gap-3 px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            {aktiv && <span className="font-mono truncate max-w-[50%]">{aktiv}</span>}
            <span>{zweig} · {stand ? stand.slice(0, 7) : "–"}</span>
            {datei && !datei.laedt && <span>{bearbeitbar ? "bearbeitbar" : datei.hinweis || "nur ansehen"}</span>}
            {aktiv && entwurf[aktiv] && datei?.blob_sha && entwurf[aktiv].basis_blob !== datei.blob_sha && <span className="text-amber-700 dark:text-amber-300">Achtung: Die Datei hat sich in main geändert, seit du sie bearbeitet hast – beim Speichern wird das erkannt.</span>}
          </div>
        </div>

        <aside className="hidden xl:flex flex-col gap-3 border-l border-slate-200 dark:border-slate-800 p-3 overflow-auto min-w-0">
          <Aenderungen entwurf={entwurf} dateien={dateien} darf={darfAendern} onSpeichern={() => setDialog(true)}
            onVerwerfen={() => setEntwurf({})} onOeffne={oeffne} />
        </aside>
      </div>
      <div className="xl:hidden"><div className={`${card} p-3 flex flex-col gap-3`}><Aenderungen entwurf={entwurf} dateien={dateien} darf={darfAendern} onSpeichern={() => setDialog(true)} onVerwerfen={() => setEntwurf({})} onOeffne={oeffne} /></div></div>
      {dialog && <Speichern gruppen={gruppen} d={d} entwurf={entwurf} toast={toast} onClose={() => setDialog(false)}
        onFertig={(id) => { setEntwurf({}); setDialog(false); toast(`Auftrag #${id} angelegt – die Werkstatt erstellt Zweig und Pull Request`); onAuftrag?.(); }} />}
      {geaendert.length > 0 && <p className="text-xs text-slate-500">Entwürfe bleiben auf diesem PC, bis du speicherst oder verwirfst.</p>}
    </section>);
}

function Aenderungen({ entwurf, dateien, darf, onSpeichern, onVerwerfen, onOeffne }) {
  const pfade = Object.keys(entwurf);
  return (<>
    <h3 className="font-display font-bold">Deine Änderungen</h3>
    {pfade.length ? pfade.map((p) => {
      const alt = dateien[p]?.inhalt;
      return (<div key={p} className="flex flex-col gap-1">
        <button type="button" className="text-left text-sm font-semibold font-mono truncate hover:underline" onClick={() => onOeffne(p)}>{p}</button>
        {alt == null ? <p className="text-xs text-slate-500">Datei neu öffnen, um die Gegenüberstellung zu sehen.</p>
          : <pre className="m-0 text-[11.5px] leading-[17px] font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0a1613] py-1 overflow-x-auto">
            {diffZeilen(alt, entwurf[p].inhalt).map(([art, t], i) => <div key={i} className={`px-2 ${art === "p" ? "bg-emerald-100/70 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200" : art === "m" ? "bg-red-100/70 text-red-900 dark:bg-red-900/30 dark:text-red-200" : "text-slate-400"}`}>{t || " "}</div>)}</pre>}
      </div>);
    }) : <p className="text-sm text-slate-500">Noch nichts geändert.</p>}
    <button type="button" className={btn} disabled={!pfade.length || !darf} onClick={onSpeichern}><GitPullRequest className="w-4 h-4" />Als Auftrag speichern</button>
    <button type="button" className={ghost} disabled={!pfade.length} onClick={onVerwerfen}>Alle verwerfen</button>
    <p className="text-xs text-slate-500">Gespeichert wird nie direkt in main: eigener Zweig, Pull Request, Prüfungen, Sicherheitsprüfung, Freigabe. Geheime Dateien (.env, Schlüssel) sind gesperrt.</p>
  </>);
}

function Speichern({ gruppen, d, entwurf, toast, onClose, onFertig }) {
  const [titel, setTitel] = useState(""); const [text, setText] = useState(""); const [gid, setGid] = useState(gruppen[0]?.id || ""); const [busy, setBusy] = useState(false);
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const pfade = Object.keys(entwurf);
  const basis = [...new Set(pfade.map((p) => entwurf[p].basis_sha))];
  const bereich = (id) => d.bereiche.find((b) => b.id === id)?.name || "";
  const los = async () => {
    setBusy(true);
    try {
      if (basis.length !== 1) throw new Error("Die Dateien stammen aus verschiedenen Ständen von main – bitte neu laden und die älteren Änderungen erneut machen");
      const { data, error } = await supabase.rpc("ws_code_hand_auftrag", { p_gruppe: gid, p_titel: titel.trim(), p_text: text.trim(), p_basis_sha: basis[0],
        p_dateien: pfade.map((p) => ({ pfad: p, inhalt: entwurf[p].inhalt, basis_blob: entwurf[p].basis_blob || "" })) });
      if (error) throw error;
      onFertig(data);
    } catch (e) { toast(fehler(e)); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Als Auftrag speichern" className={`${card} w-full max-w-lg p-5 flex flex-col gap-3`}>
        <h3 className="font-display font-bold text-xl">Als Auftrag speichern</h3>
        <label className="flex flex-col gap-1 text-sm text-slate-500">Titel<input className={input} value={titel} onChange={(e) => setTitel(e.target.value)} maxLength={120} autoFocus placeholder="z. B. Kalender: Wochenstart Montag" /></label>
        <label className="flex flex-col gap-1 text-sm text-slate-500">Gruppe
          <select className={input} value={gid} onChange={(e) => setGid(e.target.value)}>{gruppen.map((g) => <option key={g.id} value={g.id}>{g.name} · {bereich(g.bereich_id)}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm text-slate-500">Was und warum (optional)<textarea className={`${input} min-h-[70px]`} value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} /></label>
        <p className="text-xs text-slate-500">Geänderte Dateien: <span className="font-mono">{pfade.join(", ")}</span></p>
        <p className="text-xs rounded-lg px-2.5 py-1.5 border bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 flex gap-1.5"><Check className="w-4 h-4 shrink-0" />Die Werkstatt legt den Zweig an, übernimmt genau deine Änderung und erstellt den Pull Request. Danach Prüfungen und Freigabe wie immer.</p>
        <div className="flex justify-end gap-2"><button type="button" className={ghost} onClick={onClose}>Abbrechen</button>
          <button type="button" className={btn} disabled={busy || titel.trim().length < 3 || !gid} onClick={los}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Auftrag anlegen</button></div>
      </div>
    </div>);
}
