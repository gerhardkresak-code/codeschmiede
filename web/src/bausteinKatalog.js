// Baustein-Katalog des App-Designers 2.0 (Etappe 1 „Bausteine“, Entwurf freigegeben von Gerhard 2026-10-24 22:08).
// Jedes Muster der Galerie (Testseite /bausteine von Trainer to go) trägt data-cs-baustein="<id>" mit einer dieser Kennungen.
// Die Werte landen als tokens.bausteine.<id> im Design-Paket der App (DesignPackage) und wirken dort SOFORT nach der Freigabe.
// Gleiche Kennungen und Grenzen in: Trainer to go src/lib/design/bausteine.js, desktop/dienst/lib/design.mjs (Chat-Vorschlag),
// Datenbank 0037 (ws_bausteine_ok). Der Test desktop/dienst/test/kontrast.test.mjs vergleicht die Listen.
// Ausgangswerte (std) = heutiges Aussehen von Trainer to go (src/index.css, shadcn-Bausteine, Stand 24.10.2026) – nur für Anzeige und Kontrast;
// gespeichert wird nur, was jemand ändert. „wirkt: galerie“ = noch kein zentraler Baustein in der App: wirkt erst, wenn er (per Auftrag) zentral gebaut ist.

export const GRUPPEN = [
  ["knoepfe", "Knöpfe"], ["eingaben", "Eingaben & Schalter"], ["abzeichen", "Abzeichen & Status"], ["kacheln", "Karten & Kacheln"],
  ["tabellen", "Tabellen"], ["listen", "Listen"], ["symbole", "Symbole"], ["dateien", "Datei & Download"],
];
export const GROESSEN = [["klein", "Klein"], ["mittel", "Mittel"], ["gross", "Groß"]];
export const ZUSTAENDE = [["normal", "Normal"], ["darueber", "Darüber"], ["gedrueckt", "Gedrückt"], ["gesperrt", "Gesperrt"]];
export const SEITE = Object.freeze({ hell: "#ffffff", dunkel: "#0a0a0a" });

const f = (bg, text, rand) => ({ bg, text, rand });
const HAUPT = { hell: f("#059669", "#ffffff", "#059669"), dunkel: f("#34d399", "#022c22", "#34d399") };
const NEBEN = { hell: f("#f5f5f5", "#171717", "#f5f5f5"), dunkel: f("#262626", "#fafafa", "#262626") };
const UMRISS = { hell: f("#ffffff", "#0a0a0a", "#e5e5e5"), dunkel: f("#0a0a0a", "#fafafa", "#262626") };
const LEISE = { hell: f("#ffffff", "#0a0a0a", "#ffffff"), dunkel: f("#0a0a0a", "#fafafa", "#0a0a0a") };
const GEFAHR = { hell: f("#ef4444", "#fafafa", "#ef4444"), dunkel: f("#7f1d1d", "#fafafa", "#7f1d1d") };
const KARTE = { hell: f("#ffffff", "#0a0a0a", "#e5e5e5"), dunkel: f("#0a0a0a", "#fafafa", "#262626") };
const TABELLE = { hell: f("#ffffff", "#0a0a0a", "#e2e8f0"), dunkel: f("#0f172a", "#fafafa", "#1e293b") };

