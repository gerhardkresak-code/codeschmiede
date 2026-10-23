import React, { useEffect, useMemo, useState } from "react";
import { Cpu, Loader2, Save, ArrowUp, ArrowDown, Plus, X, RefreshCw, LogIn, Lock, CircleCheck, CircleAlert, Copy, History } from "lucide-react";
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
const AUFGABEN = [
  ["chat", "Chat überall (Fragen, Ausloten)", ""],
  ["konzept", "Konzept & Rückfragen vor dem Bauen", "Ergebnis ist die Konzept-Karte im Chat"],
  ["design", "Design-Chat im App-Designer", ""],
  ["pruefung", "Unabhängige Prüfungen", "Fremde Anbieter prüfen nur auf PCs mit Sandbox (Mac/Linux); unter Windows prüft Claude. Claude bleibt immer als Rückfall."],
  ["doku", "Dokumentation & Handbuch", "wird genutzt, sobald Doku-Aufträge getrennt laufen (Etappe 4)"],
  ["texte", "Texte & Übersetzungen", "wird genutzt, sobald Text-Aufträge getrennt laufen (Etappe 4)"],
  ["bilder", "Bilder & Grafiken", "wird mit Etappe 5 (Marke, Logo) genutzt; nur Anbieter, die Bilder erzeugen können"],
  ["bauen", "Bauen & Programmieren", "fest Claude – nie ein anderer Anbieter"],
];
// Ohne Admin-Einstellung gilt nur Claude (Prüfung M5). VORSCHLAG = Entwurf 1.2 zum Übernehmen.
const STANDARD = Object.fromEntries(["chat", "konzept", "design", "pruefung", "doku", "texte", "bilder", "bauen"].map((a) => [a, [{ anbieter: "claude", ...({ konzept: { modell: "opus" }, pruefung: { modell: "opus" }, texte: { modell: "haiku" } }[a] || {}) }]]));
const VORSCHLAG = {
  chat: [{ anbieter: "chatgpt" }, { anbieter: "gemini" }, { anbieter: "claude", modell: "sonnet" }],
  konzept: [{ anbieter: "chatgpt" }, { anbieter: "claude", modell: "opus" }],
  design: [{ anbieter: "chatgpt" }, { anbieter: "claude", modell: "sonnet" }],
  pruefung: [{ anbieter: "chatgpt" }, { anbieter: "gemini" }, { anbieter: "claude", modell: "opus" }],
  doku: [{ anbieter: "gemini" }, { anbieter: "chatgpt" }, { anbieter: "claude", modell: "sonnet" }],
  texte: [{ anbieter: "chatgpt" }, { anbieter: "claude", modell: "haiku" }],
  bilder: [{ anbieter: "gemini" }, { anbieter: "chatgpt" }],
  bauen: [{ anbieter: "claude" }],
};
const MODELL = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,59}$/;

