import React, { useCallback, useEffect, useRef, useState } from "react";
import { Wrench, CircleCheck, CircleAlert, Circle, Loader2, RefreshCw, Copy, ExternalLink, ArrowLeft, ArrowRight, Check, X, Monitor, Bot, GitBranch, Cpu, Power } from "lucide-react";
import { supabase } from "./supabase";
import { isDesktop, tauri } from "./desktop";

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

/** Stand aller Prüfungen auf diesem PC (auch für die Statusleiste). */
export function useEinrichtung(ich, d) {
  const [st, setSt] = useState(null);
  const dRef = useRef(d); dRef.current = d;   // PC-Liste ändert sich minütlich – Prüfung nur bei Bedarf, nicht bei jedem Lebenszeichen
  const pruefen = useCallback(async () => {
    if (!isDesktop()) { setSt({ desk: false }); return; }
    const [werk, lauf] = await Promise.all([tauri("ws_check").catch(() => null), tauri("ws_status").catch(() => null)]);
    const pcs = (dRef.current?.pcs || []).filter((p) => p.benutzer_id === ich?.id)
      .sort((a, b) => (b.an ? 1 : 0) - (a.an ? 1 : 0) || Date.parse(b.zuletzt || 0) - Date.parse(a.zuletzt || 0));   // aktiver PC zuerst
    const { data: kopp } = await supabase.from("ws_ki_kopplung").select("*").eq("benutzer_id", ich?.id || "");
    setSt({ desk: true, werk: werk || {}, laeuft: !!lauf?.laeuft, pcs, kopp: kopp || [] });
  }, [ich?.id]);
  useEffect(() => { pruefen(); const t = setInterval(pruefen, 5 * 60 * 1000); return () => clearInterval(t); }, [pruefen]);
  const entwickler = ich?.rolle === "admin" || (d?.mitglieder || []).some((m) => m.benutzer_id === ich?.id && m.rolle === "entwickler");
  const pflicht = st?.desk && entwickler ? [st.werk.node, st.werk.git, st.werk.claude, st.werk.gh, st.werk.gh_angemeldet, st.laeuft] : [];
  const offen = pflicht.filter((x) => !x).length;
  return { st, pruefen, offen, fertig: !!st?.desk && offen === 0 };
}

