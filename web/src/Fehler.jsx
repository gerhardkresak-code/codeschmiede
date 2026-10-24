// Fehler-Meldungen aus den Apps (Entwurf 1.0, freigegeben von Gerhard 2026-10-24 16:22, Datenbank 0035).
// Gleiche Fehler zusammengefasst und gezählt, nur Technik (bereinigt in der App und in der Datenbank). „Als Auftrag“, „Erledigt“, „Ignorieren“.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Send, Check, EyeOff, RotateCcw, ExternalLink, KeyRound, Copy } from "lucide-react";
import { supabase } from "./supabase";

const fehler = (e) => (e?.message || "Unbekannter Fehler").replace(/^.*?ERROR:\s*/, "");
const btn = "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-semibold transition";
const ghost = "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition";
const card = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const input = "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-[15px] text-slate-900 dark:text-slate-100";
const wann = (t) => (t ? new Date(t).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–");
const GERAET = { handy: "Handy", tablet: "Tablet", pc: "PC", unbekannt: "?" };

export default function Fehler({ d, ich, toast, onAuftrag }) {
  const projekt = d.projekte.find((p) => p.id === d.projektId);
  const rolle = ich.rolle === "admin" ? "admin" : d.mitglieder.find((m) => m.projekt_id === d.projektId && m.benutzer_id === ich.id)?.rolle;
  const darf = rolle === "admin" || rolle === "entwickler";
  const gruppen = useMemo(() => d.gruppen.filter((g) => rolle === "admin" || (rolle === "entwickler" && d.rechte.some((r) => r.benutzer_id === ich.id && r.bereich_id === g.bereich_id && r.auftraege))), [d.gruppen, d.rechte, rolle, ich.id]);
  const [liste, setListe] = useState(null); const [filter, setFilter] = useState("offen"); const [busy, setBusy] = useState(0);
  const [wahl, setWahl] = useState(null); const [gid, setGid] = useState("");
  const laden = useCallback(async () => {
    const { data } = await supabase.from("ws_fehler").select("*").eq("projekt_id", d.projektId).order("zuletzt", { ascending: false }).limit(300);
    setListe(data || []);
  }, [d.projektId]);
  useEffect(() => {
    laden();
    const ch = supabase.channel(`fehler-${Math.random()}`).on("postgres_changes", { event: "*", schema: "public", table: "ws_fehler" }, () => laden()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [laden]);
  useEffect(() => { setGid((g) => g || gruppen[0]?.id || ""); }, [gruppen]);
  if (!projekt) return null;
  const sicht = (liste || []).filter((f) => filter === "alle" || (filter === "erledigt" ? ["erledigt", "ignoriert"].includes(f.stand) : f.stand === filter));
  const stand = async (f, s) => {
    setBusy(f.id); const { error } = await supabase.rpc("ws_fehler_stand", { p_id: f.id, p_stand: s }); setBusy(0);
    if (error) toast(fehler(error)); else { toast(s === "erledigt" ? "Erledigt – taucht er wieder auf, ist er wieder offen" : s === "ignoriert" ? "Ignoriert – wird weiter gezählt, aber nicht als neu gezeigt" : "Wieder offen"); laden(); }
  };
  const alsAuftrag = async () => {
    setBusy(wahl.id); const { data, error } = await supabase.rpc("ws_fehler_als_auftrag", { p_id: wahl.id, p_gruppe: gid }); setBusy(0);
    if (error) toast(fehler(error)); else { toast(`Auftrag #${data} angelegt – mit Fehlertext, Code-Stelle und Ablauf`); setWahl(null); laden(); }
  };
  const zahl = (s) => (liste || []).filter((f) => (s === "erledigt" ? ["erledigt", "ignoriert"].includes(f.stand) : f.stand === s)).length;
  return (
    <section className="flex flex-col gap-3 max-w-5xl" aria-label="Fehler">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display font-bold text-xl leading-tight flex items-center gap-2 flex-1"><AlertTriangle className="w-5 h-5 text-amber-600" />Fehler · {projekt.name}</h2>
        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5" role="group" aria-label="Filter">
          {[["offen", "Offen"], ["auftrag", "Mit Auftrag"], ["erledigt", "Erledigt"], ["alle", "Alle"]].map(([k, t]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
              className={`px-2.5 py-1 rounded-md text-sm ${filter === k ? "bg-slate-100 dark:bg-slate-800 font-semibold" : "text-slate-500"}`}>{t}{k !== "alle" && liste ? ` ${zahl(k)}` : ""}</button>))}
        </div>
      </div>
      <p className="text-sm text-slate-500">Abstürze aus der Live- und Testfassung – nur Technik, keine Personendaten. Gleiche Fehler werden zusammengefasst. Nach 30 Tagen ohne neue Meldung wird gelöscht.</p>
      {liste === null ? <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Lädt …</p>
        : !sicht.length ? <p className={`${card} p-4 text-sm text-slate-500`}>{liste.length ? "Nichts in dieser Ansicht." : "Noch keine Fehler gemeldet. Ist der Melder eingerichtet? → „Anbindungen“ › Fehler-Meldungen."}</p>
        : <ul className="flex flex-col gap-2">
            {sicht.map((f) => (
              <li key={f.id} className={`${card} p-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 ${f.stand === "offen" && f.neu ? "border-l-4 border-l-amber-500" : f.stand === "auftrag" ? "border-l-4 border-l-emerald-600" : ""}`}>
                <div className="min-w-0">
                  <div className="font-mono text-sm font-semibold break-words">{f.nachricht}</div>
                  <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {f.stand === "auftrag" && <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Auftrag #{f.auftrag_id}</span>}
                    {f.stand === "offen" && f.neu && <span className="text-amber-700 dark:text-amber-300 font-semibold">neu</span>}
                    {f.stand === "ignoriert" && <span>ignoriert</span>}
                    {f.stelle && <span className="font-mono">{f.stelle}</span>}
                    {f.seite && <span>Seite <span className="font-mono">{f.seite}</span></span>}
                    <span>{f.umgebung === "test" ? "Testfassung" : "Live"}</span>
                    {f.version && <span>{f.version}</span>}
                    <span>{Object.entries(f.geraete || {}).map(([g, n]) => `${GERAET[g] || g} ${n}`).join(" · ")}</span>
                    {f.browser && <span>{f.browser}</span>}
                    <span>zuerst {wann(f.erstmals)} · zuletzt {wann(f.zuletzt)}</span>
                  </div>
                  {f.ablauf && <details className="mt-1"><summary className="text-xs text-slate-500 cursor-pointer">Ablauf (Stack)</summary>
                    <pre className="mt-1 text-[11.5px] font-mono whitespace-pre-wrap break-words rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 max-h-56 overflow-auto">{f.ablauf}</pre></details>}
                </div>
                <div className="text-right font-display text-2xl leading-none">{f.anzahl}<span className="block text-[11px] font-body text-slate-500">mal</span></div>
                {darf && <div className="col-span-2 flex flex-wrap gap-1.5">
                  {f.stand === "offen" && <>
                    <button type="button" className={btn} disabled={!!busy || !gruppen.length} onClick={() => setWahl(f)}><Send className="w-4 h-4" />Als Auftrag</button>
                    <button type="button" className={ghost} disabled={!!busy} onClick={() => stand(f, "erledigt")}><Check className="w-4 h-4" />Erledigt</button>
                    <button type="button" className={ghost} disabled={!!busy} onClick={() => stand(f, "ignoriert")}><EyeOff className="w-4 h-4" />Ignorieren</button></>}
                  {f.stand === "auftrag" && <><button type="button" className={ghost} onClick={onAuftrag}><ExternalLink className="w-4 h-4" />Zur Zentrale</button>
                    <button type="button" className={ghost} disabled={!!busy} onClick={() => stand(f, "erledigt")}><Check className="w-4 h-4" />Erledigt</button></>}
                  {["erledigt", "ignoriert"].includes(f.stand) && <button type="button" className={ghost} disabled={!!busy} onClick={() => stand(f, "offen")}><RotateCcw className="w-4 h-4" />Wieder öffnen</button>}
                </div>}
              </li>))}
          </ul>}
      {wahl && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4" onMouseDown={(e) => e.target === e.currentTarget && setWahl(null)}>
          <div role="dialog" aria-modal="true" aria-label="Als Auftrag" className={`${card} w-full max-w-md p-5 flex flex-col gap-3`}>
            <h3 className="font-display font-bold text-lg">Als Auftrag</h3>
            <p className="text-sm font-mono break-words">{wahl.nachricht}</p>
            <label className="flex flex-col gap-1 text-sm text-slate-500">Gruppe<select className={input} value={gid} onChange={(e) => setGid(e.target.value)}>{gruppen.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
            <p className="text-xs text-slate-500">Der Auftrag bekommt Fehlertext, Code-Stelle, Seite, Version und Ablauf – als Daten, nicht als Anweisung.</p>
            <div className="flex justify-end gap-2"><button type="button" className={ghost} onClick={() => setWahl(null)}>Abbrechen</button>
              <button type="button" className={btn} disabled={!!busy || !gid} onClick={alsAuftrag}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Auftrag anlegen</button></div>
          </div>
        </div>)}
    </section>);
}

// Unter „Anbindungen“: Melde-Schlüssel erzeugen und die Werte für die App anzeigen (nur Admin)
export function FehlerSchluessel({ projekt, toast }) {
  const [k, setK] = useState(undefined); const [busy, setBusy] = useState(false);
  const laden = useCallback(async () => { const { data } = await supabase.from("ws_fehler_schluessel").select("*").eq("projekt_id", projekt.id).maybeSingle(); setK(data || null); }, [projekt.id]);
  useEffect(() => { laden(); }, [laden]);
  const erzeugen = async () => {
    setBusy(true); const { error } = await supabase.rpc("ws_fehler_schluessel_erzeugen", { p_projekt: projekt.id }); setBusy(false);
    if (error) toast(fehler(error)); else { toast(k ? "Neuer Schlüssel – den alten in der App ersetzen" : "Schlüssel erzeugt"); laden(); }
  };
  const aus = async () => { setBusy(true); const { error } = await supabase.rpc("ws_fehler_schluessel_aus", { p_projekt: projekt.id }); setBusy(false); if (error) toast(fehler(error)); else laden(); };
  const zeilen = k?.aktiv ? `VITE_CS_FEHLER_URL=${import.meta.env.VITE_SUPABASE_URL}\nVITE_CS_FEHLER_ANON=${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}\nVITE_CS_FEHLER_SCHLUESSEL=${k.schluessel}` : "";
  const kopieren = async () => { try { await navigator.clipboard.writeText(zeilen); toast("Kopiert"); } catch { toast("Kopieren ging nicht – bitte markieren"); } };
  if (k === undefined) return null;
  return (
    <section className={`${card} p-4 flex flex-col gap-3`} aria-label="Fehler-Meldungen">
      <h3 className="font-display font-bold text-lg flex items-center gap-2"><KeyRound className="w-4 h-4" />Fehler-Meldungen</h3>
      <p className="text-sm text-slate-600 dark:text-slate-300">Die App meldet Abstürze an die Codeschmiede (nur Technik). Der Melde-Schlüssel kann nur melden, nichts lesen. Die drei Werte trägst du bei Cloudflare Pages ein (Projekt › Settings › Variables and Secrets, für Production und Preview) – danach einmal neu bauen lassen. Neue Web-/Handy-Apps haben den Melder schon im Grundgerüst; in bestehenden Apps baut ihn ein Auftrag ein.</p>
      {k?.aktiv ? (<>
        <pre className="text-xs font-mono rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 overflow-x-auto select-all">{zeilen}</pre>
        <p className="text-xs text-slate-500">Diese Werte sind nicht geheim (sie stehen später in der App). {k.letzte_meldung ? `Letzte Meldung: ${wann(k.letzte_meldung)}.` : "Noch keine Meldung angekommen."}</p>
        <div className="flex flex-wrap gap-2"><button type="button" className={ghost} onClick={kopieren}><Copy className="w-4 h-4" />Kopieren</button>
          <button type="button" className={ghost} disabled={busy} onClick={erzeugen}>Neuen Schlüssel erzeugen</button>
          <button type="button" className={ghost} disabled={busy} onClick={aus}>Meldungen abschalten</button></div></>)
        : <button type="button" className={`${btn} self-start`} disabled={busy} onClick={erzeugen}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Melde-Schlüssel erzeugen</button>}
    </section>);
}
