import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Pin, PinOff, Pencil, Trash2, Check, X, Paperclip, Send, Loader2, PanelRight, Link2, Hash, Hammer, BookOpen, FileText, Image as Bild, Lightbulb, MessageSquare } from "lucide-react";
import { supabase } from "./supabase";
import { Markdown } from "./Markdown";
import { useKiName } from "./kiName";
import { kiFarbe } from "./kiFarbe";
import { MitErwaehnung, erwaehnte, erwaehnteGruppen } from "./Bezuege";
import { Vorschlag, ORT_NAME } from "./ClaudeSpalte";
import CodeschmiedeZeichen from "./Zeichen";

// Chat wie bei Claude (Entwurf 1.1 „Oberfläche 2.0 & Chat“, freigegeben von Gerhard 2026-10-27 08:27):
// links die eigenen Unterhaltungen des Projekts (Konzept immer angeheftet oben), in der Mitte das Gespräch, unten die Eingabe mit
// @Feature, #Gruppe und Anhängen, rechts ein- und ausblendbar die Bezüge. Die eingestellte KI antwortet über die eigene Werkstatt
// (nur lesend) und legt wie im Konzept-Chat Rückfragen und Aufträge an – gebaut wird erst nach deiner Freigabe (Regel 2026-10-26).
// Datenbank 0050: ws_unterhaltungen, ws_claude_chat.unterhaltung_id/anhaenge, Speicher „ws-chat“.

const fehler = (e) => (e?.message || "Unbekannter Fehler").replace(/^.*?ERROR:\s*/, "");
const zeit = (d) => new Date(d).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
const KONZEPT = "konzept";
const TYPEN = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", pdf: "application/pdf", txt: "text/plain", md: "text/markdown", csv: "text/csv", json: "application/json" };
const ENDUNG = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf", "text/plain": "txt", "text/markdown": "md", "text/csv": "csv", "application/json": "json" };
const merken = { lies: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, schreib: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ohne Speicher */ } } };

/** Typ einer gewählten Datei bestimmen (manche Systeme liefern bei .md/.csv keinen Typ). */
export function dateiTyp(datei) {
  if (ENDUNG[datei.type]) return datei.type;
  const e = String(datei.name || "").toLowerCase().split(".").pop();
  return TYPEN[e] || null;
}

/** Gelöschte Chat-Anhänge im Speicher entfernen (Lösch-Warteschlange ws_chat_dateien_weg, nur eigene). */
export async function dateienAufraeumen() {
  try {
    const { data } = await supabase.from("ws_chat_dateien_weg").select("pfad").limit(200);
    const pfade = (data || []).map((x) => x.pfad);
    if (!pfade.length) return;
    await supabase.storage.from("ws-chat").remove(pfade);
    await supabase.rpc("ws_chat_dateien_erledigt", { p_pfade: pfade });
  } catch { /* beim nächsten Öffnen erneut */ }
}

/** Unterhaltungen nach Zeit gruppieren (Heute, Gestern, Diese Woche, Älter). */
export function gruppiereNachZeit(liste, jetzt = new Date()) {
  const tag = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const heute = tag(jetzt); const gestern = heute - 864e5; const woche = heute - 6 * 864e5;
  const g = { Heute: [], Gestern: [], "Diese Woche": [], Älter: [] };
  for (const u of liste) {
    const t = tag(new Date(u.geaendert));
    g[t >= heute ? "Heute" : t >= gestern ? "Gestern" : t >= woche ? "Diese Woche" : "Älter"].push(u);
  }
  return Object.entries(g).filter(([, l]) => l.length);
}

/** Titel einer neuen Unterhaltung aus der ersten Nachricht. */
export function titelAus(text) {
  const z = String(text || "").split("\n").map((x) => x.trim()).find(Boolean) || "Neuer Chat";
  return z.length > 60 ? `${z.slice(0, 57).replace(/\s+\S*$/, "")} …` : z;
}

