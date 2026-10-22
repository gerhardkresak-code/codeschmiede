import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Inbox, Eye, GitBranch, ShieldCheck, BookOpen, History, Download, KeyRound, Plus, Send, Trash2, X, Check,
  Loader2, Info, Bot, Layers, GitPullRequest, Wrench, LogIn, MessageSquare, Users, Lock, Gauge, FolderPlus, Power, Hammer,
} from "lucide-react";
import { supabase } from "./supabase";
import { WS_ICON, STAND, ROLLEN, BEREICH_RECHTE } from "./config";
import { isDesktop, tauri } from "./desktop";

// Codeschmiede – Programmierumgebung für alle Projekte (live über Supabase Realtime)
// Konzept: docs/KONZEPT.md · Datenbank: supabase/migrations/
// Rechte prüft die Datenbank (RLS + geprüfte Funktionen); die Oberfläche blendet nur aus, was ohnehin nicht geht.

const btn = "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-display font-bold tracking-wide transition";
const ghost = "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition";
const card = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const input = "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-[15px] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500";
const STEPS = [["wartet", "Auftrag"], ["laeuft", "In Arbeit"], ["freigabe", "Freigabe"], ["zusammen", "Zusammenführen"], ["sicherheit", "Sicherheitsprüfung"], ["wissen", "Wissen & veröffentlicht"]];
const STEP_IDX = { wartet: 0, laeuft: 1, frage: 1, freigabe: 2, zusammen: 3, sicherheit: 4, wissen: 5 };
const fmt = (d) => new Date(d).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const fehler = (e) => (e?.message || "Unbekannter Fehler").replace(/^.*?ERROR:\s*/, "");

function Badge({ stand }) {
  const s = STAND[stand] || STAND.geplant;
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap ${s.cls}`}>{s.label}</span>;
}

function Toast({ text, onDone }) {
  useEffect(() => { if (!text) return; const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [text, onDone]);
  if (!text) return null;
  return <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 text-sm shadow-lg max-w-[calc(100%-32px)]">{text}</div>;
}

function Dialog({ title, onClose, children }) {
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`${card} w-full max-w-lg p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto`}>
        <h3 className="font-display font-bold text-xl">{title}</h3>
        {children}
      </div>
    </div>
  );
}

// ---------------- Daten ----------------
const usd = (n) => (n == null ? "–" : new Intl.NumberFormat("de-AT", { style: "currency", currency: "USD" }).format(Number(n)));
function useWerkstattDaten(me, projektId) {
  const leer = { projekte: [], mitglieder: [], bereiche: [], gruppen: [], features: [], auftraege: [], benutzer: [], rechte: [], pcs: [], verbrauch: [], gesamt: 0, einstellungen: null, abo: [] };
  const [d, setD] = useState(leer);
  const [laden, setLaden] = useState(true);
  const timer = useRef(null);
  const holen = useCallback(async () => {
    const [pj, mg, u, r, p, e, vm, vg, ab] = await Promise.all([
      supabase.from("ws_projekte").select("*").eq("archiviert", false).order("name"),
      supabase.from("ws_projekt_mitglieder").select("*"),
      supabase.from("ws_benutzer").select("*").order("name"),
      supabase.from("ws_rechte").select("*"),
      supabase.from("ws_werkstatt_pcs").select("*").order("name"),
      supabase.from("ws_einstellungen").select("*").maybeSingle(),
      supabase.rpc("ws_verbrauch_monat"),
      supabase.rpc("ws_verbrauch_gesamt_monat"),
      supabase.from("ws_abo_limits").select("*"),
    ]);
    const pid = projektId || pj.data?.[0]?.id;
    let b = [], g = [], f = [], a = [];
    if (pid) {
      b = (await supabase.from("ws_bereiche").select("*").eq("projekt_id", pid).order("reihenfolge")).data || [];
      const bids = b.map((x) => x.id);
      g = bids.length ? (await supabase.from("ws_gruppen").select("*").in("bereich_id", bids).order("reihenfolge")).data || [] : [];
      const gids = g.map((x) => x.id);
      if (gids.length) {
        f = (await supabase.from("ws_features").select("*").in("gruppe_id", gids).order("id")).data || [];
        a = (await supabase.from("ws_auftraege").select("*").in("gruppe_id", gids).neq("stand", "abgebrochen").order("id")).data || [];
      }
    }
    setD({ projekte: pj.data || [], mitglieder: mg.data || [], bereiche: b, gruppen: g, features: f, auftraege: a, benutzer: u.data || [], rechte: r.data || [],
      pcs: p.data || [], einstellungen: e.data || null, verbrauch: vm.data || [], gesamt: Number(vg.data || 0), abo: ab.data || [], projektId: pid });
    setLaden(false);
  }, [projektId]);
  useEffect(() => {
    if (!me) return undefined;
    setLaden(true); holen();
    const ch = supabase.channel("cs-zentrale-" + (projektId || "start"));
    ["ws_projekte", "ws_projekt_mitglieder", "ws_gruppen", "ws_features", "ws_auftraege", "ws_benutzer", "ws_rechte", "ws_werkstatt_pcs", "ws_verbrauch", "ws_einstellungen", "ws_abo_limits"].forEach((t) =>
      ch.on("postgres_changes", { event: "*", schema: "public", table: t }, () => { clearTimeout(timer.current); timer.current = setTimeout(holen, 300); }));
    ch.subscribe();
    return () => { supabase.removeChannel(ch); clearTimeout(timer.current); };
  }, [me, holen, projektId]);
  return { ...d, laden, holen };
}

function useAuftragDetails(ids) {
  const [n, setN] = useState([]); const [log, setLog] = useState([]); const [erl, setErl] = useState([]);
  const key = ids.join(",");
  useEffect(() => {
    if (!ids.length) { setN([]); setLog([]); setErl([]); return undefined; }
    let aus = false;
    const holen = async () => {
      const [a, b, c] = await Promise.all([
        supabase.from("ws_nachrichten").select("*").in("auftrag_id", ids).order("id"),
        supabase.from("ws_live_log").select("*").in("auftrag_id", ids).order("id"),
        supabase.from("ws_erlaubnisse").select("*").in("auftrag_id", ids).order("id"),
      ]);
      if (!aus) { setN(a.data || []); setLog(b.data || []); setErl(c.data || []); }
    };
    holen();
    const ch = supabase.channel("cs-details-" + key);
    ["ws_nachrichten", "ws_live_log", "ws_erlaubnisse"].forEach((t) => ch.on("postgres_changes", { event: "*", schema: "public", table: t }, holen));
    ch.subscribe();
    return () => { aus = true; supabase.removeChannel(ch); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { nachrichten: n, log, erlaubnisse: erl };
}

// ---------------- Hauptseite ----------------
const merke = { lies: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, schreib: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ohne Speicher */ } } };

export default function App() {
  const [sitzung, setSitzung] = useState(undefined);
  const [ich, setIch] = useState(undefined);
  const [ansicht, setAnsicht] = useState("zentrale");
  const [projekt, setProjekt] = useState(() => merke.lies("cs-projekt"));
  const [toast, setToast] = useState("");
  const [neuesProjekt, setNeuesProjekt] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSitzung(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSitzung(s || null));
    return () => sub.subscription.unsubscribe();
  }, []);
  const ladeIch = useCallback(async () => {
    if (!sitzung) { setIch(null); return; }
    const { data } = await supabase.from("ws_benutzer").select("*").eq("id", sitzung.user.id).maybeSingle();
    setIch(data && data.aktiv ? data : null);
  }, [sitzung]);
  useEffect(() => { if (sitzung !== undefined) ladeIch(); }, [sitzung, ladeIch]);

  const daten = useWerkstattDaten(ich, projekt);
  const waehle = (id) => { setProjekt(id); merke.schreib("cs-projekt", id); };

  if (sitzung === undefined || (sitzung && ich === undefined)) return <Zentriert><Loader2 className="w-6 h-6 animate-spin text-emerald-700" /></Zentriert>;
  if (!sitzung) return <Anmelden />;
  if (!ich) return <EinladungAnnehmen sitzung={sitzung} onFertig={ladeIch} />;

  const nav = [["zentrale", "Auftrags-Zentrale", Inbox], ["vorschau", "Live-Vorschau", Eye], ["_", "Ablauf"], ["zweige", "Zweige & Versionen", GitBranch], ["pruef", "Prüfstand", ShieldCheck], ["wissen", "Wissensdatenbank", BookOpen], ["_", "Dokumentation"], ["log", "Änderungsprotokoll", History], ["doku", "Dokumentation", Download], ["_", "Verwaltung"], ["benutzer", "Benutzer & Rechte", KeyRound], ["verbrauch", "Verbrauch & Limits", Gauge]];
  const offen = daten.auftraege.filter((a) => a.stand === "frage").length;
  const aktuell = daten.projekte.find((p) => p.id === daten.projektId);
  const PIcon = WS_ICON[aktuell?.symbol] || Layers;

  return (
    <div className="min-h-screen grid md:grid-cols-[248px_minmax(0,1fr)] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-body">
      <aside className="bg-[#0f2a22] text-emerald-50 flex md:flex-col gap-1 p-3 md:sticky md:top-0 md:h-screen overflow-x-auto">
        <div className="flex items-center gap-2.5 px-2 pb-0 md:pb-3">
          <span className="w-9 h-9 rounded-lg bg-emerald-500 text-emerald-950 grid place-items-center"><Hammer className="w-5 h-5" /></span>
          <div className="hidden md:block leading-tight"><b className="font-display text-[19px] tracking-wide">Codeschmiede</b><div className="text-xs text-emerald-200/70">Deine Apps. Ein Ort.</div></div>
        </div>
        <div className="hidden md:block mb-2">
          <label htmlFor="cs-projekt" className="text-[11px] uppercase tracking-widest text-emerald-200/60 px-2.5">Projekt</label>
          <div className="mt-1 flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-2">
            <PIcon className="w-[18px] h-[18px] shrink-0" />
            <select id="cs-projekt" value={daten.projektId || ""} onChange={(e) => waehle(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none [&>option]:text-slate-900">
              {daten.projekte.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {ich.rolle === "admin" && <button type="button" onClick={() => setNeuesProjekt(true)} className="mt-1 w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-emerald-200 hover:bg-white/5"><FolderPlus className="w-4 h-4" />Neues Projekt</button>}
        </div>
        <nav className="flex md:flex-col gap-0.5" aria-label="Programm-Menü">
          {nav.map(([id, t, Icon], i) => id === "_" ? <div key={i} className="hidden md:block text-[11px] uppercase tracking-widest text-emerald-200/60 px-2.5 pt-3 pb-1">{t}</div> : (
            <button key={id} type="button" aria-current={ansicht === id} onClick={() => setAnsicht(id)}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm whitespace-nowrap text-left ${ansicht === id ? "bg-emerald-400/15 text-white font-semibold" : "hover:bg-white/5"}`}>
              <Icon className="w-[18px] h-[18px]" />{t}{id === "zentrale" && offen > 0 && <span className="ml-auto text-[11px] font-bold bg-amber-500 text-amber-950 rounded-full px-1.5">{offen}</span>}
            </button>))}
        </nav>
        <div className="hidden md:flex mt-auto items-center gap-2.5 p-2.5 rounded-xl bg-white/5 text-sm">
          <span className="w-8 h-8 rounded-full bg-emerald-500 text-emerald-950 grid place-items-center text-xs font-bold">{ich.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}</span>
          <div className="min-w-0 flex-1">{ich.name}<div className="text-xs text-emerald-200/70">{ROLLEN[ich.rolle]}</div></div>
          <button type="button" title="Abmelden" onClick={() => supabase.auth.signOut()} className="p-1.5 rounded-lg hover:bg-white/10"><Power className="w-4 h-4" /></button>
        </div>
      </aside>
      <main className="min-w-0 px-4 md:px-6 pb-10">
        <div className="flex flex-wrap items-center gap-3 py-3.5 border-b border-slate-200 dark:border-slate-800 mb-5">
          <h1 className="font-display font-bold text-2xl">{nav.find((n) => n[0] === ansicht)?.[1]}</h1>
          <span className="text-sm text-slate-500">{aktuell?.name}</span>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><i className="w-2 h-2 rounded-full bg-green-600" />Live synchronisiert</span>
          <div className="ml-auto flex items-center gap-3 flex-wrap">
            <VerbrauchKurz d={daten} ich={ich} onClick={() => setAnsicht("verbrauch")} />
            <WerkstattSchalter ich={ich} sitzung={sitzung} d={daten} toast={setToast} />
          </div>
        </div>
        {daten.laden ? <div className="grid place-items-center py-20"><Loader2 className="w-6 h-6 animate-spin text-emerald-700" /></div>
          : !daten.projektId ? <div className={`${card} p-8 text-slate-500`}>Du bist noch keinem Projekt zugeordnet. Der Admin nimmt dich in ein Projekt auf.</div>
          : ansicht === "zentrale" ? <Zentrale key={daten.projektId} d={daten} ich={ich} toast={setToast} />
          : ansicht === "benutzer" ? <BenutzerRechte d={daten} ich={ich} toast={setToast} />
          : ansicht === "verbrauch" ? <Verbrauch d={daten} ich={ich} toast={setToast} />
          : <Spaeter ansicht={ansicht} />}
      </main>
      {neuesProjekt && <NeuesProjekt toast={setToast} onClose={() => setNeuesProjekt(false)} onFertig={(id) => waehle(id)} />}
      <Toast text={toast} onDone={() => setToast("")} />
    </div>
  );
}

