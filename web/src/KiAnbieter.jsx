import React, { useEffect, useMemo, useState } from "react";
import { kiFarbe } from "./kiFarbe";
import { Cpu, Loader2, Save, ArrowUp, ArrowDown, Plus, X, RefreshCw, Lock, CircleCheck, CircleAlert, Copy, History, PlugZap, Globe, SquareTerminal, Check } from "lucide-react";
import { supabase } from "./supabase";

// KI-Anbieter (Entwurf 1.2, freigegeben von Gerhard 2026-10-23 15:00): Wer übernimmt was – Anbieter und Modell je Aufgabe.
// Zuständigkeiten stellt nur der Admin ein (14:59). Bauen ist fest Claude (14:27). Jede Person koppelt ihre Anbieter auf dem eigenen PC.
// Im Chat sieht man nicht, wer antwortet – das steht nur im Protokoll unten.

const card = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const btn = "inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-display font-bold tracking-wide transition text-sm";
const ghost = "inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50";
const sel = "rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs";
const fehler = (e) => (e?.message || "Unbekannter Fehler").replace(/^.*?ERROR:\s*/, "");
const fmt = (d) => (d ? new Date(d).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–");

export const ANBIETER = {
  claude: { name: "Claude", programm: "Claude Code", modelle: ["automatisch", "opus", "sonnet", "haiku"], install: "https://claude.com/claude-code", login: "claude" },
  chatgpt: { name: "ChatGPT", programm: "Codex (OpenAI)", modelle: ["automatisch"], install: "npm install -g @openai/codex", login: "codex login" },
  gemini: { name: "Gemini", programm: "Gemini CLI (Google)", modelle: ["automatisch", "gemini-2.5-pro", "gemini-2.5-flash"], install: "npm install -g @google/gemini-cli", login: "gemini" },
};
// Wofür eignet sich welche KI? (Gerhard 2026-10-23 19:29) – Empfehlungen nach Stand Oktober 2026, keine Garantie;
// „aufgaben“ = Kennungen aus AUFGABEN. Bauen bleibt immer Claude.
export const STAERKEN = {
  claude: { gut: "Stand Oktober 2026 vorne bei Programmieren und Web-Oberflächen (LMArena WebDev Platz 1), beim unabhängigen Intelligenz-Index und bei der Faktentreue; sehr gutes Deutsch.", aufgaben: ["chat", "konzept", "design", "pruefung", "doku", "texte", "bauen"] },
  chatgpt: { gut: "Knapp hinter Claude bei Programmieren und Design (WebDev Platz 2), vorne bei Logik-Tests und bei Bildern (GPT Image 2 Platz 1) – die beste zweite Meinung.", aufgaben: ["konzept", "design", "pruefung", "texte", "bilder"] },
  gemini: { gut: "Vorne bei den allgemeinen Text-Abstimmungen und sehr stark bei sehr langen Dokumenten; bei Programmieren und Design hinter Claude und ChatGPT.", aufgaben: ["chat", "doku", "bilder"] },
  copilot: { gut: "Kein eigenes Modell: ein GitHub-Abo mit Modellen von OpenAI, Anthropic und Google – nützlich als Rückfall, wenn andere Limits voll sind.", aufgaben: [] },
  antigravity: { gut: "Googles Programmier-Werkzeug mit Gemini-Modellen – gleiche Stärken wie Gemini; für persönliche Google-Konten der empfohlene Weg zu Gemini.", aufgaben: [] },
  grok: { gut: "Bei Bildern stark (Grok Imagine Platz 2), bei Texten und Programmieren hinter den drei Großen; locker, kennt aktuelle Themen.", aufgaben: [] },
  cursor: { gut: "Kein eigenes Spitzenmodell: Programm, das Modelle von Anthropic, OpenAI und Google nutzt – als Rückfall brauchbar.", aufgaben: [] },
  opencode: { gut: "Nutzt Konten, die du schon hast (z. B. ChatGPT oder Copilot), über ein Programm – nur als Rückfall.", aufgaben: [] },
  "mistral-vibe": { gut: "Europäischer Anbieter (Daten in der EU) – die Datenschutz-Wahl; in den Vergleichen hinter Claude, ChatGPT und Gemini.", aufgaben: [] },
};

const AUFGABEN = [
  ["chat", "Chat überall (Fragen, Ausloten)", ""],
  ["konzept", "Konzept & Rückfragen vor dem Bauen", "Ergebnis ist die Konzept-Karte im Chat"],
  ["design", "Design-Chat im App-Designer", ""],
  ["pruefung", "Unabhängige Prüfungen", "Fremde Anbieter prüfen nur auf PCs mit Sandbox (Mac/Linux); unter Windows prüft Claude. Claude bleibt immer als Rückfall."],
  ["doku", "Dokumentation & Handbuch", "wird genutzt, sobald Doku-Aufträge getrennt laufen (Etappe 4)"],
  ["texte", "Texte & Übersetzungen", "wird genutzt, sobald Text-Aufträge getrennt laufen (Etappe 4)"],
  ["bilder", "Bilder & Grafiken", "wird mit Etappe 5 (Marke, Logo) genutzt; nur Anbieter, die Bilder erzeugen können"],
  ["bauen", "Bauen & Programmieren", "immer Claude – auf Wunsch ChatGPT als Ersatz, nur wenn Claudes Limit voll ist"],
];
// Ohne Admin-Einstellung gilt nur Claude (Prüfung M5). VORSCHLAG = Entwurf 1.2 zum Übernehmen.
const STANDARD = Object.fromEntries(["chat", "konzept", "design", "pruefung", "doku", "texte", "bilder", "bauen"].map((a) => [a, [{ anbieter: "claude", ...({ konzept: { modell: "opus" }, pruefung: { modell: "opus" }, texte: { modell: "haiku" } }[a] || {}) }]]));
// Vorschläge: je Zuständigkeit die 3 ehrlich besten Anbieter (Gerhard 2026-10-23 22:54 „ernst gemeint, 100 % ehrlich, immer 3“).
// Grundlage Stand 23.10.2026: LMArena (WebDev, Text, Bild), Artificial Analysis Intelligence Index, LiveBench – siehe GRUND.
// Reihenfolge = wer zuerst drankommt; bei vollem Limit geht es zum nächsten. Bauen bleibt nach Gerhards Regel Claude (+ ChatGPT nur als Ersatz).
const VORSCHLAG = {
  chat: [{ anbieter: "claude", modell: "sonnet" }, { anbieter: "gemini" }, { anbieter: "chatgpt" }],
  konzept: [{ anbieter: "claude", modell: "opus" }, { anbieter: "chatgpt" }, { anbieter: "gemini" }],
  design: [{ anbieter: "claude", modell: "opus" }, { anbieter: "chatgpt" }, { anbieter: "gemini" }],
  pruefung: [{ anbieter: "claude", modell: "opus" }, { anbieter: "chatgpt" }, { anbieter: "gemini" }],
  doku: [{ anbieter: "claude", modell: "sonnet" }, { anbieter: "gemini" }, { anbieter: "chatgpt" }],
  texte: [{ anbieter: "claude", modell: "sonnet" }, { anbieter: "chatgpt" }, { anbieter: "gemini" }],
  bilder: [{ anbieter: "chatgpt" }, { anbieter: "claude", modell: "opus" }, { anbieter: "gemini" }],
  bauen: [{ anbieter: "claude" }, { anbieter: "chatgpt" }],
};
const GRUND = {
  chat: "Claude führt den unabhängigen Intelligenz-Index, Sonnet ist dabei schnell und günstig; Gemini liegt bei den Text-Abstimmungen (LMArena) vorne; ChatGPT ist der starke Dritte.",
  konzept: "Konzepte brauchen Denken und Rückfragen: Claude Opus führt den Intelligenz-Index, ChatGPT (GPT-6) führt bei Logik-Tests (LiveBench, ARC-AGI-2) – gute zweite Meinung; Gemini als Dritter.",
  design: "LMArena WebDev (23.10.2026): 1. Claude Opus, 2. ChatGPT, Gemini auf Platz 10 – Claude und ChatGPT sind hier klar vorne.",
  pruefung: "Prüfen heißt Fehler finden: Claude Opus führt bei Programm-Tests (ProgramBench, SWE-Tests); ChatGPT und Gemini als unabhängige zweite und dritte Meinung. Fremde Anbieter prüfen nur auf PCs mit Sandbox (Mac/Linux) – unter Windows prüft Claude.",
  doku: "Handbuch und Doku: Claude hat die höchste gemessene Faktentreue und sehr gutes Deutsch; Gemini ist stark bei sehr langen Dokumenten; ChatGPT als Dritter.",
  texte: "Texte und Übersetzungen: Claude bleibt bei Fachbegriffen über lange Texte am einheitlichsten, ChatGPT formuliert flüssig, Gemini als Dritter. Mistral wäre die EU-Wahl, ist in den Vergleichen aber nicht vorne und wurde für Deutsch nicht getestet.",
  bilder: "Bild-Rangliste (LMArena): 1. ChatGPT (GPT Image 2). Fürs Nachbauen von Logos als bearbeitbare Formen ist Claude Opus sehr gut; Gemini als Dritter. Grok liegt bei Bildern auf Platz 2, ist hier aber noch nicht als Bild-Anbieter angebunden.",
  bauen: "Bauen ist nach deiner Regel fest Claude (führt WebDev und Programmier-Tests); ChatGPT nur als Ersatz, wenn Claudes Limit voll ist – darum hier nur 2.",
};

const MODELL = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,59}$/;

