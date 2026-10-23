import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Send, Loader2, ClipboardList, Check, X, ChevronDown, ChevronUp, PanelRightClose, PanelRightOpen } from "lucide-react";
import { supabase } from "./supabase";

// Chat mit Claude überall (Neue Anweisung Gerhard 2026-10-23 10:45, Entscheidungen 10:50): fest eingeblendete Spalte auf jeder Seite.
// Persönliches Gespräch; Claude antwortet über die eigene Werkstatt (Abo) und liest das Projekt nur (nichts ändern, nichts ausführen).
// Soll gebaut werden, schlägt Claude einen Auftrag vor – angelegt wird er erst per Klick, mit deinen normalen Rechten.
const btn = "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-semibold";
const ghost = "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800";
const fehler = (e) => (e?.message || "Unbekannter Fehler").replace(/^.*?ERROR:\s*/, "");
const zeit = (d) => new Date(d).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const ORT_NAME = (o) => o.startsWith("feature:") ? `Feature ${o.slice(8)}` : o.startsWith("gruppe:") ? `Gruppe ${o.slice(7)}` : { zentrale: "Auftrags-Zentrale", global: "Globale Einstellungen", designer: "App-Designer", vorschau: "Live-Vorschau", benutzer: "Benutzer & Rechte", verbrauch: "Verbrauch & Limits" }[o] || o;

export default function ClaudeSpalte({ d, ich, ort, kontext, toast }) {
  const [liste, setListe] = useState([]);
  const [text, setText] = useState("");
  const [senden, setSenden] = useState(false);
  const [zu, setZu] = useState(() => { try { return localStorage.getItem("cs-claude-zu") === "1"; } catch { return false; } });
  const ende = useRef(null);
  const holen = useCallback(async () => {
    if (!d.projektId) return;
    const { data } = await supabase.from("ws_claude_chat").select("*").eq("projekt_id", d.projektId).order("id", { ascending: false }).limit(150);
    setListe((data || []).reverse());
  }, [d.projektId]);
  useEffect(() => {
    holen();
    const ch = supabase.channel(`cs-claude-${d.projektId}`).on("postgres_changes", { event: "*", schema: "public", table: "ws_claude_chat" }, holen).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [holen, d.projektId]);
  // Chats starten immer beim letzten Eintrag
  useEffect(() => { requestAnimationFrame(() => ende.current?.scrollIntoView({ block: "end" })); }, [liste.length, zu]);
  const umschalten = () => { const n = !zu; setZu(n); try { localStorage.setItem("cs-claude-zu", n ? "1" : "0"); } catch { /* egal */ } };

  const werkstattAn = d.pcs.some((p) => p.benutzer_id === ich.id && p.an);
  const wartet = liste.some((m) => !m.frage_id && ["offen", "laeuft"].includes(m.stand));
  const fragen = Object.fromEntries(liste.filter((m) => !m.frage_id).map((m) => [m.id, m]));
  const schicke = async () => {
    const t = text.trim(); if (!t) return; setSenden(true);
    const { error } = await supabase.from("ws_claude_chat").insert({ projekt_id: d.projektId, ort: String(ort || "zentrale").toLowerCase().replace(/[^a-z0-9:_.-]/g, "-").slice(0, 80), text: t.slice(0, 8000), kontext: String(kontext || "").slice(0, 6000) });
    setSenden(false);
    if (error) return toast(fehler(error));
    setText("");
  };

  if (zu) return (
    <aside className="hidden xl:flex flex-col items-center gap-2 w-12 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 sticky top-0 h-screen" aria-label="Chat mit Claude (eingeklappt)">
      <button type="button" onClick={umschalten} title="Chat mit Claude öffnen" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><PanelRightOpen className="w-5 h-5" /></button>
      <Bot className="w-5 h-5 text-emerald-700" />{wartet && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
    </aside>);
  return (
    <aside className="flex flex-col min-w-0 md:col-start-2 xl:col-start-auto xl:w-[360px] border-t xl:border-t-0 xl:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 xl:sticky xl:top-0 xl:h-screen min-h-[420px]" aria-label="Chat mit Claude">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200 dark:border-slate-800">
        <Bot className="w-5 h-5 text-emerald-700" /><b className="font-display text-[17px]">Claude</b>
        <span className="text-xs text-slate-500 truncate">· {ORT_NAME(ort || "zentrale")}</span>
        <button type="button" onClick={umschalten} title="Einklappen" className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 hidden xl:block"><PanelRightClose className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-sm" aria-live="polite">
        {!liste.length && <p className="text-slate-500">Frag mich hier jederzeit – zu der Seite, auf der du gerade bist, zum Projekt oder zu Ideen. Ich lese im Projekt nach, ändere aber nichts. Soll etwas gebaut werden, schlage ich einen Auftrag vor.</p>}
        {liste.map((m) => m.frage_id ? (
          <div key={m.id} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-2.5 max-w-[96%]">
            <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><Bot className="w-3.5 h-3.5" />Claude · {zeit(m.erstellt)}</div>
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.vorschlag && <Vorschlag m={m} d={d} ich={ich} kann={fragen[m.frage_id]?.von === ich.id} toast={toast} />}
          </div>
        ) : (
          <div key={m.id} className="ml-auto rounded-xl bg-emerald-50 dark:bg-emerald-950/50 p-2.5 max-w-[90%]">
            <div className="text-[11px] font-bold text-slate-500">Du · {ORT_NAME(m.ort)} · {zeit(m.erstellt)}</div>
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.stand === "fehler" && <p className="text-xs text-red-600 mt-1">Nicht beantwortet</p>}
          </div>))}
        {wartet && <div className="flex items-center gap-2 text-slate-500">{werkstattAn ? <><Loader2 className="w-4 h-4 animate-spin" />Claude liest nach und antwortet … (über deine Werkstatt)</> : <span className="text-amber-700 dark:text-amber-400">Deine Werkstatt ist aus – sie startet mit dem Programm; dann antwortet Claude.</span>}</div>}
        <div ref={ende} />
      </div>
      <form className="border-t border-slate-200 dark:border-slate-800 p-2.5 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); schicke(); }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={8000} placeholder="Schreib Claude …"
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); schicke(); } }} />
        <button className={`${btn} self-end`} disabled={senden || !text.trim()} title="Senden">{senden ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button>
      </form>
    </aside>);
}

