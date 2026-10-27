// App-Designer 2.0 · Etappe 1 „Bausteine“ (Entwurf 1.0, freigegeben von Gerhard 2026-10-24 22:08).
// EIN Designer, der SOFORT wirkt: Das Aussehen der Bausteine geht über die Design-Pakete der App (Trainer to go: DesignPackage,
// tokens.bausteine.<id>), nicht über einen Auftrag. Nur NEUE Bausteine (neuer Code) laufen als Auftrag.
// Datenfluss: Linksklick in der Galerie (Testseite /bausteine) → { cs: "baustein-wahl", id } → Inspektor rechts.
// Jede Änderung → sofort Vorschau in der Galerie ({ cs: "baustein-vorschau" }) und nach kurzer Pause als Entwurf gespeichert
// ({ cs: "baustein-speichern" }). Gespeichert wird IN der eingebetteten App mit deren Rechteprüfung (eigene Design-Freigabe,
// Design-Sitzung, Trigger DesignPackage_guard/DesignPackage_rights) – die Codeschmiede speichert dafür nichts und hat keinen Zugang zur App-Datenbank.
// Freigeben: über den bestehenden Weg (App-Designer › Seiten › Freigabe & Versionen, ab Werk „Sofort“).
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Shapes, Bot, PenLine, Loader2, CircleCheck, CircleAlert, TriangleAlert, RotateCcw, Send, Check, X, Sparkles, ShieldCheck, ExternalLink, Layers, Link2, MousePointerClick, Contrast } from "lucide-react";
import { supabase } from "./supabase";
import { useKiName } from "./kiName";
import { useAutoHoehe } from "./autoHoehe";
import { Markdown } from "./Markdown";
import { useVerzeichnis } from "./verzeichnis";
import { GRUPPEN, GROESSEN, ZUSTAENDE, SEITE, KATALOG, bausteinVon, bausteinWerteBereinigen, bausteineBereinigen, mitStandard, nurAbweichung } from "./bausteinKatalog";
import { pruefeBaustein, zusammenfassung, verhaeltnis, SOLL } from "./kontrast";
const SymbolWahl = lazy(() => import("./SymbolWahl"));
const SymbolZeichen = lazy(() => import("./SymbolWahl").then((m) => ({ default: m.SymbolZeichen })));

const btn = "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-semibold";
const ghost = "inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50";
const input = "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";
const fehler = (e) => (e?.message || "Unbekannter Fehler").replace(/^.*?ERROR:\s*/, "");
const fmt = (d) => new Date(d).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export const EBENEN = [["all", "Alle Vereine"], ["package", "Paket"], ["club", "Verein"], ["role", "Rolle im Verein"]];
const ROLLEN = [["trainer", "Trainer"], ["admin", "Vereinsadmin"], ["parent", "Eltern"], ["player", "Spieler"], ["funktionaer", "Funktionäre"]];
const ebeneFertig = (e) => e.level === "all" || (e.level === "package" ? !!e.package_key : !!e.club_id && (e.level !== "role" || !!e.role_key));
const ebeneSchluessel = (e) => [e.level, e.package_key || "", e.club_id || "", e.role_key || ""].join("|");

// Zwei Ebenen tief zusammenführen (geerbt ← eigen), nur bereinigte Werte
function zusammen(geerbt, eigen) {
  const r = bausteineBereinigen(geerbt);
  for (const [id, w] of Object.entries(bausteineBereinigen(eigen))) {
    const a = r[id] || {}; const n = { ...a, ...w };
    for (const m of ["hell", "dunkel"]) if (a[m] || w[m]) n[m] = { ...(a[m] || {}), ...(w[m] || {}) };
    r[id] = n;
  }
  return r;
}

/**
 * Zustand des Baustein-Designers (liegt im Designer, damit Galerie, Liste und Inspektor ihn teilen).
 * bruecke.current = (nachricht) => postMessage an die Galerie (setzt die Testseite).
 */