/** Übersicht: wofür eignet sich welche KI (eingebaute + angelegte Anbieter). */
function Eignung({ liste }) {
  const name = (id) => AUFGABEN.find(([k]) => k === id)?.[1]?.replace(/ \(.*\)$/, "") || id;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950"><h3 className="font-display font-bold">Wofür eignet sich welche KI?</h3>
        <p className="text-xs text-slate-500">Empfehlungen (Stand Oktober 2026) – du entscheidest unten bei den Zuständigkeiten. Gebaut wird immer von Claude.</p></div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {Object.entries(liste).map(([id, a]) => {
          const st = STAERKEN[id];
          return (
            <div key={id} className="px-3 py-2.5 grid gap-1 md:grid-cols-[170px_minmax(0,1fr)] text-sm">
              <div className="font-semibold flex flex-wrap items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full shrink-0 ${kiFarbe(id).punkt}`} aria-hidden="true" />{a.name}<span className="basis-full text-xs font-normal text-slate-500">{a.programm}</span></div>
              <div className="min-w-0 flex flex-col gap-1">
                <span className="text-slate-700 dark:text-slate-200">{st?.gut || a.eigen?.hinweis || "Keine Beschreibung hinterlegt."}</span>
                {st?.aufgaben?.length > 0 && <span className="flex flex-wrap gap-1">{st.aufgaben.map((t) => <span key={t} className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{name(t)}</span>)}</span>}
              </div>
            </div>);
        })}
      </div>
    </div>);
}

