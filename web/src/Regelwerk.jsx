import React, { useEffect, useMemo, useState } from "react";
import { Scale, Loader2, Send, Search, FileText, Info } from "lucide-react";
import { supabase } from "./supabase";
import { Markdown } from "./Markdown";

// Regelwerk (Entwurf „Regelwerk in der Codeschmiede“ 2026-10-22, „fertig machen“ Gerhard 2026-10-23 15:53):
// Alle Regeldateien des Projekts lesen, mit Claude darüber sprechen (Chat-Spalte rechts) und ändern – Änderungen laufen wie jeder
// Auftrag (Freigabe → Prüfungen → live). Übergeordnet gilt Gerhards Regelwerk ai-dev-os; Projektregeln ergänzen es, schwächen es nie ab.

const card = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const btn = "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-display font-bold tracking-wide transition";
const input = "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500";
const fehler = (e) => (e?.message || "Unbekannter Fehler").replace(/^.*?ERROR:\s*/, "");
const fmt = (d) => (d ? new Date(d).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–");

// Welche Dateien gehören zum Regelwerk (Reihenfolge = Wichtigkeit)
const REGELN = [
  [/^AGENTS\.md$/, "Hauptregeln des Projekts"], [/^CLAUDE\.md$/, "Verweis für Claude"], [/^docs\/KONZEPT\.md$/i, "Konzept & Entscheidungen"],
  [/^docs\/DATENSCHUTZ\.md$/i, "Datenschutz"], [/^docs\/(decisions|architecture\/decisions)\/.+\.md$/i, "Entscheidung (ADR)"],
  [/^docs\/(core|security|development)\/.+\.md$/i, "Regelwerk-Kapitel"], [/^docs\/(DESIGN|ARCHITEKTUR|WISSEN)\.md$/i, "Leitlinie"],
];
const art = (pfad) => REGELN.find(([r]) => r.test(pfad))?.[1];

export default function Regelwerk({ d, ich, toast }) {
  const [liste, setListe] = useState(null); const [pfad, setPfad] = useState(null); const [inhalt, setInhalt] = useState(null);
  const [q, setQ] = useState(""); const [wunsch, setWunsch] = useState(""); const [busy, setBusy] = useState(false);
  const projekt = d.projekte.find((p) => p.id === d.projektId);
  useEffect(() => {
    supabase.from("ws_dokumente").select("pfad, aktualisiert").eq("projekt_id", d.projektId).order("pfad").then(({ data }) => {
      const l = (data || []).filter((x) => art(x.pfad)).sort((a, b) => REGELN.findIndex(([r]) => r.test(a.pfad)) - REGELN.findIndex(([r]) => r.test(b.pfad)) || a.pfad.localeCompare(b.pfad));
      setListe(l); setPfad((p) => p || l[0]?.pfad || null);
    });
  }, [d.projektId]);
  useEffect(() => {
    if (!pfad) return; setInhalt(null);
    supabase.from("ws_dokumente").select("inhalt, aktualisiert").eq("projekt_id", d.projektId).eq("pfad", pfad).maybeSingle().then(({ data }) => setInhalt(data || { inhalt: "" }));
  }, [pfad, d.projektId]);
  const kapitel = useMemo(() => (inhalt?.inhalt || "").split("\n").filter((z) => /^#{1,3}\s/.test(z)).map((z) => z.replace(/^#+\s*/, "")).slice(0, 40), [inhalt]);
  // Regel-Änderungen gehören in die globale Gruppe (gilt für das ganze Projekt); sonst die erste Gruppe mit Auftragsrecht
  const rolle = ich.rolle === "admin" ? "admin" : d.mitglieder.find((m) => m.projekt_id === d.projektId && m.benutzer_id === ich.id)?.rolle;
  const darf = (bereich) => rolle === "admin" || d.rechte.some((r) => r.benutzer_id === ich.id && r.bereich_id === bereich && r.auftraege && ["entwickler", "texter"].includes(rolle));
  const globalB = d.bereiche.find((b) => b.global);
  const zielGruppe = d.gruppen.find((g) => g.bereich_id === globalB?.id && darf(g.bereich_id)) || d.gruppen.find((g) => darf(g.bereich_id));
  const senden = async () => {
    const t = wunsch.trim(); if (!t || !zielGruppe) return; setBusy(true);
    try {
      const titel = `Regelwerk ${pfad}: ${t}`.slice(0, 80);
      const { data, error } = await supabase.from("ws_auftraege").insert({ gruppe_id: zielGruppe.id, titel, art: rolle === "texter" ? "text" : "aendern", erstellt_von: ich.id }).select().single();
      if (error) throw error;
      const text = `Regelwerk ändern – Datei ${pfad}:\n${t}\n\nRegeln: Gerhards übergeordnetes Regelwerk (ai-dev-os) darf nur ergänzt, nie abgeschwächt werden. Trage die Änderung zusätzlich unter „Neue Anweisungen“ in AGENTS.md und in docs/CHANGELOG.md ein.`;
      const r = await supabase.from("ws_nachrichten").insert({ auftrag_id: data.id, von: ich.id, art: "text", text, kanal: "codeschmiede" });
      if (r.error) throw r.error;
      toast(`Auftrag #${data.id} angelegt – Regeländerung läuft über Freigabe und Prüfungen`); setWunsch("");
    } catch (e) { toast(fehler(e)); } finally { setBusy(false); }
  };
  const gefiltert = (liste || []).filter((x) => !q || x.pfad.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="flex flex-col gap-3" aria-label="Regelwerk">
      <div><h2 className="font-display font-bold text-xl leading-tight flex items-center gap-2"><Scale className="w-5 h-5 text-emerald-700" />Regelwerk</h2>
        <p className="text-sm text-slate-500">Alle Regeldateien von {projekt?.name || "diesem Projekt"} lesen, rechts mit Claude darüber sprechen und ändern. Änderungen laufen wie jeder Auftrag: Freigabe → Prüfungen → live.</p></div>
      <p className="text-xs text-slate-500 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />Übergeordnet gilt Gerhards Regelwerk <b>ai-dev-os</b> – Projektregeln dürfen es ergänzen, nie abschwächen.</p>
      <div className="grid gap-3 grid-cols-[minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className={`${card} p-2 flex flex-col gap-1 max-h-[70vh] overflow-auto`}>
          <label className="relative mb-1"><Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" /><input className={`${input} pl-8`} placeholder="Regeldatei suchen" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          {!liste ? <Loader2 className="w-5 h-5 animate-spin text-emerald-700 m-3" /> : !gefiltert.length ? <p className="text-sm text-slate-500 p-2">Keine Regeldateien – der Abgleich läuft über die Werkstatt (alle 10 Minuten).</p>
            : gefiltert.map((x) => (
              <button key={x.pfad} type="button" aria-current={pfad === x.pfad} onClick={() => setPfad(x.pfad)} className={`text-left px-2.5 py-1.5 rounded-lg ${pfad === x.pfad ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                <div className="text-sm font-semibold break-all flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 shrink-0" />{x.pfad}</div>
                <div className="text-[11px] text-slate-500">{art(x.pfad)} · {fmt(x.aktualisiert)}</div></button>))}
        </div>
        <div className="flex flex-col gap-3 min-w-0">
          {kapitel.length > 2 && <div className={`${card} p-3`}><div className="text-xs font-semibold text-slate-500 mb-1">Inhalt</div><div className="flex flex-wrap gap-1.5">{kapitel.map((k, i) => <span key={i} className="text-xs rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5">{k}</span>)}</div></div>}
          <div className={`${card} p-4 sm:p-6 min-w-0`}>{!pfad ? <p className="text-sm text-slate-500">Links eine Datei wählen.</p> : !inhalt ? <Loader2 className="w-5 h-5 animate-spin text-emerald-700" /> : <Markdown text={inhalt.inhalt} />}</div>
          {pfad && <div className={`${card} p-4 flex flex-col gap-2`}>
            <label htmlFor="cs-regel" className="text-sm font-semibold">Regel ändern oder ergänzen ({pfad})</label>
            <textarea id="cs-regel" className={`${input} min-h-[72px]`} value={wunsch} onChange={(e) => setWunsch(e.target.value)} placeholder="z. B. „Jede neue Seite braucht einen Handbuch-Eintrag“" />
            <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-slate-500 flex-1">{zielGruppe ? `Wird Auftrag in „${zielGruppe.name}“ – die Werkstatt ändert die Datei auf einem eigenen Zweig.` : "Du hast in diesem Projekt kein Auftragsrecht."}</span>
              <button type="button" className={btn} disabled={busy || !wunsch.trim() || !zielGruppe} onClick={senden}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Als Auftrag senden</button></div>
          </div>}
        </div>
      </div>
    </section>);
}
