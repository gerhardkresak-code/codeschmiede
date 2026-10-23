import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Table2, Shapes, ListTree, ExternalLink, Plus, Loader2, Send, Calendar, Users, Trophy, Bell, ShieldCheck, Settings, Download, Check, CircleAlert, CircleCheck, Stamp, Upload, RefreshCw, ArrowRight } from "lucide-react";
import { supabase } from "./supabase";
import { Logo, LogoZeichen, ZEICHEN, marke as markeAus } from "./Logo";

// App-Designer · Etappe 4 (Baustein-Bibliothek) und Etappe 5 (Marke) – KONZEPT-BAUSTEINE.md, Entscheidungen Gerhard 2026-10-22 22:33,
// 2026-10-23 10:34 (Tabellen-Varianten, Zuweisung je Tabelle über eine Liste, ein Icon-Stil für alle, Chat beim Anlegen), 15:53 („fertig machen“).
// Alle Werte laufen wie das Grunddesign: Entwurf → speichern → als Auftrag senden → Freigabe → Prüfungen → live.

const card = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const btn = "inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-display font-bold tracking-wide transition text-sm";
const ghost = "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50";
const input = "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";
const fehler = (e) => (e?.message || "Unbekannter Fehler").replace(/^.*?ERROR:\s*/, "");

export const VARIANTEN = ["klar", "kompakt", "streifen", "luftig"];
export const BAUSTEIN_BASIS = {
  tabellen: {
    standard: "klar",
    klar: { dichte: "normal", streifen: false, rahmen: "karte", kopf: "leise", handy: "liste", suche: false },
    kompakt: { dichte: "kompakt", streifen: false, rahmen: "linien", kopf: "leise", handy: "liste", suche: true },
    streifen: { dichte: "normal", streifen: true, rahmen: "karte", kopf: "akzent", handy: "liste", suche: false },
    luftig: { dichte: "luftig", streifen: false, rahmen: "keine", kopf: "leise", handy: "liste", suche: false },
    zuweisung: {},
  },
  icons: { strich: 2, ecken: "rund" },
};
/** Zuweisung und Marke nach festen Regeln bereinigen (die Datenbank prüft zusätzlich). */
export function bausteinWerteBereinigen(r, w, b) {
  const hatZw = w?.tabellen && Object.prototype.hasOwnProperty.call(w.tabellen, "zuweisung");
  const zw = hatZw ? w.tabellen.zuweisung : b?.tabellen?.zuweisung; r.tabellen.zuweisung = {};
  if (zw && typeof zw === "object" && !Array.isArray(zw)) for (const [k, v] of Object.entries(zw).slice(0, 200))
    if (!["__proto__", "constructor", "prototype"].includes(k) && /^[a-z0-9][a-z0-9._-]{0,60}$/i.test(k) && VARIANTEN.includes(v)) r.tabellen.zuweisung[k] = v;
  if (!VARIANTEN.includes(r.tabellen.standard)) r.tabellen.standard = "klar";
  r.marke = markeAus({ ...(b?.marke || {}), ...(w?.marke && typeof w.marke === "object" && !Array.isArray(w.marke) ? w.marke : {}) });
  return r;
}

