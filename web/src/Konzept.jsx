import React, { useCallback, useEffect, useState } from "react";
import { Lightbulb, CircleCheck, Circle, Plus, Trash2, Loader2, BookOpen, Palette, MessageSquare, FileText, Download } from "lucide-react";
import { Markdown } from "./Markdown";
import { supabase } from "./supabase";
import ClaudeChat, { KAPITEL } from "./ClaudeSpalte";

// Konzept-Arbeitsplatz (Entwurf „Konzept zuerst“ 1.0, freigegeben von Gerhard 2026-10-23 18:06):
// erste Gruppe im Bereich App. Hier wird das Grundkonzept besprochen, bevor gebaut wird; geklärte Entscheidungen gehen
// ins Wissen (ws_wissen, Datenbank 0020), das jeder spätere Chat, der Design-Chat und jeder Bau-Auftrag kennt.
const card = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const fehler = (e) => (e?.message || "Unbekannter Fehler").replace(/^.*?ERROR:\s*/, "");
const input = "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30";

export function useWissen(projektId) {
  const [liste, setListe] = useState(null);
  const holen = useCallback(async () => {
    if (!projektId) return;
    const { data, error } = await supabase.from("ws_wissen").select("*").eq("projekt_id", projektId).order("id");
    setListe(error ? [] : data || []);
  }, [projektId]);
  useEffect(() => {
    holen();
    const ch = supabase.channel(`cs-wissen-${projektId}`).on("postgres_changes", { event: "*", schema: "public", table: "ws_wissen" }, holen).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [holen, projektId]);
  return { liste, holen };
}

/** Konzept-Dokument aus dem Konzept-Stand (Gerhard 2026-10-23 18:33: „alles Relevante ins Wissen und als Konzept gespeichert“) – immer aktuell. */
export function konzeptMarkdown(projekt, liste, benutzer = []) {
  const datum = (x) => new Date(x).toLocaleDateString("de-AT");
  const wer = (id) => benutzer.find((u) => u.id === id)?.name || "Team";
  const zuletzt = liste.reduce((m, w) => (Date.parse(w.erstellt) > m ? Date.parse(w.erstellt) : m), 0);
  const teile = [`# Konzept – ${projekt?.name || ""}`, "",
    `Stand ${zuletzt ? datum(zuletzt) : datum(Date.now())} · ${liste.length} ${liste.length === 1 ? "Eintrag" : "Einträge"} · erstellt in der Codeschmiede (Gruppe „Konzept“)`,
    projekt?.beschreibung ? `\n> ${projekt.beschreibung}` : ""];
  for (const [k, titel] of Object.entries(KAPITEL)) {
    const e = liste.filter((w) => w.kapitel === k);
    if (!e.length && (k === "sonstiges")) continue;
    teile.push("", `## ${titel}`, "");
    teile.push(...(e.length ? e.map((w) => `- ${String(w.text).replace(/\s*\n\s*/g, " ")} *(${wer(w.erstellt_von)}, ${datum(w.erstellt)})*`) : [k === "offen" ? "Keine offenen Fragen." : "Noch nicht besprochen."]));
  }
  return teile.filter((x) => x !== "").join("\n").replace(/\n## /g, "\n\n## ").replace(/(## [^\n]+)\n/g, "$1\n\n").replace(/^(# [^\n]+)\n/, "$1\n\n") + "\n";
}
const speichern = (name, text) => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export default function KonzeptArbeitsplatz({ g, d, ich, toast, onDesigner }) {
  const projekt = d.projekte.find((p) => p.id === d.projektId);
  const { liste } = useWissen(d.projektId);
  const [ansicht, setAnsicht] = useState("gespraech");
  const rolle = ich.rolle === "admin" ? "admin" : d.mitglieder.find((m) => m.projekt_id === d.projektId && m.benutzer_id === ich.id)?.rolle;
  const darf = rolle === "admin" || rolle === "entwickler";
  const kontext = [`Projekt: ${projekt?.name || ""}${projekt?.beschreibung ? ` – ${projekt.beschreibung}` : ""}`, "Seite: Konzept (Grundkonzept vor dem Bauen)",
    `Gruppen: ${d.gruppen.map((x) => x.name).join(", ").slice(0, 1500)}`, `Features: ${d.features.filter((f) => !f.ausgebaut).length}`].join("\n");
  const offen = Object.keys(KAPITEL).filter((k) => k !== "sonstiges" && k !== "offen" && !(liste || []).some((w) => w.kapitel === k)).length;
  return (
    <div className="grid gap-4 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_360px] items-start">
      <section className={`${card} min-w-0`}>
        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-slate-200 dark:border-slate-800">
          <Lightbulb className="w-5 h-5 text-emerald-700" /><h2 className="font-display font-bold text-2xl">{g.name}</h2>
          <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${offen ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>{liste === null ? "…" : offen ? "Im Gespräch" : "Grundkonzept steht"}</span>
          <div role="tablist" aria-label="Ansicht" className="ml-auto flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5">
            {[["gespraech", "Gespräch", MessageSquare], ["dokument", "Konzept-Dokument", FileText]].map(([id, t, I]) => (
              <button key={id} type="button" role="tab" aria-selected={ansicht === id} onClick={() => setAnsicht(id)}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-semibold ${ansicht === id ? "bg-white dark:bg-slate-900 shadow-sm text-emerald-800 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300"}`}><I className="w-4 h-4" />{t}</button>))}
          </div>
        </div>
        {ansicht === "gespraech" ? <ClaudeChat d={d} ich={ich} ort="konzept" kontext={kontext} toast={toast} />
          : <KonzeptDokument projekt={projekt} liste={liste} d={d} />}
      </section>
      <KonzeptStand liste={liste} d={d} ich={ich} darf={darf} toast={toast} onDesigner={onDesigner} />
    </div>);
}

function KonzeptDokument({ projekt, liste, d }) {
  if (liste === null) return <div className="p-4"><Loader2 className="w-5 h-5 animate-spin text-emerald-700" /></div>;
  const md = konzeptMarkdown(projekt, liste, d.benutzer);
  const datei = `Konzept-${(projekt?.name || "Projekt").normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}.md`;
  return (
    <div className="p-4 flex flex-col gap-3 min-w-0">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <span>Entsteht automatisch aus dem Konzept-Stand und ist immer aktuell.</span>
        <button type="button" onClick={() => speichern(datei, md)} className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"><Download className="w-4 h-4" />Herunterladen (.md)</button>
      </div>
      <article className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 max-w-[75ch]"><Markdown text={md} /></article>
    </div>);
}

function KonzeptStand({ liste, d, ich, darf, toast, onDesigner }) {
  const [neu, setNeu] = useState(null);   // { kapitel, text }
  const [busy, setBusy] = useState(false);
  const eintragen = async (e) => {
    e.preventDefault(); if (!neu?.text?.trim()) return; setBusy(true);
    const { error } = await supabase.rpc("ws_wissen_eintragen", { p_projekt: d.projektId, p_kapitel: neu.kapitel, p_text: neu.text.trim() });
    setBusy(false); if (error) toast(fehler(error)); else { toast("Ins Wissen eingetragen"); setNeu(null); }
  };
  const loeschen = async (w) => { const { error } = await supabase.rpc("ws_wissen_loeschen", { p_id: w.id }); if (error) toast(fehler(error)); else toast("Aus dem Wissen entfernt"); };
  if (liste === null) return <aside className={`${card} p-4`}><Loader2 className="w-5 h-5 animate-spin text-emerald-700" /></aside>;
  return (
    <aside className={`${card} p-4 flex flex-col gap-3 min-w-0 xl:sticky xl:top-4`} aria-label="Konzept-Stand">
      <h3 className="font-display font-bold text-lg flex items-center gap-2"><BookOpen className="w-5 h-5 text-emerald-700" />Konzept-Stand</h3>
      {Object.entries(KAPITEL).map(([k, titel]) => {
        const eintraege = liste.filter((w) => w.kapitel === k);
        if (k === "sonstiges" && !eintraege.length) return null;
        const fertig = eintraege.length > 0 && k !== "offen";
        return (
          <div key={k} className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              {fertig ? <CircleCheck className="w-4 h-4 text-emerald-700" /> : <Circle className="w-4 h-4 text-slate-400" />}{titel}
              <span className={`ml-auto text-[11px] font-semibold rounded-full px-2 py-0.5 ${k === "offen" ? (eintraege.length ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300") : fertig ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                {k === "offen" ? (eintraege.length || "keine") : fertig ? "im Wissen" : "offen"}</span>
            </div>
            {eintraege.map((w) => (
              <div key={w.id} className="group flex gap-1.5 text-[13px] text-slate-700 dark:text-slate-200">
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{w.text}</span>
                {darf && (w.erstellt_von === ich.id || ich.rolle === "admin") && <button type="button" onClick={() => loeschen(w)} title="Aus dem Wissen entfernen" className="opacity-60 hover:opacity-100 p-0.5 self-start"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>))}
            {k === "design" && <button type="button" onClick={onDesigner} className="self-start text-xs font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1"><Palette className="w-3.5 h-3.5" />Weiter im App-Designer</button>}
            {darf && neu?.kapitel !== k && <button type="button" onClick={() => setNeu({ kapitel: k, text: "" })} className="self-start text-xs text-slate-500 hover:text-emerald-700 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Selbst eintragen</button>}
            {neu?.kapitel === k && (
              <form onSubmit={eintragen} className="flex flex-col gap-1.5">
                <label htmlFor={`cs-wissen-${k}`} className="sr-only">Neuer Eintrag {titel}</label>
                <textarea id={`cs-wissen-${k}`} autoFocus rows={2} maxLength={2000} value={neu.text} onChange={(e) => setNeu({ ...neu, text: e.target.value })} className={`${input} resize-none`} placeholder="Entscheidung in 1–3 Sätzen" />
                <div className="flex gap-1.5 justify-end"><button type="button" onClick={() => setNeu(null)} className="text-xs px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700">Abbrechen</button>
                  <button disabled={busy || neu.text.trim().length < 3} className="text-xs px-2 py-1 rounded-lg bg-emerald-700 text-white font-semibold disabled:opacity-50">Eintragen</button></div>
              </form>)}
          </div>);
      })}
      <p className="text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800 pt-2.5">Was hier steht, steht in der Wissensdatenbank des Projekts. Jeder spätere Chat, der Design-Chat und jeder Bau-Auftrag kennen es. Gebaut wird erst über einen Auftrag mit Freigabe.</p>
    </aside>);
}

/** Abschnitt für die Wissensdatenbank: Konzept-Einträge nach Kapiteln. */
export function KonzeptWissen({ projektId }) {
  const { liste } = useWissen(projektId);
  if (!liste?.length) return null;
  return (
    <div className={`${card} overflow-hidden`}><h3 className="px-3 py-2 font-display font-bold bg-slate-50 dark:bg-slate-950 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-emerald-700" />Aus dem Konzept</h3>
      {Object.entries(KAPITEL).map(([k, t]) => {
        const e = liste.filter((w) => w.kapitel === k); if (!e.length) return null;
        return <div key={k} className="border-t border-slate-100 dark:border-slate-800 px-3 py-2 text-sm"><div className="font-semibold">{t}</div><ul className="list-disc pl-5 text-slate-700 dark:text-slate-200">{e.map((w) => <li key={w.id} className="whitespace-pre-wrap">{w.text}</li>)}</ul></div>;
      })}
    </div>);
}

/** Fehlt einem Projekt die Konzept-Gruppe (z. B. wiederhergestellt), richtet sie sich für Admin/Entwickler selbst ein (Prüfung N2). */
export function KonzeptAuto({ d, ich }) {
  const projekt = d.projekte.find((p) => p.id === d.projektId);
  const rolle = ich.rolle === "admin" ? "admin" : d.mitglieder.find((m) => m.projekt_id === d.projektId && m.benutzer_id === ich.id)?.rolle;
  const noetig = !!projekt && !projekt.konzept_gruppe_id && "konzept_gruppe_id" in projekt && (rolle === "admin" || rolle === "entwickler");
  useEffect(() => {
    if (!noetig) return;
    supabase.rpc("ws_konzept_einrichten", { p_projekt: projekt.id }).then(({ error }) => { if (!error) d.holen?.(); });
  }, [noetig, projekt?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
