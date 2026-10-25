import React, { useCallback, useEffect, useRef, useState } from "react";
import { Wrench, CircleCheck, CircleAlert, Circle, Loader2, RefreshCw, Copy, ExternalLink, ArrowLeft, ArrowRight, Check, X, Monitor, Bot, GitBranch, Cpu, Power, Laptop, ShieldCheck, Box, Trash2, KeyRound } from "lucide-react";
import { supabase } from "./supabase";
import { isDesktop, tauri } from "./desktop";
import { designFreigabeStand } from "./designFrage";
import { kiAnzeigename } from "./kiName";

// Einrichtungs-Assistent (Gerhard 2026-10-22/23: „Anleitung, wie man Claude und die anderen Produkte koppeln muss“, Assistent mit Prüfung,
// beim ersten Start und jederzeit, Statusleiste; 14:27: ChatGPT-Kopplung im Assistenten erklären). Prüft jeden Schritt echt auf diesem PC.
// Die Codeschmiede sieht dabei nie ein Passwort: Anmeldungen laufen in den offiziellen Programmen bzw. im Browser.

const card = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const btn = "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-display font-bold tracking-wide transition";
const ghost = "inline-flex items-center justify-center gap-2 h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50";
const mac = typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);
const BEFEHL = {
  node: mac ? "brew install node" : "winget install OpenJS.NodeJS.LTS",
  git: mac ? "brew install git" : "winget install Git.Git",
  gh: mac ? "brew install gh" : "winget install GitHub.cli",
  ghLogin: "gh auth login",
  claude: mac ? "curl -fsSL https://claude.ai/install.sh | bash" : "irm https://claude.ai/install.ps1 | iex",
  claudeLogin: "claude",
  codex: "npm install -g @openai/codex", codexLogin: "codex login",
  gemini: "npm install -g @google/gemini-cli", geminiLogin: "gemini",
};

function Befehl({ text, toast }) {
  const kopiere = () => { try { navigator.clipboard.writeText(text); toast?.("Kopiert – im Terminal einfügen"); } catch { /* Text bleibt markierbar */ } };
  return <button type="button" onClick={kopiere} className="font-mono text-xs text-left bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 flex items-center gap-2 break-all w-full"><Copy className="w-3.5 h-3.5 shrink-0 text-slate-400" />{text}</button>;
}
function Zeile({ ok, titel, text, children }) {
  const I = ok === true ? CircleCheck : ok === false ? CircleAlert : Circle;
  return (
    <div className="flex gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800 first:border-t-0">
      <I className={`w-5 h-5 shrink-0 mt-0.5 ${ok === true ? "text-green-600" : ok === false ? "text-amber-600" : "text-slate-300"}`} />
      <div className="min-w-0 flex-1 flex flex-col gap-1.5"><div className="font-semibold text-sm">{titel}</div>{text && <div className="text-xs text-slate-500">{text}</div>}{!ok && children}</div>
    </div>);
}

// Ein-Klick-Einrichtung (Entwurf „Logo, KI-Wahl und Einrichtung“ 1.0, 2026-10-23): die eigene Werkstatt installiert, öffnet die offizielle
// Anmeldung und prüft (fester Katalog in desktop/dienst/lib/einrichten.mjs). Konten legt die Person selbst an – „Konto anlegen“ öffnet nur die Seite.
const LAEUFT = ["wartet", "installieren", "anmelden", "pruefen", "bestaetigen"];
function EinKlick({ k, titel, onLos, onBestaetigt, konto }) {
  const laeuft = LAEUFT.includes(k?.schritt);
  return (
    <div className="flex flex-col gap-1.5">
      {laeuft && <div role="status" className="text-xs flex items-center gap-1.5 text-blue-700 dark:text-blue-300"><Loader2 className="w-3.5 h-3.5 animate-spin" />{k.hinweis || "Wird eingerichtet …"}</div>}
      {k?.einricht_code && laeuft && <div className="rounded-lg border border-amber-500 bg-amber-50 dark:bg-amber-950/40 p-2 text-xs">Code auf der Anmeldeseite eingeben: <b className="font-mono text-base tracking-widest select-all">{k.einricht_code}</b></div>}
      {k?.schritt === "fehler" && <div className="text-xs text-red-700 dark:text-red-300">{k.hinweis}{k.schritt_zeit && <span className="text-slate-500"> · Stand {new Date(k.schritt_zeit).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })} – „{titel}“ versucht es neu</span>}</div>}
      <div className="flex flex-wrap gap-2">
        {konto && <a className={ghost} href={konto} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" />Konto anlegen</a>}
        {k?.schritt === "bestaetigen" ? <button type="button" className={btn} onClick={onBestaetigt}><Check className="w-4 h-4" />Ich bin angemeldet</button>
          : <button type="button" className={btn} disabled={laeuft && k?.schritt !== "wartet"} onClick={onLos}>{laeuft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{titel}</button>}
      </div>
    </div>);
}