function Zentriert({ children }) {
  return <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 font-body p-6"><div className="flex flex-col items-center gap-3 text-center max-w-sm">{children}</div></div>;
}

function EinladungAnnehmen({ sitzung, onFertig }) {
  const [name, setName] = useState(sitzung.user.user_metadata?.full_name || "");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const los = async () => {
    if (!name.trim()) return;
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("ws_einladung_annehmen", { p_name: name.trim() });
    setBusy(false);
    if (error) setErr(fehler(error)); else onFertig();
  };
  return (
    <Zentriert>
      <Hammer className="w-8 h-8 text-emerald-700" />
      <h1 className="font-display font-bold text-2xl">Codeschmiede</h1>
      <p className="text-sm">Hast du eine Einladung bekommen? Gib deinen Namen ein (Vorname Nachname) und tritt bei.</p><button type="button" className="text-xs text-slate-500 underline" onClick={() => supabase.auth.signOut()}>Mit anderem Konto anmelden</button>
      <input id="ws-name" className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Vorname Nachname" />
      <button type="button" className={`${btn} w-full`} disabled={busy} onClick={los}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Einladung annehmen</button>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </Zentriert>
  );
}

function Spaeter({ ansicht }) {
  const t = { vorschau: "Live-Vorschau mit Zeigen & kommentieren kommt in Schritt 3.", zweige: "Zweige & Versionen wird in Schritt 4 übernommen.", pruef: "Prüfstand wird in Schritt 4 übernommen.", wissen: "Wissensdatenbank wird in Schritt 4 übernommen.", log: "Änderungsprotokoll wird in Schritt 4 übernommen.", doku: "Dokumentation zum Herunterladen wird in Schritt 4 übernommen." }[ansicht];
  return <div className={`${card} p-8 text-slate-500 flex items-center gap-3`}><Info className="w-5 h-5" />{t}</div>;
}

