import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { icons as LUCIDE, X, Save, Send, Loader2, Bot, Check, Search, Trash2, PenLine } from "lucide-react";
import { supabase } from "./supabase";
import { useKiName } from "./kiName";
import { useAutoHoehe } from "./autoHoehe";

// Symbole und Grundbausteine umdesignen (Entwurf 1.0, freigegeben von Gerhard 2026-10-23 22:38, Datenbank 0027).
// Rechtsklick in der Galerie (Testseite) oder im Verzeichnis öffnet diesen Entwurf: Zuweisungen vorausgefüllt (alle Stellen angehakt),
// ändern – auch per Chat –, speichern und als Auftrag senden; dann ändert es sich an den angehakten Stellen der App.
// Nur feste Werte: Lucide-Namen, eigene Symbole als Striche (24 × 24), Farben #rrggbb – gleiche Regeln wie ws_umdesign_werte_ok.
// Diese Datei wird erst bei Bedarf geladen (alle Lucide-Symbole für die Auswahl).

const card = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const btn = "inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-display font-bold tracking-wide transition text-sm";
const ghost = "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50";
const input = "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";
const fehler = (e) => (e?.message || "Unbekannter Fehler").replace(/^.*?ERROR:\s*/, "");

const NAME = /^[A-Z][A-Za-z0-9]{1,40}$/;
const PFAD = /^[MmLlHhVvCcSsQqTtAaZz0-9 .,-]{1,1200}$/;
const HEX = /^#[0-9a-f]{6}$/i;
const zahl = (v, lo, hi) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
/** Werte nach festen Regeln bereinigen (die Datenbank prüft zusätzlich). */
export function umdesignBereinigen(art, w) {
  const r = {};
  if (!w || typeof w !== "object") return r;
  if (typeof w.beschreibung === "string") r.beschreibung = w.beschreibung.slice(0, 2000);
  if (art === "symbol") {
    if (typeof w.neu === "string" && NAME.test(w.neu) && Object.hasOwn(LUCIDE, w.neu)) r.neu = w.neu;
    else if (w.eigen && typeof w.eigen === "object") {
      const pfade = (Array.isArray(w.eigen.pfade) ? w.eigen.pfade : []).filter((p) => typeof p === "string" && PFAD.test(p)).slice(0, 20);
      const kreise = (Array.isArray(w.eigen.kreise) ? w.eigen.kreise : []).filter((k) => k && zahl(k.cx, 0, 24) && zahl(k.cy, 0, 24) && zahl(k.r, 0, 12)).map((k) => ({ cx: k.cx, cy: k.cy, r: k.r })).slice(0, 10);
      if (pfade.length || kreise.length) r.eigen = { ...(typeof w.eigen.name === "string" && NAME.test(w.eigen.name) ? { name: w.eigen.name } : {}), pfade, kreise };
    }
  } else if (w.einstellungen && typeof w.einstellungen === "object") {
    const e = w.einstellungen; const o = {};
    for (const k of ["hintergrund", "rand", "text"]) if (typeof e[k] === "string" && HEX.test(e[k])) o[k] = e[k].toLowerCase();
    if (["rund", "eckig", "pille"].includes(e.ecken)) o.ecken = e.ecken;
    if (["normal", "fett"].includes(e.schrift)) o.schrift = e.schrift;
    if (typeof e.symbol === "string" && (e.symbol === "keins" || (NAME.test(e.symbol) && Object.hasOwn(LUCIDE, e.symbol)))) o.symbol = e.symbol;
    if (typeof e.variante === "string" && /^[a-z0-9-]{1,30}$/.test(e.variante)) o.variante = e.variante;
    if (Object.keys(o).length) r.einstellungen = o;
  }
  return r;
}
/** Vorschlag aus der Chat-Antwort (letzte Zeile „UMDESIGN: {…}“). */
export function umdesignAusText(art, text) {
  const z = String(text || "").split(/\r?\n/).map((x) => x.trim()).reverse().find((x) => /^\**UMDESIGN:/i.test(x));
  if (!z) return null;
  try { const v = umdesignBereinigen(art, JSON.parse(z.replace(/^\**UMDESIGN:\**\s*/i, "").replace(/^`+|`+$/g, ""))); return Object.keys(v).length ? v : null; } catch { return null; }
}
const ohneVorschlag = (t) => String(t || "").split(/\r?\n/).filter((x) => !/^\s*\**UMDESIGN:/i.test(x)).join("\n").trim();