/** Stand aller Prüfungen auf diesem PC (auch für die Statusleiste). */
export function useEinrichtung(ich, d) {
  const [st, setSt] = useState(null);
  const dRef = useRef(d); dRef.current = d;   // PC-Liste ändert sich minütlich – Prüfung nur bei Bedarf, nicht bei jedem Lebenszeichen
  const pruefen = useCallback(async () => {
    if (!isDesktop()) { setSt({ desk: false }); return; }
    const [werk, lauf] = await Promise.all([tauri("ws_check").catch(() => null), tauri("ws_status").catch(() => null)]);
    const pcs = (dRef.current?.pcs || []).filter((p) => p.benutzer_id === ich?.id)
      .sort((a, b) => (b.an ? 1 : 0) - (a.an ? 1 : 0) || Date.parse(b.zuletzt || 0) - Date.parse(a.zuletzt || 0))   // aktiver PC zuerst
      .filter((p, i, alle) => alle.findIndex((q) => q.name === p.name) === i);   // gleicher PC-Name nur einmal (wie KI-Anbieter)
    const { data: kopp } = await supabase.from("ws_ki_kopplung").select("*").eq("benutzer_id", ich?.id || "");
    setSt({ desk: true, werk: werk || {}, laeuft: !!lauf?.laeuft, pcs, kopp: kopp || [] });
  }, [ich?.id]);
  useEffect(() => { pruefen(); const t = setInterval(pruefen, 5 * 60 * 1000); return () => clearInterval(t); }, [pruefen]);
  const entwickler = ich?.rolle === "admin" || (d?.mitglieder || []).some((m) => m.benutzer_id === ich?.id && m.rolle === "entwickler");
  const claudeAbo = (st?.kopp || []).some((k) => k.anbieter === "claude" && k.gekoppelt && (st?.pcs || []).some((p) => p.id === k.pc_id));
  const pflicht = st?.desk && entwickler ? [st.werk.node, st.werk.git, st.werk.claude, claudeAbo, st.werk.gh, st.werk.gh_angemeldet, st.laeuft] : [];
  const offen = pflicht.filter((x) => !x).length;
  return { st, pruefen, offen, fertig: !!st?.desk && offen === 0 };
}

