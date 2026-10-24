import React, { useLayoutEffect, useRef, useState } from "react";
import { Monitor, Tablet, Smartphone } from "lucide-react";

// Geräte-Rahmen für alle Vorschauen (Fehlerkorrektur 0.9.5, Analyse App-Designer mit Gerhard 2026-10-24 21:24):
// Die App wird in echter Gerätebreite gezeichnet (PC 1280, Tablet 820, Handy 390 px) und per transform: scale() in die
// verfügbare Spalte eingepasst. Vorher war der Rahmen schmaler als 1024 px und die App klappte ihr Menü auf Symbole zusammen.
// Klicks und „Zeigen & kommentieren“ funktionieren weiter: Der Browser rechnet Zeiger-Ereignisse durch die Skalierung um,
// die App im Rahmen sieht ihre eigenen, unskalierten Koordinaten.
export const GERAETE_MASSE = {
  pc: { breite: 1280, hoehe: 800, name: "PC", Symbol: Monitor },
  tablet: { breite: 820, hoehe: 1180, name: "Tablet", Symbol: Tablet },
  handy: { breite: 390, hoehe: 844, name: "Handy", Symbol: Smartphone },
};
export const geraetVonBreite = (b) => Object.keys(GERAETE_MASSE).find((k) => GERAETE_MASSE[k].breite === b) || "pc";

const FUSS = 22;   // Platz für die Zeile mit Gerätegröße und Maßstab

/**
 * geraet: "pc" | "tablet" | "handy"
 * hoehe:  Zahl (Gerätepixel) · "geraet" (Standardhöhe des Geräts) · "fuellen" (so hoch wie der Platz, nur mit fester Höhe von außen)
 *         · "inhalt" (so hoch wie der Inhalt, z. B. das Gerüst)
 * einpassen: "breite" (nur nach der Breite skalieren) oder "beide" (ganzes Gerät sichtbar)
 * className: Klassen des äußeren Platzes (z. B. feste Höhe bei „fuellen“)
 */
export default function GeraeteRahmen({ geraet = "pc", hoehe = "geraet", einpassen = "breite", className = "", rahmenClass = "rounded-xl ring-1 ring-black/10 bg-white shadow-lg", text = "", children }) {
  const m = GERAETE_MASSE[geraet] || GERAETE_MASSE.pc;
  const aussen = useRef(null); const innen = useRef(null);
  const [platz, setPlatz] = useState({ w: 0, h: 0 }); const [inhaltH, setInhaltH] = useState(0);
  useLayoutEffect(() => {
    const el = aussen.current; if (!el) return undefined;
    const messen = () => { const r = el.getBoundingClientRect(); setPlatz((alt) => (alt.w === r.width && alt.h === r.height ? alt : { w: r.width, h: r.height })); };
    messen();
    if (typeof ResizeObserver === "undefined") { window.addEventListener("resize", messen); return () => window.removeEventListener("resize", messen); }
    const ro = new ResizeObserver(messen); ro.observe(el); return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (hoehe !== "inhalt") return undefined;
    const el = innen.current; if (!el) return undefined;
    const messen = () => setInhaltH(el.offsetHeight);   // offsetHeight ist unskaliert (transform zählt nicht)
    messen();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(messen); ro.observe(el); return () => ro.disconnect();
  }, [hoehe]);

  const sBreite = platz.w > 0 ? Math.min(1, platz.w / m.breite) : 1;
  const frei = Math.max(0, platz.h - FUSS);
  let h = typeof hoehe === "number" ? hoehe : hoehe === "inhalt" ? inhaltH : hoehe === "fuellen" && frei > 0 ? Math.round(frei / sBreite) : m.hoehe;
  if (hoehe === "fuellen" && h < 480) h = 480;
  const s = einpassen === "beide" && hoehe !== "inhalt" && hoehe !== "fuellen" && frei > 0 ? Math.min(sBreite, frei / h) : sBreite;
  const Symbol = m.Symbol;
  return (
    <div ref={aussen} className={`w-full min-w-0 ${className}`}>
      <div className="mx-auto" style={{ width: Math.floor(m.breite * s) }}>
        <div className={`overflow-hidden ${rahmenClass}`} style={{ width: Math.floor(m.breite * s), height: hoehe === "inhalt" ? Math.ceil(inhaltH * s) : Math.floor(h * s) }}>
          <div ref={innen} style={{ width: m.breite, height: hoehe === "inhalt" ? "auto" : h, transform: s === 1 ? undefined : `scale(${s})`, transformOrigin: "0 0" }}>
            {children}
          </div>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 mt-1 h-4 whitespace-nowrap overflow-hidden">
          <Symbol className="w-3.5 h-3.5" aria-hidden="true" />{m.name} · {m.breite} × {Math.round(h)} px · Maßstab {Math.round(s * 100)} %{text ? ` · ${text}` : ""}
        </p>
      </div>
    </div>);
}