export function useBausteinDesigner({ dunkel }) {
  const bruecke = useRef(null);
  const [wahl, setWahl] = useState(null);
  const [zustand, setZustand] = useState("normal");
  const [ebene, setEbeneRoh] = useState({ level: "all" });
  const [stand, setStand] = useState({ laden: true });          // Antwort der Galerie: eigen, geerbt, darf, ziele, entwurf, live
  const [eigen, setEigen] = useState({});                        // eigene Werte dieser Ebene (nur Abweichungen)
  const [offen, setOffen] = useState({});                        // id → true: noch nicht gespeichert
  const [speichert, setSpeichert] = useState(null);              // null | "laeuft" | { ok, text, zeit }
  const [galerieDa, setGalerieDa] = useState(false);
  const warte = useRef(new Map()); const nr = useRef(0); const timer = useRef({});
  const eigenRef = useRef(eigen); eigenRef.current = eigen;
  const ebeneRef = useRef(ebene); ebeneRef.current = ebene;

  const frage = useCallback((n) => new Promise((ok, fehl) => {
    if (!bruecke.current) { fehl(new Error("Die Galerie ist noch nicht geladen.")); return; }
    const id = ++nr.current; warte.current.set(id, { ok, fehl });
    try { bruecke.current({ ...n, nr: id }); } catch (e) { warte.current.delete(id); fehl(e); return; }
    setTimeout(() => { if (warte.current.has(id)) { warte.current.delete(id); fehl(new Error("Die Galerie antwortet nicht – bitte neu laden. (Trainer to go mit App-Designer 2.0 nötig)")); } }, 90000);
  }), []);

  const laden = useCallback(async (e = ebeneRef.current) => {
    if (!ebeneFertig(e)) { setStand((s) => ({ ...s, laden: false })); return; }
    setStand((s) => ({ ...s, laden: true }));
    try {
      const a = await frage({ cs: "baustein-laden", ebene: e });
      if (ebeneSchluessel(e) !== ebeneSchluessel(ebeneRef.current)) return;
      setStand({ ...a, laden: false }); setEigen(bausteineBereinigen(a.eigen)); setOffen({});
    } catch (f) { setStand({ laden: false, fehler: fehler(f), freigabe: !!f.freigabe }); }
  }, [frage]);

  // Nachricht aus der Galerie (Herkunft und Absender prüft die Testseite)
  const onNachricht = useCallback((m) => {
    if (m.cs === "geladen") { setGalerieDa(true); laden(); return; }
    if (m.cs === "baustein-wahl") { if (typeof m.id === "string" && bausteinVon(m.id)) { setWahl(m.id); setZustand("normal"); } return; }
    if ((m.cs === "baustein-stand" || m.cs === "baustein-gespeichert") && warte.current.has(Number(m.nr))) {
      const w = warte.current.get(Number(m.nr)); warte.current.delete(Number(m.nr));
      if (m.ok) w.ok(m); else { const f = new Error(String(m.fehler || "Fehler").slice(0, 300)); f.freigabe = !!m.freigabe; w.fehl(f); }
    }
  }, [laden]);

  const setEbene = (e) => {
    if (Object.keys(offen).length && !window.confirm("Noch nicht gespeicherte Änderungen verwerfen?")) return;
    Object.values(timer.current).forEach(clearTimeout); timer.current = {};
    setEbeneRoh(e); setEigen({}); setOffen({}); setSpeichert(null);
    if (ebeneFertig(e)) laden(e); else setStand((s) => ({ ...s, eigen: {}, entwurf: null, live: null }));
  };

  const speichern = useCallback(async (id) => {
    const e = ebeneRef.current; if (!ebeneFertig(e)) return;
    setSpeichert("laeuft");
    try {
      const a = await frage({ cs: "baustein-speichern", ebene: e, id, werte: eigenRef.current[id] || {} });
      setOffen((o) => { const n = { ...o }; delete n[id]; return n; });
      setStand((s) => ({ ...s, entwurf: a.entwurf || s.entwurf }));
      setSpeichert({ ok: true, text: `Als Entwurf gespeichert${a.entwurf?.version ? ` (Version ${a.entwurf.version})` : ""}`, zeit: new Date().toISOString() });
    } catch (f) { setSpeichert({ ok: false, text: fehler(f), freigabe: f.freigabe }); }
  }, [frage]);

  /** Werte eines Bausteins setzen (voll = Werte mit Standard); speichert nach kurzer Pause automatisch. */
  const setze = useCallback((id, voll) => {
    const grundlage = mitStandard(id, (stand.geerbt || {})[id], stand.akzent);
    const n = nurAbweichung(id, voll, grundlage);
    setEigen((alt) => { const x = { ...alt }; if (Object.keys(n).length) x[id] = n; else delete x[id]; return x; });
    setOffen((o) => ({ ...o, [id]: true }));
    clearTimeout(timer.current[id]); timer.current[id] = setTimeout(() => speichern(id), 1200);
  }, [stand.geerbt, stand.akzent, speichern]);
  useEffect(() => () => Object.values(timer.current).forEach(clearTimeout), []);

  const alle = useMemo(() => zusammen(stand.geerbt, eigen), [stand.geerbt, eigen]);
  // Sofort-Vorschau in der Galerie: alle Werte (geerbt + eigen), gewählter Baustein und Zustand, Hell/Dunkel
  useEffect(() => {
    try { bruecke.current?.({ cs: "baustein-vorschau", bausteine: alle, id: wahl, zustand, modus: dunkel ? "dunkel" : "hell" }); } catch { /* egal */ }
  }, [alle, wahl, zustand, dunkel, galerieDa]);
  const markieren = (id) => { setWahl(id); setZustand("normal"); try { bruecke.current?.({ cs: "baustein-markieren", id }); } catch { /* egal */ } };

  return { bruecke, onNachricht, wahl, setWahl: markieren, zustand, setZustand, ebene, setEbene, stand, laden, eigen, alle, setze, offen, speichert, galerieDa };
}