export default function Chat({ d, ich, toast, start, onFeature }) {
  const projekt = d.projekte.find((p) => p.id === d.projektId);
  const [liste, setListe] = useState([]);
  const [wahl, setWahl] = useState(() => start?.u ?? KONZEPT);
  const [suche, setSuche] = useState("");
  const [bezuegeAn, setBezuegeAn] = useState(() => merken.lies("cs-chat-bezuege") === "1");
  const [listeAufHandy, setListeAufHandy] = useState(false);
  useEffect(() => { if (start?.u != null) setWahl(start.u); }, [start?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const laden = useCallback(async () => {
    const { data } = await supabase.from("ws_unterhaltungen").select("*").eq("projekt_id", d.projektId).order("geaendert", { ascending: false }).limit(500);
    setListe(data || []);
  }, [d.projektId]);
  useEffect(() => {
    laden();
    const ch = supabase.channel(`cs-unterhaltungen-${d.projektId}-${Math.random()}`).on("postgres_changes", { event: "*", schema: "public", table: "ws_unterhaltungen" }, laden).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [laden, d.projektId]);

  const q = suche.trim().toLowerCase();
  const gefiltert = liste.filter((u) => !q || u.titel.toLowerCase().includes(q));
  const angeheftet = gefiltert.filter((u) => u.angeheftet);
  const rest = gruppiereNachZeit(gefiltert.filter((u) => !u.angeheftet));
  const aktuell = wahl === KONZEPT ? null : liste.find((u) => u.id === wahl) || null;
  const zeigKonzept = !q || `konzept ${projekt?.name || ""}`.toLowerCase().includes(q);

  const anheften = async (u) => { const { error } = await supabase.from("ws_unterhaltungen").update({ angeheftet: !u.angeheftet }).eq("id", u.id); if (error) toast(fehler(error)); };
  const umbenennen = async (u, titel) => { const { error } = await supabase.from("ws_unterhaltungen").update({ titel: titel.slice(0, 120) }).eq("id", u.id); if (error) toast(fehler(error)); };
  const loeschen = async (u) => {
    // Nachrichten löscht die Datenbank mit der Unterhaltung; deren Dateien landen in der Lösch-Warteschlange (0050) und werden gleich entfernt
    const { error } = await supabase.from("ws_unterhaltungen").delete().eq("id", u.id);
    if (error) { toast(fehler(error)); return; }
    toast("Unterhaltung gelöscht");
    if (wahl === u.id) setWahl(KONZEPT);
    dateienAufraeumen();
  };
  useEffect(() => { dateienAufraeumen(); }, []);
  const neu = () => { setWahl("neu"); setListeAufHandy(false); };
  const bezuegeUmschalten = () => { const n = !bezuegeAn; setBezuegeAn(n); merken.schreib("cs-chat-bezuege", n ? "1" : "0"); };

  return (
    <div className={`grid h-full min-h-0 grid-cols-[minmax(0,1fr)] lg:grid-cols-[264px_minmax(0,1fr)] ${bezuegeAn ? "xl:grid-cols-[264px_minmax(0,1fr)_292px]" : ""}`}>
      <aside aria-label="Unterhaltungen" className={`${listeAufHandy ? "flex" : "hidden"} lg:flex flex-col min-h-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900`}>
        <div className="p-3 flex flex-col gap-2.5">
          <button type="button" onClick={neu} className="inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-display font-bold tracking-wide"><Plus className="w-4 h-4" />Neuer Chat</button>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-sm text-slate-500">
            <Search className="w-4 h-4 shrink-0" /><input id="cs-chat-suche" value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Unterhaltungen durchsuchen" className="min-w-0 flex-1 bg-transparent outline-none text-slate-900 dark:text-slate-100" /></label>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-3 text-sm" aria-label="Liste der Unterhaltungen">
          <Kopf>Angeheftet</Kopf>
          {zeigKonzept && <button type="button" aria-current={wahl === KONZEPT} onClick={() => { setWahl(KONZEPT); setListeAufHandy(false); }}
            className={`w-full text-left rounded-lg px-2.5 py-2 ${wahl === KONZEPT ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-100" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
            <span className="flex items-center gap-1.5 font-semibold truncate"><Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />Konzept · {projekt?.name}</span>
            <span className="block text-xs text-slate-500 truncate">Grundkonzept und alles ohne eigenen Chat</span></button>}
          {angeheftet.map((u) => <Eintrag key={u.id} u={u} aktiv={wahl === u.id} onWahl={() => { setWahl(u.id); setListeAufHandy(false); }} onAnheften={anheften} onUmbenennen={umbenennen} onLoeschen={loeschen} />)}
          {rest.map(([titel, l]) => (
            <React.Fragment key={titel}><Kopf>{titel}</Kopf>
              {l.map((u) => <Eintrag key={u.id} u={u} aktiv={wahl === u.id} onWahl={() => { setWahl(u.id); setListeAufHandy(false); }} onAnheften={anheften} onUmbenennen={umbenennen} onLoeschen={loeschen} />)}</React.Fragment>))}
          {q && !gefiltert.length && !zeigKonzept && <p className="px-2.5 py-3 text-slate-500">Keine Unterhaltung gefunden.</p>}
        </nav>
      </aside>

      <Gespraech key={wahl} d={d} ich={ich} toast={toast} unterhaltung={wahl} titel={wahl === KONZEPT ? `Konzept · ${projekt?.name || ""}` : wahl === "neu" ? "Neuer Chat" : aktuell?.titel || "Chat"}
        onAngelegt={(id) => { setWahl(id); laden(); }} bezuegeAn={bezuegeAn} onBezuege={bezuegeUmschalten} onListe={() => setListeAufHandy(true)} onFeature={onFeature} versteckt={listeAufHandy} />
    </div>);
}

function Kopf({ children }) {
  return <div className="px-2.5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{children}</div>;
}

function Eintrag({ u, aktiv, onWahl, onAnheften, onUmbenennen, onLoeschen }) {
  const [modus, setModus] = useState(null); const [titel, setTitel] = useState(u.titel);
  if (modus === "name") return (
    <form className="flex items-center gap-1 px-1.5 py-1" onSubmit={(e) => { e.preventDefault(); if (titel.trim()) onUmbenennen(u, titel.trim()); setModus(null); }}>
      <input id={`cs-u-${u.id}`} autoFocus value={titel} maxLength={120} onChange={(e) => setTitel(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setModus(null)}
        className="min-w-0 flex-1 rounded-md border border-emerald-500 bg-white dark:bg-slate-950 px-2 py-1 text-sm" aria-label="Neuer Titel" />
      <button type="submit" className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Speichern"><Check className="w-4 h-4 text-emerald-700" /></button>
    </form>);
  return (
    <div className={`group relative rounded-lg ${aktiv ? "bg-emerald-50 dark:bg-emerald-950/60" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
      <button type="button" aria-current={aktiv} onClick={onWahl} className="w-full text-left px-2.5 py-2 pr-16">
        <span className={`block truncate ${aktiv ? "font-semibold text-emerald-900 dark:text-emerald-100" : ""}`}>{u.titel}</span>
        <span className="block text-xs text-slate-500">{new Date(u.geaendert).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
      </button>
      {modus === "weg" ? (
        <div className="absolute inset-0 flex items-center gap-1.5 justify-end pr-2 rounded-lg bg-red-50 dark:bg-red-950/80 text-xs">
          <span className="mr-auto pl-2.5 font-semibold text-red-800 dark:text-red-200">Löschen?</span>
          <button type="button" onClick={() => onLoeschen(u)} className="px-2 py-1 rounded bg-red-600 text-white font-semibold">Löschen</button>
          <button type="button" onClick={() => setModus(null)} className="p-1 rounded hover:bg-white/60" aria-label="Abbrechen"><X className="w-3.5 h-3.5" /></button>
        </div>
      ) : (
        <div className={`absolute right-1.5 top-1.5 flex gap-0.5 ${aktiv ? "" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}>
          <button type="button" title={u.angeheftet ? "Lösen" : "Anheften"} aria-label={u.angeheftet ? "Lösen" : "Anheften"} onClick={() => onAnheften(u)} className="p-1 rounded hover:bg-white dark:hover:bg-slate-700">{u.angeheftet ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}</button>
          <button type="button" title="Umbenennen" aria-label="Umbenennen" onClick={() => { setTitel(u.titel); setModus("name"); }} className="p-1 rounded hover:bg-white dark:hover:bg-slate-700"><Pencil className="w-3.5 h-3.5" /></button>
          <button type="button" title="Löschen" aria-label="Löschen" onClick={() => setModus("weg")} className="p-1 rounded hover:bg-white dark:hover:bg-slate-700"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>)}
    </div>);
}

function Gespraech({ d, ich, toast, unterhaltung, titel, onAngelegt, bezuegeAn, onBezuege, onListe, onFeature, versteckt }) {
  const ki = useKiName(d.projektId, unterhaltung === KONZEPT ? "konzept" : "chat");
  const [msgs, setMsgs] = useState([]);
  const [geladen, setGeladen] = useState(false);
  const ende = useRef(null);
  const id = typeof unterhaltung === "number" ? unterhaltung : null;
  const holen = useCallback(async () => {
    if (unterhaltung === "neu") { setMsgs([]); setGeladen(true); return; }
    let q = supabase.from("ws_claude_chat").select("*").eq("projekt_id", d.projektId);
    q = id ? q.eq("unterhaltung_id", id) : q.is("unterhaltung_id", null);
    const { data } = await q.order("id", { ascending: false }).limit(200);
    setMsgs((data || []).reverse()); setGeladen(true);
  }, [d.projektId, id, unterhaltung]);
  useEffect(() => {
    holen();
    const ch = supabase.channel(`cs-chat-${d.projektId}-${unterhaltung}-${Math.random()}`).on("postgres_changes", { event: "*", schema: "public", table: "ws_claude_chat" }, holen).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [holen, d.projektId, unterhaltung]);
  useEffect(() => { requestAnimationFrame(() => ende.current?.scrollIntoView({ block: "nearest" })); }, [msgs.length]);

  const werkstattAn = d.pcs.some((p) => p.benutzer_id === ich.id && p.an);
  const wartet = msgs.some((m) => !m.frage_id && ["offen", "laeuft"].includes(m.stand));
  const fragen = Object.fromEntries(msgs.filter((m) => !m.frage_id).map((m) => [m.id, m]));
  const features = useMemo(() => d.features.filter((x) => !x.ausgebaut), [d.features]);
  const konzeptGruppe = d.projekte.find((p) => p.id === d.projektId)?.konzept_gruppe_id;
  const gruppen = useMemo(() => d.gruppen.filter((g) => g.id !== konzeptGruppe).map((g) => ({ id: g.id, name: g.name, bereich: d.bereiche.find((b) => b.id === g.bereich_id)?.name })), [d.gruppen, d.bereiche, konzeptGruppe]);

  // Senden: bei „Neuer Chat“ legt die erste Nachricht die Unterhaltung an (wie bei Claude)
  const senden = async (text, anhaenge) => {
    let uid = id;
    if (unterhaltung === "neu") {
      const { data, error } = await supabase.from("ws_unterhaltungen").insert({ projekt_id: d.projektId, titel: titelAus(text) }).select("id").single();
      if (error) { toast(fehler(error)); return false; }
      uid = data.id;
    }
    const { error } = await supabase.from("ws_claude_chat").insert({ projekt_id: d.projektId, ort: "konzept", text: text.slice(0, 8000), unterhaltung_id: uid, ...(anhaenge.length ? { anhaenge } : {}) });
    if (error) {
      if (unterhaltung === "neu") await supabase.from("ws_unterhaltungen").delete().eq("id", uid);   // keine leere Unterhaltung zurücklassen
      toast(fehler(error)); return false;
    }
    if (unterhaltung === "neu") onAngelegt(uid); else holen();
    return true;
  };

  return (
    <>
      <section aria-label="Gespräch" className={`${versteckt ? "hidden lg:grid" : "grid"} grid-rows-[auto_minmax(0,1fr)_auto] min-w-0 min-h-0 bg-slate-50 dark:bg-slate-950`}>
        <div className="flex items-center gap-2.5 px-4 md:px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60">
          <button type="button" onClick={onListe} className="lg:hidden p-1.5 rounded-lg border border-slate-200 dark:border-slate-700" aria-label="Unterhaltungen zeigen"><MessageSquare className="w-4 h-4" /></button>
          <h2 className="font-display font-bold text-lg truncate min-w-0" style={{ textWrap: "balance" }}>{titel}</h2>
          <button type="button" onClick={onBezuege} aria-pressed={bezuegeAn} title="Bezüge ein- oder ausblenden"
            className={`ml-auto hidden xl:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-semibold ${bezuegeAn ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
            <PanelRight className="w-4 h-4" />Bezüge</button>
        </div>
        <div className="overflow-y-auto px-4 md:px-6 py-5" aria-live="polite">
          <div className="max-w-[760px] mx-auto flex flex-col gap-5">
            {geladen && !msgs.length && <Leer konzept={unterhaltung === KONZEPT} ki={ki.name} onIdee={(t) => senden(t, [])} />}
            {msgs.map((m) => m.frage_id ? (
              <div key={m.id} className="flex gap-3">
                <span className="w-8 h-8 shrink-0 rounded-[9px] bg-[#0f2a22] grid place-items-center"><CodeschmiedeZeichen groesse={22} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${kiFarbe(String(m.ki || "claude").split("/")[0]).punkt}`} aria-hidden="true" />{ki.von(m.ki)} · {zeit(m.erstellt)}</div>
                  <div className="text-[15px] leading-relaxed"><Markdown text={m.text} /></div>
                  {m.vorschlag && <Vorschlag m={m} d={d} ich={ich} kann={fragen[m.frage_id]?.von === ich.id} toast={toast} onAntwort={(t) => senden(t, [])} sperre={wartet} />}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-3">
                <span className="w-8 h-8 shrink-0 rounded-full bg-emerald-600 text-white grid place-items-center text-xs font-bold">{ich.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-500 mb-1">Du{m.ort !== "konzept" ? ` · aus ${ORT_NAME(m.ort)}` : ""} · {zeit(m.erstellt)}</div>
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-[15px]">
                    <MitMarken text={m.text} features={features} gruppen={gruppen} onFeature={onFeature} />
                    {Array.isArray(m.anhaenge) && <AnhangListe liste={m.anhaenge} m={m} toast={toast} />}
                  </div>
                  {m.stand === "fehler" && <p className="text-xs text-red-600 mt-1">Nicht beantwortet</p>}
                </div>
              </div>))}
            {wartet && <div className="flex items-center gap-2 text-sm text-slate-500 pl-11">{werkstattAn ? <><Loader2 className="w-4 h-4 animate-spin" />{ki.name} liest nach und antwortet …</> : <span className="text-amber-700 dark:text-amber-400">Deine Werkstatt ist aus – sie startet mit dem Programm; dann kommt die Antwort.</span>}</div>}
            <div ref={ende} />
          </div>
        </div>
        <Eingabe d={d} ich={ich} toast={toast} features={features} gruppen={gruppen} ki={ki.name} sperre={false} onSenden={senden} />
      </section>
      {bezuegeAn && <Bezuege msgs={msgs} d={d} features={features} gruppen={gruppen} onFeature={onFeature} />}
    </>);
}

function Leer({ konzept, ki, onIdee }) {
  const ideen = konzept ? ["Was fehlt noch im Konzept?", "Fasse das Konzept zusammen", "Datenschutz prüfen"] : ["Ich habe eine neue Idee für ein Feature", "Was steht als Nächstes an?", "Erkläre mir, wie ein Feature aufgebaut ist"];
  return (
    <div className="text-center py-[10vh] flex flex-col items-center gap-3">
      <CodeschmiedeZeichen groesse={44} />
      <h3 className="font-display font-bold text-2xl">{konzept ? "Konzept besprechen" : "Worüber sprechen wir?"}</h3>
      <p className="text-slate-500 max-w-md">Mit <b>@</b> ein Feature und mit <b>#</b> eine Gruppe einbeziehen. {ki} stellt Rückfragen zum Anklicken und legt Aufträge erst an, wenn alles geklärt ist – gebaut wird nach deiner Freigabe.</p>
      <div className="flex flex-wrap justify-center gap-1.5 mt-1">{ideen.map((i) => <button key={i} type="button" onClick={() => onIdee(i)} className="text-sm rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1 hover:bg-white dark:hover:bg-slate-900">{i}</button>)}</div>
    </div>);
}

/** Nachricht mit hervorgehobenen @Features und #Gruppen (Klick auf ein Feature öffnet es). */
function MitMarken({ text, features, gruppen, onFeature }) {
  const marken = useMemo(() => {
    const f = erwaehnte(text, features).map((x) => ({ wort: `@${x.name}`, art: "f", x }));
    const g = erwaehnteGruppen(text, gruppen).map((x) => ({ wort: `#${x.name}`, art: "g", x }));
    return [...f, ...g].sort((a, b) => b.wort.length - a.wort.length);
  }, [text, features, gruppen]);
  if (!marken.length) return <div className="whitespace-pre-wrap break-words">{text}</div>;
  const teile = []; let rest = text; let n = 0;
  while (rest) {
    const lower = rest.toLowerCase(); let best = null;
    for (const mk of marken) { const i = lower.indexOf(mk.wort.toLowerCase()); if (i >= 0 && (!best || i < best.i)) best = { i, mk }; }
    if (!best) { teile.push(rest); break; }
    if (best.i) teile.push(rest.slice(0, best.i));
    const { mk } = best;
    teile.push(mk.art === "f"
      ? <button key={n++} type="button" onClick={() => onFeature?.(mk.x)} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 px-2 py-px text-[13px] font-semibold align-baseline hover:underline"><Link2 className="w-3 h-3" />{mk.x.name}</button>
      : <span key={n++} className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 px-2 py-px text-[13px] font-semibold"><Hash className="w-3 h-3" />{mk.x.name}</span>);
    rest = rest.slice(best.i + mk.wort.length);
  }
  return <div className="whitespace-pre-wrap break-words">{teile}</div>;
}

function AnhangListe({ liste, m, toast }) {
  const [frage, setFrage] = useState(false);
  const weg = async () => {
    const { error } = await supabase.rpc("ws_chat_anhaenge_entfernen", { p_nachricht: m.id });
    if (error) { toast(fehler(error)); return; }
    toast("Anhänge entfernt"); setFrage(false); dateienAufraeumen();
  };
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">{liste.filter((a) => a && typeof a.pfad === "string").map((a) => <AnhangChip key={a.pfad} a={a} />)}</div>
      {frage ? <span className="text-xs flex items-center gap-2"><span className="text-red-700 dark:text-red-300 font-semibold">Anhänge endgültig löschen?</span>
          <button type="button" onClick={weg} className="px-2 py-0.5 rounded bg-red-600 text-white font-semibold">Löschen</button><button type="button" onClick={() => setFrage(false)} className="underline">Abbrechen</button></span>
        : <button type="button" onClick={() => setFrage(true)} className="self-start text-xs text-slate-500 hover:text-red-700 inline-flex items-center gap-1"><Trash2 className="w-3 h-3" />Anhänge löschen</button>}
    </div>);
}
function AnhangChip({ a }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let aus = false;
    supabase.storage.from("ws-chat").createSignedUrl(a.pfad, 3600).then(({ data }) => { if (!aus) setUrl(data?.signedUrl || null); });
    return () => { aus = true; };
  }, [a.pfad]);
  const bild = a.typ?.startsWith("image/");
  return (
    <a href={url || undefined} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-1.5 pr-3 text-sm max-w-[240px]">
      {bild && url ? <img src={url} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <span className="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 grid place-items-center text-slate-500">{bild ? <Bild className="w-4 h-4" /> : <FileText className="w-4 h-4" />}</span>}
      <span className="min-w-0"><span className="block truncate font-semibold group-hover:underline">{a.name}</span><span className="block text-xs text-slate-500">{Number.isFinite(a.groesse) ? `${Math.max(1, Math.round(a.groesse / 1024))} KB` : ""}</span></span>
    </a>);
}

function Eingabe({ d, ich, toast, features, gruppen, ki, onSenden }) {
  const [text, setText] = useState(""); const [dateien, setDateien] = useState([]); const [busy, setBusy] = useState(false);
  const feld = useRef(null); const wahl = useRef(null);
  const hinzu = (liste) => {
    const neu = [];
    for (const f of liste) {
      const typ = dateiTyp(f);
      if (!typ) { toast(`„${f.name}“: nur Bilder, PDF und Textdateien (txt, md, csv, json)`); continue; }
      if (f.size > 10 * 1024 * 1024) { toast(`„${f.name}“ ist größer als 10 MB`); continue; }
      neu.push({ f, typ });
    }
    setDateien((alt) => [...alt, ...neu].slice(0, 5));
    if (dateien.length + neu.length > 5) toast("Höchstens 5 Anhänge je Nachricht");
  };
  const los = async () => {
    const t = text.trim(); if ((!t && !dateien.length) || busy) return;
    setBusy(true);
    const hoch = [];
    try {
      for (const { f, typ } of dateien) {
        const pfad = `${ich.id}/${d.projektId}/${crypto.randomUUID()}.${ENDUNG[typ]}`;
        const { error } = await supabase.storage.from("ws-chat").upload(pfad, f, { contentType: typ, upsert: false });
        if (error) throw error;
        hoch.push({ pfad, name: f.name.slice(0, 120).replace(/[\u0000-\u001f/\\]/g, "_") || "datei", typ, groesse: f.size });
      }
      if (await onSenden(t || "Siehe Anhang.", hoch)) { setText(""); setDateien([]); }
      else if (hoch.length) await supabase.storage.from("ws-chat").remove(hoch.map((x) => x.pfad));
    } catch (e) {
      toast(fehler(e));
      if (hoch.length) await supabase.storage.from("ws-chat").remove(hoch.map((x) => x.pfad));
    } finally { setBusy(false); }
  };
  return (
    <div className="px-4 md:px-6 pb-4 pt-1">
      <div className="max-w-[760px] mx-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_6px_24px_rgba(15,42,34,0.08)]"
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); hinzu([...e.dataTransfer.files]); }}
        onPaste={(e) => { const f = [...(e.clipboardData?.files || [])]; if (f.length) { e.preventDefault(); hinzu(f); } }}>
        {dateien.length > 0 && <div className="flex flex-wrap gap-1.5 px-3 pt-3">{dateien.map((x, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 pl-2 pr-1 py-1 text-xs max-w-[220px]">
            {x.typ.startsWith("image/") ? <Bild className="w-3.5 h-3.5 shrink-0" /> : <FileText className="w-3.5 h-3.5 shrink-0" />}<span className="truncate">{x.f.name}</span>
            <button type="button" onClick={() => setDateien(dateien.filter((_, j) => j !== i))} className="p-0.5 rounded hover:bg-white dark:hover:bg-slate-700" aria-label={`${x.f.name} entfernen`}><X className="w-3 h-3" /></button></span>))}</div>}
        <MitErwaehnung ref={feld} value={text} onChange={setText} features={features} gruppen={gruppen} minHoehe={56} rows={2} maxLength={8000} id="cs-chat-eingabe"
          placeholder="Nachricht … mit @ ein Feature, mit # eine Gruppe einbeziehen" aria-label="Nachricht"
          className="w-full bg-transparent px-4 pt-3 pb-1 text-[15px] focus:outline-none"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); los(); } }} />
        <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
          <input ref={wahl} type="file" multiple hidden accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.txt,.md,.csv,.json" onChange={(e) => { hinzu([...e.target.files]); e.target.value = ""; }} />
          <Werkzeug onClick={() => wahl.current?.click()} titel="Bild oder Datei anhängen (auch Einfügen oder Hineinziehen)"><Paperclip className="w-4 h-4" />Anhang</Werkzeug>
          <Werkzeug onClick={() => feld.current?.zeichen("@")} titel="Feature einbeziehen"><b className="font-mono">@</b>Feature</Werkzeug>
          <Werkzeug onClick={() => feld.current?.zeichen("#")} titel="Gruppe einbeziehen"><b className="font-mono">#</b>Gruppe</Werkzeug>
          <span className="ml-auto text-xs text-slate-500 hidden sm:inline-flex items-center gap-1.5" title="Eingestellt unter Verwaltung › KI-Anbieter"><i className={`w-2 h-2 rounded-full ${kiFarbe(ki.toLowerCase()).punkt}`} aria-hidden="true" />{ki}</span>
          <button type="button" onClick={los} disabled={busy || (!text.trim() && !dateien.length)} aria-label="Senden" title="Senden (Enter)"
            className="ml-2 w-9 h-9 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white grid place-items-center">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button>
        </div>
      </div>
      <p className="max-w-[760px] mx-auto mt-1.5 text-center text-xs text-slate-500">Gebaut wird erst, wenn alles geklärt ist und du freigibst. Keine Fotos von Kindern oder Mitgliederdaten anhängen.</p>
    </div>);
}

function Werkzeug({ children, onClick, titel }) {
  return <button type="button" onClick={onClick} title={titel} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">{children}</button>;
}

function Bezuege({ msgs, d, features, gruppen, onFeature }) {
  const alles = msgs.map((m) => m.text).join("\n");
  const f = erwaehnte(alles, features); const g = erwaehnteGruppen(alles, gruppen);
  const auftragIds = [...new Set(msgs.flatMap((m) => [m.auftrag_id, ...(Array.isArray(m.vorschlag?.angelegt) ? m.vorschlag.angelegt : [])]).filter(Boolean).map(Number))];
  const auftraege = auftragIds.map((id) => d.auftraege.find((a) => a.id === id) || { id, titel: `Auftrag #${id}`, stand: null });
  const wissen = msgs.filter((m) => m.vorschlag?.wissen && m.entscheidung === "uebernommen").map((m) => m.vorschlag.wissen.text);
  const STAND = { wartet: "wartet", laeuft: "in Arbeit", frage: "Rückfrage", freigabe: "Freigabe", sicherheit: "Prüfung", zusammen: "Zusammenführen", feature: "Prüfung", wissen: "live", erledigt: "erledigt" };
  return (
    <aside aria-label="Bezüge" className="hidden xl:block border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto">
      <div className="p-4 flex flex-col gap-5 text-sm">
        <Block titel="Features" leer="Mit @ ein Feature einbeziehen.">{f.map((x) => (
          <button key={x.id} type="button" onClick={() => onFeature?.(x)} className="flex items-center gap-2 py-1.5 text-left hover:underline"><Link2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" /><span className="truncate">{x.name}</span><span className="ml-auto font-mono text-[11px] text-slate-400">{x.id}</span></button>))}</Block>
        <Block titel="Gruppen" leer="Mit # eine Gruppe einbeziehen.">{g.map((x) => <div key={x.id} className="flex items-center gap-2 py-1.5"><Hash className="w-3.5 h-3.5 text-amber-600 shrink-0" /><span className="truncate">{x.name}</span><span className="ml-auto text-[11px] text-slate-400 truncate">{x.bereich}</span></div>)}</Block>
        <Block titel="Aufträge" leer="Noch keine Aufträge aus diesem Chat.">{auftraege.map((a) => <div key={a.id} className="flex items-center gap-2 py-1.5"><Hammer className="w-3.5 h-3.5 text-slate-500 shrink-0" /><span className="font-mono text-xs text-slate-500">#{a.id}</span><span className="truncate">{a.titel}</span>{a.stand && <span className="ml-auto text-[11px] rounded-full bg-slate-100 dark:bg-slate-800 px-1.5">{STAND[a.stand] || a.stand}</span>}</div>)}</Block>
        <Block titel="Ins Wissen übernommen" leer="Noch nichts übernommen.">{wissen.map((t, i) => <div key={i} className="flex gap-2 py-1.5"><BookOpen className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" /><span className="line-clamp-3">{t}</span></div>)}</Block>
      </div>
    </aside>);
}
function Block({ titel, leer, children }) {
  const n = React.Children.count(children);
  return <div><h3 className="font-display font-bold text-[15px] tracking-wide mb-1">{titel}{n > 0 && <span className="ml-1.5 text-xs font-body text-slate-400">{n}</span>}</h3>{n ? <div className="divide-y divide-slate-100 dark:divide-slate-800">{children}</div> : <p className="text-slate-500 text-xs">{leer}</p>}</div>;
}