function Symbol({ name, eigen, groesse = 24, strich = 2 }) {
  if (eigen) return (
    <svg width={groesse} height={groesse} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strich} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {eigen.pfade.map((d, i) => <path key={`p${i}`} d={d} />)}{eigen.kreise.map((k, i) => <circle key={`k${i}`} cx={k.cx} cy={k.cy} r={k.r} />)}
    </svg>);
  const I = Object.hasOwn(LUCIDE, name) ? LUCIDE[name] : null;
  return I ? <I width={groesse} height={groesse} strokeWidth={strich} /> : <span className="text-xs text-slate-400">?</span>;
}

// Muster für Grundbausteine: zeigt die festen Einstellungen an einem typischen Beispiel
function BausteinMuster({ id, e }) {
  const r = e.ecken === "eckig" ? 4 : e.ecken === "pille" ? 999 : 10;
  const stil = { background: e.hintergrund || "#fef3c7", border: `1px solid ${e.rand || "#b45309"}`, color: e.text || "#1f2937", borderRadius: r, fontWeight: e.schrift === "fett" ? 700 : 500 };
  const S = e.symbol && e.symbol !== "keins" ? <Symbol name={e.symbol} groesse={18} /> : null;
  if (/badge/.test(id)) return <span style={{ ...stil, padding: "2px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>{S}aktiv</span>;
  if (/button/.test(id)) return <span style={{ ...stil, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}>{S}Neuer Termin</span>;
  return <div style={{ ...stil, padding: "10px 12px", display: "flex", gap: 10, alignItems: "flex-start" }}>{S}<div><div style={{ fontWeight: 700 }}>Beitrag offen</div><div style={{ fontSize: 13, fontWeight: 400 }}>Für 3 Spieler ist der Beitrag noch nicht bezahlt.</div></div></div>;
}

export default function Umdesign({ projekt, d, ich, toast, ziel, verz, icons, onSchliessen }) {
  const { art, name } = ziel;
  const eintrag = art === "symbol" ? (verz?.symbole || []).find((s) => s.name === name) : (verz?.bausteine || []).find((b) => b.id === name);
  const alle = useMemo(() => (Array.isArray(eintrag?.stellen) ? eintrag.stellen.filter((s) => typeof s === "string" && /^src\/[A-Za-z0-9_./ -]{1,200}\.(jsx|js|tsx|ts)$/.test(s) && !s.includes("..")) : []), [eintrag]);
  const [entwurf, setEntwurf] = useState(null); const [werte, setWerte] = useState({}); const [an, setAn] = useState(() => new Set());
  const [suche, setSuche] = useState(""); const [busy, setBusy] = useState(false); const [senden, setSenden] = useState(null);
  const [chat, setChat] = useState([]); const [text, setText] = useState(""); const feld = useRef(null); useAutoHoehe(feld, text, { min: 72 });
  const ki = useKiName(projekt.id, "design");
  const prefix = `[Umdesign ${art === "symbol" ? "Symbol" : "Baustein"} ${name}]`;

  // vorhandenen Entwurf laden, sonst alle Stellen angehakt
  useEffect(() => {
    let aus = false;
    supabase.from("ws_umdesign").select("*").eq("projekt_id", projekt.id).eq("art", art).eq("ziel", name).eq("stand", "entwurf").order("id", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (aus) return; setEntwurf(data || null); setWerte(data ? umdesignBereinigen(art, data.werte) : {}); setAn(new Set(data ? data.stellen : alle)); });
    return () => { aus = true; };
  }, [projekt.id, art, name, alle]);
  const holeChat = useCallback(async () => {
    const { data } = await supabase.from("ws_design_chat").select("id, von, text, frage_id, stand, ki, erstellt").eq("projekt_id", projekt.id).is("entwurf_id", null).order("id", { ascending: false }).limit(200);
    const l = (data || []).reverse(); const fragen = new Set(l.filter((m) => !m.frage_id && String(m.text).startsWith(prefix)).map((m) => m.id));
    setChat(l.filter((m) => fragen.has(m.id) || fragen.has(m.frage_id)));
  }, [projekt.id, prefix]);
  useEffect(() => {
    holeChat();
    const ch = supabase.channel(`cs-umdesign-${projekt.id}-${name}-${Math.random()}`).on("postgres_changes", { event: "*", schema: "public", table: "ws_design_chat", filter: `projekt_id=eq.${projekt.id}` }, holeChat).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [holeChat, projekt.id, name]);

  const strich = icons?.strich || 2;
  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return Object.keys(LUCIDE).filter((n) => (q ? n.toLowerCase().includes(q) : n.toLowerCase().includes(name.toLowerCase().slice(0, 5)))).slice(0, 60);
  }, [suche, name]);
  const fragen = async () => {
    const t = text.trim(); if (!t) return;
    const { error } = await supabase.from("ws_design_chat").insert({ projekt_id: projekt.id, entwurf_id: null, text: `${prefix} Stand des Entwurfs (Daten): ${JSON.stringify(werte).slice(0, 1500)}\nWunsch: ${t}`.slice(0, 8000), werte: null });
    if (error) toast(fehler(error)); else { setText(""); holeChat(); }
  };
  const speichern = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("ws_umdesign_speichern", { p_id: entwurf?.id ?? null, p_projekt: projekt.id, p_art: art, p_ziel: name, p_werte: werte, p_stellen: [...an], p_alle: alle.length });
    setBusy(false);
    if (error) { toast(fehler(error)); return null; }
    setEntwurf({ ...(entwurf || {}), id: data, stand: "entwurf" }); toast("Entwurf gespeichert"); return data;
  };
  const auftragText = () => {
    const teil = an.size === alle.length ? "an ALLEN Stellen" : `nur an den angehakten ${an.size} von ${alle.length} Stellen (alle anderen bleiben unverändert)`;
    if (art === "symbol") return [
      `Symbol „${name}“ umdesignen (aus dem App-Designer der Codeschmiede).`,
      werte.neu ? `Neu: Lucide-Symbol „${werte.neu}“ statt „${name}“ – ${teil}.` : werte.eigen ? `Neu: eigenes Symbol „${werte.eigen.name || `${name}Eigen`}“ im Lucide-Stil (24 × 24, nur Striche, Farbe = Textfarbe, Strichstärke aus dem Icon-Stil) – ${teil}. Als Komponente unter src/components/icons/ anlegen (Props wie Lucide: className, strokeWidth, size; Pfade und Kreise aus den Werten unten).` : `Kein neues Symbol gewählt – nur prüfen.`,
      werte.beschreibung ? `Hinweis: ${werte.beschreibung}` : "",
      "Danach `node tools/bausteine.mjs` ausführen (Verzeichnis/Galerie), Handbuch-Bilder und CHANGELOG mitführen. Hell/Dunkel und Handy prüfen.",
    ].filter(Boolean).join("\n");
    const e = werte.einstellungen || {};
    return [
      `Grundbaustein „${name}“ (${eintrag?.datei || "src/components/ui"}) umdesignen (aus dem App-Designer der Codeschmiede).`,
      `Einstellungen: ${Object.entries(e).map(([k, v]) => `${k} = ${v}`).join(", ") || "(keine festen Änderungen)"}.`,
      werte.beschreibung ? `Beschreibung: ${werte.beschreibung}` : "",
      an.size === alle.length ? "Gilt an allen Stellen: den Baustein selbst ändern (Varianten erhalten)."
        : `Gilt ${teil}: als neue Variante „${e.variante || "neu"}“ des Bausteins anlegen und nur dort verwenden.`,
      "Farben über das Grunddesign/CSS-Variablen, Kontrast mind. 4,5 : 1, Hell/Dunkel und Handy prüfen. Danach `node tools/bausteine.mjs`, Handbuch und CHANGELOG mitführen.",
    ].filter(Boolean).join("\n");
  };
  const abschicken = async () => {
    const id = await speichern(); if (!id) return;
    setBusy(true); const { data, error } = await supabase.rpc("ws_umdesign_senden", { p_id: id, p_text: senden }); setBusy(false);
    if (error) toast(fehler(error)); else { toast(`Auftrag #${data} gesendet – geht wie jeder Auftrag über Freigabe, Prüfungen und Test`); setSenden(null); setEntwurf(null); onSchliessen(); }
  };
  const verwerfen = async () => {
    if (!entwurf?.id) { onSchliessen(); return; }
    const { error } = await supabase.rpc("ws_umdesign_verwerfen", { p_id: entwurf.id }); if (error) toast(fehler(error)); else { toast("Entwurf verworfen"); onSchliessen(); }
  };
  const e = werte.einstellungen || {};
  const setzeE = (k, v) => setWerte(umdesignBereinigen(art, { ...werte, einstellungen: { ...e, [k]: v } }));

  return (
    <section className={`${card} p-3 flex flex-col gap-3`} aria-label={`${art === "symbol" ? "Symbol" : "Grundbaustein"} ${name} umdesignen`}>
      <div className="flex items-center gap-2 flex-wrap"><PenLine className="w-5 h-5 text-emerald-700" />
        <h3 className="font-display font-bold text-lg">{art === "symbol" ? `Symbol „${name}“` : `Grundbaustein „${eintrag?.name || name}“`}</h3>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300">{entwurf?.id ? "Entwurf gespeichert" : "neuer Entwurf"}</span>
        <button type="button" className={`${ghost} ml-auto h-8`} onClick={onSchliessen}><X className="w-4 h-4" />Schließen</button></div>
      {!eintrag && <p className="text-sm text-amber-700 dark:text-amber-300">„{name}“ steht noch nicht im Baustein-Verzeichnis des Projekts – die Zuweisungen kommen mit dem nächsten Abgleich (alle 10 Minuten).</p>}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 min-w-0">
          {art === "symbol" ? (<>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-center"><div className="text-xs text-slate-500">Jetzt</div><div className="w-16 h-16 grid place-items-center rounded-xl border border-slate-200 dark:border-slate-800"><Symbol name={name} groesse={36} strich={strich} /></div></div>
              <span className="text-slate-400">→</span>
              <div className="text-center"><div className="text-xs text-slate-500">Neu</div><div className="w-16 h-16 grid place-items-center rounded-xl border border-emerald-600"><Symbol name={werte.neu || name} eigen={werte.eigen} groesse={36} strich={strich} /></div></div>
              {werte.eigen && <span className="text-xs text-slate-500">eigenes Symbol{werte.eigen.name ? ` „${werte.eigen.name}“` : ""} ({werte.eigen.pfade.length + werte.eigen.kreise.length} Striche)</span>}
            </div>
            <label className="relative"><Search className="w-4 h-4 absolute left-2.5 top-2 text-slate-400" /><input id="umdesign-suche" className={`${input} pl-8`} placeholder="Lucide-Symbol suchen (englisch, z. B. calendar, ball, shield)" value={suche} onChange={(ev) => setSuche(ev.target.value)} /></label>
            <div className="grid gap-1.5 grid-cols-[repeat(auto-fill,minmax(44px,1fr))] max-h-[220px] overflow-auto" role="listbox" aria-label="Lucide-Symbole">
              {treffer.map((n) => <button key={n} type="button" role="option" aria-selected={werte.neu === n} title={n} onClick={() => setWerte({ ...(werte.beschreibung ? { beschreibung: werte.beschreibung } : {}), neu: n })}
                className={`h-11 grid place-items-center rounded-lg border ${werte.neu === n ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950" : "border-slate-200 dark:border-slate-800 hover:border-emerald-600"}`}><Symbol name={n} groesse={20} strich={strich} /></button>)}
            </div>
            <p className="text-xs text-slate-500">Eigenes Symbol: im Chat beschreiben (z. B. „ein Fußballtor im Lucide-Stil“) – die KI zeichnet es, du übernimmst es mit einem Klick.</p>
          </>) : (<>
            <div className="rounded-xl p-4 bg-slate-50 dark:bg-slate-950"><BausteinMuster id={name} e={e} /></div>
            <div className="grid gap-2 2xl:grid-cols-2 text-sm">
              {[["hintergrund", "Hintergrund", "#fef3c7"], ["rand", "Rand", "#b45309"], ["text", "Text", "#1f2937"]].map(([k, t, std]) => (
                <label key={k} className="flex items-center justify-between gap-2">{t}<input type="color" aria-label={t} value={e[k] || std} onChange={(ev) => setzeE(k, ev.target.value)} className="w-9 h-8 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>))}
              <label className="flex items-center justify-between gap-2">Ecken<select className={`${input.replace("w-full ", "")} min-w-0 flex-1 max-w-[9rem]`} value={e.ecken || "rund"} onChange={(ev) => setzeE("ecken", ev.target.value)}><option value="rund">rund</option><option value="eckig">eckig</option><option value="pille">Pille</option></select></label>
              <label className="flex items-center justify-between gap-2">Schrift<select className={`${input.replace("w-full ", "")} min-w-0 flex-1 max-w-[9rem]`} value={e.schrift || "normal"} onChange={(ev) => setzeE("schrift", ev.target.value)}><option value="normal">normal</option><option value="fett">fett</option></select></label>
              <label className="flex items-center justify-between gap-2">Symbol<input className={`${input.replace("w-full ", "")} min-w-0 flex-1 max-w-[11rem]`} placeholder="z. B. AlertTriangle" defaultValue={e.symbol || ""} onBlur={(ev) => setzeE("symbol", ev.target.value.trim() || "keins")} /></label>
              <label className="flex items-center justify-between gap-2">Variante<input className={`${input.replace("w-full ", "")} min-w-0 flex-1 max-w-[11rem]`} placeholder="z. B. warnung" defaultValue={e.variante || ""} onBlur={(ev) => setzeE("variante", ev.target.value.trim().toLowerCase())} /></label>
            </div>
          </>)}
          <label className="flex flex-col gap-1 text-sm text-slate-500">Beschreibung (optional)
            <textarea className={`${input} min-h-[56px]`} maxLength={2000} value={werte.beschreibung || ""} onChange={(ev) => setWerte({ ...werte, beschreibung: ev.target.value })} placeholder="Was soll sich ändern und warum?" /></label>
        </div>

        <div className="flex flex-col gap-2 min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5">
          <div className="text-sm font-semibold flex items-center gap-1.5"><Bot className="w-4 h-4" />Chat mit {ki.name}</div>
          <div className="flex-1 max-h-[260px] overflow-auto flex flex-col gap-2 text-sm" aria-live="polite">
            {!chat.length && <p className="text-slate-500 text-xs">Frag z. B. „Welches Symbol passt besser für Trainingstermine?“ oder „Warnhinweise auffälliger, aber nicht schreiend“.</p>}
            {chat.map((m) => { const v = m.frage_id ? umdesignAusText(art, m.text) : null;
              return (
                <div key={m.id} className={`rounded-lg px-2.5 py-1.5 max-w-[92%] ${m.frage_id ? "bg-slate-50 dark:bg-slate-950 self-start" : "bg-emerald-50 dark:bg-emerald-950/50 self-end"}`}>
                  {m.frage_id && <div className="text-[11px] font-bold text-slate-500">{ki.von(m.ki)}</div>}
                  <div className="whitespace-pre-line">{m.frage_id ? ohneVorschlag(m.text) : String(m.text).replace(/^\[Umdesign[^\]]*\] Stand des Entwurfs \(Daten\): [^\n]*\nWunsch: /, "")}</div>
                  {v && <button type="button" className={`${btn} h-8 mt-1.5`} onClick={() => setWerte({ ...werte, ...v, ...(v.neu ? { eigen: undefined } : {}), ...(v.eigen ? { neu: undefined } : {}) })}><Check className="w-3.5 h-3.5" />Vorschlag übernehmen</button>}
                </div>); })}
            {chat.some((m) => !m.frage_id && ["offen", "laeuft"].includes(m.stand)) && <div className="text-xs text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{ki.name} denkt nach … (über deine Werkstatt)</div>}
          </div>
          <div className="flex gap-2 items-end"><textarea ref={feld} id="umdesign-chat" className={`${input} resize-none`} rows={2} maxLength={2000} value={text} onChange={(ev) => setText(ev.target.value)} placeholder="Was soll sich ändern?"
            onKeyDown={(ev) => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); fragen(); } }} />
            <button type="button" className={btn} disabled={!text.trim()} onClick={fragen}><Send className="w-4 h-4" /></button></div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap"><b className="text-sm">Zuweisungen</b><span className="text-xs text-slate-500">{an.size} von {alle.length} Stellen angehakt</span>
          <button type="button" className="text-xs underline text-slate-500" onClick={() => setAn(new Set(alle))}>alle</button><button type="button" className="text-xs underline text-slate-500" onClick={() => setAn(new Set())}>keine</button></div>
        <div className="max-h-[200px] overflow-auto rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          {alle.map((s) => <label key={s} className="flex items-center gap-2 px-2.5 py-1 text-xs font-mono"><input type="checkbox" className="accent-emerald-700" checked={an.has(s)} onChange={(ev) => { const n = new Set(an); if (ev.target.checked) n.add(s); else n.delete(s); setAn(n); }} />{s}</label>)}
          {!alle.length && <p className="p-2.5 text-xs text-slate-500">Keine Stellen bekannt.</p>}
        </div>
      </div>

      {senden != null ? (
        <div className="flex flex-col gap-2"><label className="text-sm font-semibold">Auftragstext (änderbar)<textarea className={`${input} mt-1 font-mono text-xs min-h-[140px]`} value={senden} onChange={(ev) => setSenden(ev.target.value)} maxLength={7000} /></label>
          <div className="flex gap-2 flex-wrap"><button type="button" className={btn} disabled={busy || !an.size} onClick={abschicken}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Ja, als Auftrag senden</button>
            <button type="button" className={ghost} onClick={() => setSenden(null)}>Zurück</button></div></div>
      ) : (
        <div className="flex gap-2 flex-wrap items-center">
          <button type="button" className={btn} disabled={busy || !an.size} onClick={speichern}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Speichern</button>
          <button type="button" className={ghost} disabled={busy || !an.size || (art === "symbol" && !werte.neu && !werte.eigen)} onClick={() => setSenden(auftragText())}><Send className="w-4 h-4" />Als Auftrag senden …</button>
          <button type="button" className={`${ghost} ml-auto`} onClick={verwerfen}><Trash2 className="w-4 h-4" />{entwurf?.id ? "Entwurf verwerfen" : "Abbrechen"}</button>
          {!an.size && <span className="text-xs text-amber-700 dark:text-amber-300">Mindestens eine Stelle anhaken.</span>}
        </div>)}
    </section>);
}