/** Linke Spalte: Galerie-Gruppen mit Suche. */
export function BausteinListe({ bs }) {
  const [q, setQ] = useState("");
  const s = q.trim().toLowerCase();
  const treffer = KATALOG.filter((b) => !s || `${b.name} ${b.id}`.toLowerCase().includes(s));
  return (
    <div className="flex flex-col gap-2" aria-label="Bausteine der Galerie">
      <label className="relative"><Search className="w-4 h-4 absolute left-2.5 top-2 text-slate-400" aria-hidden="true" /><span className="sr-only">Baustein suchen</span>
        <input className={`${input} pl-8`} placeholder="Baustein suchen" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      {GRUPPEN.map(([g, t]) => { const liste = treffer.filter((b) => b.gruppe === g); if (!liste.length) return null; return (
        <div key={g}><div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-1 pb-0.5">{t}</div>
          <ul className="flex flex-col">{liste.map((b) => (
            <li key={b.id}><button type="button" onClick={() => bs.setWahl(b.id)} aria-current={bs.wahl === b.id}
              className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded-md text-sm ${bs.wahl === b.id ? "bg-orange-50 text-orange-900 dark:bg-orange-950/50 dark:text-orange-200 font-semibold" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
              <span className="w-3 h-3 rounded-sm border border-black/10 shrink-0" style={{ background: mitStandard(b.id, bs.alle[b.id], bs.stand.akzent).hell.bg }} aria-hidden="true" />
              <span className="flex-1 min-w-0 truncate">{b.name}</span>
              {bs.eigen[b.id] && <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400" title="Auf dieser Ebene angepasst">angepasst</span>}
              {bs.offen[b.id] && <Loader2 className="w-3 h-3 animate-spin text-slate-400" aria-label="wird gespeichert" />}
            </button></li>))}</ul></div>); })}
      <p className="text-xs text-slate-500 flex items-start gap-1.5 pt-1"><MousePointerClick className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />Linksklick auf ein Muster in der Galerie wählt es aus. Rechtsklick öffnet wie bisher „Umdesignen“ (neuer Code als Auftrag).</p>
    </div>);
}

function Farbfeld({ name, wert, onWert, gesperrt }) {
  const [t, setT] = useState(wert); const [fokus, setFokus] = useState(false);
  return (
    <span className="flex items-center gap-1.5">
      <input type="color" aria-label={name} value={wert} disabled={gesperrt} onChange={(e) => onWert(e.target.value.toLowerCase())} className="w-8 h-7 rounded border border-slate-300 dark:border-slate-700 bg-transparent cursor-pointer disabled:cursor-default" />
      <input aria-label={`${name} Farbwert`} value={fokus ? t : wert} disabled={gesperrt} maxLength={7} onFocus={() => { setT(wert); setFokus(true); }} onBlur={() => setFokus(false)}
        onChange={(e) => { setT(e.target.value); if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onWert(e.target.value.toLowerCase()); }} className={`${input} w-[84px] font-mono text-xs`} />
    </span>);
}

/**
 * Rechte Spalte im Modus „Bausteine“: Inspektor mit Reitern „Bearbeiten“ und „Chat“ – der EINZIGE Chat dieser Ansicht.
 * „Chat“ = Gespräch zum gewählten Baustein; ohne Auswahl (oder aus dem Assistenten, allgemein=true) der allgemeine Design-Chat.
 * reiter/setReiter/allgemein/chatAllgemein kommen aus dem Designer (sonst wie bisher eigener Zustand).
 */
export function BausteinInspektor({ bs, d, ich, projekt, darf, toast, dunkel, onFreigabe, reiter: reiterAussen, setReiter: setReiterAussen, allgemein = false, onAllgemein, chatAllgemein = null }) {
  const [reiterInnen, setReiterInnen] = useState("bearbeiten");
  const reiter = reiterAussen ?? reiterInnen; const setReiter = setReiterAussen ?? setReiterInnen;
  const ki = useKiName(projekt.id, "design");
  const b = bausteinVon(bs.wahl);
  return (
    <>
      <div role="tablist" aria-label="Inspektor" className="flex gap-1 p-2 border-b border-slate-200 dark:border-slate-800">
        {[["bearbeiten", "Bearbeiten", PenLine], ["chat", `Chat mit ${ki.name}`, Bot]].map(([id, t, I]) => (
          <button key={id} type="button" role="tab" aria-selected={reiter === id} onClick={() => setReiter(id)}
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-sm font-semibold ${reiter === id ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}><I className="w-4 h-4" />{t}</button>))}
      </div>
      {reiter === "chat" && chatAllgemein && (allgemein || !b) ? <>
          <div className="px-3 pt-2 text-xs text-slate-500 flex items-center gap-2 flex-wrap">Allgemeiner Design-Chat{b ? <button type="button" className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline" onClick={() => setReiter("chat")}>Zum Chat für „{b.name}“</button> : " – wähle einen Baustein für das Gespräch zu genau diesem Baustein."}</div>
          {chatAllgemein}</>
        : !b ? <div className="p-4 text-sm text-slate-500 flex flex-col gap-2"><Shapes className="w-6 h-6 text-emerald-700" aria-hidden="true" /><p>Wähle links oder per Linksklick in der Galerie einen Baustein. Änderungen wirken sofort in der Vorschau und werden als Entwurf des Design-Pakets gespeichert.</p>
          <EbeneWahl bs={bs} /></div>
        : reiter === "bearbeiten" ? <Bearbeiten b={b} bs={bs} darf={darf} dunkel={dunkel} projekt={projekt} onFreigabe={onFreigabe} />
        : <>
          {chatAllgemein && <div className="px-3 pt-2 text-xs text-slate-500">Gespräch zu „{b.name}“ · <button type="button" className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline" onClick={() => onAllgemein?.()}>Allgemeiner Design-Chat</button></div>}
          <BausteinChat b={b} bs={bs} d={d} ich={ich} projekt={projekt} darf={darf} toast={toast} ki={ki} /></>}
    </>);
}

function EbeneWahl({ bs }) {
  const e = bs.ebene; const z = bs.stand.ziele || { packages: [], clubs: [] };
  const setze = (x) => bs.setEbene({ level: x.level, ...(x.package_key ? { package_key: x.package_key } : {}), ...(x.club_id ? { club_id: x.club_id } : {}), ...(x.role_key ? { role_key: x.role_key } : {}) });
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-xs font-bold text-slate-500 flex items-center gap-1 mb-1"><Layers className="w-3.5 h-3.5" aria-hidden="true" />Gilt für</legend>
      <select aria-label="Ebene" className={input} value={e.level} onChange={(x) => setze({ level: x.target.value })}>{EBENEN.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
      {e.level === "package" && <select aria-label="Paket" className={input} value={e.package_key || ""} onChange={(x) => setze({ ...e, package_key: x.target.value })}>
        <option value="">Paket wählen …</option>{(z.packages || []).map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select>}
      {(e.level === "club" || e.level === "role") && <select aria-label="Verein" className={input} value={e.club_id || ""} onChange={(x) => setze({ ...e, club_id: x.target.value })}>
        <option value="">Verein wählen …</option>{(z.clubs || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
      {e.level === "role" && <select aria-label="Rolle" className={input} value={e.role_key || ""} onChange={(x) => setze({ ...e, role_key: x.target.value })}>
        <option value="">Rolle wählen …</option>{ROLLEN.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>}
      {(e.level === "club" || e.level === "role") && <p className="text-[11px] text-slate-500">Individualdesign: freigeben lässt sich erst, wenn der Verein es gebucht hat.</p>}
    </fieldset>);
}

function Bearbeiten({ b, bs, darf, dunkel, projekt, onFreigabe }) {
  const verz = useVerzeichnis(projekt.id);
  const [modus, setModus] = useState(dunkel ? "dunkel" : "hell");
  useEffect(() => setModus(dunkel ? "dunkel" : "hell"), [dunkel]);
  const voll = mitStandard(b.id, bs.alle[b.id], bs.stand.akzent);
  const grundlage = mitStandard(b.id, (bs.stand.geerbt || {})[b.id], bs.stand.akzent);
  const gesperrt = !darf || !bs.stand.darf?.edit || !ebeneFertig(bs.ebene) || bs.stand.laden;
  const befunde = pruefeBaustein(voll, SEITE, { interaktiv: !!b.interaktiv, rahmenPflicht: !!b.rahmen });
  const sum = zusammenfassung(befunde);
  const aendern = (pfad, v) => { const n = JSON.parse(JSON.stringify(voll)); let z = n; pfad.slice(0, -1).forEach((k) => { z = z[k]; }); z[pfad[pfad.length - 1]] = v; bs.setze(b.id, n); };
  const lesbar = (bf) => aendern([bf.modus, bf.feld], bf.vorschlag);
  const quelle = b.quelle && verz?.bausteine ? verz.bausteine.find((x) => x.id === b.quelle) : null;
  const namen = b.farbNamen || { bg: "Hintergrund", text: "Text", rand: "Rand" };
  const eigen = bs.eigen[b.id];
  return (
    <div className="p-3 overflow-auto flex flex-col gap-3 text-sm">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1"><h3 className="font-display font-bold text-[16px] leading-tight">{b.name}</h3>
          <p className="text-[11px] text-slate-500 font-mono">{b.id}</p></div>
        {eigen && !gesperrt && <button type="button" className={ghost} title="Alle Änderungen dieser Ebene an diesem Baustein entfernen (erbt wieder)" onClick={() => bs.setze(b.id, grundlage)}><RotateCcw className="w-3.5 h-3.5" />Zurücksetzen</button>}
      </div>
      {b.wirkt === "galerie" && <p className="text-xs rounded-lg px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">Dieses Muster gibt es in der App noch nicht als zentralen Baustein – die Werte gelten in der Galerie und wirken in der App, sobald er zentral gebaut ist (neuer Code = Auftrag, Rechtsklick „Umdesignen“ oder „Neuer Baustein“).</p>}
      <EbeneWahl bs={bs} />
      {bs.stand.fehler && <p className="text-xs rounded-lg px-2.5 py-1.5 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300">{bs.stand.fehler}{bs.stand.freigabe && <> – einmal unter <button type="button" className="underline font-semibold" onClick={() => onFreigabe("designer")}>App-Designer › Seiten</button> anmelden und den PC freigeben, dann <button type="button" className="underline font-semibold" onClick={() => bs.laden()}>neu laden</button>.</>}</p>}
      {!bs.stand.fehler && !bs.stand.laden && ebeneFertig(bs.ebene) && !bs.stand.darf?.edit && <p className="text-xs text-slate-500">Auf dieser Ebene darfst du nicht gestalten (Design-Rechte vergibt der Inhaber in Trainer to go).</p>}
      {!darf && <p className="text-xs text-slate-500">Nur ansehen: Gestalten dürfen Entwickler mit Design-Recht.</p>}

      {b.felder.includes("farben") && <section aria-label="Farben" className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between"><h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Farben</h4>
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">{[["hell", "Hell"], ["dunkel", "Dunkel"]].map(([m, t]) => <button key={m} type="button" aria-pressed={modus === m} onClick={() => setModus(m)} className={`px-2 py-0.5 rounded-md ${modus === m ? "bg-white dark:bg-slate-900 shadow-sm" : ""}`}>{t}</button>)}</div></div>
        {["bg", "text", "rand"].map((k) => <label key={k} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">{namen[k]}<Farbfeld name={`${namen[k]} (${modus})`} wert={voll[modus][k]} gesperrt={gesperrt} onWert={(v) => aendern([modus, k], v)} /></label>)}
        <p className="text-[11px] text-slate-500">Farben frei wählbar – der Kontrast-Wächter prüft hell und dunkel.</p>
      </section>}

      <section aria-label="Kontrast-Wächter" className={`rounded-lg border p-2 flex flex-col gap-1 ${sum.pflicht ? "border-red-300 dark:border-red-900 bg-red-50/60 dark:bg-red-950/30" : sum.hinweise ? "border-amber-300 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30" : "border-green-300 dark:border-green-900 bg-green-50/60 dark:bg-green-950/30"}`}>
        <h4 className="text-xs font-bold flex items-center gap-1"><Contrast className="w-3.5 h-3.5" aria-hidden="true" />Kontrast-Wächter · {sum.pflicht ? `${sum.pflicht} schlecht lesbar` : sum.hinweise ? `${sum.hinweise} Hinweis${sum.hinweise === 1 ? "" : "e"}` : "alles lesbar"}</h4>
        <ul className="flex flex-col gap-1">{befunde.map((x, i) => (
          <li key={i} className="flex items-center gap-1.5 text-xs">
            {x.ok ? <CircleCheck className="w-3.5 h-3.5 text-green-600 shrink-0" aria-label="in Ordnung" /> : x.stufe === "pflicht" ? <CircleAlert className="w-3.5 h-3.5 text-red-600 shrink-0" aria-label="zu wenig Kontrast" /> : <TriangleAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-label="Hinweis" />}
            <span className="flex-1 min-w-0">{x.modus === "hell" ? "Hell" : "Dunkel"}: {x.was} <span className="text-slate-500">{verhaeltnis(x.wert)} (mind. {String(x.soll).replace(".", ",")})</span></span>
            {!x.ok && x.vorschlag && !gesperrt && <button type="button" className="text-[11px] font-semibold rounded-md border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 hover:bg-white dark:hover:bg-slate-900 inline-flex items-center gap-1" title={`Vorschlag: ${x.vorschlag}`} onClick={() => lesbar(x)}>
              <i className="w-3 h-3 rounded-sm border border-black/10" style={{ background: x.vorschlag }} aria-hidden="true" />lesbar machen</button>}
          </li>))}</ul>
        <p className="text-[10px] text-slate-500">Text mind. {String(SOLL.text).replace(".", ",")} : 1, große Schrift und Bedienelemente mind. {SOLL.bedien} : 1 (WCAG 2.1 AA). Speichern geht trotzdem.
          {" "}Geprüft mit der {bs.stand.akzent ? "gewählten Akzentfarbe der App" : "Akzentfarbe ab Werk (Smaragd)"}; Vereinsfarben im Kopfbereich können abweichen.</p>
      </section>

      {b.felder.includes("ecken") && <label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">Ecken
        <span className="flex items-center gap-2"><input type="range" min={0} max={32} value={voll.ecken} disabled={gesperrt} onChange={(e) => aendern(["ecken"], Number(e.target.value))} className="w-28 accent-emerald-700" /><span className="w-10 text-right tabular-nums text-xs">{voll.ecken} px</span></span></label>}
      {b.felder.includes("groesse") && <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">Größe
        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold" role="radiogroup" aria-label="Größe">{GROESSEN.map(([g, t]) => <button key={g} type="button" role="radio" aria-checked={voll.groesse === g} disabled={gesperrt} onClick={() => aendern(["groesse"], g)} className={`px-2 py-0.5 rounded-md ${voll.groesse === g ? "bg-white dark:bg-slate-900 shadow-sm" : ""}`}>{t}</button>)}</div></div>}
      {b.interaktiv && <div className="flex flex-col gap-1">Zustand in der Vorschau
        <div className="flex flex-wrap rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold w-max" role="radiogroup" aria-label="Zustand">{ZUSTAENDE.map(([z, t]) => <button key={z} type="button" role="radio" aria-checked={bs.zustand === z} onClick={() => bs.setZustand(z)} className={`px-2 py-0.5 rounded-md ${bs.zustand === z ? "bg-white dark:bg-slate-900 shadow-sm" : ""}`}>{t}</button>)}</div>
        <span className="text-[11px] text-slate-500">„Darüber“ und „Gedrückt“ werden aus der Hintergrundfarbe abgeleitet, „Gesperrt“ ist halb durchsichtig.</span></div>}
      {b.felder.includes("symbol") && <div className="flex flex-col gap-1"><span className="flex items-center gap-2">Symbol <span className="text-xs text-slate-500 font-mono">{voll.symbol}</span>
        <Suspense fallback={null}><SymbolZeichen name={voll.symbol} /></Suspense></span>
        <Suspense fallback={<Loader2 className="w-4 h-4 animate-spin text-emerald-700" />}><SymbolWahl wert={voll.symbol} gesperrt={gesperrt} onWahl={(n) => aendern(["symbol"], n)} /></Suspense></div>}

      <section aria-label="Verwendet in" className="flex flex-col gap-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1"><Link2 className="w-3.5 h-3.5" aria-hidden="true" />Verwendet in …</h4>
        {!b.quelle ? <p className="text-xs text-slate-500">Nur in der Galerie (noch kein zentraler Baustein).</p>
          : !verz ? <Loader2 className="w-4 h-4 animate-spin text-emerald-700" /> : !quelle ? <p className="text-xs text-slate-500">Im Baustein-Verzeichnis nicht gefunden ({b.quelle}).</p>
          : <><p className="text-xs">{quelle.verwendet} Stellen · <span className="font-mono">{quelle.datei}</span></p>
            <ul className="text-[11px] font-mono text-slate-500 max-h-24 overflow-auto">{(quelle.stellen || []).slice(0, 12).map((s) => <li key={s} className="truncate" title={s}>{s}</li>)}{quelle.verwendet > 12 && <li>… und weitere</li>}</ul></>}
      </section>

      <div className={`text-xs rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 ${bs.speichert?.ok === false ? "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300" : "bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300"}`} aria-live="polite">
        {bs.speichert === "laeuft" || bs.offen[b.id] ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Wird als Entwurf gespeichert …</>
          : bs.speichert?.ok === false ? <><CircleAlert className="w-3.5 h-3.5" />Nicht gespeichert: {bs.speichert.text}</>
          : bs.speichert?.ok ? <><Check className="w-3.5 h-3.5 text-green-600" />{bs.speichert.text} · {fmt(bs.speichert.zeit)}</>
          : bs.stand.entwurf ? <>Entwurf vorhanden (Version {bs.stand.entwurf.version}){bs.stand.live ? ` · live: Version ${bs.stand.live.version}` : ""}</>
          : bs.stand.live ? <>Live: Version {bs.stand.live.version} – Änderungen legen einen neuen Entwurf an</> : <>Noch kein Design-Paket auf dieser Ebene – das Aussehen ist ab Werk</>}
      </div>
      <button type="button" className={ghost} onClick={() => onFreigabe("freigabe")} title="Freigeben über den bestehenden Weg (App-Designer › Seiten › Freigabe & Versionen), ab Werk „Sofort“">
        <ShieldCheck className="w-4 h-4" />Zur Freigabe<ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /></button>
      <p className="text-[11px] text-slate-500">Freigeben wirkt sofort in der App (alle Nutzer der gewählten Ebene). Neue Bausteine (neuer Code) laufen weiter als Auftrag.</p>
    </div>);
}

// Chat zum gewählten Baustein: der bestehende Design-Chat (ws_design_chat, eigene Werkstatt) mit dem Baustein und seinen Werten als Kontext.
// Die KI darf als übernehmbaren Vorschlag NUR die Werte dieses Bausteins ändern (Werkstatt und Datenbank prüfen das Schema).
const IDEEN = ["Besser lesbar machen", "Passend zur Hauptfarbe", "Freundlicher, runder", "Gut fürs Handy draußen", "Dunkelmodus abstimmen"];
function BausteinChat({ b, bs, d, ich, projekt, darf, toast, ki }) {
  const [text, setText] = useState(""); const feld = useRef(null); useAutoHoehe(feld, text);
  const [liste, setListe] = useState([]); const [sende, setSende] = useState(false); const ende = useRef(null);
  const praefix = `[Baustein ${b.id}]`;
  const holen = useCallback(async () => {
    const { data } = await supabase.from("ws_design_chat").select("*").eq("projekt_id", projekt.id).is("entwurf_id", null).order("id", { ascending: false }).limit(200);
    const fragen = new Set((data || []).filter((m) => !m.frage_id && String(m.text).startsWith(praefix)).map((m) => m.id));
    setListe((data || []).filter((m) => fragen.has(m.id) || fragen.has(m.frage_id)).reverse());
  }, [projekt.id, praefix]);
  useEffect(() => {
    holen();
    const ch = supabase.channel(`cs-baustein-chat-${projekt.id}-${b.id}`).on("postgres_changes", { event: "*", schema: "public", table: "ws_design_chat" }, holen).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [holen, projekt.id, b.id]);
  useEffect(() => { ende.current?.scrollIntoView({ block: "end" }); }, [liste.length]);
  const voll = mitStandard(b.id, bs.alle[b.id], bs.stand.akzent);
  const werkstattAn = d.pcs.some((p) => p.benutzer_id === ich.id && p.an);
  const wartet = liste.some((m) => !m.frage_id && m.von === ich.id && ["offen", "laeuft"].includes(m.stand));
  const schicke = async (t) => {
    const inhalt = (t ?? text).trim(); if (!inhalt) return;
    const befunde = pruefeBaustein(voll, SEITE, { interaktiv: !!b.interaktiv, rahmenPflicht: !!b.rahmen }).filter((x) => !x.ok).map((x) => `${x.modus}: ${x.was} ${verhaeltnis(x.wert)}`);
    // Nur Gestaltung als Kontext: Kennung, Name, Werte (inkl. Standard), offene Kontrast-Befunde – keine Vereinsnamen, keine Personendaten
    const frage = `${praefix} ${inhalt}${befunde.length ? `\nKontrast offen: ${befunde.join("; ")}` : ""}`;
    setSende(true);
    const { error } = await supabase.from("ws_design_chat").insert({ projekt_id: projekt.id, entwurf_id: null, text: frage.slice(0, 8000), werte: { bausteine: { [b.id]: voll } } });
    setSende(false);
    if (error) return toast(fehler(error));
    setText("");
  };
  const entscheide = async (m, e) => {
    if (e === "uebernommen") {
      const w = bausteinWerteBereinigen(b.id, m.werte?.bausteine?.[b.id]);
      if (!Object.keys(w).length) { toast("Der Vorschlag enthält keine gültigen Werte für diesen Baustein"); return; }
      if (!darf || !bs.stand.darf?.edit) { toast("Kein Recht zum Gestalten auf dieser Ebene"); return; }
      const n = JSON.parse(JSON.stringify(voll)); for (const x of ["hell", "dunkel"]) if (w[x]) n[x] = { ...n[x], ...w[x] }; for (const x of ["ecken", "groesse", "symbol"]) if (x in w) n[x] = w[x];
      bs.setze(b.id, n);
    }
    const { error } = await supabase.rpc("ws_design_chat_entscheiden", { p_antwort: m.id, p_entscheidung: e });
    if (error) toast(fehler(error)); else toast(e === "uebernommen" ? "Übernommen – wirkt sofort in der Vorschau und wird als Entwurf gespeichert" : "Vorschlag abgelehnt");
  };
  const fragen = Object.fromEntries(liste.filter((m) => !m.frage_id).map((m) => [m.id, m]));
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-auto p-3 space-y-2.5 text-sm">
        {!liste.length && <p className="text-slate-500">Frag {ki.name} zu „{b.name}“. {ki.name} kennt die aktuellen Werte und schlägt nur Werte dieses Bausteins vor – übernommen wird nur, was du anklickst.</p>}
        {liste.map((m) => m.frage_id ? (
          <div key={m.id} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-2.5 max-w-[95%]">
            <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><Bot className="w-3.5 h-3.5" />{ki.von(m.ki)}</div>
            <Markdown text={m.text} klein />
            {m.werte?.bausteine?.[b.id] && <VorschlagBaustein b={b} voll={voll} w={m.werte.bausteine[b.id]} m={m} kann={fragen[m.frage_id]?.von === ich.id && darf} onEntscheid={(e) => entscheide(m, e)} />}
          </div>
        ) : (
          <div key={m.id} className="ml-auto rounded-xl bg-emerald-50 dark:bg-emerald-950/50 p-2.5 max-w-[90%]">
            <div className="text-[11px] font-bold text-slate-500">{m.von === ich.id ? "Du" : d.benutzer.find((u) => u.id === m.von)?.name || "Mitglied"} · {fmt(m.erstellt)}</div>
            <Markdown text={String(m.text).slice(praefix.length).trim()} klein />
            {m.stand === "fehler" && <p className="text-xs text-red-600 mt-1">Nicht beantwortet</p>}
          </div>))}
        {wartet && <div className="flex items-center gap-2 text-slate-500">{werkstattAn ? <><Loader2 className="w-4 h-4 animate-spin" />{ki.name} denkt nach … (über deine Werkstatt)</> : <span className="text-amber-700 dark:text-amber-400">Deine Werkstatt ist aus – schalte sie oben ein.</span>}</div>}
        <div ref={ende} />
      </div>
      {darf ? (
        <form className="border-t border-slate-200 dark:border-slate-800 p-2.5 space-y-2" onSubmit={(e) => { e.preventDefault(); schicke(); }}>
          <div className="flex flex-wrap gap-1">{IDEEN.map((i) => <button key={i} type="button" disabled={sende} onClick={() => schicke(i)} className="text-xs rounded-full border border-slate-300 dark:border-slate-700 px-2 py-0.5 hover:bg-slate-50 dark:hover:bg-slate-800">{i}</button>)}</div>
          <div className="flex gap-1.5">
            <textarea ref={feld} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={3000} placeholder={`Was soll sich an „${b.name}“ ändern?`} className={`${input} resize-none`}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); schicke(); } }} />
            <button className={`${btn} self-end`} disabled={sende || !text.trim()} title="Senden"><Send className="w-4 h-4" /></button>
          </div>
        </form>) : <p className="border-t border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-500">Mitlesen möglich – fragen dürfen Entwickler mit Design-Recht.</p>}
    </div>);
}

function VorschlagBaustein({ b, voll, w, m, kann, onEntscheid }) {
  const x = bausteinWerteBereinigen(b.id, w);
  const liste = [];
  for (const md of ["hell", "dunkel"]) for (const [k, v] of Object.entries(x[md] || {})) if (voll[md][k] !== v) liste.push([`${md === "hell" ? "Hell" : "Dunkel"} · ${({ bg: "Hintergrund", text: "Text", rand: "Rand" })[k]}`, voll[md][k], v]);
  for (const k of ["ecken", "groesse", "symbol"]) if (k in x && x[k] !== voll[k]) liste.push([({ ecken: "Ecken", groesse: "Größe", symbol: "Symbol" })[k], voll[k], x[k]]);
  const Wert = ({ v }) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? <span className="inline-flex items-center gap-1 font-mono"><i className="w-3 h-3 rounded-sm border border-black/10" style={{ background: v }} />{v}</span> : <span className="font-mono">{String(v)}</span>);
  return (
    <div className="mt-2 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 p-2">
      <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />Vorschlag für „{b.name}“ · {liste.length} Änderung{liste.length === 1 ? "" : "en"}</div>
      {liste.length ? <ul className="space-y-0.5">{liste.map(([k, a, n]) => <li key={k} className="flex items-center gap-1.5 text-xs"><span className="text-slate-500">{k}</span><span className="ml-auto flex items-center gap-1"><Wert v={a} />→<Wert v={n} /></span></li>)}</ul>
        : <p className="text-xs text-slate-500">Schon so eingestellt.</p>}
      {m.entscheidung ? <p className="text-xs mt-1.5 font-semibold text-slate-500">{m.entscheidung === "uebernommen" ? "Übernommen" : "Abgelehnt"}</p>
        : kann && liste.length > 0 && <div className="flex gap-1.5 mt-2"><button type="button" className={btn} onClick={() => onEntscheid("uebernommen")}><Check className="w-4 h-4" />Übernehmen</button><button type="button" className={ghost} onClick={() => onEntscheid("abgelehnt")}><X className="w-4 h-4" />Ablehnen</button></div>}
    </div>);
}