function Feld({ label, children }) { return <label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm">{label}{children}</label>; }
function Abschnitt({ titel, children, offen = true }) {
  return <details open={offen} className="group border-b border-slate-200 dark:border-slate-800 last:border-0 py-2"><summary className="cursor-pointer font-display font-bold text-[15px] list-none flex items-center justify-between">{titel}<span className="text-slate-400 group-open:rotate-90 transition">›</span></summary><div className="space-y-2 pt-2">{children}</div></details>;
}

// Baustein-Verzeichnis aus docs/BAUSTEINE.md (JSON-Block) – kommt über den Projekt-Abgleich
function useVerzeichnis(projektId) {
  const [v, setV] = useState(null);
  useEffect(() => {
    supabase.from("ws_dokumente").select("inhalt, aktualisiert").eq("projekt_id", projektId).eq("pfad", "docs/BAUSTEINE.md").maybeSingle().then(({ data }) => {
      const m = /```json\s*([\s\S]+?)```/.exec(data?.inhalt || "");
      try { setV(m ? { ...JSON.parse(m[1]), aktualisiert: data.aktualisiert } : { fehlt: true }); } catch { setV({ fehlt: true }); }
    });
  }, [projektId]);
  return v;
}

const DICHTE_PX = { kompakt: 5, normal: 9, luftig: 14 };
function TabellenMuster({ v, f, name }) {
  const zeilen = [["Mia Beispiel", "U11", "92 %"], ["Leo Muster", "U11", "61 %"], ["Ana Probe", "U13", "97 %"], ["Tom Test", "U13", "44 %"]];
  const linie = v.rahmen === "keine" ? "transparent" : f.rand;
  return (
    <div style={{ background: f.flaeche, color: f.text, border: v.rahmen === "karte" ? `1px solid ${f.rand}` : "none", borderRadius: v.rahmen === "karte" ? 14 : 0, overflow: "hidden" }}>
      {v.suche && <div style={{ padding: "6px 10px", borderBottom: `1px solid ${f.rand}` }}><div style={{ border: `1px solid ${f.rand}`, borderRadius: 7, padding: "3px 8px", fontSize: 12, color: f.text_leise }}>In der Liste suchen</div></div>}
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead><tr style={{ background: v.kopf === "akzent" ? `${f.primaer}1a` : "transparent", color: f.text_leise, fontSize: 12 }}>{["Name", "Mannschaft", "Anwesenheit"].map((t, i) => <th key={t} style={{ textAlign: i === 2 ? "right" : "left", padding: `${DICHTE_PX[v.dichte]}px 10px`, fontWeight: 400 }}>{t}</th>)}</tr></thead>
        <tbody>{zeilen.map((z, i) => <tr key={i} style={{ borderTop: `1px solid ${linie}`, background: v.streifen && i % 2 ? `${f.rand}66` : "transparent" }}>{z.map((c, j) => <td key={j} style={{ textAlign: j === 2 ? "right" : "left", padding: `${DICHTE_PX[v.dichte]}px 10px`, fontWeight: j === 0 ? 600 : 400 }}>{c}</td>)}</tr>)}</tbody>
      </table>
      <div style={{ borderTop: `1px solid ${f.rand}`, padding: "5px 10px", fontSize: 11, color: f.text_leise, display: "flex", justifyContent: "space-between" }}><span>4 Spieler · Variante „{name}“</span><span>Export</span></div>
    </div>);
}

/** Linke Seite + Mitte im Modus „Bausteine“. */
export function BausteineModus({ w, aendere, bearbeitbar, projekt, d, ich, toast, dunkel, Testseite, breite, onChat }) {
  const verz = useVerzeichnis(projekt.id);
  const [mitte, setMitte] = useState("vorschau"); const [vari, setVari] = useState("klar"); const [q, setQ] = useState(""); const [neu, setNeu] = useState(null);
  const f = w.farben[dunkel ? "dunkel" : "hell"]; const dis = !bearbeitbar;
  const t = w.tabellen; const v = t[vari];
  const wahl = (pfad, opts, wert) => <select value={String(wert)} disabled={dis} onChange={(e) => { const x = e.target.value; aendere(pfad, x === "true" ? true : x === "false" ? false : x); }} className={`${input} w-36`}>{opts.map(([a, b]) => <option key={a} value={String(a)}>{b}</option>)}</select>;
  const tabellen = (verz?.tabellen || []).filter((x) => !x.dynamisch);
  const zuweisen = (id, wert) => { const z = { ...t.zuweisung }; if (wert) z[id] = wert; else delete z[id]; aendere(["tabellen", "zuweisung"], z); };
  const gefiltert = (verz?.bausteine || []).filter((b) => !q || `${b.name} ${b.datei}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <section className={`${card} p-3 self-start`} aria-label="Einstellungen Bausteine">
        <Abschnitt titel="Tabellen">
          <Feld label="Standard für alle Listen">{wahl(["tabellen", "standard"], VARIANTEN.map((x) => [x, x]), t.standard)}</Feld>
          <div className="flex flex-wrap gap-1 pt-1" role="tablist" aria-label="Variante bearbeiten">{VARIANTEN.map((x) => <button key={x} type="button" role="tab" aria-selected={vari === x} onClick={() => setVari(x)} className={`px-2.5 py-1 rounded-md text-xs font-semibold ${vari === x ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 dark:bg-slate-800"}`}>{x}</button>)}</div>
          <Feld label="Zeilenhöhe">{wahl(["tabellen", vari, "dichte"], [["kompakt", "Kompakt"], ["normal", "Normal"], ["luftig", "Luftig"]], v.dichte)}</Feld>
          <Feld label="Streifen">{wahl(["tabellen", vari, "streifen"], [[false, "Nein"], [true, "Ja"]], v.streifen)}</Feld>
          <Feld label="Rahmen">{wahl(["tabellen", vari, "rahmen"], [["karte", "Karte"], ["linien", "Nur Linien"], ["keine", "Keine"]], v.rahmen)}</Feld>
          <Feld label="Kopfzeile">{wahl(["tabellen", vari, "kopf"], [["leise", "Leise"], ["akzent", "Akzentfarbe"]], v.kopf)}</Feld>
          <Feld label="Am Handy">{wahl(["tabellen", vari, "handy"], [["liste", "Kompakte Zeilen"], ["tabelle", "Tabelle (wischen)"]], v.handy)}</Feld>
          <Feld label="Suchfeld">{wahl(["tabellen", vari, "suche"], [[false, "Nein"], [true, "Ja"]], v.suche)}</Feld>
        </Abschnitt>
        <Abschnitt titel={`Zuweisung je Tabelle (${Object.keys(t.zuweisung).length})`} offen={false}>
          {!verz ? <Loader2 className="w-4 h-4 animate-spin text-emerald-700" /> : verz.fehlt ? <p className="text-xs text-slate-500">Noch kein Baustein-Verzeichnis (docs/BAUSTEINE.md) – kommt mit dem nächsten Abgleich.</p>
            : <div className="max-h-[320px] overflow-auto space-y-1">{tabellen.map((x) => (
              <Feld key={x.id} label={<span className="min-w-0"><span className="font-mono text-xs block truncate" title={x.datei}>{x.id}</span></span>}>
                <select value={t.zuweisung[x.id] || ""} disabled={dis} onChange={(e) => zuweisen(x.id, e.target.value)} className={`${input} w-28`}><option value="">Standard</option>{VARIANTEN.map((y) => <option key={y} value={y}>{y}</option>)}</select>
              </Feld>))}</div>}
        </Abschnitt>
        <Abschnitt titel="Symbole (Icon-Stil)" offen={false}>
          <Feld label="Strichstärke"><span className="flex items-center gap-2"><input type="range" min={1.25} max={2.5} step={0.25} value={w.icons.strich} disabled={dis} onChange={(e) => aendere(["icons", "strich"], Number(e.target.value))} className="w-28 accent-emerald-700" /><span className="w-10 text-right tabular-nums text-xs">{w.icons.strich}</span></span></Feld>
          <Feld label="Ecken">{wahl(["icons", "ecken"], [["rund", "Rund"], ["eckig", "Eckig"]], w.icons.ecken)}</Feld>
          <p className="text-xs text-slate-500">Gilt für alle Lucide-Symbole der App.</p>
        </Abschnitt>
        <div className="pt-2 flex flex-col gap-1.5">
          <button type="button" className={ghost} onClick={() => setNeu({ name: "", text: "" })}><Plus className="w-4 h-4" />Neuer Baustein …</button>
          <p className="text-xs text-slate-500">Mit Chat: beschreib den Baustein, Claude hilft beim Ausarbeiten; gebaut wird er über einen Auftrag.</p>
        </div>
      </section>
      <section className={`${card} min-w-0 flex flex-col`}>
        <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-800" role="tablist" aria-label="Ansicht">
          {[["vorschau", "Vorschau", Table2], ["galerie", "Galerie (Testseite)", ExternalLink], ["verzeichnis", "Verzeichnis", ListTree]].map(([id, tt, I]) => (
            <button key={id} type="button" role="tab" aria-selected={mitte === id} onClick={() => setMitte(id)} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-semibold ${mitte === id ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}><I className="w-4 h-4" />{tt}</button>))}
        </div>
        <div className="p-3 bg-slate-100 dark:bg-slate-950 flex-1 overflow-auto min-h-[520px]">
          {mitte === "vorschau" && (
            <div className="flex flex-col gap-4" style={{ background: f.hintergrund, color: f.text, padding: 16, borderRadius: 12 }}>
              <div className="grid gap-4 md:grid-cols-2">{VARIANTEN.map((x) => <div key={x}><div className="text-xs font-semibold mb-1" style={{ color: f.text_leise }}>{x}{t.standard === x ? " · Standard" : ""}{Object.values(t.zuweisung).filter((y) => y === x).length ? ` · ${Object.values(t.zuweisung).filter((y) => y === x).length} zugewiesen` : ""}</div><TabellenMuster v={t[x]} f={f} name={x} /></div>)}</div>
              <div><div className="text-xs font-semibold mb-1" style={{ color: f.text_leise }}>Symbole</div>
                <div className="flex flex-wrap gap-4">{[Calendar, Users, Trophy, Bell, ShieldCheck, Settings, Download, Check].map((I, i) => <I key={i} className="w-6 h-6" strokeWidth={w.icons.strich} strokeLinejoin={w.icons.ecken === "eckig" ? "miter" : "round"} strokeLinecap={w.icons.ecken === "eckig" ? "square" : "round"} />)}</div></div>
            </div>)}
          {mitte === "galerie" && <Testseite projekt={{ ...projekt, vorschau_pfad: "/bausteine" }} breite={breite} werte={w} modus={dunkel ? "dunkel" : "hell"} />}
          {mitte === "verzeichnis" && (
            <div className={`${card} overflow-hidden`}>
              <div className="p-2 flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800"><label className="relative flex-1 min-w-[200px]"><Search className="w-4 h-4 absolute left-2.5 top-2 text-slate-400" /><input className={`${input} pl-8`} placeholder="Baustein suchen" value={q} onChange={(e) => setQ(e.target.value)} /></label>
                <span className="text-xs text-slate-500">{verz?.bausteine ? `${verz.bausteine.length} Bausteine · ${verz.tabellen?.length || 0} Tabellen · Stand ${verz.stand}` : ""}</span></div>
              {!verz ? <Loader2 className="w-5 h-5 animate-spin text-emerald-700 m-4" /> : verz.fehlt ? <p className="p-4 text-sm text-slate-500">Noch kein Baustein-Verzeichnis.</p> : (
                <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-950"><tr><th className="text-left px-3 py-2">Baustein</th><th className="text-left px-3 py-2">Gruppe</th><th className="text-right px-3 py-2">Verwendet</th><th className="text-left px-3 py-2">Datei</th></tr></thead>
                  <tbody>{gefiltert.slice(0, 200).map((b) => <tr key={b.id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-3 py-1.5 font-semibold">{b.name}</td><td className="px-3 py-1.5 text-xs">{b.gruppe}</td><td className="px-3 py-1.5 text-right tabular-nums">{b.verwendet}</td><td className="px-3 py-1.5 font-mono text-xs break-all">{b.datei}</td></tr>)}</tbody></table></div>)}
            </div>)}
        </div>
      </section>
      {neu && <NeuerBaustein projekt={projekt} d={d} ich={ich} toast={toast} onClose={() => setNeu(null)} onChat={onChat} />}
    </>);
}

function NeuerBaustein({ projekt, d, ich, toast, onClose, onChat }) {
  const [name, setName] = useState(""); const [text, setText] = useState(""); const [art, setArt] = useState("zusammen"); const [busy, setBusy] = useState(false);
  const g = d.gruppen.find((x) => x.id === projekt.design_gruppe_id);
  const senden = async () => {
    if (!name.trim() || !g) return; setBusy(true);
    try {
      const titel = `Neuer Baustein: ${name.trim()}`.slice(0, 80);
      const { data, error } = await supabase.from("ws_auftraege").insert({ gruppe_id: g.id, titel, art: "neu", erstellt_von: ich.id }).select().single();
      if (error) throw error;
      const t = `Neuen Baustein bauen: ${name.trim()} (${art === "grund" ? "Grundbaustein" : art === "diagramm" ? "Diagramm" : art === "fach" ? "Fachbaustein" : "zusammengesetzter Baustein"}).\n${text.trim()}\n\nRegeln (Baustein-Bibliothek): erst prüfen, ob es schon einen passenden Baustein gibt (docs/BAUSTEINE.md); nur Grundwerte aus dem Grunddesign verwenden (keine eigenen Farben/Abstände); Varianten und Zustände (laden, leer, Fehler) vorsehen; in die Galerie /bausteine aufnehmen; danach \`node tools/bausteine.mjs\` ausführen und docs/BAUSTEINE.md mit einchecken.`;
      const r = await supabase.from("ws_nachrichten").insert({ auftrag_id: data.id, von: ich.id, art: "text", text: t, kanal: "codeschmiede" });
      if (r.error) throw r.error;
      toast(`Auftrag #${data.id} angelegt – Baustein „${name.trim()}“`); onClose();
    } catch (e) { toast(fehler(e)); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Neuer Baustein" className={`${card} w-full max-w-lg p-5 flex flex-col gap-3`}>
        <h3 className="font-display font-bold text-xl flex items-center gap-2"><Shapes className="w-5 h-5 text-emerald-700" />Neuer Baustein</h3>
        <label className="flex flex-col gap-1 text-sm text-slate-500">Name<input id="cs-bs-name" className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Spieltag-Karte" autoFocus /></label>
        <label className="flex flex-col gap-1 text-sm text-slate-500">Art<select className={input} value={art} onChange={(e) => setArt(e.target.value)}><option value="grund">Grundbaustein</option><option value="zusammen">Zusammengesetzt (Karte, Kachel …)</option><option value="diagramm">Diagramm</option><option value="fach">Fachbaustein</option></select></label>
        <label className="flex flex-col gap-1 text-sm text-slate-500">Was soll er zeigen und können?<textarea id="cs-bs-text" className={`${input} min-h-[90px]`} value={text} onChange={(e) => setText(e.target.value)} /></label>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={ghost} onClick={() => { onChat(`Ich möchte einen neuen Baustein „${name || "…"}“ anlegen: ${text || "…"} Hilf mir, ihn auszuarbeiten (Varianten, Zustände, wo er verwendet wird).`); onClose(); }}>Erst mit Claude ausarbeiten</button>
          <button type="button" className={btn} disabled={busy || !name.trim() || !g} onClick={senden}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Als Auftrag senden</button>
        </div>
      </div>
    </div>);
}

/** Linke Seite + Mitte im Modus „Marke“ (Logo-Designer, Projektlogo). */
/** Texteingabe mit Entwurf: darf beim Tippen kurz leer/ungültig sein, übernommen wird nur ein gültiger Wert (Prüfung 0.8.0). */
function Eingabe({ wert, muster, onWert, max, ...rest }) {
  const [t, setT] = useState(wert ?? ""); const [fokus, setFokus] = useState(false);
  const zeigen = fokus ? t : (wert ?? "");
  return <input {...rest} value={zeigen} maxLength={max} aria-invalid={fokus && !muster.test(t)}
    onFocus={() => { setT(wert ?? ""); setFokus(true); }} onBlur={() => setFokus(false)}
    onChange={(e) => { setT(e.target.value); if (muster.test(e.target.value)) onWert(e.target.value); }} />;
}

// Bestehendes Logo einlesen (Datenbank 0026, Entwurf „Logo, KI-Wahl und Einrichtung“ 1.0): Bild hochladen → die eigene Werkstatt lässt die KI
// das Logo als bearbeitbares Vektor-Logo nachbauen → mit Klick in den Entwurf → wie jedes Design als Auftrag senden (dann überall in der App).
const BILD_ARTEN = { "image/png": 1, "image/jpeg": 1, "image/webp": 1, "image/svg+xml": 1 };
function LogoEinlesen({ projekt, bearbeitbar, toast, onUebernehmen }) {
  const [liste, setListe] = useState([]); const [busy, setBusy] = useState(false); const [wunsch, setWunsch] = useState({}); const [bilder, setBilder] = useState({}); const geladen = useRef({});
  // Liste ohne Bild (klein); Originalbilder nur einmal je Logo nachladen (Prüfung 0.8.6 O3)
  const holen = async () => {
    const { data } = await supabase.from("ws_marke_vorlagen").select("id, dateiname, stand, ergebnis, hinweis, ki, erstellt").eq("projekt_id", projekt.id).order("id", { ascending: false }).limit(3);
    setListe(data || []);
    const fehlt = (data || []).map((v) => v.id).filter((id) => !(id in geladen.current));
    fehlt.forEach((id) => { geladen.current[id] = true; });
    if (fehlt.length) { const { data: b } = await supabase.from("ws_marke_bilder").select("vorlage_id, bild").in("vorlage_id", fehlt); setBilder((alt) => ({ ...alt, ...Object.fromEntries((b || []).map((x) => [x.vorlage_id, x.bild])) })); }
  };
  useEffect(() => {
    holen().catch(() => {});
    const ch = supabase.channel(`marke-${projekt.id}-${Math.random()}`).on("postgres_changes", { event: "*", schema: "public", table: "ws_marke_vorlagen", filter: `projekt_id=eq.${projekt.id}` }, () => holen().catch(() => {})).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projekt.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const datei = (f) => {
    if (!f) return;
    if (!BILD_ARTEN[f.type]) { toast("Bitte PNG, JPG, WebP oder SVG wählen"); return; }
    if (f.size > 2 * 1024 * 1024) { toast("Das Bild ist größer als 2 MB"); return; }
    const r = new FileReader();
    r.onload = async () => {
      setBusy(true);
      const { error } = await supabase.rpc("ws_marke_einlesen", { p_projekt: projekt.id, p_bild: String(r.result), p_dateiname: f.name.slice(0, 120) });
      setBusy(false); toast(error ? fehler(error) : "Eingelesen – deine Werkstatt baut das Logo jetzt nach (ca. 1–2 Minuten)");
    };
    r.readAsDataURL(f);
  };
  const nochmal = async (v) => { const { error } = await supabase.rpc("ws_marke_nochmal", { p_id: v.id, p_wunsch: wunsch[v.id] || null }); toast(error ? fehler(error) : "Wird nochmal nachgebaut"); };
  return (
    <Abschnitt titel="Bestehendes Logo einlesen">
      <label className={`flex flex-col items-center gap-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3 text-center text-xs ${bearbeitbar ? "cursor-pointer hover:border-emerald-600" : "opacity-60"}`}
        onDragOver={(e) => { if (bearbeitbar) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); if (bearbeitbar) datei(e.dataTransfer.files?.[0]); }}>
        {busy ? <Loader2 className="w-5 h-5 animate-spin text-emerald-700" /> : <Upload className="w-5 h-5 text-emerald-700" />}
        <b className="text-sm">Logo hierher ziehen oder auswählen</b><span className="text-slate-500">PNG, JPG, WebP oder SVG · bis 2 MB · das Original bleibt gespeichert</span>
        <input id="marke-einlesen" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" disabled={!bearbeitbar} onChange={(e) => { datei(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {liste.map((v) => (
        <div key={v.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 flex flex-col gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <img src={bilder[v.id] || undefined} alt={`Original ${v.dateiname || ""}`} className="w-12 h-12 object-contain rounded bg-white ring-1 ring-black/5" />
            <ArrowRight className="w-4 h-4 text-slate-400" />
            {v.ergebnis ? <LogoZeichen werte={{ zeichen: "eigen", vektor: v.ergebnis }} groesse={48} titel="Nachgebaut" />
              : <span className="w-12 h-12 grid place-items-center rounded bg-slate-50 dark:bg-slate-950">{v.stand === "fehler" ? <CircleAlert className="w-5 h-5 text-amber-600" /> : <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />}</span>}
            <span className="min-w-0 flex-1 text-slate-500 break-words">{v.dateiname || "Logo"} · {v.stand === "wartet" ? "wartet auf deine Werkstatt" : v.stand === "laeuft" ? "wird nachgebaut …" : v.stand === "fertig" ? `nachgebaut${v.ki ? ` von ${String(v.ki).split("/")[0]}` : ""}` : "nicht geklappt"}</span>
          </div>
          {v.hinweis && <p className="text-slate-600 dark:text-slate-300">{v.hinweis}</p>}
          {["fertig", "fehler"].includes(v.stand) && bearbeitbar && <div className="flex flex-wrap gap-1.5 items-center">
            {v.ergebnis && <button type="button" className={`${btn} h-8`} onClick={() => onUebernehmen(v.ergebnis)}><Check className="w-3.5 h-3.5" />In den Entwurf</button>}
            <input aria-label="Wunsch zum Nachbauen" className={`${input} h-8 flex-1 min-w-[120px]`} placeholder="Wunsch, z. B. Schrift moderner" maxLength={500} value={wunsch[v.id] || ""} onChange={(e) => setWunsch({ ...wunsch, [v.id]: e.target.value })} />
            <button type="button" className={`${ghost} h-8`} onClick={() => nochmal(v)}><RefreshCw className="w-3.5 h-3.5" />Nochmal</button></div>}
        </div>))}
    </Abschnitt>);
}

// Farben und Texte eines eingelesenen Logos ändern (alle Stellen einer Farbe auf einmal)
function VektorBearbeiten({ vektor, dis, onAendern }) {
  const farben = [...new Set(vektor.elemente.flatMap((e) => [e.fill, e.stroke]).filter((f) => f && f !== "none"))].slice(0, 8);
  const ersetze = (alt, neu) => onAendern({ elemente: vektor.elemente.map((e) => ({ ...e, ...(e.fill === alt ? { fill: neu } : {}), ...(e.stroke === alt ? { stroke: neu } : {}) })) });
  const texte = vektor.elemente.map((e, i) => [e, i]).filter(([e]) => e.t === "text");
  return (
    <Abschnitt titel="Eingelesenes Logo anpassen">
      {farben.map((f) => <Feld key={f} label="Farbe"><input type="color" aria-label={`Farbe ${f}`} value={f} disabled={dis} onChange={(e) => ersetze(f, e.target.value.toLowerCase())} className="w-8 h-7 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></Feld>)}
      {texte.map(([e, i]) => <Feld key={i} label="Text"><Eingabe className={`${input} w-32`} wert={e.text} disabled={dis} max={16} muster={/^[A-Za-z0-9ÄÖÜäöüß .&-]{1,16}$/}
        onWert={(v) => onAendern({ elemente: vektor.elemente.map((x, j) => (j === i ? { ...x, text: v } : x)) })} /></Feld>)}
      <p className="text-xs text-slate-500">Größere Änderungen per Chat rechts oder mit „Nochmal“ und einem Wunsch.</p>
    </Abschnitt>);
}

export function MarkeModus({ w, aendere, bearbeitbar, projekt, ich, toast }) {
  const m = markeAus(w.marke); const dis = !bearbeitbar; const [busy, setBusy] = useState(false);
  const setze = (k, v) => aendere(["marke", k], v);
  const kontrast = useMemo(() => { const l = (h) => { const n = parseInt(h.slice(1), 16); return [16, 8, 0].map((s) => ((n >> s) & 255) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0); };
    const [a, b] = [l(m.farbe), l(m.farbe2)].sort((x, y) => y - x); return (a + 0.05) / (b + 0.05); }, [m.farbe, m.farbe2]);
  const pruef = [
    ["Kontrast Zeichen", m.zeichen === "bild" || kontrast >= 3, `${kontrast.toFixed(1)} : 1 (mind. 3 : 1)`],
    ["Klein lesbar (16 px)", m.zeichen === "bild" || m.zeichen === "ball" || m.zeichen === "pfeil" || m.zeichen === "glut" || m.kuerzel.length <= 2, m.kuerzel.length > 2 ? "Kürzel mit 3 Zeichen ist bei 16 px schwer lesbar" : "ok"],
    ["Name kurz genug", m.name.length <= 24, `${m.name.length} Zeichen`],
  ];
  const projektLogo = async () => {
    setBusy(true); const { error } = await supabase.rpc("ws_projekt_logo", { p_projekt: projekt.id, p_logo: m.zeichen === "bild" ? null : m }); setBusy(false);
    toast(error ? fehler(error) : m.zeichen === "bild" ? "Projektlogo zurückgesetzt" : "Projektlogo in der Codeschmiede übernommen");
  };
  const flaeche = (hg, txt, rand) => (
    <div style={{ background: hg, color: txt, border: `1px solid ${rand}`, borderRadius: 14, padding: 18 }} className="flex flex-col gap-4">
      <Logo werte={m} groesse={44} farbeText={txt} />
      <div className="flex items-end gap-4">{[64, 32, 16].map((g) => <div key={g} className="flex flex-col items-center gap-1"><LogoZeichen werte={m} groesse={g} /><span style={{ fontSize: 10, opacity: 0.6 }}>{g}</span></div>)}</div>
    </div>);
  return (
    <>
      <section className={`${card} p-3 self-start`} aria-label="Einstellungen Marke">
        <Abschnitt titel="Zeichen">
          <div className="grid grid-cols-3 gap-1.5">{ZEICHEN.map(([z, t]) => <button key={z} type="button" disabled={dis || (z === "eigen" && !m.vektor)} title={z === "eigen" && !m.vektor ? "Zuerst unten ein Logo einlesen" : undefined} aria-pressed={m.zeichen === z} onClick={() => setze("zeichen", z)} className={`rounded-lg border p-1.5 flex flex-col items-center gap-1 text-[11px] ${m.zeichen === z ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950" : "border-slate-200 dark:border-slate-800"}`}>
            {z === "bild" ? <Stamp className="w-7 h-7 text-slate-400" /> : z === "eigen" && !m.vektor ? <Upload className="w-7 h-7 text-slate-400" /> : <LogoZeichen werte={{ ...m, zeichen: z }} groesse={30} />}{t}</button>)}</div>
          {[["farbe", "Hauptfarbe"], ["farbe2", "Zweitfarbe"]].map(([k, t]) => <Feld key={k} label={t}><span className="flex items-center gap-1.5"><input type="color" aria-label={t} value={m[k]} disabled={dis} onChange={(e) => setze(k, e.target.value)} className="w-8 h-7 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /><input aria-label={`${t} Farbwert`} value={m[k]} disabled={dis} onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && setze(k, e.target.value.toLowerCase())} className={`${input} w-[84px] font-mono text-xs`} /></span></Feld>)}
          <Feld label="Kürzel (1–3)"><Eingabe className={`${input} w-24`} wert={m.kuerzel} disabled={dis} max={3} muster={/^[A-Za-z0-9ÄÖÜäöü]{1,3}$/} onWert={(v) => setze("kuerzel", v)} /></Feld>
          <Feld label="Ecken">{<select className={`${input} w-28`} value={m.form} disabled={dis} onChange={(e) => setze("form", e.target.value)}><option value="rund">Rund</option><option value="eckig">Eckig</option></select>}</Feld>
        </Abschnitt>
        {m.zeichen === "eigen" && m.vektor && <VektorBearbeiten vektor={m.vektor} dis={dis} onAendern={(v) => setze("vektor", v)} />}
        <LogoEinlesen projekt={projekt} bearbeitbar={bearbeitbar} toast={toast} onUebernehmen={(v) => { aendere(["marke"], { ...m, zeichen: "eigen", vektor: v }); toast("Eingelesenes Logo im Entwurf – speichern und als Auftrag senden, dann ändert es sich überall"); }} />
        <Abschnitt titel="Schriftzug">
          <Feld label="Name"><Eingabe className={`${input} w-40`} wert={m.name} disabled={dis} max={40} muster={/^[A-Za-z0-9ÄÖÜäöüß .&-]{1,40}$/} onWert={(v) => setze("name", v)} /></Feld>
          <Feld label="Stärke"><select className={`${input} w-28`} value={m.gewicht} disabled={dis} onChange={(e) => setze("gewicht", Number(e.target.value))}><option value={600}>Halbfett</option><option value={700}>Fett</option><option value={800}>Extra fett</option></select></Feld>
          <Feld label="Sperrung"><span className="flex items-center gap-2"><input type="range" min={-2} max={8} value={m.sperrung} disabled={dis} onChange={(e) => setze("sperrung", Number(e.target.value))} className="w-28 accent-emerald-700" /><span className="w-6 text-right tabular-nums text-xs">{m.sperrung}</span></span></Feld>
        </Abschnitt>
        {ich.rolle === "admin" && <div className="pt-2"><button type="button" className={ghost} disabled={busy} onClick={projektLogo}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stamp className="w-4 h-4" />}Als Projektlogo (Codeschmiede) übernehmen</button></div>}
      </section>
      <section className={`${card} min-w-0 p-3 flex flex-col gap-3`}>
        <div className="grid gap-3 md:grid-cols-2">{flaeche(w.farben.hell.hintergrund, w.farben.hell.text, w.farben.hell.rand)}{flaeche(w.farben.dunkel.hintergrund, w.farben.dunkel.text, w.farben.dunkel.rand)}</div>
        <div className="rounded-xl overflow-hidden ring-1 ring-black/10"><div style={{ background: w.farben.hell.menue, borderBottom: `1px solid ${w.farben.hell.rand}`, padding: "10px 14px" }} className="flex items-center gap-3">
          <Logo werte={m} groesse={30} farbeText={w.farben.hell.menue_text} /><span className="ml-auto text-xs" style={{ color: w.farben.hell.text_leise }}>So sieht es in der App aus</span></div></div>
        <ul className="text-sm flex flex-col gap-1">{pruef.map(([t, ok, info]) => <li key={t} className="flex items-center gap-2">{ok ? <CircleCheck className="w-4 h-4 text-green-600" /> : <CircleAlert className="w-4 h-4 text-amber-600" />}<b className="font-semibold">{t}</b><span className="text-slate-500 text-xs">{info}</span></li>)}</ul>
        <p className="text-xs text-slate-500">Das Logo wird aus diesen Werten gezeichnet (keine Bilddatei). „Bisheriges Bild“ lässt das heutige Logo stehen. Vorschläge per Chat rechts – z. B. „3 Vorschläge für ein Vereinslogo in Grün“.</p>
      </section>
    </>);
}
