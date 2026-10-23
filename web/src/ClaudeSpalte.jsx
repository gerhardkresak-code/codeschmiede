import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Send, Loader2, ClipboardList, Check, X, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { supabase } from "./supabase";
import { Markdown } from "./Markdown";
import { MitErwaehnung } from "./Bezuege";

// Chat mit Claude – seit 2026-10-23 18:06 (Entwurf „Konzept zuerst“) im Konzept-Arbeitsplatz statt als Spalte auf jeder Seite.
// Persönliches Gespräch; Claude antwortet über die eigene Werkstatt (Abo) und liest das Projekt nur (nichts ändern, nichts ausführen).
// Soll gebaut werden, schlägt Claude einen Auftrag vor – angelegt wird er erst per Klick, mit deinen normalen Rechten.
const btn = "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-semibold";
const ghost = "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800";
const fehler = (e) => (e?.message || "Unbekannter Fehler").replace(/^.*?ERROR:\s*/, "");
const zeit = (d) => new Date(d).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
// Kapitel des Konzepts (gleich wie in der Werkstatt, lib/assistent.mjs, und in der Datenbank, 0020)
export const KAPITEL = { ziel: "Ziel & Zielgruppe", funktionen: "Kernfunktionen", daten: "Daten & Datenschutz", design: "Design-Vorgaben", ablauf: "Abläufe & Rollen", offen: "Offene Fragen", sonstiges: "Sonstiges" };
const ORT_NAME = (o) => o.startsWith("feature:") ? `Feature ${o.slice(8)}` : o.startsWith("gruppe:") ? `Gruppe ${o.slice(7)}` : { zentrale: "Auftrags-Zentrale", global: "Globale Einstellungen", designer: "App-Designer", vorschau: "Live-Vorschau", benutzer: "Benutzer & Rechte", verbrauch: "Verbrauch & Limits" }[o] || o;

export default function ClaudeChat({ d, ich, ort = "konzept", kontext, toast, leer }) {
  const [liste, setListe] = useState([]);
  const [text, setText] = useState("");
  const [senden, setSenden] = useState(false);
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
  useEffect(() => { requestAnimationFrame(() => ende.current?.scrollIntoView({ block: "nearest" })); }, [liste.length]);

  const werkstattAn = d.pcs.some((p) => p.benutzer_id === ich.id && p.an);
  const wartet = liste.some((m) => !m.frage_id && ["offen", "laeuft"].includes(m.stand));
  const fragen = Object.fromEntries(liste.filter((m) => !m.frage_id).map((m) => [m.id, m]));
  const schicke = async (vorgabe) => {
    const t = String(vorgabe ?? text).trim(); if (!t) return; setSenden(true);
    const { error } = await supabase.from("ws_claude_chat").insert({ projekt_id: d.projektId, ort: String(ort || "konzept").toLowerCase().replace(/[^a-z0-9:_.-]/g, "-").slice(0, 80), text: t.slice(0, 8000), kontext: String(kontext || "").slice(0, 6000) });
    setSenden(false);
    if (error) return toast(fehler(error));
    if (vorgabe == null) setText("");
  };
  const IDEEN = liste.length ? ["Was fehlt noch im Konzept?", "Fasse das Konzept zusammen", "Welche Daten speichern wir?", "Datenschutz prüfen"]
    : ["Lass uns das Grundkonzept besprechen", "Stell mir die wichtigsten Fragen", "Was brauchen wir für die erste Version?"];
  return (
    <div className="flex flex-col min-w-0 min-h-[520px] max-h-[calc(100vh-180px)]" aria-label="Chat mit Claude">
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-sm" aria-live="polite">
        {!liste.length && (leer || <p className="text-slate-500">Hier besprecht ihr das Grundkonzept, bevor gebaut wird. Claude liest im Projekt nach, ändert aber nichts. Geklärte Entscheidungen bietet Claude zum Übernehmen ins Wissen an.</p>)}
        {liste.map((m) => m.frage_id ? (
          <div key={m.id} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-2.5 max-w-[92%]">
            <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><Bot className="w-3.5 h-3.5" />Claude · {zeit(m.erstellt)}</div>
            <Markdown text={m.text} klein />
            {m.vorschlag && <Vorschlag m={m} d={d} ich={ich} kann={fragen[m.frage_id]?.von === ich.id} toast={toast} />}
          </div>
        ) : (
          <div key={m.id} className="ml-auto rounded-xl bg-emerald-50 dark:bg-emerald-950/50 p-2.5 max-w-[86%]">
            <div className="text-[11px] font-bold text-slate-500">Du{m.ort !== "konzept" ? ` · ${ORT_NAME(m.ort)}` : ""} · {zeit(m.erstellt)}</div>
            <Markdown text={m.text} klein />
            {m.stand === "fehler" && <p className="text-xs text-red-600 mt-1">Nicht beantwortet</p>}
          </div>))}
        {wartet && <div className="flex items-center gap-2 text-slate-500">{werkstattAn ? <><Loader2 className="w-4 h-4 animate-spin" />Claude liest nach und antwortet … (über deine Werkstatt)</> : <span className="text-amber-700 dark:text-amber-400">Deine Werkstatt ist aus – sie startet mit dem Programm; dann antwortet Claude.</span>}</div>}
        <div ref={ende} />
      </div>
      <form className="border-t border-slate-200 dark:border-slate-800 p-2.5 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); schicke(); }}>
        <div className="flex flex-wrap gap-1">{IDEEN.map((i) => <button key={i} type="button" disabled={senden} onClick={() => schicke(i)} className="text-xs rounded-full border border-slate-300 dark:border-slate-700 px-2 py-0.5 hover:bg-slate-50 dark:hover:bg-slate-800">{i}</button>)}</div>
        <div className="flex gap-1.5">
          <div className="flex-1 min-w-0"><MitErwaehnung value={text} onChange={setText} features={d.features.filter((x) => !x.ausgebaut)} rows={2} maxLength={8000} placeholder="Idee, Frage oder Entscheidung zum Konzept … (@ für ein Feature)"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); schicke(); } }} /></div>
          <button className={`${btn} self-end`} disabled={senden || !text.trim()} title="Senden">{senden ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button>
        </div>
      </form>
    </div>);
}

