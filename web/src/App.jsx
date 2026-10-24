import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Inbox, Eye, GitBranch, ShieldCheck, BookOpen, History, Download, KeyRound, Plus, Send, Trash2, X, Check,
  Loader2, Info, Bot, Layers, GitPullRequest, Wrench, LogIn, MessageSquare, Users, Lock, Gauge, FolderPlus, Power,
  ArrowLeft, ExternalLink, RefreshCw, Smartphone, Tablet, Monitor, MousePointerClick, GitMerge, CircleCheck, Palette, Globe, FolderInput, Cpu, FolderCog, Archive, ArchiveRestore, Scale, ListChecks, Rocket, Undo2, Pin, FlaskConical, ScanSearch, Plug, Code2,
} from "lucide-react";
import { supabase } from "./supabase";
import { Markdown } from "./Markdown";
import { WS_ICON, STAND, ROLLEN, BEREICH_RECHTE } from "./config";
import { isDesktop, tauri } from "./desktop";
import Designer from "./Designer";
import KonzeptArbeitsplatz, { KonzeptAuto } from "./Konzept";
import { ZweigeVersionen, Pruefstand, Wissensdatenbank, Aenderungsprotokoll, Dokumentation } from "./Ablauf";
import KiAnbieter from "./KiAnbieter";
import Einrichtung, { EinrichtungChip, useEinrichtung } from "./Einrichtung";
import { MitErwaehnung, erwaehnte, FeatureBezuege } from "./Bezuege";
import Regelwerk from "./Regelwerk";
import Anbindungen, { NeuesProjektAssistent } from "./ProjektArten";
import CodeEditor from "./CodeEditor";
import { LogoZeichen } from "./Logo";
import CodeschmiedeZeichen from "./Zeichen";
const AboLimits = lazy(() => import("./AboLimits"));

// Codeschmiede – Programmierumgebung für alle Projekte (live über Supabase Realtime)
// Konzept: docs/KONZEPT.md · Datenbank: supabase/migrations/
// Rechte prüft die Datenbank (RLS + geprüfte Funktionen); die Oberfläche blendet nur aus, was ohnehin nicht geht.

const btn = "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-display font-bold tracking-wide transition";
const ghost = "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition";
const card = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const input = "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-[15px] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500";
// Weg eines Auftrags (Entwurf 0.7, freigegeben 2026-10-22 20:41): Freigabe → Sicherheitsprüfung → Zusammenführen → Feature-Prüfung → live
const STEPS = [["wartet", "Auftrag"], ["laeuft", "In Arbeit"], ["freigabe", "Freigabe"], ["sicherheit", "Sicherheitsprüfung"], ["zusammen", "Zusammenführen"], ["feature", "Feature-Prüfung"], ["wissen", "Live & Wissen"]];
const STEP_IDX = { wartet: 0, laeuft: 1, frage: 1, nacharbeit: 1, freigabe: 2, sicherheit: 3, zusammen: 4, feature: 5, wissen: 6, erledigt: 6 };
const ABGESCHLOSSEN = ["wissen", "erledigt"];
// Cloudflare Pages: Testseite eines Zweigs (klein, nur a-z0-9 und „-“, höchstens 28 Zeichen)
const cfAlias = (zweig) => String(zweig || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 28).replace(/^-+|-+$/g, "");
// Ohne offenen Auftrag: bei Test & Live die Testfassung (main), sonst die App – dort sieht man Änderungen zuerst
const vorschauUrl = (projekt, a) => (a?.zweig && projekt?.vorschau_domain && !ABGESCHLOSSEN.includes(a.stand) ? `https://${cfAlias(a.zweig)}.${projekt.vorschau_domain}`
  : (projekt?.live_zweig && /^https:\/\/[^/\s]+$/i.test(String(projekt?.test_url || "").replace(/\/$/, "")) ? String(projekt.test_url).replace(/\/$/, "") : projekt?.live_url) || null);