function Zeile({ id, titel, hinweis, eintrag, admin, onSpeichern, anbieter = ANBIETER }) {
  const fest = id === "bauen";
  const [reihe, setReihe] = useState(eintrag?.reihe || STANDARD[id]);
  const [ab, setAb] = useState(eintrag?.weitergeben_ab ?? 90);
  const [busy, setBusy] = useState(false); const [eigen, setEigen] = useState(null); const [eigenText, setEigenText] = useState("");
  useEffect(() => { setReihe(eintrag?.reihe || STANDARD[id]); setAb(eintrag?.weitergeben_ab ?? 90); }, [eintrag, id]);
  const geaendert = JSON.stringify(reihe) !== JSON.stringify(eintrag?.reihe || STANDARD[id]) || ab !== (eintrag?.weitergeben_ab ?? 90) || !eintrag;
  const setze = (i, feld, wert) => setReihe(reihe.map((e, j) => (j === i ? (feld === "modell" ? (wert === "automatisch" ? { anbieter: e.anbieter } : { ...e, modell: wert }) : { anbieter: wert }) : e)));
  const tausche = (i, j) => { const r = [...reihe]; [r[i], r[j]] = [r[j], r[i]]; setReihe(r); };
  // Prüfungen nur eingebaute Anbieter (eigene Programme laufen ohne Sandbox)
  const frei = Object.keys(anbieter).filter((a) => !reihe.some((e) => e.anbieter === a) && !(id === "pruefung" && !ANBIETER[a]));
  const speichern = async () => { setBusy(true); await onSpeichern(id, reihe, ab); setBusy(false); };
  // Programmieren (Gerhard 2026-10-23 „Nur als Ersatz“): Claude fest, als zweiter Eintrag nur ChatGPT (Codex)
  if (fest) {
    const ersatz = reihe[1]?.anbieter === "chatgpt";
    return (
      <div className="border-t border-slate-100 dark:border-slate-800 p-3 grid gap-2 lg:grid-cols-[240px_minmax(0,1fr)_auto] items-start">
        <div><div className="font-semibold text-sm flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-slate-400" />{titel}</div>{hinweis && <div className="text-xs text-slate-500">{hinweis}</div>}</div>
        <div className="flex flex-col gap-1.5 text-xs">
          <span className="flex flex-wrap items-center gap-1.5"><span className="inline-flex rounded-full px-2.5 py-0.5 font-semibold border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">1. Claude</span>
            <label className="inline-flex items-center gap-1">Ersatz bei vollem Limit:
              {admin ? <select className={sel} value={ersatz ? "chatgpt" : ""} onChange={(e) => setReihe(e.target.value ? [{ anbieter: "claude" }, { anbieter: "chatgpt" }] : [{ anbieter: "claude" }])}>
                <option value="">keiner – warten</option><option value="chatgpt">ChatGPT (Codex)</option></select> : <b>{ersatz ? "ChatGPT (Codex)" : "keiner"}</b>}</label></span>
          {ersatz && <span className="text-[11px] text-amber-700 dark:text-amber-300">ChatGPT programmiert nur, wenn Claudes Abo-Limit voll ist – auf Mac und Linux in der Betriebssystem-Sandbox (nur der Auftragsordner), unter Windows nicht. Commit und Pull Request macht die Werkstatt, die Prüfungen immer Claude.</span>}
        </div>
        <div className="flex items-center gap-2 text-xs">{admin && <button type="button" className={ghost} disabled={busy || !geaendert} onClick={speichern}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}Speichern</button>}</div>
      </div>);
  }
  return (
    <div className="border-t border-slate-100 dark:border-slate-800 p-3 grid gap-2 lg:grid-cols-[240px_minmax(0,1fr)_auto] items-start">
      <div><div className="font-semibold text-sm flex items-center gap-1.5">{fest && <Lock className="w-3.5 h-3.5 text-slate-400" />}{titel}</div>{hinweis && <div className="text-xs text-slate-500">{hinweis}</div>}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {reihe.map((e, i) => {
          const a = anbieter[e.anbieter] || { name: e.anbieter, modelle: ["automatisch"] }; const eigenes = e.modell && !a.modelle.includes(e.modell);
          return (
            <span key={e.anbieter} className={`inline-flex items-center gap-1 rounded-full pl-2.5 pr-1 py-0.5 text-xs font-semibold border ${kiFarbe(e.anbieter).chip}`}>
              {i + 1}. {a.name}
              {admin && !fest ? (
                <select className="bg-transparent text-xs font-normal" aria-label={`Modell ${a.name}`} value={eigenes ? "eigenes" : e.modell || "automatisch"}
                  onChange={(ev) => { if (ev.target.value === "eigenes") { setEigen(i); setEigenText(e.modell || ""); } else { setEigen(null); setze(i, "modell", ev.target.value); } }}>
                  {a.modelle.map((m) => <option key={m} value={m}>{m}</option>)}
                  {eigenes && <option value="eigenes">{e.modell}</option>}
                  {!eigenes && <option value="eigenes">eigenes Modell …</option>}
                </select>) : <span className="font-normal">{e.modell || "automatisch"}</span>}
              {admin && !fest && <>
                <button type="button" title="Früher" disabled={i === 0} onClick={() => tausche(i, i - 1)} className="p-0.5 disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
                <button type="button" title="Später" disabled={i === reihe.length - 1} onClick={() => tausche(i, i + 1)} className="p-0.5 disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
                <button type="button" title="Entfernen" disabled={reihe.length === 1 || (id === "pruefung" && e.anbieter === "claude")} onClick={() => setReihe(reihe.filter((_, j) => j !== i))} className="p-0.5 disabled:opacity-30"><X className="w-3 h-3" /></button>
              </>}
            </span>);
        })}
        {admin && eigen != null && <span className="inline-flex items-center gap-1"><input id={`ki-modell-${id}`} className={`${sel} w-36`} placeholder="Modellname, z. B. gpt-5" value={eigenText} onChange={(ev) => setEigenText(ev.target.value)} />
          <button type="button" className={ghost} disabled={!MODELL.test(eigenText)} onClick={() => { setze(eigen, "modell", eigenText); setEigen(null); }}>OK</button></span>}
        {admin && !fest && JSON.stringify(reihe) !== JSON.stringify(VORSCHLAG[id]) && <button type="button" className={ghost} title={GRUND[id]} onClick={() => setReihe(VORSCHLAG[id])}>Vorschlag einsetzen</button>}
        {GRUND[id] && <span className="basis-full text-[11px] text-slate-500">Vorschlag: {VORSCHLAG[id].map((e, i) => `${i + 1}. ${anbieter[e.anbieter]?.name || e.anbieter}${e.modell ? ` (${e.modell})` : ""}`).join(" · ")} – {GRUND[id]}</span>}
        {admin && !fest && frei.length > 0 && <select className={sel} value="" aria-label="Anbieter hinzufügen" onChange={(ev) => ev.target.value && setReihe([...reihe, { anbieter: ev.target.value }])}>
          <option value="">+ Anbieter</option>{frei.map((a) => <option key={a} value={a}>{anbieter[a].name}</option>)}</select>}
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {!fest && <label className="flex items-center gap-1">weiter ab
          {admin ? <select className={sel} value={ab} onChange={(e) => setAb(Number(e.target.value))}>{[70, 80, 90, 95, 100].map((x) => <option key={x} value={x}>{x} %</option>)}</select> : <b>{ab} %</b>}</label>}
        {admin && !fest && <button type="button" className={ghost} disabled={busy || !geaendert} onClick={speichern}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{eintrag ? "Speichern" : "Übernehmen"}</button>}
        {admin && !fest && reihe.some((e) => e.anbieter !== "claude") && geaendert && <span className="basis-full text-[11px] text-amber-700 dark:text-amber-300">Hinweis: Fremde Anbieter bekommen Projekttexte und laufen auf dem PC; ihre Werkzeuge könnten technisch Dateien des PCs lesen.</span>}
      </div>
    </div>);
}