const FARBE = ["farben", "ecken"]; const MIT_GROESSE = ["farben", "ecken", "groesse"];
// interaktiv: Zustände (Darüber/Gedrückt/Gesperrt) und Prüfung „Form hebt sich ab“; rahmen: Rand ist Pflicht (Eingabefelder)
export const KATALOG = [
  { id: "knopf-haupt", name: "Knopf · Hauptaktion", gruppe: "knoepfe", quelle: "ui-button", wirkt: "app", interaktiv: true, felder: MIT_GROESSE, std: { ...HAUPT, ecken: 6, groesse: "mittel" } },
  { id: "knopf-neben", name: "Knopf · Neben", gruppe: "knoepfe", quelle: "ui-button", wirkt: "app", interaktiv: true, felder: MIT_GROESSE, std: { ...NEBEN, ecken: 6, groesse: "mittel" } },
  { id: "knopf-umriss", name: "Knopf · Umriss", gruppe: "knoepfe", quelle: "ui-button", wirkt: "app", interaktiv: true, felder: MIT_GROESSE, std: { ...UMRISS, ecken: 6, groesse: "mittel" } },
  { id: "knopf-leise", name: "Knopf · Leise", gruppe: "knoepfe", quelle: "ui-button", wirkt: "app", interaktiv: true, felder: MIT_GROESSE, std: { ...LEISE, ecken: 6, groesse: "mittel" } },
  { id: "knopf-gefahr", name: "Knopf · Gefahr", gruppe: "knoepfe", quelle: "ui-button", wirkt: "app", interaktiv: true, felder: MIT_GROESSE, std: { ...GEFAHR, ecken: 6, groesse: "mittel" } },
  { id: "knopf-symbol", name: "Knopf · nur Symbol", gruppe: "knoepfe", quelle: "ui-button", wirkt: "app", interaktiv: true, felder: MIT_GROESSE, std: { ...UMRISS, ecken: 6, groesse: "mittel" } },
  { id: "eingabe", name: "Eingabefeld", gruppe: "eingaben", quelle: "ui-input", wirkt: "app", interaktiv: true, rahmen: true, felder: MIT_GROESSE, std: { ...UMRISS, ecken: 6, groesse: "mittel" } },
  { id: "schalter", name: "Schalter", gruppe: "eingaben", quelle: "ui-switch", wirkt: "app", interaktiv: true, rahmen: true, felder: ["farben"],
    std: { hell: f("#059669", "#ffffff", "#e5e5e5"), dunkel: f("#34d399", "#0a0a0a", "#262626") }, farbNamen: { bg: "Eingeschaltet", text: "Knopf", rand: "Ausgeschaltet" } },
  { id: "abzeichen-haupt", name: "Abzeichen · Haupt", gruppe: "abzeichen", quelle: "ui-badge", wirkt: "app", felder: MIT_GROESSE, std: { ...HAUPT, ecken: 6, groesse: "mittel" } },
  { id: "abzeichen-neben", name: "Abzeichen · Neben", gruppe: "abzeichen", quelle: "ui-badge", wirkt: "app", felder: MIT_GROESSE, std: { ...NEBEN, ecken: 6, groesse: "mittel" } },
  { id: "abzeichen-umriss", name: "Abzeichen · Umriss", gruppe: "abzeichen", quelle: "ui-badge", wirkt: "app", felder: MIT_GROESSE, std: { ...UMRISS, ecken: 6, groesse: "mittel" } },
  { id: "abzeichen-gefahr", name: "Abzeichen · Gefahr", gruppe: "abzeichen", quelle: "ui-badge", wirkt: "app", felder: MIT_GROESSE, std: { ...GEFAHR, ecken: 6, groesse: "mittel" } },
  { id: "status-zugesagt", name: "Status · Zugesagt", gruppe: "abzeichen", quelle: null, wirkt: "galerie", felder: ["farben", "ecken", "groesse", "symbol"],
    std: { hell: f("#ecfdf5", "#065f46", "#ecfdf5"), dunkel: f("#022c22", "#6ee7b7", "#022c22"), ecken: 32, groesse: "mittel", symbol: "Check" } },
  { id: "status-offen", name: "Status · Offen", gruppe: "abzeichen", quelle: null, wirkt: "galerie", felder: ["farben", "ecken", "groesse", "symbol"],
    std: { hell: f("#fffbeb", "#92400e", "#fffbeb"), dunkel: f("#451a03", "#fcd34d", "#451a03"), ecken: 32, groesse: "mittel", symbol: "AlertTriangle" } },
  { id: "karte", name: "Karte", gruppe: "kacheln", quelle: "ui-card", wirkt: "app", felder: FARBE, std: { ...KARTE, ecken: 12 } },
  { id: "kachel-kennzahl", name: "Kennzahl-Kachel", gruppe: "kacheln", quelle: null, wirkt: "galerie", felder: FARBE, std: { ...KARTE, ecken: 12 } },
  { id: "tabelle", name: "Tabelle", gruppe: "tabellen", quelle: "ui-table", wirkt: "app", felder: FARBE, std: { ...TABELLE, ecken: 16 } },
  { id: "liste", name: "Liste", gruppe: "listen", quelle: null, wirkt: "galerie", felder: FARBE, std: { ...KARTE, ecken: 12 } },
  { id: "symbol-kachel", name: "Symbol-Feld", gruppe: "symbole", quelle: null, wirkt: "galerie", felder: FARBE, std: { hell: f("#ffffff", "#334155", "#e5e5e5"), dunkel: f("#0a0a0a", "#e2e8f0", "#262626"), ecken: 8 } },
  { id: "datei", name: "Datei & Download", gruppe: "dateien", quelle: null, wirkt: "galerie", interaktiv: true, felder: ["farben", "ecken", "symbol"],
    std: { ...UMRISS, ecken: 12, symbol: "FileDown" } },
];
export const KATALOG_IDS = KATALOG.map((b) => b.id);
export const bausteinVon = (id) => KATALOG.find((b) => b.id === id) || null;

const HEX = /^#[0-9a-f]{6}$/i;
const SYMBOL = /^[A-Z][A-Za-z0-9]{1,40}$/;
const VERBOTEN = new Set(["__proto__", "constructor", "prototype"]);
const eigen = (o, k) => !!o && typeof o === "object" && !Array.isArray(o) && !VERBOTEN.has(k) && Object.prototype.hasOwnProperty.call(o, k);

