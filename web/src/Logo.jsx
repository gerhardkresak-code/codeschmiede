import React from "react";

// Logo aus festen Marke-Werten zeichnen (App-Designer · Marke, Etappe 5 – Gerhard 2026-10-23 15:53).
// Gleiche Datei in der Codeschmiede (web/src/Logo.jsx) und in Trainer to go (src/lib/design/Logo.jsx) – bei Änderungen beide anpassen.
// Nur feste Formen, Farben #rrggbb und kurzer Text als Textknoten – kein freies SVG, nichts Ausführbares.
export const MARKE_BASIS = { zeichen: "bild", farbe: "#059669", farbe2: "#ffffff", kuerzel: "TG", name: "Trainer to go", gewicht: 700, sperrung: 0, form: "rund" };
export const ZEICHEN = [["bild", "Bisheriges Bild"], ["schild", "Schild"], ["ball", "Ball"], ["monogramm", "Monogramm"], ["pfeil", "Pfeil"], ["glut", "Glühendes C"], ["eigen", "Eingelesen"]];
// Eingelesenes Logo (Datenbank 0026): nur feste Formen – Rechteck, Kreis, Ellipse, Pfad, Text – mit Farben #rrggbb (gleiche Regeln wie ws_marke_vektor_ok)
const FARBE = (v) => (typeof v === "string" && (/^#[0-9a-f]{6}$/i.test(v) || v === "none") ? v.toLowerCase() : null);
const ZAHL = (v, lo, hi) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v * 100) / 100 : null);
const FELDER = {
  rect: { x: [-8, 72], y: [-8, 72], w: [0, 80], h: [0, 80], rx: [0, 40] }, circle: { cx: [-8, 72], cy: [-8, 72], r: [0, 40] },
  ellipse: { cx: [-8, 72], cy: [-8, 72], rx: [0, 40], ry: [0, 40] }, path: {}, text: { x: [-8, 72], y: [-8, 72], size: [4, 48] },
};
export function vektorBereinigen(v) {
  if (!v || typeof v !== "object" || !Array.isArray(v.elemente)) return null;
  const elemente = [];
  for (const e of v.elemente.slice(0, 40)) {
    if (!e || typeof e !== "object" || !Object.hasOwn(FELDER, e.t)) continue;
    const o = { t: e.t };
    for (const [k, [lo, hi]] of Object.entries(FELDER[e.t])) { const z = ZAHL(e[k], lo, hi); if (z != null) o[k] = z; }
    for (const k of ["fill", "stroke"]) { const f = FARBE(e[k]); if (f) o[k] = f; }
    const sw = ZAHL(e.sw, 0, 16); if (sw != null) o.sw = sw;
    if (e.t === "path") { if (typeof e.d !== "string" || !/^[MmLlHhVvCcSsQqTtAaZz0-9 .,-]{1,2000}$/.test(e.d)) continue; o.d = e.d; }
    if (e.t === "text") {
      if (typeof e.text !== "string" || !/^[A-Za-z0-9ÄÖÜäöüß .&-]{1,16}$/.test(e.text)) continue; o.text = e.text;
      if ([400, 500, 600, 700, 800, 900].includes(e.weight)) o.weight = e.weight;
      if (["start", "middle", "end"].includes(e.anchor)) o.anchor = e.anchor;
    }
    elemente.push(o);
  }
  return elemente.length ? { elemente } : null;
}
function VektorTeil({ e }) {
  const f = { fill: e.fill || "none", stroke: e.stroke && e.stroke !== "none" ? e.stroke : undefined, strokeWidth: e.sw };
  if (e.t === "rect") return <rect x={e.x || 0} y={e.y || 0} width={e.w || 0} height={e.h || 0} rx={e.rx || 0} {...f} />;
  if (e.t === "circle") return <circle cx={e.cx || 0} cy={e.cy || 0} r={e.r || 0} {...f} />;
  if (e.t === "ellipse") return <ellipse cx={e.cx || 0} cy={e.cy || 0} rx={e.rx || 0} ry={e.ry || 0} {...f} />;
  if (e.t === "path") return <path d={e.d} {...f} />;
  return <text x={e.x || 0} y={e.y || 0} fontSize={e.size || 12} fontWeight={e.weight || 700} textAnchor={e.anchor || "start"} fontFamily='"Barlow Semi Condensed","Arial Narrow",system-ui,sans-serif' {...f}>{e.text}</text>;
}
const HEX = /^#[0-9a-f]{6}$/i;
const VERBOTEN = new Set(["__proto__", "constructor", "prototype"]);

