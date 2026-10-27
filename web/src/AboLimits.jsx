// Abo-Limits je KI (Gerhard 2026-10-23 23:38, „So bauen“): Klick auf „Abo-Limits“ oben öffnet dieses Fenster,
// ein Reiter je gekoppelter KI in ihrer Farbe. Ehrlich: echte Prozentwerte liefern nur Claude (Claude Code) und ChatGPT (Codex);
// für die anderen steht da, dass der Anbieter keine Limits zeigt – dazu die Anfragen der Werkstatt heute und wann zuletzt „Limit voll“ war.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X, Gauge, Info, RefreshCw, Loader2, CircleAlert } from "lucide-react";
import { supabase } from "./supabase";
import { kiFarbe } from "./kiFarbe";

const NAMEN = { claude: "Claude", chatgpt: "ChatGPT", gemini: "Gemini" };
const FENSTER = { "5std": "5 Std.", woche: "Woche", tag: "Tag", fenster: "Zeitfenster" };
const uhr = (t) => {
  if (!t) return "–";
  const d = new Date(t); const heute = new Date().toDateString() === d.toDateString();
  return heute ? d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleString("de-AT", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const abgelaufen = (r) => r && Date.parse(r) < Date.now();

function Balken({ titel, prozent, reset, warn, pause }) {
  const p = abgelaufen(reset) ? 0 : prozent;
  const farbe = p >= pause ? "bg-red-600" : p >= warn ? "bg-amber-500" : "bg-emerald-600";
  return (
    <div className="grid grid-cols-[70px_minmax(0,1fr)_48px] items-center gap-2 text-sm">
      <span className="text-slate-600 dark:text-slate-300">{titel}</span>
      <span className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p ?? 0} aria-label={`${titel} verbraucht`}>
        <i className={`block h-full ${farbe}`} style={{ width: `${Math.min(100, p ?? 0)}%` }} />
      </span>
      <b className="tabular-nums text-right">{p == null ? "–" : `${Math.round(p)} %`}</b>
      <span className="col-start-2 col-span-2 -mt-1 text-xs text-slate-500">{abgelaufen(reset) ? "zurückgesetzt" : `Reset ${uhr(reset)}`}</span>
    </div>);
}

// Knopf „Jetzt aktualisieren“ (Entwurf 1.1, Gerhard 2026-10-27): die eigene Werkstatt fragt die Werte kostenlos ab
// (wie „/usage“ in Claude Code), ersatzweise mit einer Mini-Anfrage; Ergebnis und Hinweis kommen über ws_abo_limits zurück (0050).
const vor = (t) => { if (!t) return ""; const m = Math.round((Date.now() - Date.parse(t)) / 60000); return m < 1 ? "gerade eben" : m < 60 ? `vor ${m} Min.` : m < 1440 ? `vor ${Math.round(m / 60)} Std.` : `vor ${Math.round(m / 1440)} Tg.`; };
function Aktualisieren({ abo, toast, werkstattAn }) {
  const [warte, setWarte] = useState(null); const [meldung, setMeldung] = useState(null);
  const erledigt = warte && abo?.abruf_erledigt && Date.parse(abo.abruf_erledigt) >= warte - 2000;
  useEffect(() => { if (erledigt) { setWarte(null); setMeldung(null); } }, [erledigt]);
  useEffect(() => {
    if (!warte) return undefined;
    const t = setTimeout(() => { setWarte(null); setMeldung("Keine Antwort von deiner Werkstatt – ist das Programm offen und die Werkstatt an?"); }, 45000);
    return () => clearTimeout(t);
  }, [warte]);
  const los = async () => {
    setMeldung(null);
    const { error } = await supabase.rpc("ws_abo_abruf");
    if (error) { (toast || (() => {}))((error.message || "").replace(/^.*?ERROR:\s*/, "")); return; }
    setWarte(Date.now());
  };
  const fehlerHinweis = abo?.abruf_art && abo.abruf_art !== "abruf" ? abo.abruf_hinweis : null;
  return (
    <div className="flex flex-col gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 rounded-b-2xl">
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 min-w-0">{warte ? "Werkstatt fragt ab …" : abo?.aktualisiert ? `Stand ${uhr(abo.aktualisiert)} · ${vor(abo.aktualisiert)}` : "Noch kein Stand"}</span>
        <button type="button" onClick={los} disabled={!!warte} className="ml-auto inline-flex items-center gap-2 h-9 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-display font-bold tracking-wide text-sm">
          {warte ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}Jetzt aktualisieren</button>
      </div>
      {!werkstattAn && <p className="text-xs text-amber-700 dark:text-amber-300 flex gap-1.5"><CircleAlert className="w-3.5 h-3.5 shrink-0 mt-px" />Deine Werkstatt ist aus – der Knopf wirkt erst, wenn sie läuft.</p>}
      {meldung && <p className="text-xs text-amber-700 dark:text-amber-300 flex gap-1.5"><CircleAlert className="w-3.5 h-3.5 shrink-0 mt-px" />{meldung}</p>}
      {!meldung && fehlerHinweis && <p className={`text-xs flex gap-1.5 ${abo.abruf_art === "fehler" ? "text-red-700 dark:text-red-300" : "text-slate-600 dark:text-slate-300"}`}><Info className="w-3.5 h-3.5 shrink-0 mt-px" />{fehlerHinweis}</p>}
    </div>);
}

export default function AboLimits({ d, ich, toast, onSchliessen, onVerbrauch }) {
  const [kopp, setKopp] = useState([]); const [eigene, setEigene] = useState({}); const [wahl, setWahl] = useState("claude");
  const warn = d.einstellungen?.abo_klein_ab_prozent ?? 75; const pause = d.einstellungen?.abo_pause_ab_prozent ?? 95;
  const laden = useCallback(async () => {
    const [{ data: k }, { data: a }] = await Promise.all([
      supabase.from("ws_ki_kopplung").select("*").eq("benutzer_id", ich.id),
      supabase.from("ws_ki_anbieter").select("id, name")]);
    setKopp(k || []); setEigene(Object.fromEntries((a || []).map((x) => [x.id, x.name])));
  }, [ich.id]);
  useEffect(() => {
    laden();
    const ch = supabase.channel(`abo-${Math.random()}`).on("postgres_changes", { event: "*", schema: "public", table: "ws_ki_kopplung" }, () => laden()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [laden]);
  useEffect(() => { const t = (e) => e.key === "Escape" && onSchliessen(); window.addEventListener("keydown", t); return () => window.removeEventListener("keydown", t); }, [onSchliessen]);

  // aktiver PC zuerst; je Anbieter die neueste Zeile
  const pcs = (d.pcs || []).filter((p) => p.benutzer_id === ich.id).sort((a, b) => (b.an ? 1 : 0) - (a.an ? 1 : 0) || Date.parse(b.zuletzt || 0) - Date.parse(a.zuletzt || 0));
  const zeile = useMemo(() => {
    const m = {};
    for (const p of pcs) for (const k of kopp.filter((x) => x.pc_id === p.id)) if (!m[k.anbieter]) m[k.anbieter] = k;
    return m;
  }, [kopp, pcs]);
  const WERKZEUGE = ["github", "cloudflare"];
  const liste = ["claude", ...Object.keys(zeile).filter((a) => a !== "claude" && !WERKZEUGE.includes(a) && zeile[a].gekoppelt)];
  const name = (a) => NAMEN[a] || eigene[a] || a;
  const aktiv = liste.includes(wahl) ? wahl : "claude";
  const k = zeile[aktiv];
  const abo = d.abo.find((x) => x.benutzer_id === ich.id);
  const heute = new Date().toISOString().slice(0, 10);
  const limitVoll = k?.limit_bis && Date.parse(k.limit_bis) > Date.now();

  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-items-end bg-slate-950/30 p-3 sm:p-6" onClick={onSchliessen}>
      <section role="dialog" aria-modal="true" aria-label="Abo-Limits je KI" onClick={(e) => e.stopPropagation()}
        className="mt-12 w-full max-w-[440px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl flex flex-col max-h-[80vh]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Gauge className="w-4 h-4 text-emerald-700" /><h2 className="font-display font-bold text-lg flex-1">Abo-Limits</h2>
          <button type="button" onClick={onSchliessen} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Schließen"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex flex-wrap gap-1.5 px-4 pt-3" role="tablist" aria-label="KI wählen">
          {liste.map((a) => (
            <button key={a} type="button" role="tab" aria-selected={aktiv === a} onClick={() => setWahl(a)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${aktiv === a ? kiFarbe(a).chip : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
              <span className={`w-2 h-2 rounded-full ${kiFarbe(a).punkt}`} aria-hidden="true" />{name(a)}
            </button>))}
        </div>
        <div className="p-4 flex flex-col gap-3 overflow-auto" role="tabpanel">
          <div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${kiFarbe(aktiv).punkt}`} aria-hidden="true" />
            <b>{name(aktiv)}</b>{aktiv === "claude" && /\(([^)]+)\)/.test(k?.hinweis || "") && <span className="text-xs text-slate-500">{/\(([^)]+)\)/.exec(k.hinweis)[1]}</span>}</div>
          {aktiv === "claude" ? (abo && (abo.fuenf_std_prozent != null || abo.woche_prozent != null) ? <>
            <Balken titel="5 Std." prozent={abo.fuenf_std_prozent} reset={abo.fuenf_std_reset} warn={warn} pause={pause} />
            <Balken titel="Woche" prozent={abo.woche_prozent} reset={abo.woche_reset} warn={warn} pause={pause} />
            <span className="text-xs text-slate-500">{abo.quelle === "abruf" ? "kostenloser Abruf bei Anthropic" : abo.quelle === "mini" ? "aus einer Mini-Anfrage" : "aus Claude Code"}</span></>
            : <p className="text-sm text-slate-600 dark:text-slate-300 flex gap-2"><Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />Noch keine Werte – unten „Jetzt aktualisieren“ drücken.</p>)
          : k?.limits?.length ? <>
            {k.limits.map((f, i) => <Balken key={i} titel={FENSTER[f.art] || f.art} prozent={f.prozent} reset={f.reset} warn={warn} pause={pause} />)}
            <span className="text-xs text-slate-500">Stand {uhr(k.limits_zeit)} · vom Anbieter</span></>
          : <p className="text-sm text-slate-600 dark:text-slate-300 flex gap-2"><Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
              {aktiv === "chatgpt" ? "Noch keine Werte – die Werkstatt fragt sie beim nächsten Abgleich bei Codex ab." : `${name(aktiv)} zeigt keine Limits an. Sichtbar ist nur, was die Werkstatt selbst sieht.`}</p>}
          {aktiv !== "claude" && <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm border-t border-slate-100 dark:border-slate-800 pt-3">
            <dt className="text-slate-500">Anfragen heute (Werkstatt)</dt><dd className="tabular-nums font-semibold">{k?.anfragen_tag === heute ? k.anfragen_heute : 0}</dd>
            <dt className="text-slate-500">Zuletzt „Limit voll“</dt><dd className={limitVoll ? "font-semibold text-red-700 dark:text-red-300" : ""}>{k?.limit_bis ? (limitVoll ? `bis ${uhr(k.limit_bis)}` : `bis ${uhr(k.limit_bis)} (vorbei)`) : "–"}</dd>
          </dl>}
        </div>
        {onVerbrauch && <div className="px-4 pb-3"><button type="button" onClick={onVerbrauch} className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">Verbrauch & Limits ansehen</button></div>}
        <Aktualisieren abo={abo} toast={toast} werkstattAn={(d.pcs || []).some((p) => p.benutzer_id === ich.id && p.an)} />
      </section>
    </div>);
}