// Vorlage für einen eigenen Anbieter (GitHub Copilot CLI). Befehle bitte mit der Anleitung des Anbieters abgleichen.
const VORLAGE_COPILOT = { id: "copilot", name: "GitHub Copilot", programm: "copilot", argumenteText: "-p\n{prompt}\n--model\n{modell}", modelleText: "",
  installieren: "npm install -g @github/copilot", anmelden: "copilot (dann /login)", hinweis: "GitHub Copilot CLI mit dem eigenen Copilot-Abo", neu: true };

function AnbieterDialog({ wert, toast, onClose, onFertig }) {
  const [w, setW] = useState(wert); const [busy, setBusy] = useState(false);
  const feld = (k, t, ph, mono) => <label className="flex flex-col gap-1 text-xs text-slate-500">{t}<input className={`${sel} text-sm ${mono ? "font-mono" : ""}`} value={w[k] || ""} placeholder={ph} onChange={(e) => setW({ ...w, [k]: e.target.value })} /></label>;
  const speichern = async () => {
    setBusy(true);
    const p = { id: (w.id || "").trim().toLowerCase(), name: (w.name || "").trim(), programm: (w.programm || "").trim(),
      argumente: String(w.argumenteText || "").split("\n").map((x) => x.trim()).filter(Boolean),
      modelle: String(w.modelleText || "").split(/[,\s]+/).map((x) => x.trim()).filter(Boolean),
      installieren: w.installieren || null, anmelden: w.anmelden || null, hinweis: w.hinweis || null };
    const { error } = await supabase.rpc("ws_ki_anbieter_speichern", { p }); setBusy(false);
    if (error) toast(fehler(error)); else { toast(`${p.name} gespeichert – auf jedem PC einmal zulassen`); onFertig(); }
  };
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="KI-Anbieter" className={`${card} w-full max-w-lg p-5 flex flex-col gap-3 max-h-[90vh] overflow-y-auto`}>
        <h3 className="font-display font-bold text-xl flex items-center gap-2"><Cpu className="w-5 h-5 text-emerald-700" />{wert.neu ? "KI-Anbieter hinzufügen" : `${wert.name} bearbeiten`}</h3>
        {wert.neu && <p className="text-xs text-slate-500">Vorlage: GitHub Copilot. Für andere Anbieter Felder anpassen – wichtig ist ein Kommandozeilen-Programm, das eine Frage beantwortet und die Antwort ausgibt.</p>}
        <div className="grid grid-cols-2 gap-2">{feld("id", "Kennung (klein, z. B. copilot)", "copilot", true)}{feld("name", "Name", "GitHub Copilot")}</div>
        {feld("programm", "Programm (nur Name, kein Pfad)", "copilot", true)}
        <label className="flex flex-col gap-1 text-xs text-slate-500">Argumente (eine Zeile je Argument; {"{prompt}"} = Frage, {"{modell}"} = Modell; ohne {"{prompt}"} kommt die Frage über die Eingabe)
          <textarea className={`${sel} text-sm font-mono min-h-[84px]`} value={w.argumenteText || ""} onChange={(e) => setW({ ...w, argumenteText: e.target.value })} /></label>
        {feld("modelleText", "Modelle zur Auswahl (Komma getrennt, optional)", "gpt-5, claude-sonnet-4.5", true)}
        {feld("installieren", "Installieren (Hinweis zum Kopieren)", "npm install -g …", true)}
        {feld("anmelden", "Anmelden (Hinweis)", "copilot (dann /login)", true)}
        {feld("hinweis", "Beschreibung", "")}
        <p className="text-xs text-slate-500">Sicherheit: Das Programm läuft mit den Rechten der Person – darum nur echte KI-Programme eintragen (gängige Shells und Skript-Sprachen sind gesperrt, das ersetzt aber kein Vertrauen in das Programm). Es startet erst, wenn die Person genau diese Fassung auf ihrem PC zulässt; nach jeder Änderung muss sie neu zulassen. Für Prüfungen und Bauen werden eigene Anbieter nie verwendet.</p>
        <div className="flex justify-end gap-2"><button type="button" className={ghost} onClick={onClose}>Abbrechen</button>
          <button type="button" className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-display font-bold text-sm" disabled={busy || !w.id || !w.name || !w.programm} onClick={speichern}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Speichern</button></div>
      </div>
    </div>);
}