// Konzept-Entscheidung ins Wissen übernehmen (Datenbank 0020): Text kommt aus dem gespeicherten Vorschlag
function WissenVorschlag({ m, kann, toast }) {
  const v = m.vorschlag.wissen; const [busy, setBusy] = useState(false);
  const ja = async () => { setBusy(true); const { error } = await supabase.rpc("ws_wissen_uebernehmen", { p_antwort: m.id }); setBusy(false); if (error) toast(fehler(error)); else toast("Ins Wissen übernommen"); };
  const nein = async () => { const { error } = await supabase.rpc("ws_claude_chat_entscheiden", { p_antwort: m.id, p_entscheidung: "abgelehnt" }); if (error) toast(fehler(error)); };
  return (
    <div className="mt-2 rounded-lg border border-dashed border-emerald-500 bg-white dark:bg-slate-900 p-2">
      <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />Ins Wissen übernehmen? · {KAPITEL[v.kapitel] || v.kapitel}</div>
      <p className="mt-0.5 whitespace-pre-wrap">{v.text}</p>
      {m.entscheidung ? <p className="text-xs mt-1.5 font-semibold text-slate-500">{m.entscheidung === "uebernommen" ? "Im Wissen" : "Nicht übernommen"}</p>
        : kann && <div className="flex gap-1.5 mt-2"><button type="button" className={btn} disabled={busy} onClick={ja}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Ja, übernehmen</button><button type="button" className={ghost} onClick={nein}><X className="w-4 h-4" />Nein</button></div>}
    </div>);
}