// ---------------- Zentrale ----------------
function Zentrale({ d, ich, toast }) {
  const [sel, setSel] = useState({ g: d.gruppen[0]?.id, f: null });
  const [dlg, setDlg] = useState(null);
  const rolle = ich.rolle === "admin" ? "admin" : d.mitglieder.find((m) => m.projekt_id === d.projektId && m.benutzer_id === ich.id)?.rolle;
  const darf = useCallback((bereich, recht) => rolle === "admin" || d.rechte.some((r) => r.benutzer_id === ich.id && r.bereich_id === bereich && r[recht] && (recht === "auftraege" ? ["entwickler", "texter"].includes(rolle) : rolle === "entwickler")), [d.rechte, ich, rolle]);
  const g = d.gruppen.find((x) => x.id === sel.g) || d.gruppen[0];
  const feats = d.features.filter((f) => f.gruppe_id === g?.id && !f.ausgebaut);
  const f = sel.f ? d.features.find((x) => x.id === sel.f) : null;
  const aufFor = (gid, fid) => d.auftraege.filter((a) => a.gruppe_id === gid && (fid === undefined || a.feature_id === fid));
  const zaehl = (s) => d.auftraege.filter((a) => a.stand === s).length;
  if (!g) return <div className={`${card} p-8 text-slate-500`}>Noch keine Gruppen angelegt.</div>;
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-3">
        {[["frage", "Rückfragen an dich", "bg-amber-500"], ["laeuft", "In Arbeit", "bg-blue-600"], ["wartet", "Warteschlange", "bg-slate-300"], ["freigabe", "Zur Freigabe", "bg-green-600"]].map(([s, t, c]) => (
          <div key={s} className={`${card} flex items-center gap-2 px-3 py-2`}><i className={`w-2.5 h-2.5 rounded-full ${c}`} /><b className="font-display text-xl tabular-nums">{zaehl(s)}</b><span className="text-sm text-slate-500">{t}</span></div>))}
      </div>
      <div className={`${card} grid grid-cols-3 md:grid-cols-6 mb-5`}>
        {STEPS.map(([s, t], i) => <div key={s} className="px-3.5 py-2.5 border-l first:border-l-0 border-slate-200 dark:border-slate-800"><div className="text-xs text-slate-500">{t}</div><b className="font-display text-xl tabular-nums">{d.auftraege.filter((a) => STEP_IDX[a.stand] === i).length}</b></div>)}
      </div>
      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_400px] items-start">
        <nav className={`${card} overflow-hidden`} aria-label="Bereiche und Gruppen">
          {d.bereiche.map((b) => (
            <div key={b.id} className="border-t first:border-t-0 border-slate-200 dark:border-slate-800 pb-1">
              <div className="font-display font-semibold text-xs uppercase tracking-widest text-slate-500 px-4 pt-3 pb-1">{b.name}</div>
              {d.gruppen.filter((x) => x.bereich_id === b.id).map((x) => {
                const Icon = WS_ICON[x.symbol] || Layers; const js = aufFor(x.id); const arbeitet = js.some((a) => a.stand === "laeuft"); const fr = js.filter((a) => a.stand === "frage").length;
                return (
                  <button key={x.id} type="button" aria-current={g.id === x.id} onClick={() => setSel({ g: x.id, f: null })}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-[15px] ${g.id === x.id ? "bg-emerald-50 dark:bg-emerald-950/40 font-semibold shadow-[inset_3px_0_0_#047857]" : "hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20"}`}>
                    <Icon className="w-[18px] h-[18px] shrink-0" /><span className="min-w-0 truncate">{x.name}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {arbeitet && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600"><i className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />arbeitet</span>}
                      {fr > 0 && <span className="text-[11px] font-semibold bg-amber-100 text-amber-700 rounded-full px-1.5">{fr} Frage{fr > 1 ? "n" : ""}</span>}
                      <span className="text-xs text-slate-400 tabular-nums">{d.features.filter((y) => y.gruppe_id === x.id && !y.ausgebaut).length}</span>
                    </span>
                  </button>);
              })}
            </div>))}
          {ich.rolle === "admin" && <button type="button" onClick={() => setDlg({ art: "gruppe" })} className="w-full flex items-center gap-2 px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 text-emerald-700 font-semibold text-sm"><Plus className="w-4 h-4" />Neue Gruppe</button>}
        </nav>

        <section className={card}>
          <div className="flex flex-wrap gap-3 items-start justify-between p-4 border-b border-slate-200 dark:border-slate-800">
            <div className="min-w-0">
              <div className="text-xs text-slate-500">{d.bereiche.find((b) => b.id === g.bereich_id)?.name}</div>
              <h2 className="font-display font-bold text-2xl">{g.name}</h2>
              <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1"><Bot className="w-4 h-4" />Werkstatt {g.name} · <code className="text-xs">docs/gruppen/{g.id}.md</code></div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {darf(g.bereich_id, "auftraege") && <button type="button" className={ghost} onClick={() => setDlg({ art: "feature" })}><Plus className="w-4 h-4" />Neues Feature</button>}
              <button type="button" className={btn} onClick={() => setSel({ g: g.id, f: null })}><MessageSquare className="w-4 h-4" />Auftrag an die Gruppe</button>
            </div>
          </div>
          <div className="grid gap-3 p-4 grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
            {feats.length === 0 && <div className="text-sm text-slate-500 col-span-full py-6 text-center">In dieser Gruppe gibt es noch keine Features.</div>}
            {feats.map((x) => {
              const js = aufFor(g.id, x.id); const arbeitet = js.some((a) => a.stand === "laeuft"); const neu = x.neu_bis && new Date(x.neu_bis) > new Date();
              return (
                <button key={x.id} type="button" aria-current={sel.f === x.id} onClick={() => setSel({ g: g.id, f: x.id })}
                  className={`text-left flex flex-col gap-2 rounded-xl border p-3.5 min-w-0 ${x.ausgeblendet ? "opacity-55" : ""} ${sel.f === x.id ? "border-emerald-600 ring-1 ring-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" : "border-slate-200 dark:border-slate-800 hover:border-emerald-600"} ${arbeitet ? "shadow-[inset_0_3px_0_#2563eb]" : ""}`}>
                  <div className="flex items-start justify-between gap-2"><h3 className="font-display font-semibold text-[17px] leading-tight">{x.name}</h3>
                    <span className="flex gap-1 flex-wrap justify-end">{x.ausgeblendet && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md border border-dashed border-slate-400 text-slate-500">Ausgeblendet</span>}{neu && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-700 text-white">Neu</span>}<Badge stand={x.stand} /></span></div>
                  {x.beschreibung && <p className="text-[13px] text-slate-500 line-clamp-2">{x.beschreibung}</p>}
                  <div className="mt-auto text-xs text-slate-500 flex items-center gap-1.5">
                    {arbeitet ? <span className="inline-flex items-center gap-1.5 font-semibold text-blue-600"><i className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />Hier wird gerade gearbeitet</span>
                      : js.length ? <span>Auftrag #{js[js.length - 1].id}: {STEPS[STEP_IDX[js[js.length - 1].stand]]?.[1]}</span> : <><MessageSquare className="w-3.5 h-3.5" />Auftrag geben</>}
                    <span className="ml-auto font-mono text-[10px] text-slate-400">{x.id}</span>
                  </div>
                </button>);
            })}
          </div>
        </section>

        <AuftragsChat g={g} f={f} d={d} ich={ich} darf={darf} toast={toast} onLoeschen={() => setDlg({ art: "loeschen", f })} />
      </div>
      {dlg?.art === "feature" && <NeuesFeature g={g} ich={ich} texter={rolle === "texter"} toast={toast} onClose={() => setDlg(null)} onFertig={(id) => setSel({ g: g.id, f: id })} />}
      {dlg?.art === "gruppe" && <NeueGruppe d={d} ich={ich} toast={toast} onClose={() => setDlg(null)} onFertig={(id) => setSel({ g: id, f: null })} />}
      {dlg?.art === "loeschen" && <Loeschen f={dlg.f} g={g} ich={ich} toast={toast} onClose={() => setDlg(null)} />}
    </>
  );
}

function AuftragsChat({ g, f, d, ich, darf, toast, onLoeschen }) {
  const auftraege = d.auftraege.filter((a) => a.gruppe_id === g.id && (!f || a.feature_id === f.id));
  const ids = auftraege.map((a) => a.id);
  const { nachrichten, log, erlaubnisse } = useAuftragDetails(ids);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [tab, setTab] = useState("gespraech");
  const laufend = auftraege.find((a) => a.stand === "laeuft");
  const frage = auftraege.find((a) => a.stand === "frage");
  const kannAuftrag = darf(g.bereich_id, "auftraege");
  const kannFrei = darf(g.bereich_id, "freigeben");
  const name = (id) => d.benutzer.find((u) => u.id === id)?.name || "Mitglied";
  useEffect(() => { if (!laufend) setTab("gespraech"); }, [laufend]);

  const senden = async () => {
    const t = text.trim(); if (!t) return; setBusy(true);
    try {
      if (frage) {
        const { error } = await supabase.from("ws_nachrichten").insert({ auftrag_id: frage.id, von: ich.id, art: "text", text: t });
        if (error) throw error; toast("Antwort an die Werkstatt gesendet");
      } else {
        const istTexter = d.mitglieder.some((m) => m.projekt_id === d.projektId && m.benutzer_id === ich.id && m.rolle === "texter");
        const { data, error } = await supabase.from("ws_auftraege").insert({ gruppe_id: g.id, feature_id: f?.id || null, titel: t.length > 80 ? t.slice(0, 78) + "…" : t, art: istTexter ? "text" : "aendern", erstellt_von: ich.id }).select().single();
        if (error) throw error;
        const r = await supabase.from("ws_nachrichten").insert({ auftrag_id: data.id, von: ich.id, art: "text", text: t });
        if (r.error) throw r.error; toast(`Auftrag #${data.id} an Werkstatt ${g.name} gestellt`);
      }
      setText("");
    } catch (e) { toast(fehler(e)); } finally { setBusy(false); }
  };
  const freigeben = async (a) => { const { error } = await supabase.rpc("ws_freigeben", { p_auftrag: a.id }); toast(error ? fehler(error) : `Freigegeben: ${a.zweig}`); };
  const erlauben = async (e, s) => { const { error } = await supabase.rpc("ws_erlaubnis_entscheiden", { p_id: e.id, p_status: s }); toast(error ? fehler(error) : s === "abgelehnt" ? "Abgelehnt" : "Erlaubt"); };
  const offeneErl = erlaubnisse.filter((e) => e.status === "offen");

  return (
    <aside className={`${card} flex flex-col lg:col-span-2 xl:col-span-1 xl:sticky xl:top-3 xl:max-h-[calc(100vh-24px)]`} aria-label="Auftrags-Chat">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 font-display font-bold text-lg">{f ? <Layers className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}{f ? f.name : g.name}</div>
        <div className="text-sm text-slate-500 mt-0.5 flex gap-2 items-center flex-wrap"><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{f ? "Feature" : "Ganze Gruppe"}</span>geht an Werkstatt {g.name}</div>
        <div className="flex gap-2 flex-wrap mt-2">
          {laufend && <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden text-sm">
            {[["gespraech", "Gespräch"], ["live", "Live mitsehen"]].map(([k, t]) => <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={`px-3 py-1.5 inline-flex items-center gap-1.5 ${tab === k ? "bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-950" : ""}`}>{k === "live" && <i className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />}{t}</button>)}
          </div>}
          {f && darf(g.bereich_id, "loeschen") && <button type="button" className={`${ghost} h-8 text-xs`} onClick={onLoeschen}><Trash2 className="w-3.5 h-3.5" />{f.ausgeblendet ? "Wieder einblenden" : "Feature löschen …"}</button>}
        </div>
      </div>
      {tab === "live" && laufend ? (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 text-[13px] min-h-[240px]" aria-live="polite">
          {log.filter((l) => l.auftrag_id === laufend.id).map((l) => (
            <div key={l.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2"><time className="text-xs text-slate-400 tabular-nums">{new Date(l.erstellt).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })}</time>
              <div className="min-w-0"><span>{l.text}</span>{l.ausschnitt && <pre className="mt-1 font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 overflow-x-auto">{l.ausschnitt.split("\n").map((z, i) => <span key={i} className={z.startsWith("+") ? "text-green-600" : z.startsWith("-") ? "text-red-600" : ""}>{z + "\n"}</span>)}</pre>}</div></div>))}
          {offeneErl.filter((e) => e.auftrag_id === laufend.id).map((e) => <ErlaubnisKarte key={e.id} e={e} g={g} kann={kannFrei} onEntscheid={erlauben} />)}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 min-h-[220px]" aria-live="polite">
          {auftraege.length === 0 && <div className="text-sm text-slate-500 text-center py-8">{f ? `Noch kein Auftrag zu „${f.name}“.` : `Noch kein Auftrag für ${g.name}.`} Beschreibe unten, was sich ändern soll.<br /><span className="text-xs">Bitte keine Daten von Vereinsmitgliedern hineinschreiben.</span></div>}
          {auftraege.map((a) => (
            <React.Fragment key={a.id}>
              <div className="self-center text-xs text-slate-500 text-center">Auftrag #{a.id}: {a.titel}</div>
              <div className="flex gap-1 flex-wrap">{STEPS.map(([s, t], i) => { const n = STEP_IDX[a.stand]; return <span key={s} className={`flex-1 min-w-[70px] text-[10px] font-semibold text-center px-1 py-0.5 rounded ${i < n || (n === 5 && i === 5) ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" : i === n ? "bg-blue-600 text-white" : "border border-slate-200 dark:border-slate-800 text-slate-400"}`}>{t}</span>; })}</div>
              {nachrichten.filter((m) => m.auftrag_id === a.id).map((m) => (
                <div key={m.id} className={`max-w-[88%] rounded-xl px-3 py-2 text-sm ${m.von ? "self-end bg-emerald-50 dark:bg-emerald-950/50" : m.art === "frage" ? "self-start bg-amber-50 border border-amber-400 dark:bg-amber-950/40" : "self-start bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"}`}>
                  <div className="text-[11px] font-semibold text-slate-500">{m.von ? name(m.von) : `Werkstatt ${g.name}`} · {fmt(m.erstellt)}{m.art === "frage" ? " · Rückfrage" : ""}</div>
                  <div className="whitespace-pre-wrap break-words">{m.text}</div>
                </div>))}
              {offeneErl.filter((e) => e.auftrag_id === a.id).map((e) => <ErlaubnisKarte key={e.id} e={e} g={g} kann={kannFrei} onEntscheid={erlauben} />)}
              {a.stand === "freigabe" && (
                <div className="rounded-xl border border-green-600 p-3 text-sm flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-mono text-xs"><GitPullRequest className="w-4 h-4" />PR #{a.pr_nummer} · {a.zweig}</div>
                  {kannFrei ? <FreigabeKnopf a={a} onJa={() => freigeben(a)} /> : <div className="text-xs text-slate-500">Freigeben darf der Admin oder wer das Recht „Freigeben“ hat.</div>}
                </div>)}
            </React.Fragment>))}
        </div>
      )}
      {kannAuftrag ? (
        <div className="border-t border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-2">
          <textarea id="ws-auftrag" className={`${input} min-h-[72px]`} value={text} onChange={(e) => setText(e.target.value)} placeholder={frage ? "Antwort auf die Rückfrage …" : f ? `Was soll sich bei „${f.name}“ ändern?` : `Was soll sich in ${g.name} ändern?`} aria-label="Nachricht" />
          <div className="flex items-center justify-between gap-2 flex-wrap"><span className="text-xs text-slate-500">{frage ? "Antwort geht an den laufenden Auftrag" : laufend ? "Neuer Auftrag kommt in die Warteschlange" : "Wird vom nächsten freien Werkstatt-PC übernommen"}</span>
            <button type="button" className={btn} disabled={busy || !text.trim()} onClick={senden}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{frage ? "Antworten" : "Senden"}</button></div>
        </div>
      ) : <div className="border-t border-slate-200 dark:border-slate-800 p-4 text-xs text-slate-500">Für diesen Bereich hast du kein Recht, Aufträge zu geben.</div>}
    </aside>
  );
}

function ErlaubnisKarte({ e, g, kann, onEntscheid }) {
  return (
    <div className="rounded-xl border border-red-500 bg-red-50 dark:bg-red-950/30 p-3 text-sm flex flex-col gap-2">
      <div className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Werkstatt {g.name} bittet um Erlaubnis</div>
      <code className="block font-mono text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1.5 break-words">{e.werkzeug}: {e.eingabe}</code>
      {e.grund && <div>{e.grund}</div>}
      {kann ? <div className="flex gap-2 flex-wrap">
        <button type="button" className={`${btn} h-8 text-sm`} onClick={() => onEntscheid(e, "einmal")}>Einmal erlauben</button>
        {!String(e.grund || "").startsWith("Führt Code aus") && <button type="button" className={`${ghost} h-8`} onClick={() => onEntscheid(e, "immer")}>Immer erlauben in {g.name}</button>}
        <button type="button" className={`${ghost} h-8`} onClick={() => onEntscheid(e, "abgelehnt")}>Ablehnen</button>
      </div> : <div className="text-xs text-slate-500">Erlauben darf der Admin oder wer das Recht „Freigeben“ hat.</div>}
    </div>
  );
}

function FreigabeKnopf({ a, onJa }) {
  const [frag, setFrag] = useState(false);
  if (!frag) return <button type="button" className={`${btn} h-9 text-sm self-start`} onClick={() => setFrag(true)}><Check className="w-4 h-4" />Freigeben & zusammenführen</button>;
  return (
    <div className="flex flex-col gap-2"><span>Zweig <code className="font-mono text-xs">{a.zweig}</code> in main zusammenführen und auf trainer-to-go.at veröffentlichen? Danach folgen Sicherheitsprüfung und Wissensdatenbank automatisch.</span>
      <div className="flex gap-2"><button type="button" className={`${btn} h-9 text-sm`} onClick={onJa}>Ja, zusammenführen</button><button type="button" className={`${ghost} h-9`} onClick={() => setFrag(false)}>Abbrechen</button></div></div>
  );
}

function NeuesFeature({ g, ich, texter, toast, onClose, onFertig }) {
  const [name, setName] = useState(""); const [besch, setBesch] = useState(""); const [auftrag, setAuftrag] = useState(true); const [busy, setBusy] = useState(false);
  const los = async () => {
    if (!name.trim()) return; setBusy(true);
    const id = "N-" + Date.now();
    const { error } = await supabase.from("ws_features").insert({ id, gruppe_id: g.id, name: name.trim(), beschreibung: besch.trim() || null, stand: "geplant", quelle: "manuell", neu_bis: new Date(Date.now() + 7 * 864e5).toISOString(), erstellt_von: ich.id });
    if (error) { setBusy(false); toast(fehler(error)); return; }
    if (auftrag) {
      const t = `Neues Feature bauen: ${name.trim()}${besch.trim() ? " – " + besch.trim() : ""}`;
      const r = await supabase.from("ws_auftraege").insert({ gruppe_id: g.id, feature_id: id, titel: t.slice(0, 80), art: texter ? "text" : "neu", erstellt_von: ich.id }).select().single();
      if (!r.error) await supabase.from("ws_nachrichten").insert({ auftrag_id: r.data.id, von: ich.id, art: "text", text: t });
    }
    setBusy(false); toast(`Feature „${name.trim()}“ angelegt`); onFertig(id); onClose();
  };
  return (
    <Dialog title={`Neues Feature in ${g.name}`} onClose={onClose}>
      <label className="flex flex-col gap-1 text-sm text-slate-500">Name<input id="ws-fname" className={input} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
      <label className="flex flex-col gap-1 text-sm text-slate-500">Was soll das Feature können?<textarea id="ws-fdesc" className={`${input} min-h-[70px]`} value={besch} onChange={(e) => setBesch(e.target.value)} /></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={auftrag} onChange={(e) => setAuftrag(e.target.checked)} className="mt-1 accent-emerald-700" />Gleich als Auftrag an die Werkstatt geben (sonst bleibt es „Geplant“)</label>
      <div className="flex justify-end gap-2"><button type="button" className={ghost} onClick={onClose}>Abbrechen</button><button type="button" className={btn} disabled={busy || !name.trim()} onClick={los}>Anlegen</button></div>
    </Dialog>
  );
}

function NeueGruppe({ d, ich, toast, onClose, onFertig }) {
  const [name, setName] = useState(""); const [bereich, setBereich] = useState(d.bereiche[0]?.id); const [symbol, setSymbol] = useState("layers"); const [busy, setBusy] = useState(false);
  const los = async () => {
    if (!name.trim()) return; setBusy(true);
    const slug = name.trim().toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "gruppe-" + Date.now();
    const id = `${d.projektId}-${slug}`;
    const { error } = await supabase.from("ws_gruppen").insert({ id, bereich_id: bereich, name: name.trim(), symbol, reihenfolge: 99, erstellt_von: ich.id });
    setBusy(false);
    if (error) { toast(fehler(error)); return; }
    toast(`Gruppe „${name.trim()}“ angelegt`); onFertig(id); onClose();
  };
  return (
    <Dialog title="Neue Gruppe" onClose={onClose}>
      <label className="flex flex-col gap-1 text-sm text-slate-500">Name<input id="ws-gname" className={input} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
      <label className="flex flex-col gap-1 text-sm text-slate-500">Bereich<select id="ws-gbereich" className={input} value={bereich} onChange={(e) => setBereich(e.target.value)}>{d.bereiche.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm text-slate-500">Symbol<select id="ws-gsymbol" className={input} value={symbol} onChange={(e) => setSymbol(e.target.value)}>{Object.keys(WS_ICON).map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
      <p className="text-xs text-slate-500">Die Gruppe bekommt eine eigene Werkstatt mit Gruppenwissen in docs/gruppen/.</p>
      <div className="flex justify-end gap-2"><button type="button" className={ghost} onClick={onClose}>Abbrechen</button><button type="button" className={btn} disabled={busy || !name.trim()} onClick={los}>Anlegen</button></div>
    </Dialog>
  );
}

function Loeschen({ f, g, ich, toast, onClose }) {
  const [art, setArt] = useState("aus"); const [best, setBest] = useState(""); const [busy, setBusy] = useState(false);
  const einblenden = f.ausgeblendet;
  const los = async () => {
    setBusy(true);
    if (einblenden || art === "aus") {
      const { error } = await supabase.rpc("ws_feature_ausblenden", { p_feature: f.id, p_aus: !einblenden });
      toast(error ? fehler(error) : einblenden ? `„${f.name}“ wieder eingeblendet` : `„${f.name}“ ausgeblendet`);
    } else {
      const t = `Feature ausbauen: ${f.name} (Daten vorher sichern, Handbuch, PDF-Layouts und Funktionsverzeichnis bereinigen)`;
      const r = await supabase.from("ws_auftraege").insert({ gruppe_id: g.id, feature_id: f.id, titel: t.slice(0, 80), art: "ausbauen", erstellt_von: ich.id }).select().single();
      if (!r.error) await supabase.from("ws_nachrichten").insert({ auftrag_id: r.data.id, von: ich.id, art: "text", text: t });
      toast(r.error ? fehler(r.error) : `Ausbau-Auftrag #${r.data.id} gestellt`);
    }
    setBusy(false); onClose();
  };
  if (einblenden) return (
    <Dialog title={`„${f.name}“ wieder einblenden?`} onClose={onClose}>
      <div className="flex justify-end gap-2"><button type="button" className={ghost} onClick={onClose}>Abbrechen</button><button type="button" className={btn} disabled={busy} onClick={los}>Einblenden</button></div>
    </Dialog>);
  return (
    <Dialog title={`„${f.name}“ löschen`} onClose={onClose}>
      {[["aus", "Ausblenden", "Sofort abgeschaltet. Der Code bleibt, jederzeit wieder einblendbar."], ["ausbau", "Aus der App ausbauen", "Auftrag über den ganzen Weg bis zur Freigabe. Daten werden vorher gesichert. Über die Versionen wiederherstellbar."]].map(([k, t, s]) => (
        <label key={k} className={`flex gap-3 items-start rounded-xl border p-3 cursor-pointer ${art === k ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" : "border-slate-200 dark:border-slate-800"}`}>
          <input type="radio" name="ws-del" checked={art === k} onChange={() => setArt(k)} className="mt-1 accent-emerald-700" /><span><b className="block">{t}</b><span className="text-sm text-slate-500">{s}</span></span></label>))}
      <label className="flex flex-col gap-1 text-sm text-slate-500">Zur Bestätigung den Namen eintippen: {f.name}<input id="ws-delname" className={input} value={best} onChange={(e) => setBest(e.target.value)} autoComplete="off" /></label>
      <div className="flex justify-end gap-2"><button type="button" className={ghost} onClick={onClose}>Abbrechen</button><button type="button" className={`${btn} bg-red-600 hover:bg-red-700`} disabled={busy || best.trim() !== f.name} onClick={los}>Löschen</button></div>
    </Dialog>
  );
}

// ---------------- Benutzer & Rechte ----------------
function BenutzerRechte({ d, ich, toast }) {
  const [sel, setSel] = useState(d.benutzer.find((u) => u.id !== ich.id)?.id || ich.id);
  const [einl, setEinl] = useState(false);
  const [offen, setOffen] = useState([]);
  const admin = ich.rolle === "admin";
  const ladeEinl = useCallback(async () => { if (!admin) return; const { data } = await supabase.from("ws_einladungen").select("*").eq("projekt_id", d.projektId).is("angenommen", null).order("erstellt"); setOffen(data || []); }, [admin, d.projektId]);
  useEffect(() => { ladeEinl(); }, [ladeEinl]);
  const mitglied = (uid) => d.mitglieder.find((m) => m.projekt_id === d.projektId && m.benutzer_id === uid);
  const u = d.benutzer.find((x) => x.id === sel);
  const projRolle = u ? (u.rolle === "admin" ? "admin" : mitglied(u.id)?.rolle) : null;
  const rolleSetzen = async (uid, rolle) => {
    const { error } = await supabase.rpc("ws_mitglied_setzen", { p_projekt: d.projektId, p_benutzer: uid, p_rolle: rolle || null });
    toast(error ? fehler(error) : rolle ? `Rolle im Projekt: ${ROLLEN[rolle]}` : "Aus dem Projekt entfernt");
  };
  const setzen = async (bereich, recht, wert) => {
    const r = d.rechte.find((x) => x.benutzer_id === u.id && x.bereich_id === bereich) || { auftraege: false, freigeben: false, loeschen: false };
    const n = { ...r, [recht]: wert };
    const { error } = await supabase.rpc("ws_rechte_setzen", { p_benutzer: u.id, p_bereich: bereich, p_auftraege: !!n.auftraege, p_freigeben: !!n.freigeben, p_loeschen: !!n.loeschen });
    toast(error ? fehler(error) : `${wert ? "Recht vergeben" : "Recht entzogen"}: ${BEREICH_RECHTE[recht]} · ${d.bereiche.find((b) => b.id === bereich)?.name} · ${u.name}`);
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start">
      <div className={card}>
        <div className="flex items-center justify-between gap-2 p-4"><span className="font-display font-semibold text-xs uppercase tracking-widest text-slate-500 flex items-center gap-2"><Users className="w-4 h-4" />Benutzer</span>
          {admin && <button type="button" className={`${btn} h-9 text-sm`} onClick={() => setEinl(true)}><Plus className="w-4 h-4" />Benutzer einladen</button>}</div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200 dark:border-slate-800"><th className="px-4 py-2">Name</th><th className="px-4 py-2">Rolle</th><th className="px-4 py-2">Claude-Konto</th><th className="px-4 py-2">Werkstatt-PC</th></tr></thead>
          <tbody>{d.benutzer.map((x) => { const pc = d.pcs.find((p) => p.benutzer_id === x.id); return (
            <tr key={x.id} onClick={() => setSel(x.id)} className={`cursor-pointer border-b border-slate-100 dark:border-slate-800 ${sel === x.id ? "bg-emerald-50 dark:bg-emerald-950/40" : ""}`}>
              <td className="px-4 py-2.5">{x.name}{!x.aktiv && <span className="ml-2 text-xs text-slate-400">(deaktiviert)</span>}</td>
              <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>{x.rolle === "admin" ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-700 text-white">Admin</span>
                : admin ? <select id={`cs-rolle-${x.id}`} aria-label={`Rolle von ${x.name} im Projekt`} className="text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-1.5 py-1" value={mitglied(x.id)?.rolle || ""} onChange={(e) => rolleSetzen(x.id, e.target.value)}>
                    <option value="">kein Mitglied</option>{["entwickler", "texter", "leser"].map((r) => <option key={r} value={r}>{ROLLEN[r]}</option>)}</select>
                : <span className="text-xs">{mitglied(x.id) ? ROLLEN[mitglied(x.id).rolle] : "–"}</span>}</td>
              <td className="px-4 py-2.5">{x.claude_konto || "–"}</td><td className="px-4 py-2.5">{pc ? `${pc.name} · ${pc.an ? "an" : "aus"}` : "–"}</td></tr>); })}</tbody></table></div>
        {admin && offen.length > 0 && <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-sm"><div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Offene Einladungen</div>{offen.map((e) => <div key={e.id} className="flex gap-2"><span className="break-all">{e.email}</span><span className="text-slate-500">· {ROLLEN[e.rolle]} · {fmt(e.erstellt)}</span></div>)}</div>}
      </div>
      <div className={card}>
        <div className="p-4 font-display font-semibold text-xs uppercase tracking-widest text-slate-500">Rechte · {u?.name}</div>
        {!u ? null : !projRolle ? <p className="px-4 pb-4 text-sm text-slate-500">{u.name} ist nicht Mitglied dieses Projekts. Rolle links wählen, um ihn aufzunehmen.</p> : u.rolle === "admin" ? <p className="px-4 pb-4 text-sm text-slate-500">Der Admin darf alles: Aufträge geben, freigeben, löschen, Rechte vergeben. Rechtstexte und Datenschutz ändert nur der Admin.</p>
          : projRolle === "leser" ? <p className="px-4 pb-4 text-sm text-slate-500">Leser sehen Zentrale und Dokumentation, geben aber keine Aufträge.</p> : (
          <>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-200 dark:border-slate-800"><th className="text-left px-4 py-2">Bereich</th>{Object.values(BEREICH_RECHTE).map((t) => <th key={t} className="px-3 py-2">{t}</th>)}</tr></thead>
              <tbody>{d.bereiche.map((b) => { const r = d.rechte.find((x) => x.benutzer_id === u.id && x.bereich_id === b.id) || {}; return (
                <tr key={b.id} className="border-b border-slate-100 dark:border-slate-800"><td className="px-4 py-2">{b.name}</td>
                  {Object.keys(BEREICH_RECHTE).map((k) => <td key={k} className="text-center px-3 py-2"><input id={`ws-r-${u.id}-${b.id}-${k}`} type="checkbox" className="w-[18px] h-[18px] accent-emerald-700" aria-label={`${b.name} ${BEREICH_RECHTE[k]}`}
                    checked={!!r[k]} disabled={!admin || (projRolle === "texter" && k !== "auftraege")} onChange={(e) => setzen(b.id, k, e.target.checked)} /></td>)}</tr>); })}</tbody></table></div>
            <p className="p-4 text-xs text-slate-500">{projRolle === "texter" ? "Texter geben nur Text-Aufträge. Freigeben und Löschen ist für Texter gesperrt." : "Freigeben und Löschen vergibt nur der Admin, je Bereich. Rechtstexte und Datenschutz bleiben beim Admin."}</p>
          </>)}
      </div>
      {einl && <Einladen ich={ich} projekt={d.projektId} toast={toast} onClose={() => setEinl(false)} onFertig={ladeEinl} />}
    </div>
  );
}

function Einladen({ ich, projekt, toast, onClose, onFertig }) {
  const [mail, setMail] = useState(""); const [rolle, setRolle] = useState("entwickler"); const [busy, setBusy] = useState(false);
  const gueltig = useMemo(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail.trim()), [mail]);
  const los = async () => {
    setBusy(true);
    const { error } = await supabase.from("ws_einladungen").insert({ email: mail.trim().toLowerCase(), rolle, projekt_id: projekt, eingeladen_von: ich.id });
    setBusy(false);
    if (error) { toast(fehler(error)); return; }
    toast(`Einladung für ${mail.trim()} angelegt`); onFertig(); onClose();
  };
  return (
    <Dialog title="Benutzer einladen" onClose={onClose}>
      <label className="flex flex-col gap-1 text-sm text-slate-500">E-Mail-Adresse<input id="ws-mail" type="email" className={input} value={mail} onChange={(e) => setMail(e.target.value)} autoFocus /></label>
      <label className="flex flex-col gap-1 text-sm text-slate-500">Rolle<select id="ws-rolle" className={input} value={rolle} onChange={(e) => setRolle(e.target.value)}>{["entwickler", "texter", "leser"].map((r) => <option key={r} value={r}>{ROLLEN[r]}</option>)}</select></label>
      <p className="text-xs text-slate-500">So geht es weiter: Die Person öffnet die Codeschmiede, registriert sich mit genau dieser Adresse, bestätigt die E-Mail und nimmt die Einladung an. Entwickler brauchen zusätzlich ein eigenes Claude-Abo (Claude Code auf ihrem PC angemeldet) und Zugriff auf das GitHub-Repository des Projekts.</p>
      <div className="flex justify-end gap-2"><button type="button" className={ghost} onClick={onClose}><X className="w-4 h-4" />Abbrechen</button><button type="button" className={btn} disabled={busy || !gueltig} onClick={los}>Einladung anlegen</button></div>
    </Dialog>
  );
}

// ---------------- Anmelden ----------------
function Anmelden() {
  const [modus, setModus] = useState("login");
  const [mail, setMail] = useState(""); const [pw, setPw] = useState("");
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const los = async (e) => {
    e.preventDefault(); setBusy(true); setMsg("");
    let r;
    if (modus === "login") r = await supabase.auth.signInWithPassword({ email: mail.trim(), password: pw });
    else if (modus === "neu") r = await supabase.auth.signUp({ email: mail.trim(), password: pw, options: { emailRedirectTo: window.location.origin } });
    else r = await supabase.auth.resetPasswordForEmail(mail.trim(), { redirectTo: window.location.origin });
    setBusy(false);
    if (r.error) setMsg(fehler(r.error));
    else if (modus === "neu") setMsg("Fast geschafft: Bitte bestätige den Link in der E-Mail, dann hier anmelden.");
    else if (modus === "vergessen") setMsg("Wir haben dir einen Link zum Zurücksetzen geschickt.");
  };
  return (
    <Zentriert>
      <span className="w-14 h-14 rounded-2xl bg-emerald-700 text-white grid place-items-center"><Hammer className="w-7 h-7" /></span>
      <h1 className="font-display font-bold text-3xl">Codeschmiede</h1>
      <p className="text-sm text-slate-500">Deine Apps. Ein Ort.</p>
      <form onSubmit={los} className="w-full flex flex-col gap-2.5 text-left">
        <label className="text-sm text-slate-500" htmlFor="cs-mail">E-Mail-Adresse</label>
        <input id="cs-mail" type="email" autoComplete="email" className={input} value={mail} onChange={(e) => setMail(e.target.value)} required />
        {modus !== "vergessen" && <><label className="text-sm text-slate-500" htmlFor="cs-pw">Passwort</label>
          <input id="cs-pw" type="password" autoComplete={modus === "neu" ? "new-password" : "current-password"} minLength={10} className={input} value={pw} onChange={(e) => setPw(e.target.value)} required /></>}
        <button type="submit" className={`${btn} w-full mt-1`} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}{{ login: "Anmelden", neu: "Konto anlegen", vergessen: "Link schicken" }[modus]}</button>
      </form>
      {msg && <p className="text-sm text-slate-600 dark:text-slate-300">{msg}</p>}
      <div className="flex gap-4 text-sm text-emerald-700">
        {modus !== "login" && <button type="button" onClick={() => setModus("login")}>Anmelden</button>}
        {modus !== "neu" && <button type="button" onClick={() => setModus("neu")}>Konto anlegen</button>}
        {modus !== "vergessen" && <button type="button" onClick={() => setModus("vergessen")}>Passwort vergessen</button>}
      </div>
      <p className="text-xs text-slate-400">Nur für eingeladene Mitglieder. Bitte keine Daten von Kunden oder Vereinsmitgliedern in Aufträge schreiben.</p>
    </Zentriert>
  );
}

// ---------------- Verbrauch & Limits ----------------
const uhr = (t) => (t ? new Date(t).toLocaleString("de-AT", { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "–");
const abgelaufen = (t) => t && Date.parse(t) < Date.now();
function Balken({ wert, warn, pause }) {
  const w = wert == null ? 0 : Math.min(100, wert);
  const farbe = wert >= pause ? "bg-red-600" : wert >= warn ? "bg-amber-500" : "bg-emerald-600";
  return <span className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden inline-block align-middle"><i className={`block h-full ${farbe}`} style={{ width: `${w}%` }} /></span>;
}
function aboWerte(a) {
  if (!a) return { f: null, w: null };
  return { f: abgelaufen(a.fuenf_std_reset) ? 0 : a.fuenf_std_prozent, w: abgelaufen(a.woche_reset) ? 0 : a.woche_prozent };
}

function VerbrauchKurz({ d, ich, onClick }) {
  const a = d.abo.find((x) => x.benutzer_id === ich.id);
  const { f, w } = aboWerte(a);
  const warn = d.einstellungen?.abo_klein_ab_prozent ?? 75; const pause = d.einstellungen?.abo_pause_ab_prozent ?? 95;
  const hoch = Math.max(f ?? 0, w ?? 0) >= warn;
  const p = (x) => (x == null ? "–" : `${Math.round(x)} %`);
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-2.5 rounded-xl border px-3 py-1.5 text-sm ${hoch ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"}`} title="Nutzungslimits deines Claude-Abos (laut Claude Code)">
      <Gauge className={`w-4 h-4 ${hoch ? "text-amber-600" : "text-emerald-700"}`} />
      {a ? <span className="flex items-center gap-2 tabular-nums"><span>5 Std. <b>{p(f)}</b></span><Balken wert={f} warn={warn} pause={pause} /><span>Woche <b>{p(w)}</b></span><Balken wert={w} warn={warn} pause={pause} /></span>
        : <span className="text-slate-500">Abo-Limits: noch keine Werte</span>}
    </button>
  );
}

function Verbrauch({ d, ich, toast }) {
  const e = d.einstellungen || {};
  const [klein, setKlein] = useState(e.abo_klein_ab_prozent ?? 75); const [pause, setPause] = useState(e.abo_pause_ab_prozent ?? 95);
  useEffect(() => { setKlein(e.abo_klein_ab_prozent ?? 75); setPause(e.abo_pause_ab_prozent ?? 95); }, [e.abo_klein_ab_prozent, e.abo_pause_ab_prozent]);
  const admin = ich.rolle === "admin";
  const speichern = async () => {
    const { error } = await supabase.rpc("ws_abo_schwellen_setzen", { p_klein: Number(klein), p_pause: Number(pause) });
    toast(error ? fehler(error) : "Schwellen gespeichert");
  };
  const statuszeile = async () => { try { toast(await tauri("ws_statuszeile")); } catch (x) { toast(fehler(x)); } };
  const name = (pid) => d.projekte.find((p) => p.id === pid)?.name || pid;
  const wer = (uid) => d.benutzer.find((u) => u.id === uid)?.name || "Mitglied";
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start">
      <div className="flex flex-col gap-5">
        <div className={card}>
          <div className="p-4 font-display font-semibold text-xs uppercase tracking-widest text-slate-500">Abo-Nutzungslimits (Claude)</div>
          {d.abo.length === 0 ? <p className="px-4 pb-4 text-sm text-slate-500">Noch keine Werte. Sie kommen, sobald auf einem Werkstatt-PC Claude Code mit dem Abo arbeitet oder die Statuszeile eingerichtet ist.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-t border-slate-200 dark:border-slate-800"><th className="px-4 py-2">Mitglied</th><th className="px-4 py-2">5-Stunden-Fenster</th><th className="px-4 py-2">Woche</th><th className="px-4 py-2">Stand</th></tr></thead>
              <tbody>{d.abo.map((a) => { const { f, w } = aboWerte(a); return (
                <tr key={a.benutzer_id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2.5">{wer(a.benutzer_id)}</td>
                  <td className="px-4 py-2.5 tabular-nums"><b>{f == null ? "–" : `${Math.round(f)} %`}</b> <Balken wert={f} warn={klein} pause={pause} /><div className="text-xs text-slate-500">zurück: {uhr(a.fuenf_std_reset)}</div></td>
                  <td className="px-4 py-2.5 tabular-nums"><b>{w == null ? "–" : `${Math.round(w)} %`}</b> <Balken wert={w} warn={klein} pause={pause} /><div className="text-xs text-slate-500">zurück: {uhr(a.woche_reset)}</div></td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{fmt(a.aktualisiert)}<br />{a.quelle === "statuszeile" ? "Statuszeile" : "Werkstatt"}</td>
                </tr>); })}</tbody></table></div>)}
          <p className="p-4 text-xs text-slate-500">Die Werte meldet Claude Code auf dem PC des Mitglieds; sie gelten für das ganze Abo (Chats in claude.ai und Claude Code zusammen) und sind so aktuell wie die letzte Nutzung von Claude Code.</p>
        </div>
        <div className={card}>
          <div className="p-4 font-display font-semibold text-xs uppercase tracking-widest text-slate-500">Arbeit der Werkstatt diesen Monat</div>
          <table className="w-full text-sm border-t border-slate-200 dark:border-slate-800">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-4 py-2">Projekt</th><th className="px-4 py-2 text-right">Aufträge</th><th className="px-4 py-2 text-right">Rechnerischer Wert</th></tr></thead>
            <tbody>{d.verbrauch.length === 0 ? <tr><td colSpan={3} className="px-4 py-4 text-slate-500">Noch keine Arbeit in diesem Monat.</td></tr>
              : d.verbrauch.map((v) => <tr key={v.projekt_id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-4 py-2">{name(v.projekt_id)}</td><td className="px-4 py-2 text-right tabular-nums">{v.auftraege}</td><td className="px-4 py-2 text-right tabular-nums">{usd(v.kosten_usd)}</td></tr>)}</tbody>
          </table>
          <p className="p-4 text-xs text-slate-500">Die Werkstatt arbeitet über dein Abo – es entstehen keine Extrakosten. Der rechnerische Wert zeigt, was die Arbeit über die Schnittstelle gekostet hätte.</p>
        </div>
      </div>
      <div className={card}>
        <div className="p-4 font-display font-semibold text-xs uppercase tracking-widest text-slate-500">So achtet die Werkstatt auf dein Abo</div>
        <div className="px-4 pb-4 flex flex-col gap-3 text-sm">
          <p className="text-slate-600 dark:text-slate-300">Modell nach Aufwand: Texte und kleine Änderungen klein, normale Funktionen mittel, Datenbank, Rechte und Risiko HOCH groß; bei Fehlschlag eine Stufe höher.</p>
          <label className="flex flex-col gap-1 text-slate-500">Ab diesem Stand eine Modellstufe kleiner (Prozent)<input id="cs-klein" type="number" min="10" max="100" className={input} value={klein} onChange={(x) => setKlein(x.target.value)} disabled={!admin} /></label>
          <label className="flex flex-col gap-1 text-slate-500">Ab diesem Stand keine neuen Aufträge bis zur Rücksetzung (Prozent)<input id="cs-pause" type="number" min="10" max="100" className={input} value={pause} onChange={(x) => setPause(x.target.value)} disabled={!admin} /></label>
          {admin ? <button type="button" className={btn} onClick={speichern}>Speichern</button> : <p className="text-xs text-slate-500">Die Schwellen setzt der Admin.</p>}
          {isDesktop() && <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex flex-col gap-2">
            <p className="text-xs text-slate-500">Damit die Werte auch aktuell sind, wenn du selbst mit Claude Code arbeitest: Statuszeile einrichten (ändert ~/.claude/settings.json, eine vorhandene eigene Statuszeile bleibt).</p>
            <button type="button" className={ghost} onClick={statuszeile}>Statuszeile in Claude Code einrichten</button></div>}
        </div>
      </div>
    </div>
  );
}

// ---------------- Werkstatt (nur im Programm) ----------------
function WerkstattSchalter({ ich, sitzung, d, toast }) {
  const [st, setSt] = useState(null); const [busy, setBusy] = useState(false);
  const desk = isDesktop();
  const darfWerkstatt = ich.rolle === "admin" || d.mitglieder.some((m) => m.benutzer_id === ich.id && m.rolle === "entwickler");
  useEffect(() => {
    if (!desk) return undefined;
    let aus = false;
    const tick = () => tauri("ws_status").then((s) => !aus && setSt(s)).catch(() => {});
    tick(); const t = setInterval(tick, 3000);
    return () => { aus = true; clearInterval(t); };
  }, [desk]);
  useEffect(() => { if (desk && st?.laeuft && sitzung?.access_token) tauri("ws_token", { token: sitzung.access_token }).catch(() => {}); }, [desk, st?.laeuft, sitzung?.access_token]);
  if (!desk) return <span className="text-xs text-slate-500" title="Die Werkstatt läuft nur im Programm Codeschmiede">Werkstatt-PCs online: <b>{d.pcs.filter((p) => p.an && Date.now() - new Date(p.zuletzt).getTime() < 180000).length}</b></span>;
  if (!darfWerkstatt) return <UpdateHinweis toast={toast} />;
  const an = !!st?.laeuft;
  const umschalten = async () => {
    setBusy(true);
    try {
      if (an) { await tauri("ws_stop"); toast("Werkstatt aus: dieser PC übernimmt keine Aufträge mehr"); return; }
      const v = await tauri("ws_check");
      const namen = { claude: "Claude Code", node: "Node.js", git: "Git", gh: "GitHub CLI" };
      const fehlt = ["claude", "node", "git", "gh"].filter((k) => !v[k]);
      if (fehlt.length) { toast(`Auf diesem PC fehlt: ${fehlt.map((k) => namen[k]).join(", ")}`); return; }
      if (!v.gh_angemeldet) { toast("GitHub ist auf diesem PC nicht angemeldet (einmal „gh auth login“)"); return; }
      await tauri("ws_start", { config: { supabase_url: import.meta.env.VITE_SUPABASE_URL, anon_key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, access_token: sitzung.access_token, user_id: ich.id, admin: ich.rolle === "admin" } });
      toast("Werkstatt an: dieser PC übernimmt Aufträge");
    } catch (e) { toast(fehler(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <button type="button" role="switch" aria-checked={an} disabled={busy} onClick={umschalten} className="inline-flex items-center gap-2.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-1.5 pr-3 py-1 text-sm">
        <span className={`relative w-9 h-5 rounded-full transition ${an ? "bg-green-600" : "bg-slate-300 dark:bg-slate-700"}`}><i className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${an ? "left-[18px]" : "left-0.5"}`} /></span>
        Werkstatt {an ? "an" : "aus"}{st?.auftrag ? <span className="text-xs text-slate-500">· Auftrag #{st.auftrag}</span> : null}
      </button>
      <UpdateHinweis toast={toast} />
    </>
  );
}

// Automatische Updates des Programms (Anweisung Gerhard 2026-10-22 16:25): im Hintergrund geladen, beim nächsten Start aktiv
function UpdateHinweis({ toast }) {
  const [u, setU] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!isDesktop()) return undefined;
    let aus = false;
    const tick = () => tauri("ws_update_status").then((x) => !aus && setU(x)).catch(() => {}); // ältere Programmversion: Befehl fehlt
    tick(); const t = setInterval(tick, 60000);
    return () => { aus = true; clearInterval(t); };
  }, []);
  if (!u?.bereit) return null;
  const neustart = async () => { setBusy(true); try { await tauri("ws_update_neustart"); } catch (e) { toast(fehler(e)); setBusy(false); } };
  return (
    <button type="button" disabled={busy} onClick={neustart} title={`Version ${u.neu} ist geladen und wird spätestens beim nächsten Start aktiv.`}
      className="inline-flex items-center gap-2 rounded-full border border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-sm text-emerald-800 dark:text-emerald-200">
      <Download className="w-4 h-4" />Version {u.neu} bereit · Jetzt neu starten
    </button>
  );
}

// ---------------- Neues Projekt ----------------
function NeuesProjekt({ toast, onClose, onFertig }) {
  const [name, setName] = useState(""); const [kennung, setKennung] = useState(""); const [besch, setBesch] = useState(""); const [repo, setRepo] = useState(""); const [symbol, setSymbol] = useState("layers"); const [busy, setBusy] = useState(false);
  const autoKennung = name.trim().toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const id = kennung || autoKennung;
  const gueltig = /^[a-z0-9][a-z0-9-]{1,39}$/.test(id) && name.trim() && (!repo || /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repo.trim()));
  const los = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("ws_projekt_anlegen", { p_id: id, p_name: name.trim(), p_beschreibung: besch.trim(), p_repo: repo.trim(), p_symbol: symbol });
    setBusy(false);
    if (error) { toast(fehler(error)); return; }
    toast(`Projekt „${name.trim()}“ angelegt – die Werkstatt stellt beim ersten Auftrag zuerst ihre Fragen`); onFertig(id); onClose();
  };
  return (
    <Dialog title="Neues Projekt" onClose={onClose}>
      <label className="flex flex-col gap-1 text-sm text-slate-500">Name der App<input id="cs-pname" className={input} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
      <label className="flex flex-col gap-1 text-sm text-slate-500">Kennung (klein, ohne Leerzeichen)<input id="cs-pid" className={input} value={id} onChange={(e) => setKennung(e.target.value)} /></label>
      <label className="flex flex-col gap-1 text-sm text-slate-500">Worum geht es?<textarea id="cs-pdesc" className={`${input} min-h-[70px]`} value={besch} onChange={(e) => setBesch(e.target.value)} /></label>
      <label className="flex flex-col gap-1 text-sm text-slate-500">GitHub-Repository (Besitzer/Name, kann später ergänzt werden)<input id="cs-prepo" className={input} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="gerhardkresak-code/neue-app" /></label>
      <label className="flex flex-col gap-1 text-sm text-slate-500">Symbol<select id="cs-psym" className={input} value={symbol} onChange={(e) => setSymbol(e.target.value)}>{Object.keys(WS_ICON).map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
      <p className="text-xs text-slate-500">Vorlage: App (Oberfläche & Design, Funktionen), Daten & Rechte (Datenbank, Anmeldung & Rechte), Betrieb (Handbuch & Texte, Einstellungen & Datenschutz). Es gilt dein Regelwerk AI-Dev-OS.</p>
      <div className="flex justify-end gap-2"><button type="button" className={ghost} onClick={onClose}>Abbrechen</button><button type="button" className={btn} disabled={busy || !gueltig} onClick={los}>Projekt anlegen</button></div>
    </Dialog>
  );
}