export function KiProtokoll() {
  const [liste, setListe] = useState(null);
  useEffect(() => {
    (async () => {
      const [c, dz] = await Promise.all([
        supabase.from("ws_claude_chat").select("id, ort, text, ki, erstellt").not("ki", "is", null).order("id", { ascending: false }).limit(60),
        supabase.from("ws_design_chat").select("id, text, ki, erstellt").not("ki", "is", null).order("id", { ascending: false }).limit(30),
      ]);
      setListe([...(c.data || []).map((x) => ({ ...x, wo: `Chat · ${x.ort}` })), ...(dz.data || []).map((x) => ({ ...x, wo: "Design-Chat" }))].sort((a, b) => Date.parse(b.erstellt) - Date.parse(a.erstellt)));
    })();
  }, []);
  if (!liste) return <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />;
  if (!liste.length) return <p className="text-sm text-slate-500">Noch keine Antworten mit Vermerk (ab Programm 0.7.0).</p>;
  return (
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-950"><tr><th className="text-left px-3 py-2">Zeit</th><th className="text-left px-3 py-2">Wo</th><th className="text-left px-3 py-2">Antwort</th><th className="text-left px-3 py-2">Wer</th></tr></thead>
      <tbody>{liste.map((x) => <tr key={`${x.wo}-${x.id}`} className="border-t border-slate-100 dark:border-slate-800 align-top">
        <td className="px-3 py-2 text-xs whitespace-nowrap">{fmt(x.erstellt)}</td><td className="px-3 py-2 text-xs">{x.wo}</td>
        <td className="px-3 py-2 text-xs"><span className="line-clamp-2">{x.text}</span></td>
        <td className="px-3 py-2 text-xs font-semibold whitespace-nowrap">{ANBIETER[x.ki.split("/")[0]]?.name || x.ki}{x.ki.includes("/") ? ` · ${x.ki.split("/").slice(1).join("/")}` : ""}</td></tr>)}</tbody>
    </table></div>);
}

// „Hinzufügen“ per Klick (Entwurf 1.0, Datenbank 0025). Nur zur Anzeige – was wirklich installiert und gestartet wird,
// steht fest im Werkstatt-Programm (desktop/dienst/lib/einrichten.mjs), nie in der Datenbank.
const EIN_KLICK = {
  codex: { art: "browser", install: "npm install -g @openai/codex" }, gemini: { art: "fenster", install: "npm install -g @google/gemini-cli" },
  copilot: { art: "browser", install: "npm install -g @github/copilot" }, opencode: { art: "fenster", install: "npm install -g opencode-ai" },
  "cursor-agent": { art: "browser", install: "offizielle Installation von cursor.com" },
  grok: { art: "browser", install: "Offizielle Installation von x.ai läuft automatisch" }, agy: { art: "fenster", install: "Offizielle Installation von Google läuft automatisch (das Terminal-Programm agy – die Antigravity-App allein reicht nicht)" },
  vibe: { art: "fenster", install: "Offizielle Installation von Mistral läuft automatisch" },
};
const SCHRITTE = [["installieren", "Programm installieren"], ["anmelden", "Beim Anbieter anmelden"], ["pruefen", "Kopplung prüfen"]];
function Einrichten({ k, art, kopiere }) {
  const idx = { wartet: -1, installieren: 0, anmelden: 1, bestaetigen: 1, pruefen: 2 }[k.schritt] ?? -1;
  return (
    <div className="flex flex-col gap-1.5" role="status">
      <ol className="flex flex-col gap-1">
        {SCHRITTE.map(([id, t], i) => <li key={id} className="flex items-center gap-1.5">
          <span className={`w-4 h-4 rounded-full grid place-items-center text-[10px] font-bold ${i < idx ? "bg-emerald-700 text-white" : i === idx ? "border border-blue-600 text-blue-600" : "border border-slate-300 dark:border-slate-700 text-slate-400"}`}>{i < idx ? <Check className="w-3 h-3" /> : i + 1}</span>
          <span className={i === idx ? "font-semibold" : "text-slate-500"}>{i === 1 && art === "fenster" ? "Im Fenster anmelden" : i === 1 ? "Im Browser anmelden" : t}</span>
          {i === idx && <Loader2 className="w-3 h-3 animate-spin text-blue-600" />}</li>)}
      </ol>
      {k.einricht_code && <div className="rounded-lg border border-amber-500 bg-amber-50 dark:bg-amber-950/40 p-2">Code auf der Anmeldeseite eingeben:<div className="flex items-center gap-2"><span className="font-mono text-lg font-bold tracking-widest select-all">{k.einricht_code}</span><button type="button" className={ghost} onClick={() => kopiere(k.einricht_code)}><Copy className="w-3.5 h-3.5" />Kopieren</button></div></div>}
    </div>);
}