/** Nur bekannte, gültige Werte übernehmen (gleiche Regeln wie ws_marke_ok in der Datenbank). */
export function marke(w) {
  const r = { ...MARKE_BASIS };
  if (!w || typeof w !== "object") return r;
  for (const k of Object.keys(MARKE_BASIS)) {
    if (VERBOTEN.has(k) || !Object.prototype.hasOwnProperty.call(w, k)) continue;
    const v = w[k];
    if (k === "zeichen" && ZEICHEN.some(([z]) => z === v)) r.zeichen = v;
    if ((k === "farbe" || k === "farbe2") && HEX.test(v)) r[k] = v.toLowerCase();
    if (k === "kuerzel" && /^[A-Za-z0-9ÄÖÜäöü]{1,3}$/.test(v)) r.kuerzel = v;
    if (k === "name" && /^[A-Za-z0-9ÄÖÜäöüß .&-]{1,40}$/.test(v)) r.name = v;
    if (k === "gewicht" && [600, 700, 800].includes(v)) r.gewicht = v;
    if (k === "sperrung" && Number.isFinite(v)) r.sperrung = Math.max(-2, Math.min(8, Math.round(v)));
    if (k === "form" && ["rund", "eckig"].includes(v)) r.form = v;
  }
  const vk = vektorBereinigen(w.vektor); if (vk) r.vektor = vk;
  if (r.zeichen === "eigen" && !r.vektor) r.zeichen = "monogramm";
  return r;
}

/** Das Zeichen als SVG (64×64). bild = vorhandenes Bild (src). */
export function LogoZeichen({ werte, groesse = 40, bild = null, titel = "" }) {
  const m = marke(werte);
  if (m.zeichen === "bild" && bild) return <img src={bild} alt={titel} width={groesse} height={groesse} style={{ width: groesse, height: groesse, borderRadius: m.form === "rund" ? groesse * 0.22 : groesse * 0.08, objectFit: "contain" }} />;
  const rx = m.form === "rund" ? 14 : 4;
  const txt = (y = 41, gross = 24) => <text x="32" y={y} textAnchor="middle" fontFamily='"Barlow Semi Condensed","Arial Narrow",system-ui,sans-serif' fontWeight={m.gewicht} fontSize={m.kuerzel.length > 2 ? gross * 0.72 : gross} fill={m.farbe2} letterSpacing={m.sperrung * 0.3}>{m.kuerzel}</text>;
  let inhalt;
  if (m.zeichen === "schild") inhalt = <><path d="M32 5 L55 13 V30 C55 44 45 54 32 59 C19 54 9 44 9 30 V13 Z" fill={m.farbe} />{txt(40, 22)}</>;
  else if (m.zeichen === "ball") inhalt = <><circle cx="32" cy="32" r="27" fill={m.farbe2} stroke={m.farbe} strokeWidth="5" /><polygon points="32,20 43,28 39,41 25,41 21,28" fill={m.farbe} />
    {[[32, 20, 32, 7], [43, 28, 55, 24], [39, 41, 47, 52], [25, 41, 17, 52], [21, 28, 9, 24]].map(([a, b, c, d], i) => <line key={i} x1={a} y1={b} x2={c} y2={d} stroke={m.farbe} strokeWidth="3" strokeLinecap="round" />)}</>;
  else if (m.zeichen === "pfeil") inhalt = <><rect x="4" y="4" width="56" height="56" rx={rx} fill={m.farbe} /><path d="M24 18 L46 32 L24 46 Z" fill={m.farbe2} /></>;
  else if (m.zeichen === "eigen" && m.vektor) inhalt = <>{m.vektor.elemente.map((e, i) => <VektorTeil key={i} e={e} />)}</>;
  else if (m.zeichen === "glut") inhalt = <><rect x="4" y="4" width="56" height="56" rx={rx} fill="#1c1917" /><path d="M43 19 A17 17 0 1 0 43 45" fill="none" stroke={m.farbe} strokeWidth="9" strokeLinecap="round" /><rect x="41" y="27" width="4" height="12" rx="1.5" fill={m.farbe2} /></>;
  else inhalt = <><rect x="4" y="4" width="56" height="56" rx={rx} fill={m.farbe} />{txt()}</>;
  return <svg viewBox="0 0 64 64" width={groesse} height={groesse} role="img" aria-label={titel || m.name}>{inhalt}</svg>;
}

/** Zeichen + Schriftzug. */
export function Logo({ werte, groesse = 40, bild = null, farbeText, className = "" }) {
  const m = marke(werte);
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoZeichen werte={m} groesse={groesse} bild={bild} titel={m.name} />
      <span style={{ fontFamily: '"Barlow Semi Condensed","Arial Narrow",system-ui,sans-serif', fontWeight: m.gewicht, letterSpacing: `${m.sperrung / 100}em`, fontSize: groesse * 0.5, color: farbeText }}>{m.name}</span>
    </span>);
}