// Feature anlegen / Bezug setzen aus dem Gespräch (nur nach „Ja“, mit eigenen Rechten – KONZEPT-FEATURE-BEZUEGE.md)
function FeatureVorschlag({ m, d, ich, kann, toast }) {
  const v = m.vorschlag; const [busy, setBusy] = useState(false);
  const fname = (id) => d.features.find((x) => x.id === id)?.name || id;
  const ja = async () => {
    setBusy(true);
    try {
      if (v.feature_neu) {
        const id = `N-G${m.id}`;   // feste Kennung je Vorschlag: ein zweiter Klick legt nichts doppelt an (Prüfung 0.8.0)
        const { data, error } = await supabase.from("ws_features").upsert({ id, gruppe_id: v.feature_neu.gruppe_id, name: v.feature_neu.name, beschreibung: v.feature_neu.beschreibung || null,
          stand: "geplant", quelle: "gespraech", neu_bis: new Date(Date.now() + 7 * 864e5).toISOString(), erstellt_von: ich.id }, { onConflict: "id", ignoreDuplicates: true }).select("id");
        if (error) throw error;
        if (!data?.length) {   // gab es schon – nur in Ordnung, wenn es genau dieses Feature von mir ist
          const { data: da } = await supabase.from("ws_features").select("name, erstellt_von").eq("id", id).maybeSingle();
          if (!da || da.name !== v.feature_neu.name || da.erstellt_von !== ich.id) throw new Error("Diese Kennung ist schon vergeben – bitte neu fragen");
        }
        toast(`Feature „${v.feature_neu.name}“ angelegt`);
      } else {
        const { error } = await supabase.rpc("ws_bezug_setzen", { p_von: v.bezug.von, p_zu: v.bezug.zu });
        if (error) throw error;
        toast(`Vorlage gesetzt: ${fname(v.bezug.zu)} für ${fname(v.bezug.von)}`);
      }
      const { error: e2 } = await supabase.rpc("ws_claude_chat_entscheiden", { p_antwort: m.id, p_entscheidung: "uebernommen" });
      if (e2) throw e2;
    } catch (e) { toast(fehler(e)); } finally { setBusy(false); }
  };
  const nein = async () => { const { error } = await supabase.rpc("ws_claude_chat_entscheiden", { p_antwort: m.id, p_entscheidung: "abgelehnt" }); if (error) toast(fehler(error)); };
  const g = v.feature_neu ? d.gruppen.find((x) => x.id === v.feature_neu.gruppe_id) : null;
  return (
    <div className="mt-2 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 p-2">
      <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" />{v.feature_neu ? "Neues Feature" : "Vorlage setzen"}</div>
      {v.feature_neu ? <><p className="font-semibold mt-0.5">Feature „{v.feature_neu.name}“ in Gruppe „{g?.name || v.feature_neu.gruppe_id}“ anlegen?</p>{v.feature_neu.beschreibung && <p className="text-xs text-slate-500">{v.feature_neu.beschreibung}</p>}</>
        : <p className="font-semibold mt-0.5">„{fname(v.bezug.zu)}“ als Vorlage für „{fname(v.bezug.von)}“ verwenden?</p>}
      {m.entscheidung ? <p className="text-xs mt-1.5 font-semibold text-slate-500">{m.entscheidung === "uebernommen" ? "Erledigt" : "Abgelehnt"}</p>
        : kann && <div className="flex gap-1.5 mt-2"><button type="button" className={btn} disabled={busy} onClick={ja}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Ja</button><button type="button" className={ghost} onClick={nein}><X className="w-4 h-4" />Nein</button></div>}
    </div>);
}

function Vorschlag(props) {
  const v = props.m.vorschlag;
  return v?.wissen ? <WissenVorschlag {...props} /> : v?.feature_neu || v?.bezug ? <FeatureVorschlag {...props} /> : <AuftragVorschlag {...props} />;
}

function AuftragVorschlag({ m, d, ich, kann, toast }) {
  // Auftragstext immer sichtbar, bevor er angelegt wird (Prüfung 2026-10-23)
  const v = m.vorschlag; const [offen, setOffen] = useState(true); const [busy, setBusy] = useState(false);   // Auftragstext immer sichtbar (Prüfung M4)
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
      const { error: e2 } = await supabase.rpc("ws_claude_chat_entscheiden", { p_antwort: m.id, p_entscheidung: "uebernommen", p_auftrag: data.id });
      if (e2) toast(fehler(e2));
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
