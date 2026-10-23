import React, { useId } from "react";

// Zeichen der Codeschmiede „Glühendes C“ (Entwurf C, Gerhard 2026-10-23 17:30). Quelle: marke/zeichen.svg.
// klein: ab 32 px und darunter ohne Verlauf/Cursor, damit es scharf bleibt (marke/zeichen-klein.svg).
export default function CodeschmiedeZeichen({ groesse = 36, className = "" }) {
  const id = useId().replace(/:/g, "");
  const klein = groesse <= 24;
  return (
    <svg width={groesse} height={groesse} viewBox="0 0 64 64" className={`shrink-0 ${className}`} role="img" aria-label="Codeschmiede">
      {!klein && <defs><linearGradient id={`g${id}`} x1="0" x2="1"><stop offset="0" stopColor="#34d399" /><stop offset=".7" stopColor="#34d399" /><stop offset="1" stopColor="#fbbf24" /></linearGradient></defs>}
      <rect width="64" height="64" rx={klein ? 14 : 16} fill="#0f2a22" />
      {klein
        ? <path d="M47 20A17 17 0 1 0 47 44" stroke="#34d399" strokeWidth="13" fill="none" strokeLinecap="round" />
        : <><path d="M48 20A18 18 0 1 0 48 44" stroke={`url(#g${id})`} strokeWidth="9" fill="none" strokeLinecap="round" /><rect x="36" y="25" width="4" height="14" rx="2" fill="#fff" /></>}
    </svg>);
}