function Zeile({ id, titel, hinweis, eintrag, admin, onSpeichern }) {
  const fest = id === "bauen";
  const [reihe, setReihe] = useState(eintrag?.reihe || STANDARD[id]);
  const [ab, setAb] = useState(eintrag?.weitergeben_ab ?? 90);
  const [busy, setBusy] = useState(false); const [eigen, setEigen] = useState(null); const [eigenText, setEigenText] = useState("");
  useEffect(() => { setReihe(eintrag?.reihe || STANDARD[id]); setAb(eintrag?.weitergeben_ab ?? 90); }, [eintrag, id]);
  const geaendert = JSON.stringify(reihe) !== JSON.stringify(eintrag?.reihe || STANDARD[id]) || ab !== (eintrag?.weitergeben_ab ?? 90) || !eintrag;
  const setze = (i, feld, wert) => setReihe(reihe.map((e, j) => (j === i ? (feld === "modell" ? (wert === "automatisch" ? { anbieter: e.anbieter } : { ...e, modell: wert }) : { anbieter: wert }) : e)));
  const tausche = (i, j) => { const r = [...reihe]; [r[i], r[j]] = [r[j], r[i]]; setReihe(r); };
  const frei = Object.keys(ANBIETER).filter((a) => !reihe.some((e) => e.anbieter === a));
  const speichern = async () => { setBusy(true); await onSpeichern(id, reihe, ab); setBusy(false); };
  return (
    <div className="border-t border-slate-100 dark:border-slate-800 p-3 grid gap-2 lg:grid-cols-[240px_minmax(0,1fr)_auto] items-start">
      <div><div className="font-semibold text-sm flex items-center gap-1.5">{fest && <Lock className="w-3.5 h-3.5 text-slate-400" />}{titel}</div>{hinweis && <div className="text-xs text-slate-500">{hinweis}</div>}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {reihe.map((e, i) => {
          const a = ANBIETER[e.anbieter]; const eigenes = e.modell && !a.modelle.includes(e.modell);
          return (
            <span key={e.anbieter} className={`inline-flex items-center gap-1 rounded-full pl-2.5 pr-1 py-0.5 text-xs font-semibold border ${e.anbieter === "claude" ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>
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
        {admin && !fest && !eintrag && JSON.stringify(reihe) !== JSON.stringify(VORSCHLAG[id]) && <button type="button" className={ghost} onClick={() => setReihe(VORSCHLAG[id])}>Vorschlag einsetzen</button>}
        {admin && !fest && frei.length > 0 && <select className={sel} value="" aria-label="Anbieter hinzufügen" onChange={(ev) => ev.target.value && setReihe([...reihe, { anbieter: ev.target.value }])}>
          <option value="">+ Anbieter</option>{frei.map((a) => <option key={a} value={a}>{ANBIETER[a].name}</option>)}</select>}
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {!fest && <label className="flex items-center gap-1">weiter ab
          {admin ? <select className={sel} value={ab} onChange={(e) => setAb(Number(e.target.value))}>{[70, 80, 90, 95, 100].map((x) => <option key={x} value={x}>{x} %</option>)}</select> : <b>{ab} %</b>}</label>}
        {admin && !fest && <button type="button" className={ghost} disabled={busy || !geaendert} onClick={speichern}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{eintrag ? "Speichern" : "Übernehmen"}</button>}
        {admin && !fest && reihe.some((e) => e.anbieter !== "claude") && geaendert && <span className="basis-full text-[11px] text-amber-700 dark:text-amber-300">Hinweis: Fremde Anbieter bekommen Projekttexte und laufen auf dem PC; ihre Werkzeuge könnten technisch Dateien des PCs lesen.</span>}
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

export default function KiAnbieter({ d, ich, toast }) {
  const admin = ich.rolle === "admin";
  const [zust, setZust] = useState(null); const [kopplung, setKopplung] = useState([]); const [tick, setTick] = useState(0);
  useEffect(() => {
    let aus = false;
    (async () => {
      const [z, k] = await Promise.all([
        supabase.from("ws_ki_zustaendigkeit").select("*").eq("projekt_id", d.projektId),
        supabase.from("ws_ki_kopplung").select("*").order("anbieter"),
      ]);
      if (aus) return;
      setZust(z.error ? { fehlt: true } : Object.fromEntries((z.data || []).map((x) => [x.aufgabe, x])));
      setKopplung(k.data || []);
    })();
    const kanal = supabase.channel(`ki-${Math.random()}`).on("postgres_changes", { event: "*", schema: "public", table: "ws_ki_kopplung" }, () => setTick((t) => t + 1)).subscribe();
    return () => { aus = true; supabase.removeChannel(kanal); };
  }, [d.projektId, tick]);
  const meinePcs = d.pcs.filter((p) => p.benutzer_id === ich.id);
  const name = (id) => d.benutzer.find((u) => u.id === id)?.name || "Mitglied";
  const pcName = (id) => d.pcs.find((p) => p.id === id)?.name || "PC";
  const speichern = async (aufgabe, reihe, ab) => {
    const { error } = await supabase.rpc("ws_ki_zustaendigkeit_setzen", { p_projekt: d.projektId, p_aufgabe: aufgabe, p_reihe: reihe, p_ab: ab });
    if (error) toast(fehler(error)); else { toast("Zuständigkeit gespeichert"); setTick((t) => t + 1); }
  };
  const aktion = async (pc, anbieter, a) => {
    const { error } = await supabase.from("ws_ki_kopplung").upsert({ pc_id: pc, benutzer_id: ich.id, anbieter, aktion: a }, { onConflict: "pc_id,anbieter" });
    if (error) toast(fehler(error)); else toast(a === "anmelden" ? "Anmeldung wird auf dem PC geöffnet …" : "Wird auf dem PC geprüft …");
  };
  const kopiere = (t) => { try { navigator.clipboard.writeText(t); toast("Kopiert"); } catch { /* Auswahl bleibt möglich */ } };
  const eigene = kopplung.filter((k) => k.benutzer_id === ich.id);
  const andere = kopplung.filter((k) => k.benutzer_id !== ich.id);
  return (
    <section className="flex flex-col gap-4" aria-label="KI-Anbieter">
      <div><h2 className="font-display font-bold text-xl leading-tight flex items-center gap-2"><Cpu className="w-5 h-5 text-emerald-700" />KI-Anbieter</h2>
        <p className="text-sm text-slate-500">Wer übernimmt was: Anbieter und Modell je Aufgabe, in Reihenfolge. Der nächste übernimmt, wenn ein Limit voll ist oder ein Anbieter auf dem PC nicht gekoppelt ist. Jeder nutzt sein eigenes Abo.</p></div>

      <div className={`${card} overflow-hidden`}>
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center gap-2"><h3 className="font-display font-bold">Zuständigkeiten</h3><span className="text-xs text-slate-500">{admin ? "Nur du als Admin stellst das ein." : "Stellt der Admin ein."}</span></div>
        {zust?.fehlt ? <p className="p-4 text-sm text-amber-700 dark:text-amber-300">Die Datenbank-Erweiterung 0012 (KI-Anbieter) ist noch nicht eingespielt.</p>
          : !zust ? <div className="p-4"><Loader2 className="w-5 h-5 animate-spin text-emerald-700" /></div>
          : AUFGABEN.map(([id, titel, hinweis]) => <Zeile key={id} id={id} titel={titel} hinweis={hinweis} eintrag={zust[id]} admin={admin} onSpeichern={speichern} />)}
        <p className="px-3 py-2 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800">Solange hier nichts gespeichert ist, antwortet nur Claude. Andere Anbieter bekommen Dokumentation und Dateiliste als Text und starten in einem leeren Ordner mit minimaler Umgebung; sie ändern nichts. <b>Restrisiko:</b> Ihre eingebauten Werkzeuge könnten technisch Dateien des PCs lesen – Antworten mit verdächtigem Inhalt werden verworfen. Prüfen und Bauen macht deshalb nur Claude. „Automatisch“ = Standardmodell des Anbieters.</p>
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950"><h3 className="font-display font-bold">Auf meinem PC gekoppelt</h3></div>
        {!meinePcs.length ? <p className="p-4 text-sm text-slate-500">Noch kein Werkstatt-PC – die Kopplung läuft über das Codeschmiede-Programm.</p>
          : meinePcs.map((pc) => (
            <div key={pc.id} className="border-t border-slate-100 dark:border-slate-800 p-3 flex flex-col gap-2">
              <div className="text-xs text-slate-500">{pc.name}</div>
              <div className="grid gap-2 md:grid-cols-3">
                {Object.entries(ANBIETER).map(([key, a]) => {
                  const k = eigene.find((x) => x.pc_id === pc.id && x.anbieter === key);
                  const limit = k?.limit_bis && Date.parse(k.limit_bis) > Date.now();
                  return (
                    <div key={key} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 flex flex-col gap-1.5 text-xs min-w-0">
                      <div className="flex items-center gap-1.5"><b className="text-sm">{a.name}</b><span className="text-slate-500">{a.programm}</span>
                        <span className={`ml-auto inline-flex items-center gap-1 font-semibold ${k?.gekoppelt ? (limit ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-green-400") : "text-slate-500"}`}>{k?.gekoppelt ? (limit ? <CircleAlert className="w-3.5 h-3.5" /> : <CircleCheck className="w-3.5 h-3.5" />) : <CircleAlert className="w-3.5 h-3.5" />}{k ? (k.gekoppelt ? (limit ? `Limit voll bis ${fmt(k.limit_bis)}` : "gekoppelt") : "nicht gekoppelt") : "noch nicht geprüft"}</span></div>
                      {k?.hinweis && <p className="text-slate-600 dark:text-slate-300 break-words">{k.hinweis}</p>}
                      {!k?.gekoppelt && key !== "claude" && <div className="flex flex-col gap-1">
                        <span className="text-slate-500">1. Installieren (einmal, im Terminal):</span>
                        <button type="button" className="font-mono text-left bg-slate-50 dark:bg-slate-950 rounded px-2 py-1 flex items-center gap-1.5 break-all" onClick={() => kopiere(a.install)}><Copy className="w-3 h-3 shrink-0" />{a.install}</button>
                        <span className="text-slate-500">2. Mit dem eigenen {key === "chatgpt" ? "ChatGPT" : "Google"}-Konto anmelden{key === "gemini" ? " (im Terminal „gemini“ starten, „Login with Google“)" : ""}.</span>
                      </div>}
                      <div className="flex flex-wrap gap-1.5 mt-auto">
                        <button type="button" className={ghost} onClick={() => aktion(pc.id, key, "pruefen")}><RefreshCw className="w-3.5 h-3.5" />Prüfen</button>
                        {key === "chatgpt" && !k?.gekoppelt && <button type="button" className={ghost} onClick={() => aktion(pc.id, key, "anmelden")}><LogIn className="w-3.5 h-3.5" />Anmelden</button>}
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
          <td className="px-3 py-2">{name(k.benutzer_id)}</td><td className="px-3 py-2 text-xs">{pcName(k.pc_id)}</td><td className="px-3 py-2">{ANBIETER[k.anbieter]?.name}</td>
          <td className="px-3 py-2 text-xs">{k.gekoppelt ? "gekoppelt" : "nicht gekoppelt"}</td><td className="px-3 py-2 text-xs text-slate-500">{fmt(k.geprueft)}</td></tr>)}</tbody></table></div>
      </div>}

      <div className={`${card} overflow-hidden`}>
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950 flex items-center gap-2"><History className="w-4 h-4 text-emerald-700" /><h3 className="font-display font-bold">Protokoll: wer hat geantwortet</h3><span className="text-xs text-slate-500">nur deine eigenen Gespräche</span></div>
        <div className="p-3"><KiProtokoll /></div>
      </div>
    </section>);
}
