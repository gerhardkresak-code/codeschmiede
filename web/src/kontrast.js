// Kontrast-Wächter (App-Designer 2.0, Entwurf freigegeben von Gerhard 2026-10-24 22:08; Grundsatz 21:4x „Farben frei mit Kontrast-Wächter“).
// Gemeinsame kleine Bibliothek ohne Abhängigkeiten – genutzt vom Baustein-Inspektor; getestet in desktop/dienst/test/kontrast.test.mjs.
// Regeln nach WCAG 2.1 AA: Text 4,5 : 1, große Schrift und Bedienelemente (Ränder, Symbole) 3 : 1 – immer hell UND dunkel.

export const SOLL = Object.freeze({ text: 4.5, gross: 3, bedien: 3 });
const HEX = /^#[0-9a-f]{6}$/i;
export const istHex = (v) => typeof v === "string" && HEX.test(v);

const kanal = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** Relative Leuchtdichte (0 = schwarz, 1 = weiß); ungültige Farbe → null. */
export function luminanz(hex) {
  if (!istHex(hex)) return null;
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [16, 8, 0].map((s) => kanal(((n >> s) & 255) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Kontrastverhältnis 1–21; ungültige Farben → 1 (zählt als „nicht lesbar“). */
export function kontrast(a, b) {
  const x = luminanz(a), y = luminanz(b);
  if (x == null || y == null) return 1;
  const [h, d] = x > y ? [x, y] : [y, x];
  return (h + 0.05) / (d + 0.05);
}
/** Anzeige „4,6 : 1“ (deutsches Komma). */
export const verhaeltnis = (k) => `${(Math.floor(k * 10) / 10).toFixed(1).replace(".", ",")} : 1`;

// HSL nur für „lesbar machen“ (Farbton bleibt, nur die Helligkeit wandert)
function zuHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [16, 8, 0].map((s) => ((n >> s) & 255) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function ausHsl([h, s, l]) {
  const a = s * Math.min(l, 1 - l);
  const f = (k) => { const t = (k + h / 30) % 12; return l - a * Math.max(-1, Math.min(t - 3, 9 - t, 1)); };
  return "#" + [f(0), f(8), f(4)].map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("");
}

/**
 * Vorschlag „lesbar machen“: verändert NUR die Helligkeit von `farbe` (Farbton und Sättigung bleiben),
 * bis sie auf `hinter` mindestens `soll` erreicht. Wählt die kleinste Änderung (heller oder dunkler).
 * Reicht das nicht, kommt Schwarz oder Weiß – je nachdem, was mehr Kontrast hat. Schon lesbar → unverändert.
 */
export function lesbarMachen(farbe, hinter, soll = SOLL.text) {
  if (!istHex(farbe) || !istHex(hinter)) return istHex(farbe) ? farbe.toLowerCase() : "#000000";
  if (kontrast(farbe, hinter) >= soll) return farbe.toLowerCase();
  const [h, s, l] = zuHsl(farbe);
  let best = null;
  for (const richtung of [-1, 1]) {
    for (let schritt = 1; schritt <= 100; schritt++) {
      const nl = l + richtung * schritt / 100;
      if (nl < 0 || nl > 1) break;
      const c = ausHsl([h, s, nl]);
      if (kontrast(c, hinter) >= soll) { if (!best || schritt < best.schritt) best = { c, schritt }; break; }
    }
  }
  if (best) return best.c;
  return kontrast("#000000", hinter) >= kontrast("#ffffff", hinter) ? "#000000" : "#ffffff";
}

/**
 * Prüft einen Baustein in hell und dunkel.
 * w      = { hell: { bg, text, rand }, dunkel: { bg, text, rand } } (fehlende Werte vorher mit dem Standard füllen)
 * seite  = { hell: "#ffffff", dunkel: "#0a0a0a" } (Hintergrund, auf dem der Baustein steht)
 * art    = { interaktiv: true|false, grosseSchrift: true|false, rahmenPflicht: true|false }
 * Ergebnis: Liste { modus, was, wert, soll, ok, stufe ("pflicht"|"hinweis"), feld, vorschlag }
 */
export function pruefeBaustein(w, seite = { hell: "#ffffff", dunkel: "#0a0a0a" }, art = {}) {
  const out = [];
  for (const modus of ["hell", "dunkel"]) {
    const f = w?.[modus] || {}; const s = seite?.[modus];
    const tSoll = art.grosseSchrift ? SOLL.gross : SOLL.text;
    if (istHex(f.text) && istHex(f.bg)) {
      const k = kontrast(f.text, f.bg);
      out.push({ modus, was: "Text auf Hintergrund", wert: k, soll: tSoll, ok: k >= tSoll, stufe: "pflicht", feld: "text", vorschlag: k >= tSoll ? null : lesbarMachen(f.text, f.bg, tSoll) });
    }
    // Bedienelemente (WCAG 1.4.11): die Form muss sich vom Seitenhintergrund abheben – über Fläche ODER Rand.
    // Pflicht nur, wo die Form das Element erst erkennbar macht (Eingabefelder, Schalter); bei Knöpfen mit Text ein Hinweis.
    if (art.interaktiv && istHex(s)) {
      const kb = istHex(f.bg) ? kontrast(f.bg, s) : 1; const kr = istHex(f.rand) ? kontrast(f.rand, s) : 1;
      const k = Math.max(kb, kr); const ok = k >= SOLL.bedien;
      out.push({ modus, was: "Form hebt sich von der Seite ab", wert: k, soll: SOLL.bedien, ok, stufe: art.rahmenPflicht ? "pflicht" : "hinweis",
        feld: "rand", vorschlag: ok ? null : lesbarMachen(istHex(f.rand) ? f.rand : s, s, SOLL.bedien) });
    }
  }
  return out;
}

/** Kurzfassung für Anzeige/Chat: Zahl der offenen Pflicht-Prüfungen und Hinweise. */
export function zusammenfassung(befunde) {
  return { pflicht: befunde.filter((b) => !b.ok && b.stufe === "pflicht").length, hinweise: befunde.filter((b) => !b.ok && b.stufe !== "pflicht").length };
}