/**
 * Werte EINES Bausteins streng bereinigen: nur Felder, die der Baustein hat, nur gültige Formen
 * (Farben #rrggbb, Ecken 0–32 ganzzahlig, Größe aus der Liste, Symbol als Lucide-Name). Alles andere fällt weg.
 */
export function bausteinWerteBereinigen(id, w) {
  const b = bausteinVon(id); const r = {};
  if (!b || !w || typeof w !== "object" || Array.isArray(w)) return r;
  if (b.felder.includes("farben")) for (const m of ["hell", "dunkel"]) {
    if (!eigen(w, m)) continue; const q = w[m]; const z = {};
    for (const k of ["bg", "text", "rand"]) if (eigen(q, k) && typeof q[k] === "string" && HEX.test(q[k])) z[k] = q[k].toLowerCase();
    if (Object.keys(z).length) r[m] = z;
  }
  if (b.felder.includes("ecken") && eigen(w, "ecken") && Number.isFinite(w.ecken)) r.ecken = Math.min(32, Math.max(0, Math.round(w.ecken)));
  if (b.felder.includes("groesse") && eigen(w, "groesse") && GROESSEN.some(([g]) => g === w.groesse)) r.groesse = w.groesse;
  if (b.felder.includes("symbol") && eigen(w, "symbol") && typeof w.symbol === "string" && SYMBOL.test(w.symbol)) r.symbol = w.symbol;
  return r;
}
/** Ganzes tokens.bausteine-Objekt bereinigen (nur bekannte Kennungen). */
export function bausteineBereinigen(alle) {
  const r = {};
  if (!alle || typeof alle !== "object" || Array.isArray(alle)) return r;
  for (const id of KATALOG_IDS) if (eigen(alle, id)) { const w = bausteinWerteBereinigen(id, alle[id]); if (Object.keys(w).length) r[id] = w; }
  return r;
}
// Bausteine in der Akzentfarbe der App (Prüfbefund Etappe 1: Kontrast-Wächter mit der gewählten statt der festen Smaragd-Farbe)
const IN_AKZENT = { "knopf-haupt": ["bg", "text", "rand"], "abzeichen-haupt": ["bg", "text", "rand"], schalter: ["bg"] };
/** Akzentfarbe aus der App (Trainer to go: tokens.accent → Stufe 600 hell, 400 dunkel) streng prüfen → { hell:{bg,text}, dunkel:{bg,text} } oder null. */
export function akzentBereinigen(a) {
  if (!a || typeof a !== "object") return null;
  const r = {};
  for (const m of ["hell", "dunkel"]) { if (!HEX.test(a[m]?.bg || "") || !HEX.test(a[m]?.text || "")) return null; r[m] = { bg: a[m].bg.toLowerCase(), text: a[m].text.toLowerCase() }; }
  return r;
}
/** Standardwerte eines Bausteins – mit der Akzentfarbe der App, wenn sie vom Smaragd ab Werk abweicht. */
export function standardVon(id, akzent = null) {
  const b = bausteinVon(id); if (!b) return null;
  const s = JSON.parse(JSON.stringify(b.std)); const a = akzentBereinigen(akzent);
  if (a && IN_AKZENT[id]) for (const m of ["hell", "dunkel"]) for (const k of IN_AKZENT[id]) s[m][k] = k === "text" ? a[m].text : a[m].bg;
  return s;
}
/** Gespeicherte Werte über den Standard legen (für Anzeige und Kontrast). */
export function mitStandard(id, w, akzent = null) {
  const b = bausteinVon(id); if (!b) return null;
  const s = standardVon(id, akzent); const x = bausteinWerteBereinigen(id, w);
  for (const m of ["hell", "dunkel"]) if (x[m]) s[m] = { ...s[m], ...x[m] };
  for (const k of ["ecken", "groesse", "symbol"]) if (k in x) s[k] = x[k];
  return s;
}
/**
 * Nur das speichern, was von der Grundlage abweicht. Grundlage = was ohne diese Ebene gälte
 * (Standard ab Werk plus geerbte Ebenen darüber) – gleicher Wert wie die Grundlage = nicht speichern (erbt weiter).
 */
export function nurAbweichung(id, voll, grundlage) {
  const b = bausteinVon(id); if (!b) return {};
  const g = grundlage || b.std;
  const x = bausteinWerteBereinigen(id, voll); const r = {};
  for (const m of ["hell", "dunkel"]) if (x[m]) { const z = {}; for (const [k, v] of Object.entries(x[m])) if (v !== g[m]?.[k]) z[k] = v; if (Object.keys(z).length) r[m] = z; }
  for (const k of ["ecken", "groesse", "symbol"]) if (k in x && x[k] !== g[k]) r[k] = x[k];
  return r;
}