function Vorschlag({ m, d, ich, kann, toast }) {
  // Auftragstext immer sichtbar, bevor er angelegt wird (Prüfung 2026-10-23)
  const v = m.vorschlag; const [offen, setOffen] = useState(!v.konzept); const [busy, setBusy] = useState(false);
  const g = d.gruppen.find((x) => x.id === v.gruppe_id); const f = v.feature_id ? d.features.find((x) => x.id === v.feature_id) : null;
  // Konzept-Karte (Entwurf 1.2): offene Punkte sperren die Freigabe; das Konzept geht als erste Nachricht an den Bau
  const k = v.konzept || null; const nochOffen = (k?.offen || []).length;
  const slug = (f?.name || v.titel).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "konzept";
  const auftragsText = !k ? v.text : [
    v.text, "", `## Freigegebenes Konzept (${new Date().toLocaleDateString("de-AT")})`,
    k.ziel && `**Ziel:** ${k.ziel}`, k.umfang && `**Umfang:** ${k.umfang}`, k.datenschutz && `**Datenschutz:** ${k.datenschutz}`,
    k.entscheidungen?.length && `**Entscheidungen:**\n${k.entscheidungen.map((x) => `- ${x}`).join("\n")}`,
    k.abnahme?.length && `**Abnahme:**\n${k.abnahme.map((x) => `- ${x}`).join("\n")}`, "",
    `Lege dieses Konzept zusätzlich als docs/konzepte/${new Date().toISOString().slice(0, 10)}-${slug}.md im Projekt ab (mit dem Bau-PR).`,
  ].filter((x) => x !== false && x != null && x !== 0).join("\n").slice(0, 8000);
  const anlegen = async () => {
    setBusy(true);
    try {
      const texter = d.mitglieder.some((x) => x.projekt_id === d.projektId && x.benutzer_id === ich.id && x.rolle === "texter");
      const { data, error } = await supabase.from("ws_auftraege").insert({ gruppe_id: v.gruppe_id, feature_id: v.feature_id || null, titel: v.titel.slice(0, 80), art: texter ? "text" : "aendern", erstellt_von: ich.id }).select().single();
      if (error) throw error;
      const r = await supabase.from("ws_nachrichten").insert({ auftrag_id: data.id, von: ich.id, art: "text", text: auftragsText, kanal: "codeschmiede" });
      if (r.error) throw r.error;
      await supabase.rpc("ws_claude_chat_entscheiden", { p_antwort: m.id, p_entscheidung: "uebernommen", p_auftrag: data.id });
      toast(`Auftrag #${data.id} angelegt – ${g?.name || v.gruppe_id}`);
    } catch (e) { toast(fehler(e)); } finally { setBusy(false); }
  };
  const ablehnen = async () => { const { error } = await supabase.rpc("ws_claude_chat_entscheiden", { p_antwort: m.id, p_entscheidung: "abgelehnt" }); if (error) toast(fehler(error)); };
  return (
    <div className="mt-2 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 p-2">
      <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" />{k ? "Konzept-Karte" : "Vorschlag: Auftrag"}
        {k && <span className={`ml-auto rounded-full px-2 py-0.5 font-semibold ${nochOffen ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>{nochOffen ? `${nochOffen} offen` : "keine offenen Punkte"}</span>}</div>
      <p className="font-semibold mt-0.5">{v.titel}</p>
      <p className="text-xs text-slate-500">{g?.name || v.gruppe_id}{f ? ` › ${f.name}` : ""}</p>
      {k && <dl className="mt-1.5 grid grid-cols-[84px_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
        {[["Ziel", k.ziel], ["Umfang", k.umfang], ["Datenschutz", k.datenschutz]].filter(([, x]) => x).map(([t, x]) => <React.Fragment key={t}><dt className="text-slate-500 font-semibold">{t}</dt><dd className="whitespace-pre-wrap">{x}</dd></React.Fragment>)}
        {[["Entschieden", k.entscheidungen], ["Abnahme", k.abnahme], ["Offen", k.offen]].filter(([, x]) => x?.length).map(([t, x]) => <React.Fragment key={t}><dt className={`font-semibold ${t === "Offen" ? "text-amber-700 dark:text-amber-300" : "text-slate-500"}`}>{t}</dt><dd><ul className="list-disc pl-4">{x.map((y, i) => <li key={i}>{y}</li>)}</ul></dd></React.Fragment>)}
      </dl>}
      <button type="button" onClick={() => setOffen(!offen)} className="text-xs text-slate-500 inline-flex items-center gap-1 mt-1">{offen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}Auftragstext {offen ? "ausblenden" : "anzeigen"}</button>
      {offen && <p className="whitespace-pre-wrap text-xs mt-1 bg-slate-50 dark:bg-slate-950 rounded p-2 max-h-48 overflow-auto">{auftragsText}</p>}
      {m.entscheidung ? <p className="text-xs mt-1.5 font-semibold text-slate-500">{m.entscheidung === "uebernommen" ? `Angelegt${m.auftrag_id ? ` als Auftrag #${m.auftrag_id}` : ""}` : "Abgelehnt"}</p>
        : kann && <div className="flex flex-wrap gap-1.5 mt-2"><button type="button" className={btn} disabled={busy || nochOffen > 0} title={nochOffen ? "Erst die offenen Punkte im Chat klären" : undefined} onClick={anlegen}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{k ? "Konzept freigeben & bauen" : "Als Auftrag anlegen"}</button><button type="button" className={ghost} onClick={ablehnen}><X className="w-4 h-4" />{k ? "Verwerfen" : "Nein"}</button></div>}
    </div>);
}