export default function KiAnbieter({ d, ich, toast }) {
  const admin = ich.rolle === "admin";
  const [zust, setZust] = useState(null); const [kopplung, setKopplung] = useState([]); const [tick, setTick] = useState(0);
  const [eigeneAnbieter, setEigeneAnbieter] = useState([]); const [bearbeite, setBearbeite] = useState(null);
  useEffect(() => {
    let aus = false;
    (async () => {
      const [z, k, a] = await Promise.all([
        supabase.from("ws_ki_zustaendigkeit").select("*").eq("projekt_id", d.projektId),
        supabase.from("ws_ki_kopplung").select("*").order("anbieter"),
        supabase.from("ws_ki_anbieter").select("*").order("name"),
      ]);
      if (aus) return;
      setEigeneAnbieter(a.data || []);
      setZust(z.error ? { fehlt: true } : Object.fromEntries((z.data || []).map((x) => [x.aufgabe, x])));
      setKopplung(k.data || []);
    })();
    const kanal = supabase.channel(`ki-${Math.random()}`).on("postgres_changes", { event: "*", schema: "public", table: "ws_ki_kopplung" }, () => setTick((t) => t + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "ws_ki_anbieter" }, () => setTick((t) => t + 1)).subscribe();
    return () => { aus = true; supabase.removeChannel(kanal); };
  }, [d.projektId, tick]);
  // Jeder PC nur einmal (Gerhard 16:22): je Name der zuletzt aktive Eintrag – alte Einträge nach Neuinstallation fallen weg
  const meinePcs = Object.values(d.pcs.filter((p) => p.benutzer_id === ich.id)
    .sort((a, b) => (b.an ? 1 : 0) - (a.an ? 1 : 0) || Date.parse(b.zuletzt || 0) - Date.parse(a.zuletzt || 0))
    .reduce((m, p) => { if (!m[p.name]) m[p.name] = p; return m; }, {}));
  const liste = { ...ANBIETER, ...Object.fromEntries(eigeneAnbieter.map((a) => [a.id, { name: a.name, programm: a.programm, modelle: ["automatisch", ...(a.modelle || [])], install: a.installieren || "", login: a.anmelden || "", eigen: a }])) };
  // Zulassung gilt nur für genau die angezeigte Definition (Fingerabdruck fp, Nachprüfung 0.8.0 H1) – ändert der Admin etwas, ist sie weg
  const zulassen = async (pc, anbieter, an, fp) => {
    const { error } = await supabase.from("ws_ki_kopplung").upsert({ pc_id: pc, benutzer_id: ich.id, anbieter, zugelassen: an, zugelassen_fp: an ? fp : null, aktion: "pruefen" }, { onConflict: "pc_id,anbieter" });
    if (error) toast(fehler(error)); else { toast(an ? "Auf diesem PC zugelassen" : "Auf diesem PC gesperrt"); setTick((t) => t + 1); }
  };
  const name = (id) => d.benutzer.find((u) => u.id === id)?.name || "Mitglied";
  const pcName = (id) => d.pcs.find((p) => p.id === id)?.name || "PC";
  const speichern = async (aufgabe, reihe, ab) => {
    const { error } = await supabase.rpc("ws_ki_zustaendigkeit_setzen", { p_projekt: d.projektId, p_aufgabe: aufgabe, p_reihe: reihe, p_ab: ab });
    if (error) toast(fehler(error)); else { toast("Zuständigkeit gespeichert"); setTick((t) => t + 1); }
  };
  const aktion = async (pc, anbieter, a) => {
    const { error } = await supabase.from("ws_ki_kopplung").upsert({ pc_id: pc, benutzer_id: ich.id, anbieter, aktion: a }, { onConflict: "pc_id,anbieter" });
    if (error) toast(fehler(error)); else toast(a === "anmelden" ? "Anmeldung wird auf dem PC geöffnet …" : a === "bestaetigt" ? "Danke – wird als gekoppelt eingetragen" : "Wird auf dem PC geprüft …");
  };
  // Hinzufügen: eigene Werkstatt installiert, öffnet die Anmeldung und prüft; bei eigenen Anbietern gilt der Klick als Zulassung auf diesem PC
  const hinzufuegen = async (pc, anbieter, a) => {
    const { error } = await supabase.from("ws_ki_kopplung").upsert({ pc_id: pc, benutzer_id: ich.id, anbieter, aktion: "einrichten", schritt: "wartet", schritt_zeit: new Date().toISOString(), einricht_code: null,
      hinweis: "Wartet auf deine Werkstatt (das Codeschmiede-Programm muss laufen) …", ...(a.eigen ? { zugelassen: true, zugelassen_fp: a.eigen.fp } : {}) }, { onConflict: "pc_id,anbieter" });
    if (error) toast(fehler(error)); else { toast(`${a.name} wird eingerichtet`); setTick((t) => t + 1); }
  };
  const abbrechen = async (pc, anbieter) => {
    const { error } = await supabase.from("ws_ki_kopplung").upsert({ pc_id: pc, benutzer_id: ich.id, anbieter, aktion: null, schritt: "fehler", einricht_code: null, hinweis: "Zurückgesetzt – bei Bedarf nochmal „Hinzufügen“." }, { onConflict: "pc_id,anbieter" });
    if (error) toast(fehler(error)); else setTick((t) => t + 1);
  };
  const kopiere = (t) => { try { navigator.clipboard.writeText(t); toast("Kopiert"); } catch { /* Auswahl bleibt möglich */ } };
  const eigene = kopplung.filter((k) => k.benutzer_id === ich.id);
  const andere = kopplung.filter((k) => k.benutzer_id !== ich.id);
  return (
    <section className="flex flex-col gap-4" aria-label="KI-Anbieter">
      <div><h2 className="font-display font-bold text-xl leading-tight flex items-center gap-2"><Cpu className="w-5 h-5 text-emerald-700" />KI-Anbieter</h2>
        <p className="text-sm text-slate-500">Wer übernimmt was: Anbieter und Modell je Aufgabe, in Reihenfolge. Der nächste übernimmt, wenn ein Limit voll ist oder ein Anbieter auf dem PC nicht gekoppelt ist. Jeder nutzt sein eigenes Abo.</p></div>

      <Eignung liste={liste} />

      <div className={`${card} overflow-hidden`}>
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center gap-2"><h3 className="font-display font-bold">Zuständigkeiten</h3><span className="text-xs text-slate-500">{admin ? "Nur du als Admin stellst das ein." : "Stellt der Admin ein."}</span></div>
        {zust?.fehlt ? <p className="p-4 text-sm text-amber-700 dark:text-amber-300">Die Datenbank-Erweiterung 0012 (KI-Anbieter) ist noch nicht eingespielt.</p>
          : !zust ? <div className="p-4"><Loader2 className="w-5 h-5 animate-spin text-emerald-700" /></div>
          : AUFGABEN.map(([id, titel, hinweis]) => <Zeile key={id} id={id} titel={titel} hinweis={hinweis} eintrag={zust[id]} admin={admin} onSpeichern={speichern} anbieter={liste} />)}
        <p className="px-3 py-2 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800">Solange hier nichts gespeichert ist, antwortet nur Claude. Andere Anbieter bekommen Dokumentation und Dateiliste als Text und starten in einem leeren Ordner mit minimaler Umgebung; sie ändern nichts. <b>Restrisiko:</b> Ihre eingebauten Werkzeuge könnten technisch Dateien des PCs lesen – Antworten mit verdächtigem Inhalt werden verworfen. Prüfen und Bauen macht deshalb nur Claude. „Automatisch“ = Standardmodell des Anbieters.</p>
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center gap-2"><h3 className="font-display font-bold flex-1">Anbieter</h3>
          {admin && <button type="button" className={ghost} onClick={() => setBearbeite({ ...VORLAGE_COPILOT })}><Plus className="w-3.5 h-3.5" />Anbieter hinzufügen</button>}</div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {Object.entries(liste).map(([key, a]) => (
            <div key={key} className="px-3 py-2 flex flex-wrap items-center gap-2 text-sm">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${kiFarbe(key).punkt}`} aria-hidden="true" /><b>{a.name}</b><span className="text-xs text-slate-500 font-mono">{a.eigen ? `${a.programm} ${(a.eigen.argumente || []).join(" ")}` : a.programm}</span>
              <span className={`text-[11px] rounded-full px-2 py-0.5 ${a.eigen ? "bg-slate-100 dark:bg-slate-800" : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"}`}>{a.eigen ? "eigener Anbieter" : "eingebaut"}</span>
              {admin && a.eigen && <span className="ml-auto flex gap-1.5"><button type="button" className={ghost} onClick={() => setBearbeite({ ...a.eigen, argumenteText: (a.eigen.argumente || []).join("\n"), modelleText: (a.eigen.modelle || []).join(", ") })}>Bearbeiten</button>
                <button type="button" className={ghost} onClick={async () => { const { error } = await supabase.rpc("ws_ki_anbieter_loeschen", { p_id: key }); if (error) toast(fehler(error)); else { toast(`${a.name} entfernt`); setTick((t) => t + 1); } }}><X className="w-3.5 h-3.5" />Entfernen</button></span>}
            </div>))}
        </div>
        <p className="px-3 py-2 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800">Eigene Anbieter (z. B. GitHub Copilot) nutzt die Werkstatt für Chat, Konzept, Design, Texte usw. – nie zum Bauen und nicht für Prüfungen. Jede Person lässt einen eigenen Anbieter auf ihrem PC selbst zu.</p>
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950"><h3 className="font-display font-bold">Auf meinem PC gekoppelt</h3></div>
        {!meinePcs.length ? <p className="p-4 text-sm text-slate-500">Noch kein Werkstatt-PC – die Kopplung läuft über das Codeschmiede-Programm.</p>
          : meinePcs.map((pc) => (
            <div key={pc.id} className="border-t border-slate-100 dark:border-slate-800 p-3 flex flex-col gap-2">
              <div className="text-xs text-slate-500">{pc.name}</div>
              <div className="grid gap-2 md:grid-cols-3">
                {Object.entries(liste).map(([key, a]) => {
                  const k = eigene.find((x) => x.pc_id === pc.id && x.anbieter === key);
                  const limit = k?.limit_bis && Date.parse(k.limit_bis) > Date.now();
                  return (
                    <div key={key} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 flex flex-col gap-1.5 text-xs min-w-0">
                      <div className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full shrink-0 ${kiFarbe(key).punkt}`} aria-hidden="true" /><b className="text-sm">{a.name}</b><span className="text-slate-500">{a.programm}</span>
                        <span className={`ml-auto inline-flex items-center gap-1 font-semibold ${k?.gekoppelt ? (limit ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-green-400") : "text-slate-500"}`}>{k?.gekoppelt ? (limit ? <CircleAlert className="w-3.5 h-3.5" /> : <CircleCheck className="w-3.5 h-3.5" />) : <CircleAlert className="w-3.5 h-3.5" />}{k ? (k.gekoppelt ? (limit ? `Limit voll bis ${fmt(k.limit_bis)}` : "gekoppelt") : "nicht gekoppelt") : "noch nicht geprüft"}</span></div>
                      {STAERKEN[key] && <p className="text-slate-500 break-words"><b className="font-semibold text-slate-600 dark:text-slate-300">Gut für:</b> {STAERKEN[key].gut}</p>}
                      {k?.hinweis && <p className="text-slate-600 dark:text-slate-300 break-words">{k.hinweis}</p>}
                      {(() => { const prog = a.eigen ? a.programm : key === "chatgpt" ? "codex" : key; const ek = EIN_KLICK[prog]; const laeuft = ["wartet", "installieren", "anmelden", "pruefen", "bestaetigen"].includes(k?.schritt);
                        if (!ek || key === "claude") return null;
                        // hängt? (Werkstatt aus, alt oder abgestürzt): nach 2 bzw. 12 Minuten „Nochmal“/„Abbrechen“ anbieten (Prüfung O3)
                        const alt = laeuft && Date.now() - Date.parse(k.schritt_zeit || k.geprueft || 0) > (k.schritt === "wartet" ? 2 : 12) * 60 * 1000;
                        if (laeuft) return <><Einrichten k={k} art={ek.art} kopiere={kopiere} />
                          {k.schritt === "bestaetigen" && <button type="button" className={`${btn} self-start`} onClick={() => aktion(pc.id, key, "bestaetigt")}><CircleCheck className="w-4 h-4" />Ich bin angemeldet</button>}
                          {alt && <div className="flex flex-wrap gap-1.5 items-center"><span className="text-amber-700 dark:text-amber-300">{k.schritt === "wartet" ? "Deine Werkstatt meldet sich nicht – läuft das Codeschmiede-Programm (ab 0.8.5)?" : "Das dauert ungewöhnlich lange."}</span>
                            <button type="button" className={ghost} onClick={() => hinzufuegen(pc.id, key, a)}><RefreshCw className="w-3.5 h-3.5" />Nochmal</button><button type="button" className={ghost} title="Setzt nur die Anzeige zurück – ein noch offenes Anmeldefenster schließt du selbst" onClick={() => abbrechen(pc.id, key)}><X className="w-3.5 h-3.5" />Zurücksetzen</button></div>}</>;
                        if (k?.gekoppelt && k?.eingerichtet) return null;
                        return <div className="flex flex-col gap-1.5">
                          <span className="inline-flex items-center gap-1 text-slate-500">{ek.art === "fenster" ? <SquareTerminal className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}{ek.art === "fenster" ? "Anmeldung im Fenster" : "Anmeldung im Browser"} · falls nötig: {ek.install}</span>
                          <button type="button" className={`${btn} self-start`} onClick={() => hinzufuegen(pc.id, key, a)}><PlugZap className="w-4 h-4" />{k?.gekoppelt ? "Neu anmelden" : "Hinzufügen"}</button>
                          {a.eigen && <span className="text-slate-500">Mit dem Klick lässt du {a.name} auf diesem PC zu – die Werkstatt startet es dann mit <span className="font-mono break-all">{a.programm} {(a.eigen.argumente || []).join(" ")}</span> im leeren Ordner.</span>}
                        </div>; })()}
                      {!k?.gekoppelt && key !== "claude" && !EIN_KLICK[a.eigen ? a.programm : key === "chatgpt" ? "codex" : key] && <div className="flex flex-col gap-1">
                        {a.install && <><span className="text-slate-500">1. Installieren (einmal, im Terminal):</span>
                        <button type="button" className="font-mono text-left bg-slate-50 dark:bg-slate-950 rounded px-2 py-1 flex items-center gap-1.5 break-all" onClick={() => kopiere(a.install)}><Copy className="w-3 h-3 shrink-0" />{a.install}</button></>}
                        <span className="text-slate-500">2. Mit dem eigenen Konto anmelden{a.login ? `: im Terminal „${a.login}“` : ""}{key === "gemini" ? " und „Login with Google“ wählen" : ""}.</span>
                      </div>}
                      {a.eigen && <label className="flex items-start gap-1.5 rounded bg-amber-50 dark:bg-amber-950/40 p-1.5">
                        <input type="checkbox" className="mt-0.5 accent-emerald-700" checked={!!k?.zugelassen} onChange={(e) => zulassen(pc.id, key, e.target.checked, a.eigen.fp)} />
                        <span>Auf diesem PC zulassen – startet <span className="font-mono break-all">{a.programm} {(a.eigen.argumente || []).join(" ")}</span> mit deinen Rechten im leeren Ordner. Nur zulassen, wenn du dem Programm vertraust.</span></label>}
                      <div className="flex flex-wrap gap-1.5 mt-auto">
                        <button type="button" className={ghost} onClick={() => aktion(pc.id, key, "pruefen")}><RefreshCw className="w-3.5 h-3.5" />Prüfen</button>
                        {k?.geprueft && <span className="text-slate-400 self-center">geprüft {fmt(k.geprueft)}</span>}
                      </div>
                    </div>);
                })}
              </div>
            </div>))}
        <p className="px-3 py-2 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800">Die Anmeldung bleibt im Anmeldespeicher des jeweiligen Programms auf deinem PC – die Codeschmiede sieht kein Passwort und speichert keine Zugangsdaten.</p>
      </div>

      {admin && andere.length > 0 && <div className={`${card} overflow-hidden`}>
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950"><h3 className="font-display font-bold">Kopplungen im Team</h3></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>{andere.map((k) => <tr key={`${k.pc_id}-${k.anbieter}`} className="border-t border-slate-100 dark:border-slate-800">
          <td className="px-3 py-2">{name(k.benutzer_id)}</td><td className="px-3 py-2 text-xs">{pcName(k.pc_id)}</td><td className="px-3 py-2">{liste[k.anbieter]?.name || k.anbieter}</td>
          <td className="px-3 py-2 text-xs">{k.gekoppelt ? "gekoppelt" : "nicht gekoppelt"}</td><td className="px-3 py-2 text-xs text-slate-500">{fmt(k.geprueft)}</td></tr>)}</tbody></table></div>
      </div>}

      <div className={`${card} overflow-hidden`}>
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950 flex items-center gap-2"><History className="w-4 h-4 text-emerald-700" /><h3 className="font-display font-bold">Protokoll: wer hat geantwortet</h3><span className="text-xs text-slate-500">nur deine eigenen Gespräche</span></div>
        <div className="p-3"><KiProtokoll /></div>
      </div>
      {bearbeite && <AnbieterDialog wert={bearbeite} toast={toast} onClose={() => setBearbeite(null)} onFertig={() => { setBearbeite(null); setTick((t) => t + 1); }} />}
    </section>);
}