export default function Einrichtung({ ich, d, toast, onClose }) {
  const { st, pruefen } = useEinrichtung(ich, d);
  const [schritt, setSchritt] = useState(0); const [busy, setBusy] = useState(false);
  const entwickler = ich.rolle === "admin" || d.mitglieder.some((m) => m.benutzer_id === ich.id && m.rolle === "entwickler");
  const neu = async () => { setBusy(true); await pruefen(); setBusy(false); };
  const ki = (a) => st?.kopp?.find((k) => k.anbieter === a);
  const aktion = async (anbieter, a) => {
    const pc = st?.pcs?.[0]?.id; if (!pc) { toast("Erst die Werkstatt einschalten (Schritt 4)"); return; }
    const { error } = await supabase.from("ws_ki_kopplung").upsert({ pc_id: pc, benutzer_id: ich.id, anbieter, aktion: a }, { onConflict: "pc_id,anbieter" });
    if (error) toast(error.message); else { toast(a === "anmelden" ? "Anmeldung wird geöffnet …" : "Wird geprüft …"); setTimeout(neu, 6000); }
  };
  const w = st?.werk || {};
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
        <a className={btn} href="https://github.com/gerhardkresak-code/codeschmiede/releases/latest" target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" />Programm herunterladen</a>
        <p className="text-xs text-slate-500">Installieren, öffnen, anmelden – der Assistent startet dann im Programm von selbst.</p></div>) : (
      <div>
        <Zeile ok={!!w.node} titel="Node.js" text="Laufzeit für die Werkstatt und die KI-Programme."><Befehl text={BEFEHL.node} toast={toast} /></Zeile>
        <Zeile ok={!!w.git} titel="Git" text="Versionen und Zweige."><Befehl text={BEFEHL.git} toast={toast} /></Zeile>
        <Zeile ok={!!w.gh} titel="GitHub CLI" text="Pull Requests der Werkstatt."><Befehl text={BEFEHL.gh} toast={toast} /></Zeile>
        <p className="text-xs text-slate-500 mt-2">Nach dem Installieren das Programm Codeschmiede einmal neu starten, dann „Erneut prüfen“.</p>
      </div>) },
    { titel: "GitHub anmelden", icon: GitBranch, inhalt: (
      <div>
        <Zeile ok={!!w.gh_angemeldet} titel="Mit GitHub angemeldet" text="Einmal im Terminal ausführen, „GitHub.com“ und „Login with a web browser“ wählen und im Browser bestätigen.">
          <Befehl text={BEFEHL.ghLogin} toast={toast} /></Zeile>
      </div>) },
    { titel: "Claude", icon: Bot, inhalt: (
      <div>
        <Zeile ok={!!w.claude} titel="Claude Code installiert" text="Das offizielle Programm von Anthropic. Die Werkstatt baut damit – mit deinem Claude-Abo, ohne Kosten pro Aufruf.">
          <Befehl text={BEFEHL.claude} toast={toast} /><a className="text-xs text-emerald-700 dark:text-emerald-400 underline" href="https://docs.claude.com/en/docs/claude-code/setup" target="_blank" rel="noopener noreferrer">Anleitung von Anthropic</a></Zeile>
        <Zeile ok={w.claude ? undefined : false} titel="Mit dem Claude-Abo anmelden" text="Einmal im Terminal „claude“ starten und „Claude account with subscription“ wählen. Danach das Terminal schließen.">
          <Befehl text={BEFEHL.claudeLogin} toast={toast} /></Zeile>
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
        <Zeile ok={!!ki("chatgpt")?.gekoppelt} titel="ChatGPT (Codex)" text={ki("chatgpt")?.hinweis || "Jedes ChatGPT-Abo mit Codex. 1. installieren, 2. anmelden (öffnet den Browser)."}>
          <Befehl text={BEFEHL.codex} toast={toast} />
          <div className="flex gap-2"><button type="button" className={ghost} onClick={() => aktion("chatgpt", "anmelden")}>Anmelden</button><button type="button" className={ghost} onClick={() => aktion("chatgpt", "pruefen")}>Prüfen</button></div></Zeile>
        <Zeile ok={!!ki("gemini")?.gekoppelt} titel="Gemini (Gemini CLI)" text={ki("gemini")?.hinweis || "Mit deinem Google-Konto. 1. installieren, 2. im Terminal „gemini“ starten und „Login with Google“ wählen."}>
          <Befehl text={BEFEHL.gemini} toast={toast} /><Befehl text={BEFEHL.geminiLogin} toast={toast} />
          <button type="button" className={ghost} onClick={() => aktion("gemini", "pruefen")}>Prüfen</button></Zeile>
      </div>) },
    { titel: "Fertig", icon: Check, inhalt: (
      <div className="text-sm flex flex-col gap-2">
        <p>Den Assistenten findest du jederzeit unter <b>Verwaltung › Einrichtung</b> und oben in der Statusleiste.</p>
        {st?.desk && <ul className="text-xs grid grid-cols-2 gap-1">{[["Node.js", w.node], ["Git", w.git], ["GitHub", w.gh && w.gh_angemeldet], ["Claude Code", w.claude], ["Werkstatt", st.laeuft], ["ChatGPT", ki("chatgpt")?.gekoppelt], ["Gemini", ki("gemini")?.gekoppelt]].map(([t, ok]) => <li key={t} className="flex items-center gap-1.5">{ok ? <CircleCheck className="w-3.5 h-3.5 text-green-600" /> : <CircleAlert className="w-3.5 h-3.5 text-amber-600" />}{t}</li>)}</ul>}
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

/** Kleiner Hinweis in der Statusleiste: „Einrichtung: alles bereit“ oder „N offen“. */
export function EinrichtungChip({ ich, d, onOeffnen }) {
  const { st, offen } = useEinrichtung(ich, d);
  if (!st?.desk) return null;
  return (
    <button type="button" onClick={onOeffnen} title="Einrichtung öffnen" className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${offen ? "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"}`}>
      {offen ? <CircleAlert className="w-4 h-4" /> : <CircleCheck className="w-4 h-4 text-green-600" />}Einrichtung{offen ? `: ${offen} offen` : ""}
    </button>);
}
