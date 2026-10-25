// Symbol-Wahl für den Baustein-Inspektor (App-Designer 2.0): nur Lucide-Symbole (ein Stil für die ganze App).
// Wird erst bei Bedarf geladen (enthält alle Lucide-Symbole – wie Umdesign.jsx).
import React, { useMemo, useState } from "react";
import { icons as LUCIDE, Search } from "lucide-react";

const input = "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-sm";
const NAME = /^[A-Z][A-Za-z0-9]{1,40}$/;

export function SymbolZeichen({ name, className = "w-4 h-4" }) {
  const I = NAME.test(name || "") && Object.hasOwn(LUCIDE, name) ? LUCIDE[name] : null;
  return I ? <I className={className} aria-hidden="true" /> : null;
}

export default function SymbolWahl({ wert, onWahl, gesperrt = false }) {
  const [q, setQ] = useState("");
  const treffer = useMemo(() => {
    const s = q.trim().toLowerCase();
    return Object.keys(LUCIDE).filter((n) => NAME.test(n) && (!s || n.toLowerCase().includes(s))).slice(0, 48);
  }, [q]);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="relative"><Search className="w-4 h-4 absolute left-2.5 top-2 text-slate-400" aria-hidden="true" />
        <span className="sr-only">Symbol suchen</span>
        <input className={`${input} pl-8`} placeholder="Symbol suchen (englisch, z. B. check)" value={q} maxLength={40} onChange={(e) => setQ(e.target.value)} disabled={gesperrt} /></label>
      <div className="grid grid-cols-8 gap-1 max-h-[136px] overflow-auto" role="listbox" aria-label="Lucide-Symbole">
        {treffer.map((n) => { const I = LUCIDE[n]; return (
          <button key={n} type="button" role="option" aria-selected={wert === n} title={n} disabled={gesperrt} onClick={() => onWahl(n)}
            className={`h-8 grid place-items-center rounded-md border ${wert === n ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950" : "border-slate-200 dark:border-slate-800 hover:border-emerald-500"}`}><I className="w-4 h-4" /></button>); })}
      </div>
    </div>);
}