export default function Einrichtung({ ich, d, toast, onClose }) {
  const { st, pruefen } = useEinrichtung(ich, d);
  const [schritt, setSchritt] = useState(0); const [busy, setBusy] = useState(false);
  const entwickler = ich.rolle === "admin" || d.mitglieder.some((m) => m.benutzer_id === ich.id && m.rolle === "entwickler");
  const neu = async () => { setBusy(true); await pruefen(); setBusy(false); };
  // Welcher PC ist „dieser PC“? Der zuletzt aktive eigene; bei mehreren wählbar (Prüfung 0.8.0)
  const [pcWahl, setPcWahl] = useState(null);
  const pc = (st?.pcs || []).some((p) => p.id === pcWahl) ? pcWahl : st?.pcs?.[0]?.id;
  const ki = (a) => st?.kopp?.find((k) => k.anbieter === a && k.pc_id === pc);
  const aktion = async (anbieter, a) => {
    if (!pc) { toast("Erst die Werkstatt einschalten (Schritt 4)"); return; }
    const { error } = await supabase.from("ws_ki_kopplung").upsert({ pc_id: pc, benutzer_id: ich.id, anbieter, aktion: a }, { onConflict: "pc_id,anbieter" });
    if (error) toast(error.message); else { toast(a === "anmelden" ? "Anmeldung wird geöffnet …" : "Wird geprüft …"); setTimeout(neu, 6000); }
  };
  const w = st?.werk || {};
  // Fortschritt live (Kopplungszeile des eigenen PCs)
  useEffect(() => {
    const ch = supabase.channel(`einr-${Math.random()}`).on("postgres_changes", { event: "*", schema: "public", table: "ws_ki_kopplung" }, () => pruefen()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pruefen]);
  const einrichten = async (anbieter) => {
    if (!pc) { toast("Erst die Werkstatt einschalten (Schritt Werkstatt)"); return; }
    const { error } = await supabase.from("ws_ki_kopplung").upsert({ pc_id: pc, benutzer_id: ich.id, anbieter, aktion: "einrichten", schritt: "wartet", schritt_zeit: new Date().toISOString(), einricht_code: null, hinweis: "Wartet auf deine Werkstatt …" }, { onConflict: "pc_id,anbieter" });
    if (error) toast(error.message); else setTimeout(neu, 1500);
  };
  const SCHRITTE = [
    { titel: "Willkommen", icon: Wrench, inhalt: (
      <div className="flex flex-col gap-3 text-sm">
        <p>Dieser Assistent richtet die Codeschmiede auf <b>diesem PC</b> ein und prüft jeden Schritt. Dauer: ca. 10 Minuten beim ersten Mal.</p>
        <ul className="list-disc pl-5 text-slate-600 dark:text-slate-300 flex flex-col gap-1">
          <li>Programm und Werkzeuge (Node.js, Git, GitHub)</li><li>Claude mit deinem Claude-Abo – damit baut die Werkstatt</li>
          <li>Werkstatt einschalten</li><li>Optional: ChatGPT und Gemini für Chat und Konzepte</li>
        </ul>
        <p className="text-xs text-slate-500">Passwörter gibst du nur in den offiziellen Programmen bzw. im Browser ein – die Codeschmiede sieht sie nie.</p>
      </div>) },
    { titel: "Programm & Werkzeuge", icon: Monitor, inhalt: !st ? <Loader2 className="w-5 h-5 animate-spin text-emerald-700" /> : !st.desk ? (
      <div className="flex flex-col gap-2 text-sm"><p>Du bist im Browser. Die Werkstatt läuft nur im Programm <b>Codeschmiede</b> für {mac ? "Mac" : "Windows"}.</p>
        <a className={btn} href="https://github.com/kresak-it-solutions/codeschmiede/releases/latest" target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" />Programm herunterladen</a>
        <p className="text-xs text-slate-500">Installieren, öffnen, anmelden – der Assistent startet dann im Programm von selbst.</p></div>) : (
      <div>
        <Zeile ok={!!w.node} titel="Node.js" text="Laufzeit für die Werkstatt und die KI-Programme."><Befehl text={BEFEHL.node} toast={toast} /></Zeile>
        <Zeile ok={!!w.git} titel="Git" text="Versionen und Zweige."><Befehl text={BEFEHL.git} toast={toast} /></Zeile>
        <Zeile ok={!!w.gh} titel="GitHub CLI" text="Pull Requests der Werkstatt."><Befehl text={BEFEHL.gh} toast={toast} /></Zeile>
        <p className="text-xs text-slate-500 mt-2">Nach dem Installieren das Programm Codeschmiede einmal neu starten, dann „Erneut prüfen“.</p>
      </div>) },
    { titel: "GitHub anmelden", icon: GitBranch, inhalt: (
      <div>
        <Zeile ok={!!w.gh_angemeldet} titel="Mit GitHub angemeldet" text="„Anmelden“ öffnet ein Fenster mit der GitHub-Anmeldung (Code im Browser bestätigen). Noch kein Konto? „Konto anlegen“ öffnet die Registrierung bei GitHub.">
          <EinKlick k={ki("github")} titel="Anmelden" konto="https://github.com/signup" onLos={() => einrichten("github")} onBestaetigt={() => aktion("github", "bestaetigt")} />
          <details className="text-xs text-slate-500"><summary>Von Hand im Terminal</summary><Befehl text={BEFEHL.ghLogin} toast={toast} /></details></Zeile>
        {ich.rolle === "admin" && <Zeile ok={!!ki("cloudflare")?.gekoppelt} titel="Cloudflare (nur Admin)" text={ki("cloudflare")?.schritt === "fertig" ? ki("cloudflare")?.hinweis : "Für Testfassung, Live und eigene Adressen. „Anmelden“ installiert das Cloudflare-Werkzeug (falls nötig) und öffnet die Anmeldung im Browser."}>
          <EinKlick k={ki("cloudflare")} titel="Anmelden" konto="https://dash.cloudflare.com/sign-up" onLos={() => einrichten("cloudflare")} onBestaetigt={() => aktion("cloudflare", "bestaetigt")} /></Zeile>}
      </div>) },
    { titel: "Claude", icon: Bot, inhalt: (
      <div>
        <Zeile ok={!!w.claude} titel="Claude Code installiert" text="Das offizielle Programm von Anthropic. Die Werkstatt baut damit – mit deinem Claude-Abo, ohne Kosten pro Aufruf.">
          <Befehl text={BEFEHL.claude} toast={toast} /><a className="text-xs text-emerald-700 dark:text-emerald-400 underline" href="https://docs.claude.com/en/docs/claude-code/setup" target="_blank" rel="noopener noreferrer">Anleitung von Anthropic</a></Zeile>
        {/* Bisher nie geprüft (Hinweis Gerhard 21:45) – jetzt echt über „claude auth status“ der eigenen Werkstatt */}
        <Zeile ok={ki("claude") ? !!ki("claude").gekoppelt : w.claude ? undefined : false} titel="Mit dem Claude-Abo angemeldet"
          text={ki("claude")?.hinweis && !LAEUFT.includes(ki("claude")?.schritt) ? ki("claude").hinweis : "„Mit Claude anmelden“ öffnet die offizielle Anmeldung im Browser – dort mit dem Konto deines Abos (z. B. Max) anmelden."}>
          <EinKlick k={ki("claude")} titel="Mit Claude anmelden" onLos={() => einrichten("claude")} onBestaetigt={() => aktion("claude", "bestaetigt")} />
          <button type="button" className={`${ghost} self-start h-8 text-xs`} onClick={() => aktion("claude", "pruefen")}><RefreshCw className="w-3.5 h-3.5" />Prüfen</button></Zeile>
      </div>) },
    { titel: "Werkstatt", icon: Power, inhalt: (
      <div className="text-sm">
        {!entwickler ? <p>Du hast die Rolle {ich.rolle}: Die Werkstatt brauchst du nicht – Aufträge bearbeiten die Werkstätten der Entwickler.</p> : (
          <Zeile ok={!!st?.laeuft} titel="Werkstatt läuft" text="Sie startet bei jedem Programmstart von selbst (Schalter oben rechts). Läuft sie nicht, fehlt meist ein Schritt davor.">
            <p className="text-xs">Oben rechts „Werkstatt“ einschalten und dann „Erneut prüfen“.</p></Zeile>)}
      </div>) },
    { titel: "ChatGPT & Gemini (optional)", icon: Cpu, inhalt: (
      <div>
        <p className="text-sm mb-1">Für Chat, Konzepte und Design-Chat kann der Admin unter <b>Verwaltung › KI-Anbieter</b> ChatGPT oder Gemini einsetzen. Gebaut wird immer von Claude.</p>
        {(st?.pcs?.length || 0) > 1 && (
          <label className="flex items-center gap-2 text-xs my-2"><span className="text-slate-500">Dieser PC:</span>
            <select value={pc || ""} onChange={(e) => setPcWahl(e.target.value)} className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-900">
              {st.pcs.map((p) => <option key={p.id} value={p.id}>{p.name || p.id}{p.an ? " (Werkstatt an)" : ""}</option>)}</select></label>)}
        <Zeile ok={!!ki("chatgpt")?.gekoppelt} titel="ChatGPT (Codex)" text={ki("chatgpt")?.hinweis || "Jedes ChatGPT-Abo mit Codex. 1. installieren, 2. anmelden (öffnet den Browser)."}>
          <Befehl text={BEFEHL.codex} toast={toast} />
          <div className="flex gap-2"><button type="button" className={ghost} onClick={() => aktion("chatgpt", "anmelden")}>Anmelden</button><button type="button" className={ghost} onClick={() => aktion("chatgpt", "pruefen")}>Prüfen</button></div></Zeile>
        <Zeile ok={!!ki("gemini")?.gekoppelt} titel="Gemini (Gemini CLI)" text={ki("gemini")?.hinweis || "Mit deinem Google-Konto. 1. installieren, 2. im Terminal „gemini“ starten und „Login with Google“ wählen."}>
          <Befehl text={BEFEHL.gemini} toast={toast} /><Befehl text={BEFEHL.geminiLogin} toast={toast} />
          <button type="button" className={ghost} onClick={() => aktion("gemini", "pruefen")}>Prüfen</button></Zeile>
      </div>) },
    { titel: "Dieser PC", icon: Laptop, inhalt: <DieserPc ich={ich} d={d} st={st} pc={pc} toast={toast} /> },
    { titel: "Fertig", icon: Check, inhalt: (
      <div className="text-sm flex flex-col gap-2">
        <p>Den Assistenten findest du jederzeit unter <b>Verwaltung › Einrichtung</b> und oben in der Statusleiste.</p>
        {st?.desk && <ul className="text-xs grid grid-cols-2 gap-1">{[["Node.js", w.node], ["Git", w.git], ["GitHub", w.gh && w.gh_angemeldet], ["Claude Code", w.claude], ["Claude-Abo", ki("claude")?.gekoppelt], ["Werkstatt", st.laeuft], ["ChatGPT", ki("chatgpt")?.gekoppelt], ["Gemini", ki("gemini")?.gekoppelt]].map(([t, ok]) => <li key={t} className="flex items-center gap-1.5">{ok ? <CircleCheck className="w-3.5 h-3.5 text-green-600" /> : <CircleAlert className="w-3.5 h-3.5 text-amber-600" />}{t}</li>)}</ul>}
      </div>) },
  ];
  const S = SCHRITTE[schritt]; const I = S.icon;
  const schliessen = () => { try { localStorage.setItem("cs-einrichtung-gesehen", "1"); } catch { /* egal */ } onClose(); };
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4" onMouseDown={(e) => e.target === e.currentTarget && schliessen()}>
      <div role="dialog" aria-modal="true" aria-label="Einrichtung" className={`${card} w-full max-w-xl p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center gap-2"><I className="w-5 h-5 text-emerald-700" /><h3 className="font-display font-bold text-xl flex-1">Einrichtung · {S.titel}</h3>
          <button type="button" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" onClick={schliessen} aria-label="Schließen"><X className="w-4 h-4" /></button></div>
        <ol className="flex gap-1" aria-label="Schritte">{SCHRITTE.map((x, i) => <li key={x.titel} className={`h-1.5 flex-1 rounded-full ${i <= schritt ? "bg-emerald-600" : "bg-slate-200 dark:bg-slate-800"}`} title={x.titel} />)}</ol>
        <div className="min-h-[180px]">{S.inhalt}</div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={ghost} disabled={schritt === 0} onClick={() => setSchritt(schritt - 1)}><ArrowLeft className="w-4 h-4" />Zurück</button>
          {schritt > 0 && schritt < SCHRITTE.length - 1 && <button type="button" className={ghost} disabled={busy} onClick={neu}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}Erneut prüfen</button>}
          <span className="flex-1" />
          {schritt < SCHRITTE.length - 1 ? <button type="button" className={btn} onClick={() => setSchritt(schritt + 1)}>Weiter<ArrowRight className="w-4 h-4" /></button>
            : <button type="button" className={btn} onClick={schliessen}><Check className="w-4 h-4" />Fertig</button>}
        </div>
      </div>
    </div>);
}

// Einrichtung › Dieser PC (App-Designer 2.0, Fertigstellung 2026-10-24 22:35/22:45): Seiten-Designer-Freigabe dieses PCs, weitere KI-Anbieter,
// Sandbox und alte Werkstatt-PCs (Entfernen nur der Admin, Datenbank 0040 ws_werkstatt_pc_entfernen mit Rechteprüfung und Protokoll).
const ALT_TAGE = 14;
function DieserPc({ ich, d, st, pc, toast }) {
  const [schluessel, setSchluessel] = useState(undefined);   // undefined = lädt, null = keiner/Browser
  const [namen, setNamen] = useState({}); const [busy, setBusy] = useState(null);
  const desk = !!st?.desk;
  useEffect(() => {
    let aus = false;
    if (!isDesktop()) { setSchluessel(null); return undefined; }
    tauri("ws_design_geraet").then((g) => { if (!aus) setSchluessel(/^[A-Za-z0-9+/]{43}=$/.test(String(g?.public_key || "")) ? g.public_key : null); }, () => { if (!aus) setSchluessel(null); });
    supabase.from("ws_ki_anbieter").select("id, name").then(({ data }) => { if (!aus) setNamen(Object.fromEntries((data || []).map((a) => [a.id, a.name]))); }, () => {});
    return () => { aus = true; };
  }, []);
  const freigabe = designFreigabeStand();
  const meinPc = (d.pcs || []).find((p) => p.id === pc);
  const f = meinPc?.faehigkeiten || null;
  const weitere = (st?.kopp || []).filter((k) => k.pc_id === pc && !["claude", "github", "cloudflare"].includes(k.anbieter));
  const grenze = Date.now() - ALT_TAGE * 24 * 3600 * 1000;
  const alte = (d.pcs || []).filter((p) => p.id !== pc && (!p.an || Date.parse(p.zuletzt || 0) < grenze))
    .sort((a, b) => Date.parse(a.zuletzt || 0) - Date.parse(b.zuletzt || 0));
  const admin = ich.rolle === "admin";
  const wer = (id) => (id === ich.id ? "du" : d.benutzer.find((u) => u.id === id)?.name || "Mitglied");
  const datum = (x) => (x ? new Date(x).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–");
  const entfernen = async (p) => {
    if (!window.confirm(`Werkstatt-PC „${p.name}“ (${wer(p.benutzer_id)}) entfernen? Seine KI-Kopplungen fallen weg; meldet er sich wieder an, erscheint er neu.`)) return;
    setBusy(p.id);
    const { error } = await supabase.rpc("ws_werkstatt_pc_entfernen", { p_pc: p.id });
    setBusy(null);
    if (error) toast(error.message.replace(/^.*?ERROR:\s*/, "")); else { toast(`„${p.name}“ entfernt`); d.holen?.(); }
  };
  const FREIGABE_TEXT = { frei: "freigegeben – der Seiten-Designer und die Baustein-Galerie öffnen sich auf diesem PC", wartet: "wartet auf die Freigabe durch den Inhaber (Plattform-Programm › Desktop-Geräte oder Code per E-Mail)",
    gesperrt: "gesperrt – der Inhaber hat diesen PC für das Design gesperrt", fehlt: "noch nicht angemeldet – App-Designer › Seiten öffnen, dann meldet sich der PC an" };
  return (
    <div className="text-sm">
      {!desk && <p className="text-xs text-slate-500 mb-2">Im Browser lässt sich nur ein Teil prüfen – die Werte dieses PCs zeigt das Programm Codeschmiede.</p>}
      <Zeile ok={desk ? (schluessel === undefined ? undefined : freigabe?.stand === "frei") : undefined} titel="Seiten-Designer-Freigabe (Design-Gerät)"
        text={!desk ? "Nur im Programm." : schluessel === undefined ? "Wird geprüft …" : !schluessel ? "Kein Design-Schlüssel auf diesem PC (Programm neu starten bzw. aktualisieren)."
          : `Design-Schlüssel vorhanden (…${schluessel.slice(-10, -1)}). ${freigabe ? `Stand ${datum(freigabe.zeit)}: ${FREIGABE_TEXT[freigabe.stand]}.` : "Stand noch unbekannt – einmal App-Designer › Seiten öffnen."}`}>
        <p className="text-xs flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" aria-hidden="true" />Der Schlüssel öffnet nur das Design der App (Seiten, Bausteine) – nie die Plattform-Verwaltung. Freigeben kann nur der Inhaber.</p>
      </Zeile>
      <Zeile ok={desk ? weitere.some((k) => k.gekoppelt) || undefined : undefined} titel="Weitere KI-Anbieter auf diesem PC"
        text={!desk ? "Nur im Programm." : weitere.length ? weitere.map((k) => `${kiAnzeigename(k.anbieter, namen)}: ${k.gekoppelt ? "angemeldet" : "nicht angemeldet"}`).join(" · ") : "Keine weiteren Anbieter gekoppelt (optional – gebaut wird immer mit Claude)."}>
        <p className="text-xs">Hinzufügen und Anmelden unter <b>Verwaltung › KI-Anbieter</b> (Schritt „ChatGPT & Gemini“).</p>
      </Zeile>
      <Zeile ok={!desk || !f ? undefined : f.plattform === "win32" ? !!f.windows_sandbox : !!f.os_sandbox} titel={f?.plattform === "win32" || (!f && !mac) ? "Windows-Sandbox" : "Sandbox des Betriebssystems"}
        text={!desk ? "Nur im Programm." : !f ? "Noch unbekannt – die Werkstatt meldet es beim nächsten Einschalten." : f.plattform === "win32"
          ? (f.windows_sandbox ? "Verfügbar – Programme lassen sich gefahrlos in der Windows-Sandbox testen." : "Nicht eingeschaltet. Windows-Funktion „Windows-Sandbox“ aktivieren (Windows Pro/Enterprise), dann neu starten.")
          : f.os_sandbox ? `Verfügbar (${f.os_sandbox === "macos" ? "macOS" : "Linux"}) – fremde KI-Programme laufen abgeschottet.` : "Keine Sandbox gefunden – fremde KI-Programme prüfen hier nicht, Claude übernimmt."}>
        {f?.plattform === "win32" && <Befehl text="Enable-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM" toast={toast} />}
      </Zeile>
      <div className="flex gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800">
        <Box className="w-5 h-5 shrink-0 mt-0.5 text-slate-400" aria-hidden="true" />
        <div className="min-w-0 flex-1 flex flex-col gap-1.5">
          <div className="font-semibold text-sm">Alte oder abgeschaltete Werkstatt-PCs</div>
          {!alte.length ? <div className="text-xs text-slate-500">Keine – alle anderen PCs waren in den letzten {ALT_TAGE} Tagen aktiv.</div> : (
            <ul className="flex flex-col gap-1">{alte.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5">
                <Monitor className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                <span className="flex-1 min-w-0"><b className="font-semibold">{p.name}</b> · {wer(p.benutzer_id)} · {p.an ? "an" : "aus"} · zuletzt {datum(p.zuletzt)}{p.admin_pc ? " · Admin-PC" : ""}</span>
                {admin && <button type="button" className={`${ghost} h-8 text-xs`} disabled={busy === p.id} onClick={() => entfernen(p)}>{busy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}Entfernen</button>}
              </li>))}</ul>)}
          <p className="text-[11px] text-slate-500 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />{admin ? "Entfernen geht nur bei PCs, die gerade nicht eingeschaltet sind; es steht im Änderungsprotokoll." : "Entfernen darf nur der Admin."}</p>
        </div>
      </div>
    </div>);
}

/** Kleiner Hinweis in der Statusleiste: „Einrichtung: alles bereit“ oder „N offen“. */
export function EinrichtungChip({ ich, d, onOeffnen }) {
  const { st, offen } = useEinrichtung(ich, d);
  if (!st?.desk) return null;
  return (
    <button type="button" onClick={onOeffnen} title="Einrichtung öffnen" className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${offen ? "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"}`}>
      {offen ? <CircleAlert className="w-4 h-4" /> : <CircleCheck className="w-4 h-4 text-green-600" />}Einrichtung{offen ? `: ${offen} offen` : ""}
    </button>);
}
