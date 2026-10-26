// Freigeben und Zusammenführen eines Auftrags – mit Rückfrage. Gemeinsam für die Zentrale (App.jsx) und den Konzept-Chat (ClaudeSpalte.jsx).
import React, { useState } from "react";
import { Check, GitMerge } from "lucide-react";

const btn = "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-display font-bold tracking-wide transition";
const ghost = "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition";

export function FreigabeKnopf({ a, onJa, ohneInfo }) {
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

export function ZusammenKnopf({ a, onJa }) {
  const [frag, setFrag] = useState(false);
  if (!frag) return <button type="button" className={`${btn} h-9 text-sm self-start`} onClick={() => setFrag(true)}><GitMerge className="w-4 h-4" />Zusammenführen</button>;
  return (
    <div className="flex flex-col gap-2"><span>Auftrag #{a.id} mit dem neuesten Stand zusammenführen? Das ganze Feature wird in einer Testfassung geprüft und erst bei Grün live geschaltet.</span>
      <div className="flex gap-2"><button type="button" className={`${btn} h-9 text-sm`} onClick={onJa}>Ja, zusammenführen</button><button type="button" className={`${ghost} h-9`} onClick={() => setFrag(false)}>Abbrechen</button></div></div>
  );
}