// Seite in der Vorschau: gemerkte Seite des Features (Datenbank 0028), sonst die des Projekts; „cs=1“ hängt am Ende
const SEITE = /^\/[A-Za-z0-9/_.~-]{0,150}(\?[A-Za-z0-9_=&.~%-]{0,150})?$/;
const seiteOk = (p) => typeof p === "string" && SEITE.test(p) && !/(^|\/)\.\.(\/|$|\?)/.test(p) && !p.startsWith("//") && !/\/[A-Za-z0-9_-]{20,}/.test(p) && !/\/[0-9]/.test(p);
const mitCs = (p) => `${p}${p.includes("?") ? "&" : "?"}cs=1`;
const oeffneExtern = (url) => { if (isDesktop()) tauri("plugin:opener|open_url", { url }).catch(() => {}); else window.open(url, "_blank", "noopener"); };
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
    // Gewähltes Projekt nur, wenn es (noch) da und nicht archiviert ist – sonst das erste
    const pid = (projektId && (pj.data || []).some((x) => x.id === projektId)) ? projektId : pj.data?.[0]?.id;
    let b = [], g = [], f = [], a = [], erl = [];
    if (pid) {
      b = (await supabase.from("ws_bereiche").select("*").eq("projekt_id", pid).order("reihenfolge")).data || [];
      const bids = b.map((x) => x.id);
      g = bids.length ? (await supabase.from("ws_gruppen").select("*").in("bereich_id", bids).order("reihenfolge")).data || [] : [];
      const gids = g.map((x) => x.id);
      if (gids.length) {
        f = (await supabase.from("ws_features").select("*").in("gruppe_id", gids).order("id")).data || [];
        a = (await supabase.from("ws_auftraege").select("*").in("gruppe_id", gids).neq("stand", "abgebrochen").order("id")).data || [];
        // Offene Rückfrage = Auftrag in „frage“ und die letzte Nachricht kommt von der Werkstatt (noch nicht beantwortet)
        const fragIds = a.filter((x) => x.stand === "frage").map((x) => x.id);
        if (fragIds.length) {
          const n = (await supabase.from("ws_nachrichten").select("auftrag_id, von, id").in("auftrag_id", fragIds).order("id", { ascending: false })).data || [];
          const letzte = {}; n.forEach((m) => { if (!(m.auftrag_id in letzte)) letzte[m.auftrag_id] = m; });
          a = a.map((x) => (x.stand === "frage" ? { ...x, offeneFrage: !letzte[x.id]?.von } : x));
        }
        const ids = a.filter((x) => !ABGESCHLOSSEN.includes(x.stand)).map((x) => x.id);
        if (ids.length) erl = (await supabase.from("ws_erlaubnisse").select("id, auftrag_id, werkzeug, eingabe, grund, status, erstellt").in("auftrag_id", ids).eq("status", "offen").order("id")).data || [];
      }
    }
    setD({ projekte: pj.data || [], mitglieder: mg.data || [], bereiche: b, gruppen: g, features: f, auftraege: a, erlaubnisse: erl, benutzer: u.data || [], rechte: r.data || [],
      pcs: p.data || [], einstellungen: e.data || null, verbrauch: vm.data || [], gesamt: Number(vg.data || 0), abo: ab.data || [], projektId: pid });
    setLaden(false);
  }, [projektId]);
  useEffect(() => {
    if (!me) return undefined;
    setLaden(true); holen();
    const ch = supabase.channel("cs-zentrale-" + (projektId || "start"));
    ["ws_projekte", "ws_projekt_mitglieder", "ws_gruppen", "ws_features", "ws_auftraege", "ws_nachrichten", "ws_benutzer", "ws_rechte", "ws_werkstatt_pcs", "ws_verbrauch", "ws_einstellungen", "ws_abo_limits", "ws_erlaubnisse"].forEach((t) =>
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
// „sitzung“ = nur bis zum Programmende (sessionStorage), sonst dauerhaft (localStorage)
const speicher = (art) => (art === "sitzung" ? sessionStorage : localStorage);
const merke = { lies: (k, art) => { try { return speicher(art).getItem(k); } catch { return null; } }, schreib: (k, v, art) => { try { speicher(art).setItem(k, v); } catch { /* ohne Speicher */ } } };

export default function App() {
  const [sitzung, setSitzung] = useState(undefined);
  const [ich, setIch] = useState(undefined);
  const [ansicht, setAnsicht] = useState("zentrale");
  const [oeffne, setOeffne] = useState(null);   // aus „Zu erledigen“: Feature-Arbeitsplatz bzw. Gruppen-Chat öffnen
  const [projekt, setProjekt] = useState(() => merke.lies("cs-projekt"));
  const [toast, setToast] = useState("");
  const [neuesProjekt, setNeuesProjekt] = useState(false); const [projekteVerwalten, setProjekteVerwalten] = useState(false); const [einrichtung, setEinrichtung] = useState(false); const [aboOffen, setAboOffen] = useState(false);

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

  const nav = [["zentrale", "Auftrags-Zentrale", Inbox], ["erledigen", "Zu erledigen", ListChecks], ["vorschau", "Live-Vorschau", Eye], ["anbindungen", "Anbindungen", Plug], ["code", "Code", Code2], ["designer", "App-Designer", Palette], ["global", "Globale Einstellungen", Globe], ["_", "Ablauf"], ["zweige", "Zweige & Versionen", GitBranch], ["pruef", "Prüfstand", ShieldCheck], ["wissen", "Wissensdatenbank", BookOpen], ["_", "Dokumentation"], ["log", "Änderungsprotokoll", History], ["doku", "Dokumentation", Download], ["regelwerk", "Regelwerk", Scale], ["_", "Verwaltung"], ["benutzer", "Benutzer & Rechte", KeyRound], ["ki", "KI-Anbieter", Cpu], ["einrichtung", "Einrichtung", Wrench], ["verbrauch", "Verbrauch & Limits", Gauge]];
  const offen = daten.auftraege.filter((a) => a.offeneFrage).length;
  const zuTun = daten.projektId ? aufgabenListe(daten, rechteVon(daten, ich)).length : 0;
  const aktuell = daten.projekte.find((p) => p.id === daten.projektId);
  const PIcon = WS_ICON[aktuell?.symbol] || Layers;

  return (
    <div className={`min-h-screen grid grid-cols-[minmax(0,1fr)] md:grid-cols-[248px_minmax(0,1fr)] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-body`}>
      <aside className="bg-[#0f2a22] text-emerald-50 flex md:flex-col gap-1 p-3 md:sticky md:top-0 md:h-screen overflow-x-auto">
        <div className="flex items-center gap-2.5 px-2 pb-0 md:pb-3">
          <CodeschmiedeZeichen groesse={36} className="ring-1 ring-emerald-400/30 rounded-[9px]" />
          <div className="hidden md:block leading-tight"><b className="font-display text-[19px] tracking-wide">Codeschmiede</b><div className="text-xs text-emerald-200/70">Deine Apps. Ein Ort.</div></div>
        </div>
        <div className="hidden md:block mb-2">
          <label htmlFor="cs-projekt" className="text-[11px] uppercase tracking-widest text-emerald-200/60 px-2.5">Projekt</label>
          <div className="mt-1 flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-2">
            {aktuell?.logo ? <LogoZeichen werte={aktuell.logo} groesse={20} /> : <PIcon className="w-[18px] h-[18px] shrink-0" />}
            <select id="cs-projekt" value={daten.projektId || ""} onChange={(e) => waehle(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none [&>option]:text-slate-900">
              {daten.projekte.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {ich.rolle === "admin" && <button type="button" onClick={() => setNeuesProjekt(true)} className="mt-1 w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-emerald-200 hover:bg-white/5"><FolderPlus className="w-4 h-4" />Neues Projekt</button>}
          {ich.rolle === "admin" && <button type="button" onClick={() => setProjekteVerwalten(true)} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-emerald-200 hover:bg-white/5"><FolderCog className="w-4 h-4" />Projekte verwalten</button>}
        </div>
        <nav className="flex md:flex-col gap-0.5" aria-label="Programm-Menü">
          {nav.map(([id, t, Icon], i) => id === "_" ? <div key={i} className="hidden md:block text-[11px] uppercase tracking-widest text-emerald-200/60 px-2.5 pt-3 pb-1">{t}</div> : (
            <button key={id} type="button" aria-current={ansicht === id} onClick={() => (id === "einrichtung" ? setEinrichtung(true) : setAnsicht(id))}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm whitespace-nowrap text-left ${ansicht === id ? "bg-emerald-400/15 text-white font-semibold" : "hover:bg-white/5"}`}>
              <Icon className="w-[18px] h-[18px]" />{t}{id === "zentrale" && offen > 0 && <span className="ml-auto text-[11px] font-bold bg-amber-500 text-amber-950 rounded-full px-1.5">{offen}</span>}{id === "erledigen" && zuTun > 0 && <span className="ml-auto text-[11px] font-bold bg-amber-500 text-amber-950 rounded-full px-1.5">{zuTun}</span>}
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
            <VerbrauchKurz d={daten} ich={ich} onClick={() => setAboOffen(true)} />
            {aboOffen && <Suspense fallback={null}><AboLimits d={daten} ich={ich} onSchliessen={() => setAboOffen(false)} onVerbrauch={() => { setAboOffen(false); setAnsicht("verbrauch"); }} /></Suspense>}
            <EinrichtungChip ich={ich} d={daten} onOeffnen={() => setEinrichtung(true)} />
            <WerkstattSchalter ich={ich} sitzung={sitzung} d={daten} toast={setToast} />
          </div>
        </div>
        {daten.laden ? <div className="grid place-items-center py-20"><Loader2 className="w-6 h-6 animate-spin text-emerald-700" /></div>
          : !daten.projektId ? <div className={`${card} p-8 text-slate-500`}>Du bist noch keinem Projekt zugeordnet. Der Admin nimmt dich in ein Projekt auf.</div>
          : ansicht === "zentrale" ? <Zentrale key={daten.projektId} d={daten} ich={ich} toast={setToast} onDesigner={() => setAnsicht("designer")} start={oeffne} />
          : ansicht === "erledigen" ? <ZuErledigen key={daten.projektId} d={daten} ich={ich} toast={setToast} onOeffne={(a) => { setOeffne({ f: a.feature_id, g: a.gruppe_id, n: Date.now() }); setAnsicht("zentrale"); }} />
          : ansicht === "global" ? <Zentrale key={daten.projektId + "-global"} d={daten} ich={ich} toast={setToast} nurGlobal />
          : ansicht === "regelwerk" ? <Regelwerk key={daten.projektId} d={daten} ich={ich} toast={setToast} />
          : ansicht === "ki" ? <KiAnbieter key={daten.projektId} d={daten} ich={ich} toast={setToast} />
          : ansicht === "zweige" ? <ZweigeVersionen key={daten.projektId} d={daten} />
          : ansicht === "pruef" ? <Pruefstand key={daten.projektId} d={daten} />
          : ansicht === "wissen" ? <Wissensdatenbank key={daten.projektId} d={daten} />
          : ansicht === "log" ? <Aenderungsprotokoll key={daten.projektId} d={daten} />
          : ansicht === "doku" ? <Dokumentation key={daten.projektId} d={daten} />
          : ansicht === "code" ? <CodeEditor key={daten.projektId} d={daten} ich={ich} toast={setToast} onAuftrag={() => setAnsicht("zentrale")} />
          : ansicht === "anbindungen" ? <Anbindungen key={daten.projektId} d={daten} ich={ich} toast={setToast} onVorschau={() => setAnsicht("vorschau")} />
          : ansicht === "vorschau" ? <LiveVorschauSeite key={daten.projektId} d={daten} ich={ich} toast={setToast} />
          : ansicht === "designer" ? <Designer key={daten.projektId} d={daten} ich={ich} toast={setToast} />
          : ansicht === "benutzer" ? <BenutzerRechte d={daten} ich={ich} toast={setToast} />
          : ansicht === "verbrauch" ? <Verbrauch d={daten} ich={ich} toast={setToast} />
          : <Spaeter ansicht={ansicht} />}
      </main>
      {/* Die Chat-Spalte rechts entfällt (Gerhard 2026-10-23 17:52): Gespräche mit Claude laufen in der Gruppe „Konzept“ */}
      {einrichtung && !daten.laden && <Einrichtung ich={ich} d={daten} toast={setToast} onClose={() => setEinrichtung(false)} />}
      {!daten.laden && daten.projektId && <EinrichtungAuto ich={ich} d={daten} onOeffnen={() => setEinrichtung(true)} />}
      {!daten.laden && daten.projektId && <KonzeptAuto d={daten} ich={ich} />}
      {projekteVerwalten && <ProjekteVerwalten toast={setToast} aktiv={daten.projektId} onClose={() => setProjekteVerwalten(false)} onWeg={(id) => { if (id === daten.projektId) { const n = daten.projekte.find((p) => p.id !== id); if (n) waehle(n.id); } }} />}
      {neuesProjekt && <NeuesProjektAssistent toast={setToast} onClose={() => setNeuesProjekt(false)} onFertig={(id) => { waehle(id); setAnsicht("anbindungen"); }} />}
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
      <CodeschmiedeZeichen groesse={48} />
      <h1 className="font-display font-bold text-2xl">Codeschmiede</h1>
      <p className="text-sm">Hast du eine Einladung bekommen? Gib deinen Namen ein (Vorname Nachname) und tritt bei.</p><button type="button" className="text-xs text-slate-500 underline" onClick={() => supabase.auth.signOut()}>Mit anderem Konto anmelden</button>
      <input id="ws-name" className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Vorname Nachname" />
      <button type="button" className={`${btn} w-full`} disabled={busy} onClick={los}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Einladung annehmen</button>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </Zentriert>
  );
}

function Spaeter({ ansicht }) {
  const t = `Unbekannte Ansicht „${ansicht}“.`;
  return <div className={`${card} p-8 text-slate-500 flex items-center gap-3`}><Info className="w-5 h-5" />{t}</div>;
}

// ---------------- Zentrale ----------------
// nurGlobal: Ansicht „Globale Einstellungen“ (Anweisung Gerhard 2026-10-23 10:20) – Bereich, der in der App nie als eigener Bereich erscheint;
// seine Features gelten für die ganze App. In der Auftrags-Zentrale wird er ausgeblendet.
function Zentrale({ d: alle, ich, toast, nurGlobal = false, onDesigner, start }) {
  const d = useMemo(() => {
    const bereiche = alle.bereiche.filter((b) => !!b.global === nurGlobal);
    const bids = new Set(bereiche.map((b) => b.id));
    const gruppen = alle.gruppen.filter((g) => bids.has(g.bereich_id)); const gids = new Set(gruppen.map((g) => g.id));
    const fids = new Set(alle.features.filter((f) => gids.has(f.gruppe_id)).map((f) => f.id));
    return { ...alle, bereiche, gruppen, auftraege: nurGlobal ? alle.auftraege.filter((a) => gids.has(a.gruppe_id) || fids.has(a.feature_id)) : alle.auftraege };
  }, [alle, nurGlobal]);
  // Start immer im Konzept (erste Gruppe im Bereich App, Konzept zuerst 2026-10-23); ohne Konzept-Gruppe die erste Gruppe
  const [sel, setSel] = useState(() => { if (start?.g && d.gruppen.some((x) => x.id === start.g)) return { g: start.g, f: start.f || null }; const k = !nurGlobal && alle.projekte.find((p) => p.id === alle.projektId)?.konzept_gruppe_id; return { g: (k && d.gruppen.some((x) => x.id === k) ? k : d.gruppen[0]?.id), f: null }; });
  const [dlg, setDlg] = useState(null);
  const rolle = ich.rolle === "admin" ? "admin" : d.mitglieder.find((m) => m.projekt_id === d.projektId && m.benutzer_id === ich.id)?.rolle;
  const darf = useCallback((bereich, recht) => rolle === "admin" || d.rechte.some((r) => r.benutzer_id === ich.id && r.bereich_id === bereich && r[recht] && (recht === "auftraege" ? ["entwickler", "texter"].includes(rolle) : rolle === "entwickler")), [d.rechte, ich, rolle]);
  const g = d.gruppen.find((x) => x.id === sel.g) || d.gruppen[0];
  const feats = d.features.filter((f) => f.gruppe_id === g?.id && !f.ausgebaut);
  const f = sel.f ? d.features.find((x) => x.id === sel.f) : null;
  const aufFor = (gid, fid) => d.auftraege.filter((a) => (fid === undefined ? a.gruppe_id === gid : a.feature_id === fid));
  const [station, setStation] = useState(null);
  const [platz, setPlatz] = useState(() => start?.f || null); // Feature-Arbeitsplatz (Doppelklick)
  useEffect(() => { if (!start) return; setStation(null); if (start.f) setPlatz(start.f); else { setPlatz(null); setSel({ g: start.g, f: null }); } }, [start?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  // Features selbst zuordnen (Anweisung Gerhard 2026-10-23 10:26): Admin, per Dialog oder Ziehen auf eine Gruppe
  const kannVerschieben = ich.rolle === "admin";
  const [ziel, setZiel] = useState(null);
  const verschiebe = async (fid, gid) => {
    const feat = alle.features.find((x) => x.id === fid); if (!feat || feat.gruppe_id === gid) return;
    const { error } = await supabase.rpc("ws_feature_verschieben", { p_feature: fid, p_gruppe: gid });
    const gz = alle.gruppen.find((x) => x.id === gid);
    if (error) toast(fehler(error)); else { toast(`„${feat.name}“ verschoben nach ${gz?.name || gid}`); await alle.holen?.(); }
  };
  const ablage = (gid) => kannVerschieben ? {
    onDragOver: (e) => { if (e.dataTransfer.types.includes("text/cs-feature")) { e.preventDefault(); setZiel(gid); } },
    onDragLeave: () => setZiel((z) => (z === gid ? null : z)),
    onDrop: (e) => { e.preventDefault(); setZiel(null); const fid = e.dataTransfer.getData("text/cs-feature"); if (fid) verschiebe(fid, gid); },
  } : {};
  const globalGruppe = alle.gruppen.find((x) => alle.bereiche.find((b) => b.id === x.bereich_id)?.global);
  const fragen = d.auftraege.filter((a) => a.offeneFrage).length;
  if (!g) return <div className={`${card} p-8 text-slate-500`}>{nurGlobal ? "Für dieses Projekt gibt es noch keine globalen Einstellungen (Datenbank 0009 einspielen)." : "Noch keine Gruppen angelegt."}</div>;
  const platzF = platz ? d.features.find((x) => x.id === platz) : null;
  const platzG = platzF ? d.gruppen.find((x) => x.id === platzF.gruppe_id) : null;
  // Gruppe „Konzept“ (Datenbank 0020): eigener Arbeitsplatz mit Chat und Konzept-Stand statt Feature-Karten
  const konzeptId = alle.projekte.find((p) => p.id === alle.projektId)?.konzept_gruppe_id;
  const istKonzept = !nurGlobal && !!g && g.id === konzeptId;
  return (
    <>
      <div className="flex flex-wrap gap-1.5 mb-4" role="toolbar" aria-label="Weg eines Auftrags">
        {fragen > 0 && <button type="button" aria-pressed={station === "frage"} onClick={() => { setStation(station === "frage" ? null : "frage"); setPlatz(null); }} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 ${station === "frage" ? "ring-2 ring-amber-500" : ""}`}><i className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />{fragen} Rückfrage{fragen > 1 ? "n" : ""} an dich</button>}
        {STEPS.map(([s, t], i) => {
          const z = d.auftraege.filter((a) => STEP_IDX[a.stand] === i && (s !== "wissen" || a.stand === "wissen") && a.stand !== "frage").length;
          const handeln = ["freigabe", "zusammen"].includes(s) && z > 0;
          return (
            <button key={s} type="button" aria-pressed={station === s} onClick={() => { setStation(station === s ? null : s); setPlatz(null); }}
              className={`inline-flex items-center gap-2 rounded-full border pl-3 pr-1.5 py-1 text-sm font-semibold ${station === s ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-600"}`}>
              {t}<span className={`min-w-[24px] text-center rounded-full px-1.5 tabular-nums ${handeln ? "bg-amber-500 text-amber-950" : "bg-slate-100 dark:bg-slate-800"}`}>{z}</span>
            </button>);
        })}
      </div>
      {station ? <StationsUebersicht station={station} d={d} darf={darf} toast={toast} onSchliessen={() => setStation(null)} onOeffne={(fid) => { setStation(null); setPlatz(fid); }} onGruppe={(gid) => { setStation(null); setSel({ g: gid, f: null }); }} />
      : platzF ? <FeatureArbeitsplatz f={platzF} g={platzG} d={d} ich={ich} darf={darf} toast={toast} onZurueck={() => setPlatz(null)} onLoeschen={() => setDlg({ art: "loeschen", f: platzF })} />
      : <div className="grid gap-5 grid-cols-[minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_400px] items-start">
        <nav className={`${card} overflow-hidden`} aria-label="Bereiche und Gruppen">
          {d.bereiche.map((b) => (
            <div key={b.id} className="border-t first:border-t-0 border-slate-200 dark:border-slate-800 pb-1">
              <div className="font-display font-semibold text-xs uppercase tracking-widest text-slate-500 px-4 pt-3 pb-1">{b.name}</div>
              {d.gruppen.filter((x) => x.bereich_id === b.id).map((x) => {
                const Icon = WS_ICON[x.symbol] || Layers; const js = aufFor(x.id); const arbeitet = js.some((a) => a.stand === "laeuft"); const fr = js.filter((a) => a.offeneFrage).length;
                return (
                  <button key={x.id} type="button" aria-current={g.id === x.id} onClick={() => setSel({ g: x.id, f: null })} {...(x.id !== konzeptId ? ablage(x.id) : {})}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-[15px] ${ziel === x.id ? "ring-2 ring-inset ring-orange-500 bg-orange-50 dark:bg-orange-950/40" : ""} ${g.id === x.id ? "bg-emerald-50 dark:bg-emerald-950/40 font-semibold shadow-[inset_3px_0_0_#047857]" : "hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20"}`}>
                    <Icon className="w-[18px] h-[18px] shrink-0" /><span className="min-w-0 truncate">{x.name}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {arbeitet && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600"><i className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />arbeitet</span>}
                      {fr > 0 && <span className="text-[11px] font-semibold bg-amber-100 text-amber-700 rounded-full px-1.5">{fr} Frage{fr > 1 ? "n" : ""}</span>}
                      {x.id !== konzeptId && <span className="text-xs text-slate-400 tabular-nums">{d.features.filter((y) => y.gruppe_id === x.id && !y.ausgebaut).length}</span>}
                    </span>
                  </button>);
              })}
            </div>))}
          {!nurGlobal && kannVerschieben && globalGruppe && <div {...ablage(globalGruppe.id)} className={`mx-3 my-2 rounded-lg border border-dashed px-3 py-2 text-xs flex items-center gap-2 ${ziel === globalGruppe.id ? "border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200" : "border-slate-300 dark:border-slate-700 text-slate-500"}`}><Globe className="w-4 h-4" />Hierher ziehen = Globale Einstellungen</div>}
          {nurGlobal && <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800">Diese Features gelten für die ganze App und alle Nutzer. In der App selbst gibt es dafür keinen eigenen Bereich.</p>}
          {ich.rolle === "admin" && !nurGlobal && <button type="button" onClick={() => setDlg({ art: "gruppe" })} className="w-full flex items-center gap-2 px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 text-emerald-700 font-semibold text-sm"><Plus className="w-4 h-4" />Neue Gruppe</button>}
        </nav>

        {istKonzept ? <div className="min-w-0 xl:col-span-2"><KonzeptArbeitsplatz g={g} d={d} ich={ich} toast={toast} onDesigner={onDesigner} /></div> : <>
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
              const js = aufFor(g.id, x.id); const arbeitet = js.some((a) => a.stand === "laeuft"); const neu = x.neu_bis && new Date(x.neu_bis) > new Date(); const frageHier = js.some((a) => a.offeneFrage);
              return (
                <button key={x.id} type="button" aria-current={sel.f === x.id} onClick={() => setSel({ g: g.id, f: x.id })} onDoubleClick={() => setPlatz(x.id)}
                  draggable={kannVerschieben} onDragStart={(e) => { e.dataTransfer.setData("text/cs-feature", x.id); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setZiel(null)}
                  onKeyDown={(e) => { if (e.key === "Enter" && sel.f === x.id) { e.preventDefault(); setPlatz(x.id); } }} title="Einmal klicken: Kurzinfo · doppelt klicken: Arbeitsplatz mit Chat und Live-Vorschau"
                  className={`text-left flex flex-col gap-2 rounded-xl border p-3.5 min-w-0 ${frageHier ? "ring-1 ring-amber-400" : ""} ${x.ausgeblendet ? "opacity-55" : ""} ${sel.f === x.id ? "border-emerald-600 ring-1 ring-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" : "border-slate-200 dark:border-slate-800 hover:border-emerald-600"} ${arbeitet ? "shadow-[inset_0_3px_0_#2563eb]" : ""}`}>
                  <div className="flex items-start justify-between gap-2"><h3 className="font-display font-semibold text-[17px] leading-tight">{x.name}</h3>
                    <span className="flex gap-1 flex-wrap justify-end">{frageHier && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">Rückfrage an dich</span>}{x.ausgeblendet && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md border border-dashed border-slate-400 text-slate-500">Ausgeblendet</span>}{neu && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-700 text-white">Neu</span>}<Badge stand={x.stand} /></span></div>
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

        {f ? <FeatureKurzinfo f={f} g={g} d={d} ich={ich} toast={toast} darfAuftrag={darf(g.bereich_id, "auftraege")} onOeffnen={() => setPlatz(f.id)} onGruppe={() => setSel({ g: g.id, f: null })} onVerschieben={kannVerschieben ? () => setDlg({ art: "verschieben", f }) : null} />
          : <AuftragsChat g={g} f={null} d={d} ich={ich} darf={darf} toast={toast} kanal="gruppe" />}
        </>}
      </div>}
      {dlg?.art === "feature" && <NeuesFeature g={g} ich={ich} texter={rolle === "texter"} toast={toast} onClose={() => setDlg(null)} onFertig={(id) => setSel({ g: g.id, f: id })} />}
      {dlg?.art === "gruppe" && <NeueGruppe d={d} ich={ich} toast={toast} onClose={() => setDlg(null)} onFertig={(id) => setSel({ g: id, f: null })} />}
      {dlg?.art === "loeschen" && <Loeschen f={dlg.f} g={g} ich={ich} toast={toast} onClose={() => setDlg(null)} />}
      {dlg?.art === "verschieben" && <Verschieben f={dlg.f} d={alle} onClose={() => setDlg(null)} onWahl={async (gid) => { setDlg(null); await verschiebe(dlg.f.id, gid); setSel({ g: g.id, f: null }); }} />}
    </>
  );
}

function AuftragsChat({ g, f, d, ich, darf, toast, onLoeschen, kanal = "codeschmiede", baustein, onBausteinFertig, eingebettet }) {
  const auftraege = d.auftraege.filter((a) => (f ? a.feature_id === f.id : a.gruppe_id === g.id));   // je Feature: Verlauf bleibt beim Verschieben
  const ids = auftraege.map((a) => a.id);
  const { nachrichten, log, erlaubnisse } = useAuftragDetails(ids);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [tab, setTab] = useState("gespraech");
  const laufend = auftraege.find((a) => a.stand === "laeuft");
  const frage = auftraege.find((a) => a.stand === "frage");
  const kannAuftrag = darf(g.bereich_id, "auftraege");
  const kannFrei = darf(g.bereich_id, "freigeben");
  const name = (id) => d.benutzer.find((u) => u.id === id)?.name || "Mitglied";
  useEffect(() => { if (!laufend) setTab("gespraech"); }, [laufend]);
  // Chats starten immer beim letzten Eintrag (Neue Anweisung Gerhard 2026-10-23 10:20)
  const verlaufRef = useRef(null);
  useEffect(() => { const el = verlaufRef.current; if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; }); }, [nachrichten.length, log.length, tab, g.id, f?.id]);

  const senden = async () => {
    const t = text.trim(); if (!t) return; setBusy(true);
    try {
      if (frage) {
        const { error } = await supabase.from("ws_nachrichten").insert({ auftrag_id: frage.id, von: ich.id, art: "text", text: bausteinText(t), kanal });
        if (error) throw error; toast("Antwort an die Werkstatt gesendet");
      } else {
        const istTexter = d.mitglieder.some((m) => m.projekt_id === d.projektId && m.benutzer_id === ich.id && m.rolle === "texter");
        const { data, error } = await supabase.from("ws_auftraege").insert({ gruppe_id: g.id, feature_id: f?.id || null, titel: t.length > 80 ? t.slice(0, 78) + "…" : t, art: istTexter ? "text" : "aendern", erstellt_von: ich.id, baustein: baustein || null }).select().single();
        if (error) throw error;
        const r = await supabase.from("ws_nachrichten").insert({ auftrag_id: data.id, von: ich.id, art: "text", text: bausteinText(t), kanal });
        if (r.error) throw r.error; toast(`Auftrag #${data.id} an Werkstatt ${g.name} gestellt`);
      }
      // @Feature im Text = fester Bezug „Vorlage“ für dieses Feature (Entscheidung 2026-10-22 22:31)
      if (f) for (const x of erwaehnte(t, d.features).filter((x) => x.id !== f.id)) {
        const { error: eb } = await supabase.rpc("ws_bezug_setzen", { p_von: f.id, p_zu: x.id });
        if (!eb) toast(`Vorlage gesetzt: ${x.name}`);
      }
      setText(""); onBausteinFertig?.();
    } catch (e) { toast(fehler(e)); } finally { setBusy(false); }
  };
  const bausteinText = (t) => (baustein ? `[Baustein: ${baustein.name}${baustein.seite ? ` · Seite ${baustein.seite}` : ""}]\n${t}` : t);
  const freigeben = async (a) => { const { error } = await supabase.rpc("ws_freigeben", { p_auftrag: a.id }); toast(error ? fehler(error) : `Auftrag #${a.id} freigegeben – Sicherheitsprüfung startet`); };
  const zusammen = async (a) => { const { error } = await supabase.rpc("ws_zusammenfuehren", { p_auftrag: a.id }); toast(error ? fehler(error) : `Auftrag #${a.id}: Zusammenführen gestartet`); };
  const beantwortet = (m) => m.art === "frage" && nachrichten.some((x) => x.auftrag_id === m.auftrag_id && x.id > m.id && x.von);
  const [alleFragen, setAlleFragen] = useState(false);
  const zahlBeantwortet = nachrichten.filter(beantwortet).length;
  const erlauben = async (e, s) => { const { error } = await supabase.rpc("ws_erlaubnis_entscheiden", { p_id: e.id, p_status: s }); toast(error ? fehler(error) : s === "abgelehnt" ? "Abgelehnt" : "Erlaubt"); };
  const offeneErl = erlaubnisse.filter((e) => e.status === "offen");

  return (
    <aside className={`${card} flex flex-col min-h-0 ${eingebettet ? "h-full" : "lg:col-span-2 xl:col-span-1 xl:sticky xl:top-3 xl:max-h-[calc(100vh-24px)]"}`} aria-label="Auftrags-Chat">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 font-display font-bold text-lg">{f ? <Layers className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}{f ? f.name : g.name}</div>
        <div className="text-sm text-slate-500 mt-0.5 flex gap-2 items-center flex-wrap"><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{f ? "Feature" : "Ganze Gruppe"}</span>geht an Werkstatt {g.name}</div>
        <div className="flex gap-2 flex-wrap mt-2">
          {laufend && <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden text-sm">
            {[["gespraech", "Gespräch"], ["live", "Live mitsehen"]].map(([k, t]) => <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={`px-3 py-1.5 inline-flex items-center gap-1.5 ${tab === k ? "bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-950" : ""}`}>{k === "live" && <i className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />}{t}</button>)}
          </div>}
          {f && onLoeschen && darf(g.bereich_id, "loeschen") && <button type="button" className={`${ghost} h-8 text-xs`} onClick={onLoeschen}><Trash2 className="w-3.5 h-3.5" />{f.ausgeblendet ? "Wieder einblenden" : "Feature löschen …"}</button>}
        </div>
      </div>
      {tab === "live" && laufend ? (
        <div ref={verlaufRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 text-[13px] min-h-[240px]" aria-live="polite">
          {log.filter((l) => l.auftrag_id === laufend.id).map((l) => (
            <div key={l.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2"><time className="text-xs text-slate-400 tabular-nums">{new Date(l.erstellt).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })}</time>
              <div className="min-w-0"><span>{l.text}</span>{l.ausschnitt && <pre className="mt-1 font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 overflow-x-auto">{l.ausschnitt.split("\n").map((z, i) => <span key={i} className={z.startsWith("+") ? "text-green-600" : z.startsWith("-") ? "text-red-600" : ""}>{z + "\n"}</span>)}</pre>}</div></div>))}
          {offeneErl.filter((e) => e.auftrag_id === laufend.id).map((e) => <ErlaubnisKarte key={e.id} e={e} g={g} kann={kannFrei} onEntscheid={erlauben} />)}
        </div>
      ) : (
        <div ref={verlaufRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 min-h-[220px]" aria-live="polite">
          {zahlBeantwortet > 0 && <button type="button" onClick={() => setAlleFragen(!alleFragen)} className="self-center text-xs text-slate-500 underline underline-offset-2">{alleFragen ? "Beantwortete Rückfragen ausblenden" : `${zahlBeantwortet} beantwortete Rückfrage${zahlBeantwortet > 1 ? "n" : ""} (abgeschlossen) anzeigen`}</button>}
          {auftraege.length === 0 && <div className="text-sm text-slate-500 text-center py-8">{f ? `Noch kein Auftrag zu „${f.name}“.` : `Noch kein Auftrag für ${g.name}.`} Beschreibe unten, was sich ändern soll.<br /><span className="text-xs">Bitte keine Daten von Vereinsmitgliedern hineinschreiben.</span></div>}
          {auftraege.map((a) => (
            <React.Fragment key={a.id}>
              <div className="self-center text-xs text-slate-500 text-center flex items-center gap-2 flex-wrap justify-center">Auftrag #{a.id}: {a.titel}{ABGESCHLOSSEN.includes(a.stand) && <span className="inline-flex items-center gap-1 font-semibold text-green-700 dark:text-green-400"><CircleCheck className="w-3.5 h-3.5" />abgeschlossen</span>}
                {ABBRECHBAR.includes(a.stand) && (ich.rolle === "admin" || a.erstellt_von === ich.id) && <AbbrechenKnopf a={a} toast={toast} />}</div>
              <Schritte a={a} />
              {nachrichten.filter((m) => m.auftrag_id === a.id && (alleFragen || !beantwortet(m))).map((m) => {
                const zu = beantwortet(m);
                return (
                <div key={m.id} className={`max-w-[88%] rounded-xl px-3 py-2 text-sm ${m.von ? "self-end bg-emerald-50 dark:bg-emerald-950/50" : m.art === "frage" && !zu ? "self-start bg-amber-50 border border-amber-400 dark:bg-amber-950/40" : m.art === "system" ? "self-center bg-transparent text-slate-500 text-xs" : "self-start bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"} ${zu ? "opacity-75" : ""}`}>
                  {m.art !== "system" && <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 flex-wrap">{m.von ? name(m.von) : `Werkstatt ${g.name}`} · {fmt(m.erstellt)}{m.art === "frage" ? " · Rückfrage" : ""}
                    {m.kanal === "gruppe" && f && <span className="px-1.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">aus Gruppe</span>}
                    {m.kanal === "claude-chat" && <span className="px-1.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">aus Claude-Chat</span>}
                    {zu && <span className="text-green-700 dark:text-green-400 inline-flex items-center gap-1"><CircleCheck className="w-3 h-3" />abgeschlossen</span>}</div>}
                  <Markdown text={m.text} klein />
                </div>); })}
              <PruefBefunde a={a} />
              {offeneErl.filter((e) => e.auftrag_id === a.id).map((e) => <ErlaubnisKarte key={e.id} e={e} g={g} kann={kannFrei} onEntscheid={erlauben} />)}
              {["freigabe", "zusammen"].includes(a.stand) && (
                <div className="rounded-xl border border-green-600 p-3 text-sm flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-mono text-xs"><GitPullRequest className="w-4 h-4" />PR #{a.pr_nummer} · {a.zweig}</div>
                  {!kannFrei ? <div className="text-xs text-slate-500">Freigeben und Zusammenführen darf der Admin oder wer das Recht „Freigeben“ hat.</div>
                    : a.stand === "freigabe" ? <FreigabeKnopf a={a} onJa={() => freigeben(a)} />
                    : <ZusammenKnopf a={a} onJa={() => zusammen(a)} />}
                </div>)}
            </React.Fragment>))}
        </div>
      )}
      {kannAuftrag ? (
        <div className="border-t border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-2">
          <MitErwaehnung id="ws-auftrag" className={`${input} min-h-[72px]`} value={text} onChange={setText} features={d.features.filter((x) => !x.ausgebaut)} placeholder={frage ? "Antwort auf die Rückfrage …" : f ? `Was soll sich bei „${f.name}“ ändern? (@ verweist auf ein Feature als Vorlage)` : `Was soll sich in ${g.name} ändern?`} aria-label="Nachricht" />
          <div className="flex items-center justify-between gap-2 flex-wrap"><span className="text-xs text-slate-500">{frage ? "Antwort geht an den laufenden Auftrag" : laufend ? "Neuer Auftrag kommt in die Warteschlange" : "Wird vom nächsten freien Werkstatt-PC übernommen"}</span>
            <button type="button" className={btn} disabled={busy || !text.trim()} onClick={senden}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{frage ? "Antworten" : "Senden"}</button></div>
        </div>
      ) : <div className="border-t border-slate-200 dark:border-slate-800 p-4 text-xs text-slate-500">Für diesen Bereich hast du kein Recht, Aufträge zu geben.</div>}
    </aside>
  );
}

// Auftrag abbrechen (Datenbank 0023, Gerhard 2026-10-23 19:08): zweimal klicken, damit nichts aus Versehen abgebrochen wird
const ABBRECHBAR = ["wartet", "frage", "nacharbeit", "freigabe"];
function AbbrechenKnopf({ a, toast }) {
  const [sicher, setSicher] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!sicher) return undefined; const t = setTimeout(() => setSicher(false), 6000); return () => clearTimeout(t); }, [sicher]);
  const los = async () => {
    if (!sicher) { setSicher(true); return; }
    setBusy(true); const { error } = await supabase.rpc("ws_auftrag_abbrechen", { p_auftrag: a.id, p_grund: null }); setBusy(false); setSicher(false);
    toast(error ? fehler(error) : `Auftrag #${a.id} abgebrochen${a.pr_nummer ? ` – der Pull Request #${a.pr_nummer} bleibt bei GitHub offen` : ""}`);
  };
  return <button type="button" disabled={busy} onClick={los} title="Auftrag abbrechen – die Werkstatt arbeitet nicht weiter daran"
    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${sicher ? "border-red-600 bg-red-600 text-white" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-red-500 hover:text-red-700"}`}>
    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}{sicher ? "Wirklich abbrechen?" : "Abbrechen"}</button>;
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

function FreigabeKnopf({ a, onJa, ohneInfo }) {
  const [frag, setFrag] = useState(false);
  const lokal = ohneInfo ? null : a.pruefung?.lokal;
  if (!frag) return (
    <div className="flex flex-col gap-1.5">
      {lokal && <span className={`text-xs ${lokal.ergebnis === "gruen" ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>Bauen & Tests am PC: {lokal.ergebnis === "gruen" ? "grün" : "rot"}{lokal.befund ? ` · ${lokal.befund.split("\n")[0]}` : ""}</span>}
      <button type="button" className={`${btn} h-9 text-sm self-start`} onClick={() => setFrag(true)}><Check className="w-4 h-4" />Freigeben</button>
    </div>);
  return (
    <div className="flex flex-col gap-2"><span>Auftrag #{a.id} freigeben? Danach läuft die Sicherheitsprüfung automatisch; live geht erst etwas, wenn du zusammenführst und die Feature-Prüfung grün ist.</span>
      <div className="flex gap-2"><button type="button" className={`${btn} h-9 text-sm`} onClick={onJa}>Ja, freigeben</button><button type="button" className={`${ghost} h-9`} onClick={() => setFrag(false)}>Abbrechen</button></div></div>
  );
}

function ZusammenKnopf({ a, onJa }) {
  const [frag, setFrag] = useState(false);
  if (!frag) return <button type="button" className={`${btn} h-9 text-sm self-start`} onClick={() => setFrag(true)}><GitMerge className="w-4 h-4" />Zusammenführen</button>;
  return (
    <div className="flex flex-col gap-2"><span>Auftrag #{a.id} mit dem neuesten Stand zusammenführen? Das ganze Feature wird in einer Testfassung geprüft und erst bei Grün live geschaltet.</span>
      <div className="flex gap-2"><button type="button" className={`${btn} h-9 text-sm`} onClick={onJa}>Ja, zusammenführen</button><button type="button" className={`${ghost} h-9`} onClick={() => setFrag(false)}>Abbrechen</button></div></div>
  );
}

// Weg eines Auftrags: aktuelle Station hervorgehoben, Nacharbeit rot
function Schritte({ a }) {
  const n = STEP_IDX[a.stand] ?? 0; const fertig = ABGESCHLOSSEN.includes(a.stand); const rot = a.stand === "nacharbeit";
  const laeuftStation = ["sicherheit", "feature"].includes(a.stand) && a.pruefung?.[a.stand]?.ergebnis === "laeuft";
  return (
    <div className="flex gap-1 flex-wrap" aria-label={`Stand: ${STEPS[n]?.[1]}`}>
      {STEPS.map(([s, t], i) => (
        <span key={s} className={`flex-1 min-w-[64px] text-[10px] font-semibold text-center px-1 py-0.5 rounded ${fertig || i < n ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" : i === n ? (rot ? "bg-red-600 text-white" : "bg-emerald-700 text-white") : "border border-slate-200 dark:border-slate-800 text-slate-400"}`}>
          {i === n && rot ? "Nacharbeit" : t}{i === n && laeuftStation ? " …" : ""}
        </span>))}
    </div>);
}

function PruefBefunde({ a }) {
  const eintraege = [["sicherheit", "Sicherheitsprüfung"], ["feature", "Feature-Prüfung"]].filter(([k]) => a.pruefung?.[k]?.befund);
  if (!eintraege.length) return null;
  return eintraege.map(([k, t]) => { const p = a.pruefung[k]; return (
    <details key={k} className={`rounded-lg border px-3 py-2 text-xs ${p.ergebnis === "gruen" ? "border-green-600" : p.ergebnis === "rot" ? "border-red-500" : "border-slate-300 dark:border-slate-700"}`}>
      <summary className="cursor-pointer font-semibold">{t}: {p.ergebnis === "gruen" ? "grün" : p.ergebnis === "rot" ? "rot" : p.ergebnis === "laeuft" ? "läuft …" : p.ergebnis}{p.zeit ? ` · ${fmt(p.zeit)}` : ""}</summary>
      <div className="whitespace-pre-wrap mt-1.5 text-slate-600 dark:text-slate-300">{p.befund}</div>
    </details>); });
}

// ---------------- Kurzinfo (einfacher Klick auf ein Feature) ----------------
// Feature in eine andere Gruppe verschieben – alle Gruppen des Projekts, auch „Globale Einstellungen“
function Verschieben({ f, d, onClose, onWahl }) {
  const [q, setQ] = useState("");
  const bereiche = [...d.bereiche].sort((a, b) => (a.global ? 1 : 0) - (b.global ? 1 : 0));
  return (
    <Dialog title={`„${f.name}“ verschieben`} onClose={onClose}>
      <p className="text-sm text-slate-500 mb-2">Wähle die neue Gruppe. Laufende und abgeschlossene Aufträge bleiben beim Feature.</p>
      <input autoFocus className={`${input} mb-2`} placeholder="Gruppe suchen …" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-[50vh] overflow-auto space-y-2">
        {bereiche.map((b) => {
          const gs = d.gruppen.filter((x) => x.bereich_id === b.id && x.name.toLowerCase().includes(q.toLowerCase()));
          if (!gs.length) return null;
          return (<div key={b.id}><div className="text-[11px] uppercase tracking-widest font-semibold text-slate-500 px-1 pb-1 flex items-center gap-1">{b.global && <Globe className="w-3.5 h-3.5" />}{b.global ? "Global – gilt für die ganze App" : b.name}</div>
            {gs.map((x) => { const Icon = WS_ICON[x.symbol] || Layers; const jetzt = x.id === f.gruppe_id;
              return <button key={x.id} type="button" disabled={jetzt} onClick={() => onWahl(x.id)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm ${jetzt ? "opacity-50" : "hover:bg-emerald-50 dark:hover:bg-emerald-950/40"}`}><Icon className="w-4 h-4" />{x.name}{jetzt && <span className="ml-auto text-xs">aktuell</span>}</button>; })}
          </div>);
        })}
      </div>
    </Dialog>);
}

function FeatureKurzinfo({ f, g, d, ich, toast, darfAuftrag, onOeffnen, onGruppe, onVerschieben }) {
  const js = d.auftraege.filter((a) => a.feature_id === f.id);
  const letzter = js[js.length - 1];
  const laufend = js.find((a) => a.stand === "laeuft");
  const pc = laufend ? d.pcs.find((p) => p.id === laufend.werkstatt_pc) : null;
  return (
    <aside className={`${card} p-4 flex flex-col gap-3 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-3`} aria-label="Kurzinfo">
      <div><div className="text-xs text-slate-500">{g.name} · <span className="font-mono">{f.id}</span></div><h2 className="font-display font-bold text-xl leading-tight">{f.name}</h2></div>
      {f.beschreibung && <p className="text-sm text-slate-600 dark:text-slate-300">{f.beschreibung}</p>}
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-slate-500">Stand</dt><dd><Badge stand={f.stand} /></dd>
        <dt className="text-slate-500">Letzter Auftrag</dt><dd>{letzter ? `#${letzter.id} · ${STEPS[STEP_IDX[letzter.stand]]?.[1] || letzter.stand}${letzter.stand === "nacharbeit" ? " (Nacharbeit)" : ""}` : "–"}</dd>
        {js.some((a) => a.offeneFrage) && <><dt className="text-amber-700 font-semibold">Rückfrage</dt><dd className="text-amber-700 font-semibold">wartet auf deine Antwort – Öffnen</dd></>}
        <dt className="text-slate-500">Gerade</dt><dd>{laufend ? <span className="inline-flex items-center gap-1.5 text-blue-600 font-semibold"><i className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />Werkstatt {pc?.name || ""} arbeitet</span> : "niemand"}</dd>
        <dt className="text-slate-500">Aufträge</dt><dd>{js.length} ({js.filter((a) => ABGESCHLOSSEN.includes(a.stand)).length} abgeschlossen)</dd>
      </dl>
      <FeatureBezuege f={f} d={d} ich={ich} toast={toast} darfAuftrag={darfAuftrag} />
      <button type="button" className={btn} onClick={onOeffnen}><Layers className="w-4 h-4" />Öffnen: Chat & Live-Vorschau</button>
      <button type="button" className={ghost} onClick={onGruppe}><MessageSquare className="w-4 h-4" />Zum Chat der Gruppe</button>
      {onVerschieben && <button type="button" className={ghost} onClick={onVerschieben}><FolderInput className="w-4 h-4" />Verschieben …</button>}
      <p className="text-xs text-slate-500">Tipp: Doppelklick auf die Karte öffnet den Arbeitsplatz direkt.{onVerschieben ? " Zum Verschieben die Karte auf eine Gruppe links ziehen." : ""}</p>
    </aside>);
}

// ---------------- Stationen-Übersicht (Klick auf eine Station oben) ----------------
function StationsUebersicht({ station, d, darf, toast, onSchliessen, onOeffne, onGruppe }) {
  const name = station === "frage" ? "Rückfragen an dich" : STEPS.find((s) => s[0] === station)?.[1];
  const liste = d.auftraege.filter((a) => (station === "frage" ? a.offeneFrage : station === "laeuft" ? ["laeuft", "nacharbeit"].includes(a.stand) : a.stand === station));
  const [busy, setBusy] = useState(false);
  const gruppeVon = (a) => d.gruppen.find((x) => x.id === a.gruppe_id);
  const kann = (a) => darf(gruppeVon(a)?.bereich_id, "freigeben");
  const aktion = station === "freigabe" ? ["ws_freigeben", "Freigeben", "Alle freigeben"] : station === "zusammen" ? ["ws_zusammenfuehren", "Zusammenführen", "Alle zusammenführen"] : null;
  const ausfuehren = async (as) => {
    setBusy(true);
    let ok = 0; const fehlerListe = [];
    for (const a of as) { const { error } = await supabase.rpc(aktion[0], { p_auftrag: a.id }); if (error) fehlerListe.push(`#${a.id}: ${fehler(error)}`); else ok++; }
    setBusy(false);
    toast(fehlerListe.length ? `${ok} erledigt · ${fehlerListe.join(" · ")}` : `${ok} Auftrag${ok === 1 ? "" : "e"}: ${aktion[1]} gestartet`);
  };
  const proFeature = {};
  liste.forEach((a) => { const k = a.feature_id || `gruppe:${a.gruppe_id}`; (proFeature[k] = proFeature[k] || []).push(a); });
  const erklaerung = { frage: "Die Werkstatt wartet auf deine Antwort – Arbeitsplatz öffnen und antworten.", wartet: "Warten auf einen freien Werkstatt-PC.", laeuft: "Die Werkstatt arbeitet (inkl. Nacharbeit nach roter Prüfung).", freigabe: "Bauen & Tests am PC sind gelaufen – deine Freigabe startet die Sicherheitsprüfung.", sicherheit: "Läuft automatisch auf dem Admin-PC.", zusammen: "Sicherheitsprüfung grün – Zusammenführen startet die Prüfung des ganzen Features, danach live.", feature: "Testfassung mit neuestem Stand wird geprüft, bei Grün automatisch live.", wissen: "Live geschaltet und in der Wissensdatenbank." }[station];
  return (
    <section className={`${card} p-4 flex flex-col gap-4`} aria-label={`Station ${name}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display font-bold text-2xl">{name}</h2>
        <span className="text-sm text-slate-500">{liste.length} Auftrag{liste.length === 1 ? "" : "e"} · {erklaerung}</span>
        <span className="flex-1" />
        {aktion && liste.filter(kann).length > 1 && <button type="button" className={btn} disabled={busy} onClick={() => ausfuehren(liste.filter(kann))}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : station === "zusammen" ? <GitMerge className="w-4 h-4" /> : <Check className="w-4 h-4" />}{aktion[2]}</button>}
        <button type="button" className={ghost} onClick={onSchliessen}><X className="w-4 h-4" />Schließen</button>
      </div>
      {liste.length === 0 && <div className="text-sm text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4">An dieser Station wartet gerade nichts.</div>}
      {Object.entries(proFeature).map(([k, as]) => {
        const f = d.features.find((x) => x.id === k); const g = f ? d.gruppen.find((x) => x.id === f.gruppe_id) : gruppeVon(as[0]);
        return (
          <div key={k} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-950 flex-wrap">
              <span className="text-xs text-slate-500">{g?.name}</span>{f && <><span className="font-mono text-xs text-slate-400">{f.id}</span><b className="font-display">{f.name}</b></>}{!f && <b className="font-display">ganze Gruppe</b>}
              <span className="flex-1" />{f ? <button type="button" className={`${ghost} h-8 text-xs`} onClick={() => onOeffne(f.id)}><Layers className="w-3.5 h-3.5" />Arbeitsplatz</button>
                : onGruppe && <button type="button" className={`${ghost} h-8 text-xs`} onClick={() => onGruppe(as[0].gruppe_id)}><MessageSquare className="w-3.5 h-3.5" />Gruppen-Chat</button>}
            </div>
            {as.map((a) => {
              const p = a.pruefung?.[station];
              return (
                <div key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center px-3 py-2.5 border-t border-slate-200 dark:border-slate-800">
                  <div className="min-w-0"><div className="font-semibold text-sm">#{a.id} {a.titel}</div>
                    <div className="text-xs text-slate-500 flex gap-2 flex-wrap">{a.pr_nummer && <span className="inline-flex items-center gap-1"><GitPullRequest className="w-3 h-3" />PR #{a.pr_nummer}</span>}
                      {a.stand === "nacharbeit" && <span className="text-red-600 font-semibold">Nacharbeit nach roter Prüfung</span>}
                      {a.pruefung?.lokal && station === "freigabe" && <span>Bauen & Tests: {a.pruefung.lokal.ergebnis === "gruen" ? "grün" : "rot"}</span>}
                      {station === "zusammen" && a.pruefung?.sicherheit && <span className="text-green-700 dark:text-green-400">Sicherheitsprüfung grün</span>}
                      {p?.ergebnis === "laeuft" && <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />läuft seit {fmt(p.zeit)}</span>}
                      {p?.ergebnis === "fehler" && <span className="text-red-600">Fehler: {p.befund} – wird erneut versucht</span>}
                      {p?.ergebnis === "wartet" && <span>{p.befund}</span>}
                    </div></div>
                  {aktion && (kann(a) ? <button type="button" className={`${btn} h-9 text-sm`} disabled={busy} onClick={() => ausfuehren([a])}>{aktion[1]}</button> : <span className="text-xs text-slate-500">kein Recht</span>)}
                </div>);
            })}
          </div>);
      })}
    </section>);
}

// ---------------- Zu erledigen & Live (Entwurf 1.0, freigegeben 2026-10-23 „Entwurf1.0 frei“, Datenbank 0024) ----------------
// Alles, was auf mich wartet, mit den passenden Knöpfen; oben der Weg bis live (Test → Live), rechts „Jetzt unabhängig prüfen“.
function rechteVon(d, ich) {
  const rolle = ich.rolle === "admin" ? "admin" : d.mitglieder.find((m) => m.projekt_id === d.projektId && m.benutzer_id === ich.id)?.rolle;
  return (bereich, recht) => rolle === "admin" || d.rechte.some((r) => r.benutzer_id === ich.id && r.bereich_id === bereich && r[recht] && (recht === "auftraege" ? ["entwickler", "texter"].includes(rolle) : rolle === "entwickler"));
}
function useRechte(d, ich) {
  const rolle = ich.rolle === "admin" ? "admin" : d.mitglieder.find((m) => m.projekt_id === d.projektId && m.benutzer_id === ich.id)?.rolle;
  return useCallback((bereich, recht) => rolle === "admin" || d.rechte.some((r) => r.benutzer_id === ich.id && r.bereich_id === bereich && r[recht] && (recht === "auftraege" ? ["entwickler", "texter"].includes(rolle) : rolle === "entwickler")), [d.rechte, ich, rolle]);
}
// Was wartet auf mich? (Zahl im Menü)
function aufgabenListe(d, darf) {
  const bereich = (a) => d.gruppen.find((g) => g.id === a.gruppe_id)?.bereich_id;
  const l = [];
  d.auftraege.filter((a) => a.offeneFrage && darf(bereich(a), "auftraege")).forEach((a) => l.push({ art: "frage", a }));
  (d.erlaubnisse || []).forEach((e) => { const a = d.auftraege.find((x) => x.id === e.auftrag_id); if (a && darf(bereich(a), "freigeben")) l.push({ art: "erlaubnis", a, e }); });
  d.auftraege.filter((a) => a.stand === "freigabe" && darf(bereich(a), "freigeben")).forEach((a) => l.push({ art: "freigabe", a }));
  d.auftraege.filter((a) => a.stand === "zusammen" && darf(bereich(a), "freigeben")).forEach((a) => l.push({ art: "zusammen", a }));
  return l;
}
const AUFGABE = { frage: ["Rückfrage", "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"], erlaubnis: ["Erlaubnis", "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"],
  freigabe: ["Freigabe", "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"], zusammen: ["Zusammenführen", "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"] };

function ZuErledigen({ d, ich, toast, onOeffne }) {
  const darf = useRechte(d, ich);
  const projekt = d.projekte.find((p) => p.id === d.projektId);
  const liste = aufgabenListe(d, darf);
  const [filter, setFilter] = useState("alle");
  const fragIds = liste.filter((x) => x.art === "frage").map((x) => x.a.id);
  const [fragen, setFragen] = useState({});
  useEffect(() => {
    if (!fragIds.length) { setFragen({}); return; }
    supabase.from("ws_nachrichten").select("auftrag_id, text, id").in("auftrag_id", fragIds).eq("art", "frage").order("id", { ascending: false })
      .then(({ data }) => { const m = {}; (data || []).forEach((n) => { if (!(n.auftrag_id in m)) m[n.auftrag_id] = n.text; }); setFragen(m); });
  }, [fragIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const gName = (a) => d.gruppen.find((g) => g.id === a.gruppe_id)?.name || "";
  const fName = (a) => d.features.find((f) => f.id === a.feature_id)?.name;
  const laufend = d.auftraege.filter((a) => ["laeuft", "sicherheit", "feature", "wartet"].includes(a.stand));
  const rpc = async (fn, args, ok) => { const { error } = await supabase.rpc(fn, args); toast(error ? fehler(error) : ok); };
  const gezeigt = liste.filter((x) => filter === "alle" || x.art === filter);
  return (
    <div className="flex flex-col gap-5">
      <LiveWeg d={d} ich={ich} projekt={projekt} toast={toast} />
      <div className="grid gap-5 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_380px] items-start">
        <section className={`${card} p-4 flex flex-col gap-3`} aria-label="Wartet auf dich">
          <div className="flex items-center gap-2 flex-wrap"><h2 className="font-display font-bold text-xl">Wartet auf dich</h2>
            <span className="min-w-[24px] text-center rounded-full px-1.5 text-sm font-bold bg-amber-500 text-amber-950 tabular-nums">{liste.length}</span></div>
          <div className="flex gap-1.5 flex-wrap" role="tablist">
            {[["alle", "Alle"], ["frage", "Rückfragen"], ["erlaubnis", "Erlaubnisse"], ["freigabe", "Freigaben"], ["zusammen", "Zusammenführen"]].map(([k, t]) => {
              const z = k === "alle" ? liste.length : liste.filter((x) => x.art === k).length;
              return <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-sm font-semibold ${filter === k ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" : "border-slate-200 dark:border-slate-700"}`}>{t} <span className="tabular-nums text-slate-500">{z}</span></button>;
            })}
          </div>
          {gezeigt.length === 0 && <div className="text-sm text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-5 text-center"><CircleCheck className="w-5 h-5 mx-auto mb-1 text-green-600" />Hier wartet gerade nichts auf dich.</div>}
          {gezeigt.map(({ art, a, e }) => (
            <article key={`${art}-${e?.id || a.id}`} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex flex-wrap gap-3 items-start justify-between">
              <div className="min-w-0 flex-1 basis-[260px] flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap text-sm"><span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${AUFGABE[art][1]}`}>{AUFGABE[art][0]}</span>
                  <b className="font-display">#{a.id} {fName(a) || a.titel}</b><span className="text-xs text-slate-500">{gName(a)}</span></div>
                {art === "frage" && <div className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3"><Markdown text={fragen[a.id] || "Die Werkstatt wartet auf deine Antwort."} klein /></div>}
                {art === "erlaubnis" && <><code className="block font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1.5 break-words">{e.werkzeug}: {e.eingabe}</code>{e.grund && <span className="text-xs text-slate-500">{e.grund}</span>}</>}
                {art === "freigabe" && <span className="text-xs text-slate-500 inline-flex items-center gap-1.5 flex-wrap"><GitPullRequest className="w-3.5 h-3.5" />Pull Request #{a.pr_nummer}{a.pruefung?.lokal && <> · Bauen & Tests am PC {a.pruefung.lokal.ergebnis === "gruen" ? "grün" : "rot"}</>}</span>}
                {art === "zusammen" && <span className="text-xs text-green-700 dark:text-green-400 inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />Sicherheitsprüfung grün · Pull Request #{a.pr_nummer}</span>}
              </div>
              <div className="flex gap-2 flex-wrap items-center text-xs">
                {art === "frage" && <><button type="button" className={`${btn} h-9 text-sm`} onClick={() => onOeffne(a)}><MessageSquare className="w-4 h-4" />Antworten</button>{(ich.rolle === "admin" || a.erstellt_von === ich.id) && <AbbrechenKnopf a={a} toast={toast} />}</>}
                {art === "erlaubnis" && <><button type="button" className={`${btn} h-9 text-sm`} onClick={() => rpc("ws_erlaubnis_entscheiden", { p_id: e.id, p_status: "einmal" }, "Einmal erlaubt")}><Check className="w-4 h-4" />Erlauben</button>
                  <button type="button" className={`${ghost} h-9`} onClick={() => rpc("ws_erlaubnis_entscheiden", { p_id: e.id, p_status: "abgelehnt" }, "Abgelehnt")}>Ablehnen</button></>}
                {art === "freigabe" && <>{projekt?.repo && a.pr_nummer && <a className={`${ghost} h-9`} href={`https://github.com/${projekt.repo}/pull/${a.pr_nummer}/files`} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" />Änderung ansehen</a>}
                  <FreigabeKnopf a={a} ohneInfo onJa={() => rpc("ws_freigeben", { p_auftrag: a.id }, `Auftrag #${a.id} freigegeben – Sicherheitsprüfung startet`)} /><AbbrechenKnopf a={a} toast={toast} /></>}
                {art === "zusammen" && <ZusammenKnopf a={a} onJa={() => rpc("ws_zusammenfuehren", { p_auftrag: a.id }, `Auftrag #${a.id}: Zusammenführen gestartet`)} />}
              </div>
            </article>))}
          {laufend.length > 0 && <p className="text-xs text-slate-500">Laufend (nichts zu tun): {laufend.slice(0, 6).map((a) => `#${a.id} ${STEPS[STEP_IDX[a.stand]]?.[1] || a.stand}`).join(" · ")}{laufend.length > 6 ? " …" : ""}. Knöpfe sieht nur, wer das Recht dazu hat.</p>}
        </section>
        <JetztPruefen d={d} ich={ich} darf={darf} projekt={projekt} toast={toast} />
      </div>
    </div>);
}

// Weg bis live: Test (main) und Live (Zweig „live“) nebeneinander; einrichten, live schalten, zurück – nur der Admin
function LiveWeg({ d, ich, projekt, toast }) {
  const [versionen, setVersionen] = useState([]); const [auftrag, setAuftrag] = useState(null); const [testStand, setTestStand] = useState(null);
  const [frage, setFrage] = useState(null); const [busy, setBusy] = useState(false);
  const [testUrl, setTestUrl] = useState("");
  const admin = ich.rolle === "admin";
  const holen = useCallback(async () => {
    const [v, a, t] = await Promise.all([
      supabase.from("ws_live_versionen").select("*").eq("projekt_id", d.projektId).order("id", { ascending: false }).limit(20),
      supabase.from("ws_live_auftraege").select("*").eq("projekt_id", d.projektId).order("id", { ascending: false }).limit(1),
      supabase.from("ws_abgleich").select("main_sha, zeit").eq("projekt_id", d.projektId).maybeSingle(),   // Stand von main aus dem Abgleich (alle 10 Minuten)
    ]);
    setVersionen(v.data || []); setAuftrag(a.data?.[0] || null); setTestStand(/^[0-9a-f]{40}$/.test(t.data?.main_sha || "") ? t.data : null);
  }, [d.projektId]);
  useEffect(() => {
    holen();
    const ch = supabase.channel("cs-live-" + d.projektId);
    ["ws_live_versionen", "ws_live_auftraege"].forEach((t) => ch.on("postgres_changes", { event: "*", schema: "public", table: t }, holen));
    ch.subscribe(); const t = setInterval(holen, 15000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [holen, d.projektId]);
  useEffect(() => { setTestUrl(projekt?.test_url || (projekt?.vorschau_domain ? `https://main.${projekt.vorschau_domain}` : "")); }, [projekt?.test_url, projekt?.vorschau_domain]);
  if (!projekt) return null;
  const offen = auftrag && ["wartet", "laeuft"].includes(auftrag.stand);
  const anfordern = async (art, version) => {
    setBusy(true); const { error } = await supabase.rpc("ws_live_anfordern", { p_projekt: projekt.id, p_art: art, p_version: version?.id ?? null, p_commit: art === "live" ? testStand?.main_sha ?? null : null }); setBusy(false); setFrage(null);
    toast(error ? fehler(error) : art === "einrichten" ? "Wird eingerichtet – die Werkstatt des Admins legt den Zweig „live“ an" : art === "live" ? "Live schalten gestartet" : `Zurück auf ${version.bezeichnung} gestartet`);
    holen();
  };
  const umgestellt = async (an) => {
    setBusy(true); const { error } = await supabase.rpc("ws_live_umgestellt", { p_projekt: projekt.id, p_an: an, p_test_url: an ? (testUrl.trim() || null) : null }); setBusy(false);
    toast(error ? fehler(error) : an ? "Test & Live ist eingeschaltet" : "Test & Live ist ausgeschaltet – main geht wieder direkt live"); await d.holen?.();
  };
  const jetzt = versionen[0];
  const imTest = d.features.filter((f) => f.stand === "test" && !f.ausgebaut);
  const sperre = (v) => { const fehlt = (jetzt?.migrationen || []).filter((m) => !(v.migrationen || []).includes(m)); return fehlt.length ? `Passt nicht zur Datenbank (neuer: ${fehlt.slice(0, 2).join(", ")}${fehlt.length > 2 ? " …" : ""})` : null; };
  const status = auftrag && (offen || Date.now() - Date.parse(auftrag.geaendert) < 30 * 60 * 1000) && (
    <div role="status" className={`text-sm rounded-lg px-3 py-2 inline-flex items-center gap-2 ${auftrag.stand === "fehler" ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" : offen ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"}`}>
      {offen ? <Loader2 className="w-4 h-4 animate-spin" /> : auftrag.stand === "fehler" ? <Info className="w-4 h-4" /> : <CircleCheck className="w-4 h-4" />}
      {offen ? (auftrag.stand === "wartet" ? "Wartet auf die Werkstatt des Admins (Programm muss laufen)" : auftrag.hinweis || "Werkstatt arbeitet") : auftrag.hinweis}
      {auftrag.stand === "fertig" && auftrag.art !== "einrichten" && " – Cloudflare baut die Live-Fassung jetzt (1–3 Minuten)"}</div>);
  const schritte = [["Auftrag", "Werkstatt baut auf eigenem Zweig"], ["Freigeben", "du siehst den Pull Request"], ["Sicherheitsprüfung", "unabhängig, automatisch"], ["Zusammenführen", "in den Hauptstand"], ["Test", "auf der Testadresse ansehen"], ["Live schalten", projekt.live_url ? projekt.live_url.replace(/^https:\/\//, "") : "deine Live-Adresse"]];
  return (
    <section className={`${card} p-4 flex flex-col gap-4`} aria-label="Weg bis live">
      <div className="flex items-center gap-2 flex-wrap"><h2 className="font-display font-bold text-xl">Weg bis live</h2>{status}</div>
      <ol className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 text-sm">
        {schritte.map(([t, u], i) => <li key={t} className={`rounded-lg border px-3 py-2 ${i >= 4 && !projekt.live_zweig ? "border-dashed border-slate-300 dark:border-slate-700 text-slate-400" : "border-slate-200 dark:border-slate-800"}`}><b className="font-display">{i + 1} · {t}</b><div className="text-xs text-slate-500">{u}</div></li>)}
      </ol>
      {!projekt.live_zweig ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-3 text-sm">
          <p><b>Noch ohne Testfassung:</b> Was zusammengeführt und geprüft ist, geht bisher direkt live{projekt.live_url ? ` (${projekt.live_url})` : ""}. Mit <b>Test & Live</b> landet es zuerst auf einer Testadresse und geht erst live, wenn du auf „Live schalten“ klickst. {projekt.db_live_ref ? "Datenbank-Änderungen gehen mit dem Live-Schalten in die Live-Datenbank (Datenbank-Station)." : "Test und Live nutzen dieselbe Datenbank (eigene Live-Datenbank: unter „Anbindungen“ › Datenbank-Station)."}</p>
          {!projekt.repo ? <p className="text-slate-500">Zuerst braucht das Projekt ein GitHub-Repository (Projekte verwalten).</p>
            : !admin ? <p className="text-slate-500">Einrichten kann der Admin.</p>
            : !jetzt ? <button type="button" className={`${btn} self-start`} disabled={busy || offen} onClick={() => anfordern("einrichten")}><FlaskConical className="w-4 h-4" />Test & Live einrichten</button>
            : <div className="flex flex-col gap-2">
                <p className="font-semibold">Schritt 2 – einmalig bei Cloudflare umstellen (der Zweig „live“ ist angelegt, Stand {jetzt.commit_sha.slice(0, 7)}):</p>
                <ol className="list-decimal pl-5 flex flex-col gap-1 text-slate-600 dark:text-slate-300">
                  <li>dash.cloudflare.com → <b>Workers & Pages</b> → Projekt <b>{projekt.vorschau_domain?.replace(".pages.dev", "") || projekt.id}</b> öffnen.</li>
                  <li><b>Settings</b> → <b>Build</b> → <b>Branch control</b> → <b>Production branch</b> auf <code className="font-mono">live</code> stellen und speichern.</li>
                  <li>Die Testfassung ist danach unter <code className="font-mono">main.{projekt.vorschau_domain || "…pages.dev"}</code> erreichbar (eigene Adresse wie test.trainer-to-go.at geht später über „Custom domains“).</li>
                </ol>
                <label className="flex flex-col gap-1 text-xs text-slate-500 max-w-md">Testadresse<input className={input} value={testUrl} onChange={(e) => setTestUrl(e.target.value)} placeholder="https://main.mein-projekt.pages.dev" /></label>
                <button type="button" className={`${btn} self-start`} disabled={busy} onClick={() => umgestellt(true)}><Check className="w-4 h-4" />Cloudflare ist umgestellt – einschalten</button>
              </div>}
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-[minmax(0,1fr)] md:grid-cols-2">
          <div className="rounded-xl border border-blue-300 dark:border-blue-900 p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2"><FlaskConical className="w-5 h-5 text-blue-600" /><b className="font-display text-lg">Test</b><span className="text-xs text-slate-500">neuester Hauptstand (main)</span></div>
            {projekt.test_url && <a className="text-sm font-mono text-blue-700 dark:text-blue-300 break-all" href={projekt.test_url} target="_blank" rel="noreferrer">{projekt.test_url.replace(/^https:\/\//, "")}</a>}
            <span className="text-xs text-slate-500">{testStand ? <>Stand <span className="font-mono">{testStand.main_sha.slice(0, 7)}</span> · abgeglichen {fmt(testStand.zeit)}{jetzt?.commit_sha === testStand.main_sha ? " · gleich wie live" : ""}</> : "Stand noch unbekannt – der Abgleich der Werkstatt läuft alle 10 Minuten"}</span>
            <DbOffen projekt={projekt} />
            {projekt.db_ablaeufe_geaendert && <p className="text-xs rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 px-2.5 py-1.5">Achtung: Abläufe (<span className="font-mono">.github/workflows</span>) haben sich gegenüber live geändert. Sie laufen nach dem Live-Schalten mit den Live-Zugängen – bitte vorher im Code-Editor ansehen.</p>}
            <p className="text-sm text-slate-600 dark:text-slate-300">{imTest.length ? <>Neu gegenüber live: {imTest.slice(0, 5).map((f) => f.name).join(" · ")}{imTest.length > 5 ? " …" : ""}</> : "Gleich wie live oder nur kleine Änderungen ohne Feature."}</p>
            <div className="flex gap-2 flex-wrap mt-auto">
              {projekt.test_url && <a className={`${ghost} h-9`} href={projekt.test_url} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" />Testseite öffnen</a>}
              {admin && (frage?.art === "live"
                ? <span className="flex gap-2 flex-wrap items-center text-sm">Stand {testStand?.main_sha.slice(0, 7)} live schalten? Genau dieser Stand geht live.{projekt.db_live_ref && (projekt.db_offen || []).length ? ` Dabei werden ${projekt.db_offen.length} Datenbank-Änderung(en) in die Live-Datenbank eingespielt – vorher wird ihr Aufbau gesichert.` : ""}<button type="button" className={`${btn} h-9 text-sm`} disabled={busy} onClick={() => anfordern("live")}>Ja, live schalten</button><button type="button" className={`${ghost} h-9`} onClick={() => setFrage(null)}>Abbrechen</button></span>
                : <button type="button" className={`${btn} h-9 text-sm`} disabled={busy || offen || !testStand || jetzt?.commit_sha === testStand?.main_sha} onClick={() => setFrage({ art: "live" })}><Rocket className="w-4 h-4" />Live schalten</button>)}
            </div>
          </div>
          <div className="rounded-xl border border-green-300 dark:border-green-900 p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap"><Globe className="w-5 h-5 text-green-700" /><b className="font-display text-lg">Live</b>{jetzt && <span className="text-sm font-semibold">{jetzt.bezeichnung}</span>}{jetzt && <span className="text-xs text-slate-500">seit {fmt(jetzt.geschaltet)}</span>}</div>
            {projekt.live_url && <a className="text-sm font-mono text-green-700 dark:text-green-400 break-all" href={projekt.live_url} target="_blank" rel="noreferrer">{projekt.live_url.replace(/^https:\/\//, "")}</a>}
            {versionen.length > 1 && <div className="text-sm flex flex-col gap-1.5"><span className="text-xs text-slate-500">Vorige Versionen</span>
              {versionen.slice(1, 6).filter((v) => v.commit_sha !== jetzt.commit_sha).map((v) => { const s = sperre(v); return (
                <div key={v.id} className="flex items-center gap-2 flex-wrap"><span className="font-mono text-xs">{v.bezeichnung}</span><span className="text-xs text-slate-500">{fmt(v.geschaltet)}</span>
                  {admin && (frage?.v?.id === v.id
                    ? <span className="flex gap-2 flex-wrap items-center basis-full rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-400 p-2 text-[13px]">Live auf {v.bezeichnung} zurücksetzen? Nur der Code geht zurück, die Datenbank bleibt – diese Version passt zu ihr.
                        <button type="button" className={`${btn} h-8 text-sm`} disabled={busy} onClick={() => anfordern("zurueck", v)}>Ja, zurücksetzen</button><button type="button" className={`${ghost} h-8`} onClick={() => setFrage(null)}>Abbrechen</button></span>
                    : <button type="button" className={`${ghost} h-8 text-xs ml-auto`} disabled={!!s || busy || offen} title={s || "Nur der Admin"} onClick={() => setFrage({ v })}><Undo2 className="w-3.5 h-3.5" />{s ? "gesperrt" : "Zurück …"}</button>)}
                  {s && <span className="basis-full text-xs text-slate-500">{s}</span>}
                </div>); })}</div>}
            {admin && (frage?.art === "aus"
              ? <span className="flex gap-2 flex-wrap items-center text-[13px] mt-auto rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-400 p-2">Test & Live ausschalten? Stelle vorher bei Cloudflare den Produktionszweig wieder auf „main“. Danach geht main direkt live und alles im Test gilt als live.
                  <button type="button" className={`${btn} h-8 text-sm`} disabled={busy} onClick={() => { setFrage(null); umgestellt(false); }}>Ja, ausschalten</button><button type="button" className={`${ghost} h-8`} onClick={() => setFrage(null)}>Abbrechen</button></span>
              : <button type="button" className="text-xs text-slate-500 underline self-start mt-auto" onClick={() => setFrage({ art: "aus" })}>Test & Live ausschalten …</button>)}
          </div>
        </div>)}
    </section>);
}

// Datenbank-Station (0034): Datenbank-Dateien, die auf main liegen, aber noch nicht live sind
function DbOffen({ projekt }) {
  const offen = projekt.db_offen || [];
  if (!offen.length) return null;
  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-2.5 text-sm flex flex-col gap-1.5">
      <b className="text-amber-900 dark:text-amber-200">{offen.length} Datenbank-Änderung{offen.length > 1 ? "en" : ""} {projekt.db_live_ref ? "gehen mit dem Live-Schalten in die Live-Datenbank" : "– Test und Live teilen sich die Datenbank (schon eingespielt)"}</b>
      {offen.map((o) => (
        <details key={o.datei} className="text-xs"><summary className="cursor-pointer font-mono">{o.datei}</summary>
          <pre className="mt-1 max-h-64 overflow-auto rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 font-mono text-[11.5px] whitespace-pre">{o.sql}</pre></details>))}
      {projekt.db_live_ref && <span className="text-xs text-amber-800 dark:text-amber-300">Vor dem Einspielen sichert der Ablauf „Datenbank“ den Aufbau der Live-Datenbank (in ihr selbst, ohne Daten). Jede Datei läuft für sich – bei einem Fehler bleibt nichts von ihr. Bitte vor dem Live-Schalten durchsehen; zurückgerollt wird die Datenbank nicht.</span>}
    </div>);
}

// Jetzt unabhängig prüfen: ein Feature, eine Gruppe oder die ganze App (Werkstatt des Admins, nur lesen)
const PRUEF_UMFANG = [["feature", "Ein Feature", "Code, Rechte, Datenschutz, Aussehen", "etwa 3–5 %"], ["gruppe", "Eine ganze Gruppe", "alle Features der Gruppe zusammen", "etwa 8–15 %"], ["app", "Die ganze App", "große Sicherheits- und Qualitätsprüfung", "etwa 20–40 %"]];
function JetztPruefen({ d, ich, darf, projekt, toast }) {
  const [umfang, setUmfang] = useState("feature"); const [ziel, setZiel] = useState(""); const [busy, setBusy] = useState(false);
  const [liste, setListe] = useState([]); const [offen, setOffen] = useState(null); const [gruppeFuer, setGruppeFuer] = useState(""); const [bestaetigen, setBestaetigen] = useState(null);
  const konzept = projekt?.konzept_gruppe_id;
  const gruppen = d.gruppen.filter((g) => g.id !== konzept && darf(g.bereich_id, "freigeben"));
  const features = d.features.filter((f) => !f.ausgebaut && gruppen.some((g) => g.id === f.gruppe_id));
  const holen = useCallback(async () => { const { data } = await supabase.from("ws_pruefungen").select("*").eq("projekt_id", d.projektId).order("id", { ascending: false }).limit(8); setListe(data || []); }, [d.projektId]);
  useEffect(() => { holen(); const ch = supabase.channel("cs-pruef-" + d.projektId).on("postgres_changes", { event: "*", schema: "public", table: "ws_pruefungen" }, holen).subscribe(); const t = setInterval(holen, 20000); return () => { supabase.removeChannel(ch); clearInterval(t); }; }, [holen, d.projektId]);
  useEffect(() => setZiel(""), [umfang]);
  const darfApp = ich.rolle === "admin";
  if (!gruppen.length && !darfApp) return null;
  const laeuft = liste.find((p) => ["wartet", "laeuft"].includes(p.stand));
  const auswahl = umfang === "feature" ? features.map((f) => [f.id, `${f.name} (${f.id})`]) : umfang === "gruppe" ? gruppen.map((g) => [g.id, g.name]) : [];
  const starten = async () => {
    setBusy(true); const { error } = await supabase.rpc("ws_pruefung_anfordern", { p_projekt: d.projektId, p_umfang: umfang, p_ziel: umfang === "app" ? null : ziel }); setBusy(false);
    toast(error ? fehler(error) : "Prüfung gestartet – die Werkstatt des Admins prüft nur lesend"); holen();
  };
  const zielName = (p) => p.umfang === "app" ? "Ganze App" : p.umfang === "gruppe" ? `Gruppe ${d.gruppen.find((g) => g.id === p.ziel)?.name || p.ziel}` : d.features.find((f) => f.id === p.ziel)?.name || p.ziel;
  const alsAuftrag = async (p) => {
    const { data, error } = await supabase.rpc("ws_pruefung_als_auftrag", { p_id: p.id, p_gruppe: p.umfang === "app" ? gruppeFuer || null : null });
    toast(error ? fehler(error) : `Auftrag #${data} an die Werkstatt gestellt`); holen();
  };
  const auftragsGruppen = d.gruppen.filter((g) => g.id !== konzept && darf(g.bereich_id, "auftraege"));
  return (
    <section className={`${card} p-4 flex flex-col gap-3 xl:sticky xl:top-3`} aria-label="Jetzt unabhängig prüfen">
      <h2 className="font-display font-bold text-xl flex items-center gap-2"><ScanSearch className="w-5 h-5" />Jetzt unabhängig prüfen</h2>
      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Was prüfen?">
        {PRUEF_UMFANG.filter(([k]) => k !== "app" || darfApp).filter(([k]) => k === "app" || gruppen.length).map(([k, t, u]) => (
          <button key={k} type="button" role="radio" aria-checked={umfang === k} onClick={() => setUmfang(k)} className={`text-left rounded-lg border px-3 py-2 ${umfang === k ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" : "border-slate-200 dark:border-slate-700"}`}>
            <b className="font-display">{t}</b><div className="text-xs text-slate-500">{u}</div></button>))}
      </div>
      {umfang !== "app" && <label className="flex flex-col gap-1 text-xs text-slate-500">Was genau?
        <select className={input} value={ziel} onChange={(e) => setZiel(e.target.value)}><option value="">– bitte wählen –</option>{auswahl.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>}
      <p className="text-xs text-slate-500">Braucht grob {PRUEF_UMFANG.find((x) => x[0] === umfang)[3]} deines 5-Stunden-Kontingents (Claude, großes Modell). Läuft auf der Werkstatt des Admins.</p>
      <button type="button" className={btn} disabled={busy || !!laeuft || (umfang !== "app" && !ziel) || !projekt?.repo} onClick={starten}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}{laeuft ? "Eine Prüfung läuft schon" : "Prüfung starten"}</button>
      {!projekt?.repo && <p className="text-xs text-slate-500">Prüfen geht, sobald das Projekt ein GitHub-Repository hat.</p>}
      {liste.length > 0 && <div className="flex flex-col gap-2 border-t border-slate-200 dark:border-slate-800 pt-3"><span className="text-[11px] uppercase tracking-widest font-semibold text-slate-500">Letzte Prüfungen</span>
        {liste.map((p) => (
          <div key={p.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 text-sm flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap"><b className="font-display">#{p.id} {zielName(p)}</b>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${p.stand === "gruen" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" : p.stand === "rot" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                {{ wartet: "wartet", laeuft: "läuft …", gruen: "GRÜN", rot: "ROT", fehler: "Fehler", abgebrochen: "abgebrochen" }[p.stand]}</span>
              <span className="text-xs text-slate-500 ml-auto">{fmt(p.erstellt)}</span></div>
            {p.befund && <button type="button" className="text-xs text-slate-500 underline self-start" onClick={() => setOffen(offen === p.id ? null : p.id)}>{offen === p.id ? "Befunde ausblenden" : "Befunde anzeigen"}</button>}
            {offen === p.id && p.befund && <div className="text-[13px] max-h-72 overflow-auto rounded-md bg-slate-50 dark:bg-slate-950 p-2"><Markdown text={p.befund} klein /></div>}
            {p.stand === "wartet" && (ich.rolle === "admin" || p.von === ich.id) && <button type="button" className={`${ghost} h-8 text-xs self-start`} onClick={async () => { const { error } = await supabase.rpc("ws_pruefung_abbrechen", { p_id: p.id }); toast(error ? fehler(error) : "Prüfung abgebrochen"); holen(); }}><X className="w-3.5 h-3.5" />Abbrechen</button>}
            {p.stand === "rot" && !p.auftrag_id && auftragsGruppen.length > 0 && <div className="flex gap-2 flex-wrap items-center">
              {p.umfang === "app" && <select aria-label="Gruppe für den Auftrag" className={`${input} h-8 py-0 text-sm max-w-[180px]`} value={gruppeFuer} onChange={(e) => setGruppeFuer(e.target.value)}><option value="">Gruppe wählen …</option>{auftragsGruppen.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>}
              {bestaetigen === p.id
                ? <span className="flex gap-2 flex-wrap items-center text-[13px] basis-full">Diese Befunde (oben) gehen als Auftrag an die Werkstatt – vorher durchlesen.
                    <button type="button" className={`${btn} h-8 text-sm`} onClick={() => { setBestaetigen(null); alsAuftrag(p); }}>Ja, Auftrag stellen</button><button type="button" className={`${ghost} h-8`} onClick={() => setBestaetigen(null)}>Abbrechen</button></span>
                : <button type="button" className={`${btn} h-8 text-sm`} disabled={p.umfang === "app" && !gruppeFuer} onClick={() => { setOffen(p.id); setBestaetigen(p.id); }}><Send className="w-3.5 h-3.5" />Befunde als Auftrag …</button>}</div>}
            {p.auftrag_id && <span className="text-xs text-slate-500">Daraus wurde Auftrag #{p.auftrag_id}.</span>}
          </div>))}</div>}
    </section>);
}

// ---------------- Live-Vorschau (Menüpunkt): aktuelle App + „Zeigen & kommentieren“ → Auftrag an Gruppe/Feature ----------------
function LiveVorschauSeite({ d, ich, toast }) {
  const projekt = d.projekte.find((p) => p.id === d.projektId);
  const rolle = ich.rolle === "admin" ? "admin" : d.mitglieder.find((m) => m.projekt_id === d.projektId && m.benutzer_id === ich.id)?.rolle;
  const darf = useCallback((bereich, recht) => rolle === "admin" || d.rechte.some((r) => r.benutzer_id === ich.id && r.bereich_id === bereich && r[recht] && (recht === "auftraege" ? ["entwickler", "texter"].includes(rolle) : rolle === "entwickler")), [d.rechte, ich, rolle]);
  // Nur Gruppen, in denen ich Aufträge geben darf (globale Gruppen zuletzt)
  const bereichName = (id) => d.bereiche.find((b) => b.id === id)?.name || "";
  const gruppen = d.gruppen.filter((g) => darf(g.bereich_id, "auftraege"))
    .sort((a, b) => (!!d.bereiche.find((x) => x.id === a.bereich_id)?.global - !!d.bereiche.find((x) => x.id === b.bereich_id)?.global) || a.name.localeCompare(b.name, "de"));
  const [gid, setGid] = useState(() => merke.lies("cs-vorschau-gruppe") || "");
  const [fid, setFid] = useState("");
  const [baustein, setBaustein] = useState(null);
  const g = gruppen.find((x) => x.id === gid) || null;
  const feats = g ? d.features.filter((f) => f.gruppe_id === g.id && !f.ausgebaut && !f.ausgeblendet) : [];
  const f = feats.find((x) => x.id === fid) || null;
  const waehleGruppe = (v) => { setGid(v); setFid(""); merke.schreib("cs-vorschau-gruppe", v); };
  return (
    <section className="flex flex-col gap-3" aria-label="Live-Vorschau">
      <div><h2 className="font-display font-bold text-xl leading-tight">Live-Vorschau</h2>
        <p className="text-sm text-slate-500">Die aktuelle App. Mit <b>Zeigen & kommentieren</b> klickst du auf ein Element, wählst Gruppe (und Feature) und schreibst, was sich ändern soll – daraus wird ein Auftrag.</p></div>
      <div className="grid gap-3 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(320px,38%)_minmax(0,1fr)] lg:h-[calc(100vh-210px)] min-h-[560px]">
        <div className={`${card} flex flex-col min-h-0 overflow-hidden`}>
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 grid gap-2">
            <label className="flex flex-col gap-1 text-xs text-slate-500">Gruppe
              <select className={input} value={g?.id || ""} onChange={(e) => waehleGruppe(e.target.value)}>
                <option value="">– Gruppe wählen –</option>
                {gruppen.map((x) => <option key={x.id} value={x.id}>{x.name} · {bereichName(x.bereich_id)}</option>)}
              </select></label>
            {g && <label className="flex flex-col gap-1 text-xs text-slate-500">Feature (optional)
              <select className={input} value={f?.id || ""} onChange={(e) => setFid(e.target.value)}>
                <option value="">Ganze Gruppe</option>
                {feats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select></label>}
            {!gruppen.length && <p className="text-xs text-slate-500">Du darfst in diesem Projekt keine Aufträge geben – die Vorschau kannst du trotzdem ansehen.</p>}
          </div>
          {g ? <div className="flex-1 min-h-0 flex flex-col"><AuftragsChat key={`${g.id}-${f?.id || ""}`} g={g} f={f} d={d} ich={ich} darf={darf} toast={toast} eingebettet baustein={baustein} onBausteinFertig={() => setBaustein(null)} /></div>
            : <div className="flex-1 grid place-items-center p-6 text-sm text-slate-500 text-center"><span><MousePointerClick className="w-5 h-5 mx-auto mb-2 text-orange-500" />Zuerst eine Gruppe wählen, dann rechts auf „Zeigen & kommentieren“ und auf das Element klicken.</span></div>}
        </div>
        <LiveVorschau projekt={projekt} a={null} toast={toast} onBaustein={setBaustein} baustein={baustein} />
      </div>
    </section>);
}

// ---------------- Feature-Arbeitsplatz (Doppelklick): Chat links, Live-Vorschau rechts ----------------
function FeatureArbeitsplatz({ f, g, d, ich, darf, toast, onZurueck, onLoeschen }) {
  const projekt = d.projekte.find((p) => p.id === d.projektId);
  const js = d.auftraege.filter((a) => a.feature_id === f.id);
  const aktiv = [...js].reverse().find((a) => !ABGESCHLOSSEN.includes(a.stand) && a.zweig) || null;
  const laufend = js.find((a) => a.stand === "laeuft");
  const [links, setLinks] = useState(() => Number(merke.lies("cs-platz-links")) || 40);
  const [baustein, setBaustein] = useState(null);
  const raster = useRef(null);
  const ziehen = (e) => {
    const r = raster.current?.getBoundingClientRect(); if (!r) return;
    const bewegen = (ev) => { const p = Math.min(70, Math.max(25, ((ev.clientX - r.left) / r.width) * 100)); setLinks(p); merke.schreib("cs-platz-links", String(Math.round(p))); };
    const los = () => { window.removeEventListener("pointermove", bewegen); window.removeEventListener("pointerup", los); };
    window.addEventListener("pointermove", bewegen); window.addEventListener("pointerup", los); e.preventDefault();
  };
  return (
    <section className="flex flex-col gap-3" aria-label={`Arbeitsplatz ${f.name}`}>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={ghost} onClick={onZurueck}><ArrowLeft className="w-4 h-4" />Zentrale</button>
        <div className="min-w-0"><div className="text-xs text-slate-500">{g?.name} · <span className="font-mono">{f.id}</span></div><h2 className="font-display font-bold text-xl leading-tight">{f.name}</h2></div>
        {laufend && <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600"><i className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />Hier wird gerade gearbeitet</span>}
        <span className="flex-1" />
        {onLoeschen && darf(g?.bereich_id, "loeschen") && <button type="button" className={`${ghost} h-9 text-xs`} onClick={onLoeschen}><Trash2 className="w-3.5 h-3.5" />{f.ausgeblendet ? "Wieder einblenden" : "Feature löschen …"}</button>}
      </div>
      <div ref={raster} className="grid gap-0 lg:[grid-template-columns:var(--links)_8px_minmax(0,1fr)] h-auto lg:h-[calc(100vh-190px)] min-h-[560px]" style={{ "--links": `${links}%` }}>
        <AuftragsChat g={g} f={f} d={d} ich={ich} darf={darf} toast={toast} eingebettet baustein={baustein} onBausteinFertig={() => setBaustein(null)} />
        <div className="hidden lg:block cursor-col-resize group" onPointerDown={ziehen} role="separator" aria-orientation="vertical" aria-label="Breite ändern"><div className="mx-auto w-1 h-full rounded bg-slate-200 dark:bg-slate-800 group-hover:bg-emerald-600" /></div>
        <LiveVorschau projekt={projekt} a={aktiv} f={f} darfMerken={darf(g?.bereich_id, "auftraege")} toast={toast} onBaustein={setBaustein} baustein={baustein} />
      </div>
    </section>);
}

// Live-Vorschau: echte Testseite des Auftrags (Cloudflare), meldet neue Stände, „Zeigen & kommentieren“ über den Vorschau-Helfer der App
function LiveVorschau({ projekt, a, f, darfMerken, toast, onBaustein, baustein }) {
  const url = vorschauUrl(projekt, a);
  const [gemerkt, setGemerkt] = useState(f?.vorschau_pfad || null);
  useEffect(() => { setGemerkt(f?.vorschau_pfad || null); }, [f?.id, f?.vorschau_pfad]);
  const startSeite = seiteOk(gemerkt) ? gemerkt : seiteOk(projekt?.vorschau_pfad) ? projekt.vorschau_pfad : "/";
  const [jetztSeite, setJetztSeite] = useState(null);
  // Design in der Vorschau (Entwurf 1.0, 24.10.2026): aktuelle App, Seiten-Entwurf des Designers oder ein Grunddesign-Entwurf –
  // wirkt nur in dieser Vorschau (Vorschau-Helfer der App), nichts wird gespeichert
  const [designWahl, setDesignWahl] = useState("app");
  const [entwuerfe, setEntwuerfe] = useState([]);
  useEffect(() => {
    if (!projekt?.id) return undefined; let aus = false;
    supabase.from("ws_design_entwuerfe").select("id, name, stand, werte").eq("projekt_id", projekt.id).neq("stand", "verworfen").order("geaendert", { ascending: false }).limit(30)
      .then(({ data }) => { if (!aus) setEntwuerfe(data || []); });
    return () => { aus = true; };
  }, [projekt?.id]);
  const merken = async () => {
    if (!f || !seiteOk(jetztSeite)) return;
    const { error } = await supabase.rpc("ws_feature_vorschau_setzen", { p_feature: f.id, p_pfad: jetztSeite });
    if (error) toast(fehler(error)); else { setGemerkt(jetztSeite); toast(`Gemerkt: ${f.name} öffnet ab jetzt ${jetztSeite}`); }
  };
  const [breite, setBreite] = useState("100%");
  const [neu, setNeu] = useState(false); const [stand, setStand] = useState(null); const [schluessel, setSchluessel] = useState(0);
  const [zeigen, setZeigen] = useState(false); const [helfer, setHelfer] = useState(false);
  const frame = useRef(null);
  const herkunft = url ? new URL(url).origin : null;
  useEffect(() => { setNeu(false); setStand(null); setHelfer(false); setZeigen(false); }, [url]);
  // Neuer Stand: /version.json der Testseite (enthält den Commit, den Cloudflare gebaut hat)
  useEffect(() => {
    if (!url) return undefined;
    let aus = false;
    const pruefen = async () => {
      try {
        const r = await fetch(`${url}/version.json?t=${Date.now()}`, { cache: "no-store" }); if (!r.ok) return;
        const v = await r.json(); if (aus || !v?.commit) return;
        setStand((alt) => { if (alt && alt !== v.commit) setNeu(true); return alt || v.commit; });
      } catch { /* Testseite noch nicht gebaut oder ohne version.json */ }
    };
    pruefen(); const t = setInterval(pruefen, 20000);
    return () => { aus = true; clearInterval(t); };
  }, [url]);
  // Antworten des Vorschau-Helfers (nur von der Testseite selbst)
  useEffect(() => {
    const an = (e) => {
      if (e.origin !== herkunft || e.source !== frame.current?.contentWindow || typeof e.data !== "object" || !e.data) return;
      if (e.data.cs === "bereit") {
        setHelfer(true);
        const w = frame.current?.contentWindow;
        if (w && designWahl === "seiten") w.postMessage({ cs: "seiten-entwurf", an: true }, herkunft);
        const ent = designWahl.startsWith("e:") ? entwuerfe.find((x) => `e:${x.id}` === designWahl) : null;
        if (w && ent?.werte && typeof ent.werte === "object") w.postMessage({ cs: "design", werte: ent.werte }, herkunft);
      }
      if (e.data.cs === "seite" && seiteOk(e.data.pfad)) setJetztSeite(e.data.pfad);
      if (e.data.cs === "baustein") {
        const b = { name: String(e.data.name || "").slice(0, 200), seite: String(e.data.seite || "").slice(0, 200), pfad: String(e.data.pfad || "").slice(0, 300), text: String(e.data.text || "").slice(0, 200) };
        onBaustein(b); setZeigen(false); toast(`Baustein gewählt: ${b.name} – schreib links, was sich ändern soll`);
      }
    };
    window.addEventListener("message", an); return () => window.removeEventListener("message", an);
  }, [herkunft, onBaustein, toast, designWahl, entwuerfe]);
  useEffect(() => { if (herkunft && frame.current?.contentWindow) frame.current.contentWindow.postMessage({ cs: "zeigen", an: zeigen }, herkunft); }, [zeigen, herkunft]);
  const neuLaden = () => { setNeu(false); setStand(null); setSchluessel((k) => k + 1); };
  if (!url) return <div className={`${card} grid place-items-center p-8 text-sm text-slate-500`}>Für dieses Projekt ist noch keine Vorschau-Adresse hinterlegt.</div>;
  return (
    <div className={`${card} flex flex-col min-h-[480px] min-w-0 overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-2 p-2 border-b border-slate-200 dark:border-slate-800">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-500 bg-slate-50 dark:bg-slate-950 rounded-lg px-2.5 py-1.5" title={url}>{url.replace("https://", "")}{a ? ` · Auftrag #${a.id}` : " · aktuelle App"}</span>
        {[["390px", Smartphone, "Handy"], ["820px", Tablet, "Tablet"], ["100%", Monitor, "Desktop"]].map(([w, I, t]) => <button key={w} type="button" title={t} aria-pressed={breite === w} onClick={() => setBreite(w)} className={`p-2 rounded-lg border ${breite === w ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950" : "border-slate-200 dark:border-slate-800"}`}><I className="w-4 h-4" /></button>)}
        <label className="sr-only" htmlFor="lv-design">Design in der Vorschau</label>
        <select id="lv-design" value={designWahl} onChange={(e) => { setDesignWahl(e.target.value); neuLaden(); }} title="Wirkt nur in dieser Vorschau – nichts wird gespeichert"
          className="h-9 max-w-[220px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 text-sm">
          <option value="app">Design: aktuelle App</option>
          <option value="seiten">Design: Seiten-Entwurf (Designer)</option>
          {entwuerfe.map((x) => <option key={x.id} value={`e:${x.id}`}>Grunddesign: {x.name}</option>)}
        </select>
        <button type="button" title="Neu laden" onClick={neuLaden} className="p-2 rounded-lg border border-slate-200 dark:border-slate-800"><RefreshCw className="w-4 h-4" /></button>
        <button type="button" aria-pressed={zeigen} disabled={!helfer} title={helfer ? "Auf ein Element in der Vorschau klicken und kommentieren" : "Die Testseite hat den Vorschau-Helfer noch nicht (kommt mit dem nächsten Stand der App)"} onClick={() => setZeigen(!zeigen)}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-semibold disabled:opacity-50 ${zeigen ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300" : "border-slate-200 dark:border-slate-800"}`}><MousePointerClick className="w-4 h-4" />Zeigen & kommentieren</button>
        <button type="button" title="Im eigenen Fenster öffnen" onClick={() => oeffneExtern(`${url}${jetztSeite || startSeite}`)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-800"><ExternalLink className="w-4 h-4" /></button>
      </div>
      {f && <div className="flex flex-wrap items-center gap-2 px-2 pt-2 text-xs">
        <span className="text-slate-500">Seite für dieses Feature:</span><span className="font-mono">{gemerkt || "Startseite"}</span>
        {darfMerken && helfer && jetztSeite && jetztSeite !== gemerkt && <button type="button" className={`${ghost} h-8 text-xs`} onClick={merken} title={`Ab jetzt öffnet „${f.name}“ hier: ${jetztSeite}`}><Pin className="w-3.5 h-3.5" />Diese Seite merken ({jetztSeite})</button>}
        {jetztSeite && jetztSeite !== startSeite && <button type="button" className={`${ghost} h-8 text-xs`} onClick={() => { setJetztSeite(null); setSchluessel((k) => k + 1); }}><Undo2 className="w-3.5 h-3.5" />Zurück zur Feature-Seite</button>}
      </div>}
      {designWahl !== "app" && <p className="mx-2 mt-2 text-xs rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900 text-amber-800 dark:text-amber-300 px-2.5 py-1.5">
        {designWahl === "seiten" ? "Vorschau mit dem gespeicherten Seiten-Entwurf (Plattform-Standard) – nur hier sichtbar, nichts wird geändert. Voraussetzung: Der Seiten-Designer (App-Designer › Seiten) war in dieser Sitzung offen und freigegeben – sonst zeigt die Vorschau die aktuelle App." : "Vorschau mit dem Grunddesign-Entwurf – nur hier sichtbar. In der App wirkt er erst, wenn du ihn im App-Designer als Auftrag sendest."}</p>}
      {neu && <button type="button" onClick={neuLaden} className="m-2 self-end inline-flex items-center gap-2 rounded-full bg-emerald-700 text-white px-3 py-1.5 text-sm font-semibold"><RefreshCw className="w-4 h-4" />Neuer Stand da · neu laden</button>}
      {baustein && <div className="mx-2 mt-2 text-xs rounded-lg border border-orange-400 bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1.5 flex items-center gap-2">Gewählt: <b>{baustein.name}</b>{baustein.seite && <span className="text-slate-500">· {baustein.seite}</span>}<button type="button" className="ml-auto" onClick={() => onBaustein(null)} title="Auswahl aufheben"><X className="w-3.5 h-3.5" /></button></div>}
      <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 overflow-auto grid justify-items-center">
        <iframe key={schluessel} ref={frame} title="Live-Vorschau" src={`${url}${mitCs(startSeite)}`} className="h-full min-h-[440px] bg-white rounded-lg border border-slate-200 dark:border-slate-800" style={{ width: breite, maxWidth: "100%" }}
          onLoad={() => { setHelfer(false); frame.current?.contentWindow?.postMessage({ cs: "hallo" }, herkunft); }} />
      </div>
    </div>);
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
  const [name, setName] = useState(""); const [bereich, setBereich] = useState(d.bereiche.find((b) => !b.global)?.id); const [symbol, setSymbol] = useState("layers"); const [busy, setBusy] = useState(false);
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
      <label className="flex flex-col gap-1 text-sm text-slate-500">Bereich<select id="ws-gbereich" className={input} value={bereich} onChange={(e) => setBereich(e.target.value)}>{d.bereiche.filter((b) => !b.global).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
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
      <CodeschmiedeZeichen groesse={64} />
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
        : <span className="text-slate-600 dark:text-slate-300 font-semibold">Abo-Limits</span>}
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
// Einrichtungs-Assistent beim ersten Start von selbst öffnen – und später, wenn auf diesem PC etwas Wichtiges fehlt (einmal je Programmstart)
let einrichtungAutoGezeigt = false;
function EinrichtungAuto({ ich, d, onOeffnen }) {
  const { st, offen } = useEinrichtung(ich, d);
  useEffect(() => {
    if (einrichtungAutoGezeigt || !st?.desk) return;
    let gesehen = false; try { gesehen = localStorage.getItem("cs-einrichtung-gesehen") === "1"; } catch { /* egal */ }
    // offen zählt auch die laufende Werkstatt – kurz nach dem Start ist sie evtl. noch nicht an, darum nur Werkzeuge/Anmeldung werten
    // Nur wer baut (Admin/Entwickler), braucht die Werkzeuge – Leser sehen den Assistenten nur beim ersten Start (Prüfung 0.8.0)
    const baut = ich?.rolle === "admin" || (d?.mitglieder || []).some((m) => m.benutzer_id === ich?.id && m.rolle === "entwickler");
    const werkzeugFehlt = baut && ["node", "git", "claude", "gh", "gh_angemeldet"].some((k) => !st.werk?.[k]);
    if (!gesehen || werkzeugFehlt) { einrichtungAutoGezeigt = true; onOeffnen(); }
    else einrichtungAutoGezeigt = true;
  }, [st, offen, onOeffnen, ich, d]);
  return null;
}

let werkstattAutoVersucht = false;   // einmal je Programmstart
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
  const an = !!st?.laeuft;
  const umschalten = async (auto = false) => {
    setBusy(true);
    try {
      if (an) { await tauri("ws_stop"); merke.schreib("cs-werkstatt-aus", "1", "sitzung"); toast("Werkstatt aus: dieser PC übernimmt keine Aufträge mehr (beim nächsten Start wieder an)"); return; }
      const v = await tauri("ws_check");
      const namen = { claude: "Claude Code", node: "Node.js", git: "Git", gh: "GitHub CLI" };
      const fehlt = ["claude", "node", "git", "gh"].filter((k) => !v[k]);
      if (fehlt.length) { toast(`${auto ? "Werkstatt konnte nicht automatisch starten – " : ""}Auf diesem PC fehlt: ${fehlt.map((k) => namen[k]).join(", ")}`); return; }
      if (!v.gh_angemeldet) { toast(`${auto ? "Werkstatt konnte nicht automatisch starten – " : ""}GitHub ist auf diesem PC nicht angemeldet (einmal „gh auth login“)`); return; }
      merke.schreib("cs-werkstatt-aus", "", "sitzung");
      await tauri("ws_start", { config: { supabase_url: import.meta.env.VITE_SUPABASE_URL, anon_key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, access_token: sitzung.access_token, user_id: ich.id, admin: ich.rolle === "admin" } });
      toast(auto ? "Werkstatt automatisch eingeschaltet" : "Werkstatt an: dieser PC übernimmt Aufträge");
    } catch (e) { toast(fehler(e)); } finally { setBusy(false); }
  };
  // Neue Anweisung Gerhard 2026-10-23 10:20/10:22: Werkstatt ist bei jedem Programmstart an. Ausschalten gilt bis zum nächsten Start.
  useEffect(() => {
    if (!desk || !darfWerkstatt || !st || st.laeuft || busy || werkstattAutoVersucht || !sitzung?.access_token) return;
    if (merke.lies("cs-werkstatt-aus", "sitzung") === "1") return;
    werkstattAutoVersucht = true;
    umschalten(true);
  }, [desk, darfWerkstatt, st, busy, sitzung?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!desk) return <span className="text-xs text-slate-500" title="Die Werkstatt läuft nur im Programm Codeschmiede">Werkstatt-PCs online: <b>{d.pcs.filter((p) => p.an && Date.now() - new Date(p.zuletzt).getTime() < 180000).length}</b></span>;
  if (!darfWerkstatt) return <UpdateHinweis toast={toast} />;
  return (
    <>
      <button type="button" role="switch" aria-checked={an} disabled={busy} onClick={() => umschalten(false)} className="inline-flex items-center gap-2.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-1.5 pr-3 py-1 text-sm">
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

// ---------------- Projekte verwalten (Hinweis Gerhard 2026-10-23 15:34): archivieren / wiederherstellen / endgültig löschen ----------------
// Nur Admin. Löschen entfernt die Daten des Projekts in der Codeschmiede (nicht das GitHub-Repository, nicht die App) – Bestätigung mit dem Namen.
function ProjekteVerwalten({ toast, aktiv, onClose, onWeg }) {
  const [liste, setListe] = useState(null); const [weg, setWeg] = useState(null); const [umfang, setUmfang] = useState(null);
  const [name, setName] = useState(""); const [busy, setBusy] = useState(false); const [tick, setTick] = useState(0);
  useEffect(() => {
    const holen = () => supabase.from("ws_projekte").select("id, name, repo, archiviert, logo, repo_stand, repo_hinweis, repo_privat, repo_aktion").order("name").then(({ data }) => setListe(data || []));
    holen(); const t = setInterval(holen, 8000); return () => clearInterval(t);   // Stand des Repository-Auftrags live sehen
  }, [tick]);
  const repoAnlegen = async (p, privat) => { const { error } = await supabase.rpc("ws_repo_anfordern", { p_projekt: p.id, p_privat: privat }); if (error) toast(fehler(error)); else { toast("Deine Werkstatt legt das GitHub-Repository an"); setTick((t) => t + 1); } };
  const [oeffnen, setOeffnen] = useState(null); const [bestaetigt, setBestaetigt] = useState("");   // Öffentlich machen nur mit Eintippen (Prüfung M4)
  const sichtbar = async (p, privat) => {
    if (!privat && oeffnen?.id !== p.id) { setOeffnen(p); setBestaetigt(""); return; }
    setOeffnen(null); const { error } = await supabase.rpc("ws_repo_sichtbarkeit", { p_projekt: p.id, p_privat: privat }); if (error) toast(fehler(error)); else { toast(privat ? "Wird auf privat umgestellt" : "Wird auf öffentlich umgestellt"); setTick((t) => t + 1); } };
  const archiv = async (p, aus) => {
    const { error } = await supabase.rpc("ws_projekt_archivieren", { p_projekt: p.id, p_aus: aus });
    if (error) { toast(fehler(error)); return; }
    toast(aus ? `„${p.name}“ archiviert` : `„${p.name}“ wiederhergestellt`); if (aus) onWeg(p.id); setTick((t) => t + 1);
  };
  const vorbereiten = async (p) => {
    setWeg(p); setName(""); setUmfang(null);
    const { data, error } = await supabase.rpc("ws_projekt_umfang", { p_projekt: p.id });
    if (error) { toast(fehler(error)); setWeg(null); } else setUmfang(data);
  };
  const loeschen = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("ws_projekt_loeschen", { p_projekt: weg.id, p_bestaetigung: name });
    setBusy(false);
    if (error) { toast(fehler(error)); return; }
    toast(`Projekt „${weg.name}“ gelöscht`); onWeg(weg.id); setWeg(null); setTick((t) => t + 1);
  };
  if (oeffnen) return (
    <Dialog title={`${oeffnen.repo} öffentlich machen?`} onClose={() => setOeffnen(null)}>
      <p className="text-sm">Danach kann <b>jeder</b> den ganzen Code samt Verlauf und Dokumentation (auch docs/KONZEPT.md) bei GitHub sehen. Geheimnisse dürfen ohnehin nie im Repository stehen – prüfe das trotzdem vorher.</p>
      <label className="flex flex-col gap-1 text-sm text-slate-500">Zur Bestätigung den Namen eingeben: <b className="text-slate-800 dark:text-slate-100 font-mono">{oeffnen.repo}</b>
        <input id="cs-repo-oeffentlich" className={input} value={bestaetigt} onChange={(e) => setBestaetigt(e.target.value)} autoFocus /></label>
      <div className="flex justify-end gap-2"><button type="button" className={ghost} onClick={() => setOeffnen(null)}>Abbrechen</button>
        <button type="button" className={btn} disabled={bestaetigt.trim() !== oeffnen.repo} onClick={() => sichtbar(oeffnen, false)}>Öffentlich machen</button></div>
    </Dialog>);
  if (weg) return (
    <Dialog title={`Projekt „${weg.name}“ endgültig löschen`} onClose={() => setWeg(null)}>
      <p className="text-sm">Gelöscht werden alle Daten dieses Projekts <b>in der Codeschmiede</b>: Bereiche, Gruppen, Features, Aufträge mit Verlauf, Chats, Designer-Entwürfe, Abgleich, KI-Zuständigkeiten, Verbrauch und Mitgliedschaften.
        Das <b>GitHub-Repository</b>{weg.repo ? ` (${weg.repo})` : ""} und die App selbst bleiben unberührt. Das lässt sich nicht rückgängig machen – zum Ausblenden lieber „Archivieren“.</p>
      {umfang ? <ul className="text-sm grid grid-cols-2 gap-1 rounded-lg bg-slate-50 dark:bg-slate-950 p-3">
        <li>{umfang.gruppen} Gruppen</li><li>{umfang.features} Features</li><li>{umfang.auftraege} Aufträge</li><li>{umfang.mitglieder} Mitglieder</li>
        {umfang.laufend > 0 && <li className="col-span-2 text-red-600 font-semibold">{umfang.laufend} Auftrag/Prüfung läuft – erst abschließen oder abbrechen.</li>}
      </ul> : <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />}
      <label className="flex flex-col gap-1 text-sm text-slate-500">Zur Bestätigung den Projektnamen eingeben: <b className="text-slate-800 dark:text-slate-100">{weg.name}</b>
        <input id="ws-projekt-loeschen" className={input} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
      <div className="flex justify-end gap-2"><button type="button" className={ghost} onClick={() => setWeg(null)}>Abbrechen</button>
        <button type="button" className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-display font-bold tracking-wide transition" disabled={busy || name !== weg.name || !umfang || umfang.laufend > 0} onClick={loeschen}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Endgültig löschen</button></div>
    </Dialog>);
  return (
    <Dialog title="Projekte verwalten" onClose={onClose}>
      {!liste ? <Loader2 className="w-5 h-5 animate-spin text-emerald-700" /> : (
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
          {liste.map((p) => (
            <div key={p.id} className="py-2.5 flex flex-wrap items-center gap-2">
              {p.logo && <LogoZeichen werte={p.logo} groesse={28} />}
              <div className="min-w-0 flex-1"><div className="font-semibold flex items-center gap-2">{p.name}{p.id === aktiv && <span className="text-[11px] rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">geöffnet</span>}{p.archiviert && <span className="text-[11px] rounded-full px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">archiviert</span>}</div>
                <div className="text-xs text-slate-500 font-mono break-all">{p.id}{p.repo ? ` · ${p.repo}` : ""}</div>
                {p.repo_stand && p.repo_stand !== "fertig" && <div className={`text-xs mt-0.5 flex items-center gap-1 ${p.repo_stand === "fehler" ? "text-red-700 dark:text-red-400" : "text-slate-500"}`}>{["angefragt", "laeuft"].includes(p.repo_stand) && <Loader2 className="w-3 h-3 animate-spin" />}GitHub: {p.repo_hinweis}</div>}</div>
              {!p.archiviert && !p.repo && !["angefragt", "laeuft"].includes(p.repo_stand) && <button type="button" className={`${ghost} h-9 text-xs`} onClick={() => repoAnlegen(p, false)}><GitBranch className="w-3.5 h-3.5" />GitHub-Repository anlegen</button>}
              {p.repo && !["angefragt", "laeuft"].includes(p.repo_stand) && (p.repo_privat == null
                ? <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Lock className="w-3.5 h-3.5" />Sichtbarkeit:<button type="button" className={`${ghost} h-8 text-xs`} onClick={() => sichtbar(p, false)}>Öffentlich …</button><button type="button" className={`${ghost} h-8 text-xs`} onClick={() => sichtbar(p, true)}>Privat</button></span>
                : <button type="button" className={`${ghost} h-9 text-xs`} title={`Jetzt ${p.repo_privat ? "privat" : "öffentlich"} – bei GitHub umstellen`} onClick={() => sichtbar(p, !p.repo_privat)}><Lock className="w-3.5 h-3.5" />{p.repo_privat ? "Öffentlich machen …" : "Auf privat stellen"}</button>)}
              {p.archiviert ? <button type="button" className={`${ghost} h-9 text-xs`} onClick={() => archiv(p, false)}><ArchiveRestore className="w-3.5 h-3.5" />Wiederherstellen</button>
                : <button type="button" className={`${ghost} h-9 text-xs`} onClick={() => archiv(p, true)}><Archive className="w-3.5 h-3.5" />Archivieren</button>}
              <button type="button" className={`${ghost} h-9 text-xs text-red-700 dark:text-red-400`} onClick={() => vorbereiten(p)}><Trash2 className="w-3.5 h-3.5" />Löschen …</button>
            </div>))}
        </div>)}
      <div className="flex justify-end"><button type="button" className={ghost} onClick={onClose}>Schließen</button></div>
    </Dialog>);
}

// Neues Projekt: Assistent mit Technik-Art in ProjektArten.jsx (Entwurf 1.0, 2026-10-24)
