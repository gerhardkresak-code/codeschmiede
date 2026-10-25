import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Palette, Shapes, Stamp, Save, Send, Copy, Plus, Trash2, Undo2, Redo2, History, GitCompareArrows, Monitor, Tablet, Smartphone,
  Sun, Moon, LayoutGrid, CheckCheck, CircleCheck, CircleAlert, TriangleAlert, Loader2, Bot, ShieldCheck, Sparkles, Check, X, ExternalLink, LayoutTemplate, Home, Users, Calendar, Trophy, Settings, Bell, Search,
} from "lucide-react";
import { supabase } from "./supabase";
import { useKiName } from "./kiName";
import { useAutoHoehe } from "./autoHoehe";
import { BausteineModus, MarkeModus, BAUSTEIN_BASIS, bausteinWerteBereinigen } from "./DesignerBausteine";
import { MARKE_BASIS, Logo as MarkeLogo, LogoZeichen } from "./Logo";
import GeraeteRahmen, { geraetVonBreite } from "./GeraeteRahmen";
import { Markdown } from "./Markdown";
const SeitenModus = lazy(() => import("./SeitenModus"));
const Uebernehmen = lazy(() => import("./Uebernehmen"));   // App-Designer 2.0 · Etappe 4
import { useBausteinDesigner, BausteinInspektor } from "./BausteinInspektor";
import { designFrageBeantworten } from "./designFrage";
import { APP_ARTEN, ART_BASIS, ArtEinstellungen, ArtMuster, beispieleBereinigen, beispieleFuer, menueSymbol } from "./DesignerArten";

// App-Designer · Etappe 1 (Entwurf 0.9, freigegeben von Gerhard 2026-10-22 22:40) · Etappe 2: Chat mit Claude + erweiterte Prüfungen (2026-10-23)
// Ein Grunddesign je Projekt (nicht je Rolle). Ändern → Entwurf speichern (jede Fassung bleibt) → vergleichen → als Auftrag senden.
// Wirksam wird es erst über den normalen Weg: Freigabe → Sicherheitsprüfung → Zusammenführen → Feature-Prüfung → live.
// Etappe 3: Trainer to go liest die Werte zentral · Etappe 4/5: Bausteine, Marke.

const btn = "inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-display font-bold tracking-wide transition text-sm";
const ghost = "inline-flex items-center justify-center gap-2 h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition";
const card = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const input = "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500";
const fehler = (e) => (e?.message || "Unbekannter Fehler").replace(/^.*?ERROR:\s*/, "");
const fmt = (d) => new Date(d).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Ausgangswerte = heutiges Design von Trainer to go (src/index.css, tailwind.config.js – Stand 22.10.2026)
export const BASIS = {
  farben: {
    hell: { primaer: "#059669", primaer_text: "#ffffff", hintergrund: "#ffffff", flaeche: "#ffffff", text: "#0a0a0a", text_leise: "#737373",
      rand: "#e5e5e5", menue: "#fafafa", menue_text: "#3f3f46", erfolg: "#16a34a", warnung: "#d97706", fehler: "#ef4444" },
    dunkel: { primaer: "#34d399", primaer_text: "#022c22", hintergrund: "#0a0a0a", flaeche: "#141414", text: "#fafafa", text_leise: "#a3a3a3",
      rand: "#262626", menue: "#111111", menue_text: "#e4e4e7", erfolg: "#22c55e", warnung: "#f59e0b", fehler: "#f87171" },
  },
  schrift: { ueberschrift: "Barlow Semi Condensed", text: "Barlow", basis: 15, gewicht: 700 },
  form: { radius: 8, radius_karte: 16, abstand: 16, schatten: "leicht" },
  menue: { position: "links", aufklappbar: true, breite: 248, tablet: "eingeklappt", handy: "unten" },
  logo: { platz: "menue-oben", groesse: 36 },
  // Etappe 4/5: Tabellen-Varianten, Icon-Stil, Marke (gleich wie src/lib/design/grunddesign.js in Trainer to go)
  ...JSON.parse(JSON.stringify(BAUSTEIN_BASIS)),
  marke: { ...MARKE_BASIS },
  // App-Arten (Datenbank 0022): Spiel-Bausteine, Webseite, Shop – feste Auswahlwerte
  ...JSON.parse(JSON.stringify(ART_BASIS)),
};

const FARBEN = [["primaer", "Hauptfarbe"], ["primaer_text", "Text auf Hauptfarbe"], ["hintergrund", "Hintergrund"], ["flaeche", "Flächen (Karten)"],
  ["text", "Text"], ["text_leise", "Text leise"], ["rand", "Ränder"], ["menue", "Menü"], ["menue_text", "Menü-Text"],
  ["erfolg", "Erfolg"], ["warnung", "Warnung"], ["fehler", "Fehler"]];
const SCHRIFTEN = ["Barlow Semi Condensed", "Barlow", "system-ui"];
const GERAETE = { pc: [1280, "PC", Monitor], tablet: [820, "Tablet", Tablet], handy: [390, "Handy", Smartphone] };

const tief = (o) => JSON.parse(JSON.stringify(o));
// Nur Schlüssel aus BASIS mit passendem Typ übernehmen (Prüfung 2026-10-23: kein __proto__, kaputte Werte legen nichts lahm)
const VERBOTEN = new Set(["__proto__", "constructor", "prototype"]);
const mische = (b, w) => { const r = tief(b); const geh = (z, q) => { if (!q || typeof q !== "object" || Array.isArray(q)) return;
  Object.keys(z).forEach((k) => { if (VERBOTEN.has(k) || !Object.prototype.hasOwnProperty.call(q, k)) return; const v = q[k];
    if (z[k] && typeof z[k] === "object") geh(z[k], v);
    else if (typeof v === typeof z[k] && (typeof z[k] !== "string" || !z[k].startsWith("#") || /^#[0-9a-f]{6}$/i.test(v))) z[k] = v; }); }; geh(r, w);
  // Zuweisung je Tabelle und Marke: nur aus w übernehmen, wenn w sie enthält (Vorschläge sind Teilwerte)
  const e = bausteinWerteBereinigen(r, w, b);
  // Beispiele der Vorschau (nur Text): aus w, sonst aus b übernehmen – Vorschläge sind Teilwerte
  const bsp = beispieleBereinigen(w && Object.prototype.hasOwnProperty.call(w, "beispiele") ? w.beispiele : b?.beispiele);
  if (bsp) e.beispiele = bsp; else delete e.beispiele;
  return e; };
const setze = (o, pfad, v) => { const r = tief(o); let z = r; pfad.slice(0, -1).forEach((k) => { z[k] = z[k] || {}; z = z[k]; }); z[pfad[pfad.length - 1]] = v; return r; };
// Eingelesenes Logo (marke.vektor) als EIN Wert – sonst stünde jede Form einzeln in der Änderungsliste
const flach = (o, p = "") => Object.entries(o || {}).filter(([k]) => !VERBOTEN.has(k)).flatMap(([k, v]) => (p + k === "marke.vektor" ? [[p + k, `eingelesenes Logo (${v?.elemente?.length || 0} Formen, ${JSON.stringify(v).length} Zeichen)`]]
  : v && typeof v === "object" ? flach(v, p + k + ".") : [[p + k, v]]));

// Kontrast nach WCAG 2.1
const lum = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return 0; const n = parseInt(m[1], 16);
  return [16, 8, 0].map((s) => ((n >> s) & 255) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0); };
const kontrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// Farbsehschwäche simulieren (Machado 2009, volle Stärke) und Farbabstand ΔE (CIE76) – Prüfung, ob Statusfarben unterscheidbar bleiben
const lin = (hex) => { const n = parseInt(String(hex).slice(1), 16); return [16, 8, 0].map((s) => ((n >> s) & 255) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); };
const MATRIX = { rot: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  gruen: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]] };
const lab = ([r, g, b]) => { const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [x, y, z] = [(r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, r * 0.2126 + g * 0.7152 + b * 0.0722, (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883].map(f);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]; };
const sim = (hex, m) => { const c = lin(hex); return m ? MATRIX[m].map((z) => Math.min(1, Math.max(0, z[0] * c[0] + z[1] * c[1] + z[2] * c[2]))) : c; };
const deltaE = (a, b, m) => { const [p, q] = [lab(sim(a, m)), lab(sim(b, m))]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const farbton = (hex) => { const [r, g, b] = [16, 8, 0].map((s) => ((parseInt(String(hex).slice(1), 16) >> s) & 255) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return null; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };

// Prüfungen: stufe „rot“ = muss (Barrierefreiheit), „hinweis“ = sollte. Gruppen für die Anzeige.
function pruefungen(w) {
  const out = []; const neu = (gruppe, ok, text, wert, stufe = "rot") => out.push({ gruppe, ok, text, wert, stufe });
  ["hell", "dunkel"].forEach((m) => {
    const f = w.farben[m]; const t = m === "hell" ? "Hell" : "Dunkel";
    [["text", "hintergrund", 4.5, "Text auf Hintergrund"], ["text", "flaeche", 4.5, "Text auf Karten"], ["text_leise", "flaeche", 4.5, "Leiser Text auf Karten"],
      ["primaer_text", "primaer", 4.5, "Knopf-Text auf Hauptfarbe"], ["menue_text", "menue", 4.5, "Menü-Text"], ["primaer", "hintergrund", 3, "Hauptfarbe als Rahmen/Symbol"],
      ["primaer", "menue", 3, "Aktiver Menüpunkt erkennbar"]]
      .forEach(([a, b, soll, name]) => { const k = kontrast(f[a], f[b]); neu("Kontrast", k >= soll, `${t}: ${name}`, `${k.toFixed(1)} : 1 (mind. ${soll})`); });
    [["erfolg", "Erfolg"], ["warnung", "Warnung"], ["fehler", "Fehler"]].forEach(([k, n]) => { const v = kontrast(f[k], f.flaeche); neu("Statusfarben", v >= 3, `${t}: ${n} auf Karten`, `${v.toFixed(1)} : 1 (mind. 3)`); });
    const r = kontrast(f.rand, f.flaeche); neu("Kontrast", r >= 1.15, `${t}: Ränder sichtbar`, `${r.toFixed(2)} : 1 (mind. 1,15)`, "hinweis");
  });
  const h = w.farben.hell;
  [["erfolg", "fehler", "Erfolg ↔ Fehler"], ["warnung", "fehler", "Warnung ↔ Fehler"], ["primaer", "fehler", "Hauptfarbe ↔ Fehler"]].forEach(([a, b, n]) => {
    const minimum = Math.min(deltaE(h[a], h[b], "rot"), deltaE(h[a], h[b], "gruen"));
    neu("Farbsehschwäche", minimum >= 15, `${n} bei Rot-Grün-Schwäche unterscheidbar`, `Abstand ${minimum.toFixed(0)} (mind. 15) – Status zusätzlich immer mit Text/Symbol`, "hinweis");
  });
  const [th, td] = [farbton(w.farben.hell.primaer), farbton(w.farben.dunkel.primaer)];
  const dh = th == null || td == null ? 0 : Math.min(Math.abs(th - td), 360 - Math.abs(th - td));
  neu("Hell & Dunkel", dh <= 25, "Hauptfarbe in beiden Modi gleich erkennbar", `Farbton-Abstand ${dh.toFixed(0)}° (höchstens 25°)`, "hinweis");
  const dl = lum(w.farben.dunkel.hintergrund); neu("Hell & Dunkel", dl <= 0.03, "Dunkelmodus: Hintergrund dunkel genug", `Helligkeit ${(dl * 100).toFixed(1)} % (höchstens 3 %)`, "hinweis");
  const gr = kontrast(w.farben.dunkel.text, w.farben.dunkel.hintergrund); neu("Hell & Dunkel", gr <= 18, "Dunkelmodus nicht zu grell", `${gr.toFixed(1)} : 1 (höchstens 18 – reinweiß auf schwarz blendet)`, "hinweis");
  neu("Handy", w.schrift.basis >= 14, "Grundschrift gut lesbar", `${w.schrift.basis} px (mind. 14)`);
  neu("Handy", w.logo.groesse >= 24, "Logo groß genug", `${w.logo.groesse} px (mind. 24)`);
  neu("Handy", w.form.abstand >= 12, "Abstände groß genug zum Tippen", `${w.form.abstand} px (mind. 12)`, "hinweis");
  neu("Handy", w.menue.handy === "unten", "Menü mit dem Daumen erreichbar", w.menue.handy === "unten" ? "Leiste unten" : "Menü-Knopf oben – schwerer erreichbar", "hinweis");
  return out;
}

// Beschreibung für den Auftrag: was sich gegenüber dem gültigen Grunddesign ändert
function aenderungen(alt, neu) {
  const a = Object.fromEntries(flach(alt)); return flach(neu).filter(([k, v]) => a[k] !== v).map(([k, v]) => ({ k, alt: a[k], neu: v }));
}
const auftragsText = (name, liste, werte) => `Grunddesign-Entwurf „${name}“ aus dem App-Designer umsetzen.

Änderungen gegenüber dem gültigen Grunddesign:
${liste.length ? liste.map((x) => `- ${x.k}: ${x.alt ?? "–"} → ${x.neu}`).join("\n") : "- (keine – nur bestätigen)"}

So umsetzen:
- Trage ALLE Werte unten unverändert in src/design/grunddesign.json ein (Trainer to go wendet sie über src/lib/design/grunddesign.js an).
- Nichts in einzelnen Seiten ändern; was die Grunddesign-Ebene noch nicht kann (z. B. Menü-Aufbau, Logo-Platz, Abstände), zentral ergänzen.
- Hell- und Dunkelmodus, PC/Tablet/Handy prüfen; Kontrast mind. 4,5 : 1.
- Handbuch/DESIGN.md und CHANGELOG mitführen.
${werte?.marke?.zeichen === "eigen" ? `
Marke mit eingelesenem Logo (marke.zeichen = "eigen", marke.vektor = feste Formen in 64×64):
- Die Logo-Komponente zeichnet „eigen“ aus marke.vektor (gleich wie web/src/Logo.jsx der Codeschmiede: nur rect/circle/ellipse/path/text mit Farben #rrggbb, kein freies SVG).
- Das Logo überall ersetzen, wo das Projekt sein Logo zeigt: Kopf/Menü, Anmeldung, App-Symbol, Favicon und PWA-Symbole (als Bilddateien aus dem Vektor erzeugen),
  PDF-Layouts, Handbuch (Bildschirmfotos/Logo), App-Mails. Alte Logo-Dateien nur ersetzen, nicht an anderen Stellen löschen.
` : ""}
Alle Werte (JSON):
${JSON.stringify(werte, null, 1)}`;

export default function Designer({ d, ich, toast }) {
  const projekt = d.projekte.find((p) => p.id === d.projektId);
  const [entwuerfe, setEntwuerfe] = useState([]);
  const [laden, setLaden] = useState(true);
  const [aktivId, setAktivId] = useState(null);
  const [werte, setWerte] = useState(BASIS);
  const [verlauf, setVerlauf] = useState({ zurueck: [], vor: [] });
  const [geaendert, setGeaendert] = useState(false);
  const [modus, setModus] = useState("grund");
  const [mitte, setMitte] = useState("geruest");
  const [geraet, setGeraet] = useState("pc");
  const [dunkel, setDunkel] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [arbeit, setArbeit] = useState(false);
  const [rechts, setRechts] = useState("chat");
  const ki = useKiName(d.projektId, "design");   // eingestellter Anbieter für den Design-Chat
  const [chatText, setChatText] = useState("");
  const [bausteinEntwurf, setBausteinEntwurf] = useState(null);   // Assistent „Neuer Baustein“ behält die Eingaben (auch nach „Im Design-Chat fragen“)
  // App-Designer 2.0 (Entwurf 2026-10-24 22:08): Bausteine wirken sofort über die Design-Pakete der App (BausteinInspektor.jsx)
  const bs = useBausteinDesigner({ dunkel });
  const [seitenTab, setSeitenTab] = useState(null);
  const [bsSeite, setBsSeite] = useState("inspektor");   // Modus „Bausteine“: rechts Inspektor oder Design-Chat
  const zumChat = (t) => { setRechts("chat"); setBsSeite("chat"); setChatText(t); };
  const zurFreigabe = (tab) => { if (tab === "freigabe") { setModus("uebernehmen"); return; } setSeitenTab(tab); setModus("seiten"); };
  const [sofortAnzahl, setSofortAnzahl] = useState(null);   // offene Änderungen im Design-Paket (meldet der Freigabe-Reiter der App)

  const darf = useMemo(() => {
    if (ich.rolle === "admin") return true;
    const g = d.gruppen.find((x) => x.id === projekt?.design_gruppe_id);
    const r = d.rechte.find((x) => x.benutzer_id === ich.id && x.bereich_id === g?.bereich_id);
    const rolle = d.mitglieder.find((m) => m.projekt_id === d.projektId && m.benutzer_id === ich.id)?.rolle;
    return !!(g && r?.auftraege && rolle === "entwickler");   // Texter geben nur Text-Aufträge
  }, [d, ich, projekt]);

  const holen = useCallback(async () => {
    const { data, error } = await supabase.from("ws_design_entwuerfe").select("*").eq("projekt_id", d.projektId).neq("stand", "verworfen").order("geaendert", { ascending: false });
    if (error) toast(fehler(error)); setEntwuerfe(data || []); setLaden(false);
  }, [d.projektId, toast]);
  // Test & Live (Datenbank 0024): Live-Schaltungen, um „In der Testfassung“ von „Live“ zu trennen
  const [versionen, setVersionen] = useState([]);
  const testLive = !!projekt?.live_zweig;
  const holeVersionen = useCallback(async () => {
    if (!testLive) { setVersionen([]); return; }
    const { data } = await supabase.from("ws_live_versionen").select("id, commit_sha, geschaltet").eq("projekt_id", d.projektId).order("id", { ascending: false }).limit(200);
    setVersionen(data || []);
  }, [d.projektId, testLive]);
  useEffect(() => {
    holen(); holeVersionen();
    const ch = supabase.channel("cs-designer-" + d.projektId).on("postgres_changes", { event: "*", schema: "public", table: "ws_design_entwuerfe" }, holen)
      .on("postgres_changes", { event: "*", schema: "public", table: "ws_live_versionen" }, holeVersionen).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [holen, holeVersionen, d.projektId]);

  const live = entwuerfe.find((e) => e.stand === "live");
  const gueltig = useMemo(() => mische(BASIS, live?.werte), [live]);
  // „live“ im Designer heißt: Auftrag fertig geprüft und in main (Testfassung). Mit Test & Live ist es erst wirklich live, wenn danach
  // ein Stand live geschaltet wurde. Der aktuelle Live-Stand gilt seit seiner ersten Schaltung (auch nach „Zurück“ auf eine ältere Version).
  const liveImLive = useMemo(() => {
    if (!live || !testLive) return true;
    const jetzt = versionen[0]; if (!jetzt) return false;
    const seit = Math.min(...versionen.filter((v) => v.commit_sha === jetzt.commit_sha).map((v) => Date.parse(v.geschaltet)));
    return seit >= Date.parse(live.geaendert);
  }, [live, testLive, versionen]);
  const liveText = liveImLive ? "Live" : "In der Testfassung";
  // Ausgangslage: nach dem Laden das gültige Grunddesign übernehmen, solange nichts gewählt oder geändert ist (Fehlerkorrektur 0.9.5)
  useEffect(() => { if (!laden && !aktivId && !geaendert) setWerte(gueltig); }, [laden, gueltig]); // eslint-disable-line react-hooks/exhaustive-deps
  const aktiv = entwuerfe.find((e) => e.id === aktivId) || null;
  const fest = !!aktiv && aktiv.stand !== "entwurf";
  const eigen = !aktiv || aktiv.erstellt_von === ich.id || ich.rolle === "admin";
  const bearbeitbar = darf && !fest && eigen;

  const oeffne = (e) => {
    if (geaendert && !window.confirm("Ungespeicherte Änderungen verwerfen?")) return;
    setAktivId(e?.id || null); setWerte(e ? mische(BASIS, e.werte) : gueltig); setVerlauf({ zurueck: [], vor: [] }); setGeaendert(false);
  };
  const aendere = (pfad, v) => {
    if (!bearbeitbar) return;
    setVerlauf((h) => ({ zurueck: [...h.zurueck.slice(-49), werte], vor: [] })); setWerte(setze(werte, pfad, v)); setGeaendert(true);
  };
  const zurueck = () => { const h = verlauf; if (!h.zurueck.length) return; setWerte(h.zurueck[h.zurueck.length - 1]); setVerlauf({ zurueck: h.zurueck.slice(0, -1), vor: [werte, ...h.vor] }); setGeaendert(true); };
  const vor = () => { const h = verlauf; if (!h.vor.length) return; setWerte(h.vor[0]); setVerlauf({ zurueck: [...h.zurueck, werte], vor: h.vor.slice(1) }); setGeaendert(true); };

  const neu = async (name, von) => {
    setArbeit(true);
    const { data, error } = await supabase.from("ws_design_entwuerfe").insert({ projekt_id: d.projektId, name, werte: von }).select().single();
    setArbeit(false);
    if (error) return toast(fehler(error));
    await holen(); setAktivId(data.id); setWerte(mische(BASIS, data.werte)); setVerlauf({ zurueck: [], vor: [] }); setGeaendert(false); toast(`Entwurf „${name}“ angelegt`);
  };
  const speichern = async () => {
    if (!aktiv) return setDialog({ art: "neu", von: werte });
    setArbeit(true);
    const { data, error } = await supabase.rpc("ws_design_speichern", { p_entwurf: aktiv.id, p_werte: werte });
    setArbeit(false);
    if (error) return toast(fehler(error));
    setGeaendert(false); holen(); toast(`Gespeichert – Version ${data}`);
  };
  const verwerfen = async () => {
    if (!aktiv || !window.confirm(`Entwurf „${aktiv.name}“ verwerfen? (bleibt im Protokoll, wird ausgeblendet)`)) return;
    const { error } = await supabase.rpc("ws_design_verwerfen", { p_entwurf: aktiv.id });
    if (error) return toast(fehler(error));
    setAktivId(null); setWerte(gueltig); setGeaendert(false); toast("Entwurf verworfen");
  };

  const art = APP_ARTEN.some(([k]) => k === projekt?.app_art) ? projekt.app_art : "verwaltung";
  const artSetzen = async (neu) => {
    const { error } = await supabase.rpc("ws_projekt_app_art", { p_projekt: projekt.id, p_art: neu });
    if (error) toast(fehler(error)); else { toast(`App-Art: ${APP_ARTEN.find(([k]) => k === neu)?.[1]}`); d.holen?.(); }
  };
  if (!projekt) return null;
  // Design ist eines der ersten Dinge, die man plant (Gerhard 2026-10-23 17:49): ohne Design-Gruppe richtet sich der Designer selbst ein
  if (!projekt.design_gruppe_id) return <DesignerEinrichten projekt={projekt} d={d} ich={ich} toast={toast} />;
  // „Übernehmen (n)“: offene Grunddesign-Entwürfe + laufende Baustein-/Kachel-Aufträge + offene Änderungen im Design-Paket
  const auftragsPunkte = entwuerfe.filter((e) => e.stand === "entwurf" || e.stand === "gesendet").length
    + d.auftraege.filter((a) => a.gruppe_id === projekt.design_gruppe_id && /^(Neuer Baustein: |Neue Kachel für den Seiten-Designer: )/.test(String(a.titel || "")) && !["wissen", "erledigt"].includes(a.stand)).length;
  const offenGesamt = auftragsPunkte + (sofortAnzahl || 0);
  const befunde = pruefungen(werte);
  const rot = befunde.filter((b) => !b.ok && b.stufe === "rot").length;
  const hinweise = befunde.filter((b) => !b.ok && b.stufe !== "rot").length;

  return (
    <div className="space-y-3">
      {/* Kopfleiste: Entwurf wählen, rückgängig, speichern, vergleichen, senden */}
      <div className={`${card} p-2.5 flex flex-wrap items-center gap-2`}>
        <div role="tablist" aria-label="Bereich" className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5">
          {[["grund", "Grunddesign", Palette], ["bausteine", "Bausteine", Shapes], ["marke", "Marke", Stamp], ["seiten", "Seiten", LayoutGrid]].map(([id, t, I]) => (
            <button key={id} type="button" role="tab" aria-selected={modus === id} onClick={() => setModus(id)}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-semibold ${modus === id ? "bg-white dark:bg-slate-900 shadow-sm text-emerald-800 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300"}`}><I className="w-4 h-4" />{t}</button>))}
          <button type="button" role="tab" aria-selected={modus === "uebernehmen"} onClick={() => setModus("uebernehmen")} title="Alle offenen Design-Änderungen übernehmen und freigeben"
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-semibold ${modus === "uebernehmen" ? "bg-white dark:bg-slate-900 shadow-sm text-emerald-800 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300"}`}>
            <CheckCheck className="w-4 h-4" />Übernehmen{offenGesamt > 0 && <span className="text-[11px] font-bold bg-emerald-700 text-white rounded-full px-1.5">{offenGesamt}</span>}</button>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-slate-500" title={APP_ARTEN.find(([k]) => k === art)?.[2]}>App-Art
          <select id="ds-app-art" value={art} disabled={!darf} onChange={(e) => artSetzen(e.target.value)} className={`${input} w-auto`}>
            {APP_ARTEN.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <span className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
        <label className="sr-only" htmlFor="ds-entwurf">Entwurf</label>
        <select id="ds-entwurf" value={aktivId || ""} onChange={(e) => oeffne(entwuerfe.find((x) => String(x.id) === e.target.value))} className={`${input} w-auto max-w-[260px]`}>
          <option value="">{live ? `Gültiges Grunddesign (${live.name} · ${liveText})` : laden ? "Gültiges Grunddesign …" : `Ausgangswerte – ${entwuerfe.some((e) => e.stand === "gesendet") ? "noch kein Grunddesign umgesetzt" : "noch kein Grunddesign gesendet"}`}</option>
          {entwuerfe.filter((e) => e.stand !== "live").map((e) => <option key={e.id} value={e.id}>{e.name} · {STAND_TXT[e.stand]} · v{e.version}</option>)}
        </select>
        {aktiv && <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${STAND_CLS[aktiv.stand]}`}>{STAND_TXT[aktiv.stand]}</span>}
        {!aktiv && live && <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${liveImLive ? STAND_CLS.live : STAND_CLS.gesendet}`}
          title={liveImLive ? "Das Grunddesign ist in der App live" : "Fertig geprüft und in der Testfassung – live wird es mit der nächsten Live-Schaltung"}>{liveText}</span>}
        {geaendert && <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold">ungespeichert</span>}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button type="button" className={ghost} title="Rückgängig" onClick={zurueck} disabled={!verlauf.zurueck.length}><Undo2 className="w-4 h-4" /></button>
          <button type="button" className={ghost} title="Wiederholen" onClick={vor} disabled={!verlauf.vor.length}><Redo2 className="w-4 h-4" /></button>
          {darf && <button type="button" className={ghost} onClick={() => setDialog({ art: "neu", von: werte })}><Plus className="w-4 h-4" />{aktiv ? "Kopie" : "Neuer Entwurf"}</button>}
          {aktiv && <button type="button" className={ghost} onClick={() => setDialog({ art: "versionen" })}><History className="w-4 h-4" />Versionen</button>}
          <button type="button" className={ghost} onClick={() => setMitte("vergleich")}><GitCompareArrows className="w-4 h-4" />Vergleichen</button>
          {aktiv && bearbeitbar && <button type="button" className={ghost} title="Entwurf verwerfen" onClick={verwerfen}><Trash2 className="w-4 h-4" /></button>}
          {bearbeitbar && <button type="button" className={ghost} onClick={speichern} disabled={arbeit || (!!aktiv && !geaendert)}><Save className="w-4 h-4" />Speichern</button>}
          {aktiv && bearbeitbar && <button type="button" className={btn} disabled={arbeit || geaendert} title={geaendert ? "Erst speichern" : ""}
            onClick={() => setDialog({ art: "senden" })}><Send className="w-4 h-4" />Als Auftrag senden</button>}
        </div>
      </div>
      {!laden && !aktiv && !live && <p className="text-sm text-slate-600 dark:text-slate-300">Noch kein Grunddesign {entwuerfe.some((e) => e.stand === "gesendet") ? "umgesetzt (ein Entwurf ist als Auftrag unterwegs)" : "gesendet"} – der Editor zeigt die Ausgangswerte der Codeschmiede, nicht unbedingt das, was die App heute zeigt.</p>}
      {!darf && <p className="text-sm text-slate-500">Nur ansehen: Gestalten dürfen Entwickler mit dem Recht „Aufträge geben“ im Bereich der Design-Gruppe.</p>}
      {fest && <p className="text-sm text-slate-600 dark:text-slate-300">Dieser Entwurf ist {STAND_TXT[aktiv.stand].toLowerCase()} und damit fest{aktiv.auftrag_id ? ` (Auftrag #${aktiv.auftrag_id})` : ""}. Für Änderungen eine Kopie anlegen.</p>}

      {modus === "uebernehmen" ? <Suspense fallback={<p className="text-sm text-slate-500 p-4">Lädt …</p>}><Uebernehmen projekt={projekt} d={d} ich={ich} werte={werte} dunkel={dunkel} darf={darf} toast={toast}
          entwuerfe={entwuerfe} sofortAnzahl={sofortAnzahl} onFreigabeOffen={setSofortAnzahl} onGrunddesign={(e) => { setModus("grund"); oeffne(e); }} /></Suspense>
      : modus === "seiten" ? <Suspense fallback={<p className="text-sm text-slate-500 p-4">Lädt …</p>}><SeitenModus key={seitenTab || "start"} tab={seitenTab} projekt={projekt} d={d} ich={ich} werte={werte} dunkel={dunkel} darf={darf} toast={toast} /></Suspense> : (
        <div className="grid gap-3 grid-cols-[minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_280px] lg:grid-cols-[300px_minmax(0,1fr)]">
          {modus === "bausteine" ? <BausteineModus w={werte} aendere={aendere} bearbeitbar={bearbeitbar} darf={darf} projekt={projekt} d={d} ich={ich} toast={toast} dunkel={dunkel} Testseite={Testseite} breite={GERAETE[geraet][0]} onChat={zumChat} bausteinEntwurf={bausteinEntwurf} setBausteinEntwurf={setBausteinEntwurf} bs={bs} />
            : modus === "marke" ? <MarkeModus w={werte} aendere={aendere} bearbeitbar={bearbeitbar} projekt={projekt} ich={ich} toast={toast} />
            : <><Einstellungen w={werte} aendere={aendere} bearbeitbar={bearbeitbar} art={art}
              onBeispiele={() => { setRechts("chat"); setChatText(`[Beispiele] Passe die Beispiele der Vorschau (${APP_ARTEN.find(([k]) => k === art)?.[1]}) an unser Konzept an: Menüpunkte, Kennzahlen und Beispieltexte.`); }} />
          <section className={`${card} min-w-0 flex flex-col`}>
            <div className="flex flex-wrap items-center gap-2 p-2 border-b border-slate-200 dark:border-slate-800">
              <div role="tablist" aria-label="Ansicht" className="flex gap-1">
                {[["geruest", "Gerüst", LayoutTemplate], ["testseite", "Testseite", ExternalLink], ["vergleich", "Vergleich", GitCompareArrows]].map(([id, t, I]) => (
                  <button key={id} type="button" role="tab" aria-selected={mitte === id} onClick={() => setMitte(id)}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-semibold ${mitte === id ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}><I className="w-4 h-4" />{t}</button>))}
              </div>
              <div className="ml-auto flex items-center gap-1">
                {Object.entries(GERAETE).map(([id, [, t, I]]) => <button key={id} type="button" title={t} aria-pressed={geraet === id} onClick={() => setGeraet(id)} className={`p-1.5 rounded-lg ${geraet === id ? "bg-slate-200 dark:bg-slate-700" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}><I className="w-4 h-4" /></button>)}
                <button type="button" title={dunkel ? "Hellmodus" : "Dunkelmodus"} aria-pressed={dunkel} onClick={() => setDunkel(!dunkel)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">{dunkel ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
              </div>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-950 flex-1 overflow-auto min-h-[520px]">
              {mitte === "geruest" && <Rahmen geraet={geraet}><Geruest w={werte} modus={dunkel ? "dunkel" : "hell"} geraet={geraet} name={projekt.name} art={art} bsp={beispieleFuer(projekt, art, werte)} /></Rahmen>}
              {mitte === "testseite" && <Testseite projekt={projekt} breite={GERAETE[geraet][0]} werte={werte} modus={dunkel ? "dunkel" : "hell"} />}
              {mitte === "vergleich" && <Vergleich entwuerfe={entwuerfe} gueltig={gueltig} liveText={liveText} aktuell={{ name: aktiv ? `${aktiv.name}${geaendert ? " (ungespeichert)" : ""}` : "Im Editor", werte }} modus={dunkel ? "dunkel" : "hell"} name={projekt.name} art={art} projekt={projekt} />}
            </div>
          </section></>}
          <aside className={`${card} lg:col-span-2 xl:col-span-1 self-start flex flex-col min-h-[520px] max-h-[calc(100vh-140px)]`}>
            {/* Prüfbefund Etappe 1: im Modus „Bausteine“ gibt es neben dem Inspektor weiter den Design-Chat (Neuer Baustein, [Bausteine]-Fragen) */}
            {modus === "bausteine" && <div role="tablist" aria-label="Seitenleiste Bausteine" className="flex gap-1 p-2 border-b border-slate-200 dark:border-slate-800">
              {[["inspektor", "Baustein", Shapes], ["chat", `Design-Chat mit ${ki.name}`, Bot]].map(([id, t, I]) => (
                <button key={id} type="button" role="tab" aria-selected={bsSeite === id} onClick={() => setBsSeite(id)}
                  className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-sm font-semibold ${bsSeite === id ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}><I className="w-4 h-4" />{t}</button>))}
            </div>}
            {modus === "bausteine" && bsSeite === "inspektor" ? <BausteinInspektor bs={bs} d={d} ich={ich} projekt={projekt} darf={darf} toast={toast} dunkel={dunkel} onFreigabe={zurFreigabe} /> : <>
            {modus !== "bausteine" && <div role="tablist" aria-label="Seitenleiste" className="flex gap-1 p-2 border-b border-slate-200 dark:border-slate-800">
              {[["chat", `Chat mit ${ki.name}`, Bot], ["pruef", "Prüfungen", ShieldCheck]].map(([id, t, I]) => (
                <button key={id} type="button" role="tab" aria-selected={rechts === id} onClick={() => setRechts(id)}
                  className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-sm font-semibold ${rechts === id ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                  <I className="w-4 h-4" />{t}{id === "pruef" && (rot ? <span className="text-[11px] font-bold bg-red-600 text-white rounded-full px-1.5">{rot}</span> : hinweise ? <span className="text-[11px] font-bold bg-amber-500 text-amber-950 rounded-full px-1.5">{hinweise}</span> : null)}</button>))}
            </div>}
            {rechts === "pruef" && modus !== "bausteine" ? <Pruefliste befunde={befunde} rot={rot} hinweise={hinweise} kiName={ki.name} onFragen={() => setRechts("chat")} />
              : <DesignChat d={d} ich={ich} projekt={projekt} entwurf={aktiv} werte={werte} befunde={befunde} darf={darf} toast={toast} modus={modus} text={chatText} setText={setChatText} start={!laden && !live && !entwuerfe.length}
                  onUebernehmen={(v) => { if (!bearbeitbar) { toast(fest ? "Dieser Entwurf ist fest – lege eine Kopie an" : "Kein Recht zum Gestalten"); return false; }
                    setVerlauf((h) => ({ zurueck: [...h.zurueck.slice(-49), werte], vor: [] })); setWerte(mische(werte, v)); setGeaendert(true); if (modus === "grund") setMitte("geruest"); return true; }} />}
            </>}
          </aside>
        </div>)}

      {laden && <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />}
      {dialog?.art === "neu" && <NeuDialog vorschlag={aktiv ? `${aktiv.name} – Kopie` : ""} onClose={() => setDialog(null)} onOk={(n) => { setDialog(null); neu(n, dialog.von); }} />}
      {dialog?.art === "versionen" && aktiv && <Versionen entwurf={aktiv} onClose={() => setDialog(null)} onHolen={(w, nr) => {
        if (!bearbeitbar) { toast("Entwurf ist fest – lege eine Kopie an"); return; }
        setVerlauf((h) => ({ zurueck: [...h.zurueck, werte], vor: [] })); setWerte(mische(BASIS, w)); setGeaendert(true); setDialog(null); toast(`Version ${nr} geladen – Speichern übernimmt sie`);
      }} />}
      {dialog?.art === "senden" && aktiv && <SendenDialog entwurf={aktiv} werte={werte} gueltig={gueltig} rot={rot} onClose={() => setDialog(null)} onGesendet={(a) => { setDialog(null); holen(); toast(`Auftrag #${a} angelegt – läuft jetzt über Freigabe und Prüfungen`); }} toast={toast} />}
    </div>
  );
}

const STAND_TXT = { entwurf: "Entwurf", gesendet: "Als Auftrag gesendet", live: "Live", ersetzt: "Ersetzt", verworfen: "Verworfen" };
const STAND_CLS = { entwurf: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300", gesendet: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  live: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400", ersetzt: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", verworfen: "bg-slate-100 text-slate-500" };

function Feld({ label, children }) { return <label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm">{label}{children}</label>; }
function Abschnitt({ titel, children, offen = true }) {
  return <details open={offen} className="group border-b border-slate-200 dark:border-slate-800 last:border-0 py-2"><summary className="cursor-pointer font-display font-bold text-[15px] list-none flex items-center justify-between">{titel}<span className="text-slate-400 group-open:rotate-90 transition">›</span></summary><div className="space-y-2 pt-2">{children}</div></details>;
}

function Einstellungen({ w, aendere, bearbeitbar, art = "verwaltung", onBeispiele }) {
  const [m, setM] = useState("hell");
  const dis = !bearbeitbar;
  const zahl = (pfad, min, max, schritt = 1) => { const v = pfad.reduce((o, k) => o[k], w);
    return <span className="flex items-center gap-2"><input type="range" min={min} max={max} step={schritt} value={v} disabled={dis} onChange={(e) => aendere(pfad, Number(e.target.value))} className="w-28 accent-emerald-700" /><span className="w-10 text-right tabular-nums text-xs">{v}</span></span>; };
  const wahl = (pfad, opts) => <select value={String(pfad.reduce((o, k) => o[k], w))} disabled={dis} onChange={(e) => { const v = e.target.value; aendere(pfad, /^\d+$/.test(v) ? Number(v) : v === "true" ? true : v === "false" ? false : v); }} className={`${input} w-40`}>{opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>;
  const farbe = (pfad) => { const v = pfad.reduce((o, k) => o[k], w); return <span className="flex items-center gap-1.5">
    <input type="color" aria-label={pfad.join(" ")} value={v} disabled={dis} onChange={(e) => aendere(pfad, e.target.value)} className="w-8 h-7 rounded border border-slate-300 dark:border-slate-700 bg-transparent cursor-pointer disabled:cursor-default" />
    <input aria-label={`${pfad.join(" ")} Farbwert`} value={v} disabled={dis} onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && aendere(pfad, e.target.value.toLowerCase())} className={`${input} w-[84px] font-mono text-xs`} /></span>; };
  return (
    <section className={`${card} p-3 self-start`} aria-label="Einstellungen Grunddesign">
      <ArtEinstellungen art={art} w={w} wahl={wahl} farbe={farbe} onBeispiele={onBeispiele} bearbeitbar={bearbeitbar} Abschnitt={Abschnitt} Feld={Feld} />
      <Abschnitt titel="Farben">
        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold w-max">
          {[["hell", "Hellmodus"], ["dunkel", "Dunkelmodus"]].map(([id, t]) => <button key={id} type="button" aria-pressed={m === id} onClick={() => setM(id)} className={`px-2.5 py-1 rounded-md ${m === id ? "bg-white dark:bg-slate-900 shadow-sm" : ""}`}>{t}</button>)}
        </div>
        {FARBEN.map(([k, t]) => (
          <Feld key={k} label={t}>
            <span className="flex items-center gap-1.5">
              <input type="color" aria-label={`${t} (${m})`} value={w.farben[m][k]} disabled={dis} onChange={(e) => aendere(["farben", m, k], e.target.value)} className="w-8 h-7 rounded border border-slate-300 dark:border-slate-700 bg-transparent cursor-pointer disabled:cursor-default" />
              <input aria-label={`${t} Farbwert`} value={w.farben[m][k]} disabled={dis} onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && aendere(["farben", m, k], e.target.value.toLowerCase())} className={`${input} w-[84px] font-mono text-xs`} />
            </span>
          </Feld>))}
      </Abschnitt>
      <Abschnitt titel="Schrift">
        <Feld label="Überschriften">{wahl(["schrift", "ueberschrift"], SCHRIFTEN.map((s) => [s, s]))}</Feld>
        <Feld label="Fließtext">{wahl(["schrift", "text"], SCHRIFTEN.map((s) => [s, s]))}</Feld>
        <Feld label="Grundgröße (px)">{zahl(["schrift", "basis"], 13, 19)}</Feld>
        <Feld label="Stärke Überschrift">{wahl(["schrift", "gewicht"], [[600, "Halbfett"], [700, "Fett"]])}</Feld>
      </Abschnitt>
      <Abschnitt titel="Formen & Abstände" offen={false}>
        <Feld label="Ecken (Knöpfe, Felder)">{zahl(["form", "radius"], 0, 20)}</Feld>
        <Feld label="Ecken (Karten)">{zahl(["form", "radius_karte"], 0, 28)}</Feld>
        <Feld label="Grundabstand">{zahl(["form", "abstand"], 8, 28, 2)}</Feld>
        <Feld label="Schatten">{wahl(["form", "schatten"], [["kein", "Kein"], ["leicht", "Leicht"], ["deutlich", "Deutlich"]])}</Feld>
      </Abschnitt>
      {art !== "spiel" && <Abschnitt titel="Menüleiste" offen={false}>
        <Feld label="Position (PC)">{wahl(["menue", "position"], [["links", "Links"], ["oben", "Oben"]])}</Feld>
        <Feld label="Aufklappbar">{wahl(["menue", "aufklappbar"], [[true, "Ja"], [false, "Nein"]].map(([v, t]) => [String(v), t]))}</Feld>
        <Feld label="Breite (px)">{zahl(["menue", "breite"], 200, 320, 8)}</Feld>
        <Feld label="Tablet">{wahl(["menue", "tablet"], [["eingeklappt", "Eingeklappt (nur Symbole)"], ["offen", "Offen"], ["oben", "Oben"]])}</Feld>
        <Feld label="Handy">{wahl(["menue", "handy"], [["unten", "Leiste unten"], ["burger", "Menü-Knopf oben"]])}</Feld>
      </Abschnitt>}
      <Abschnitt titel="Logo-Platz" offen={false}>
        <Feld label="Platz">{wahl(["logo", "platz"], [["menue-oben", "Menü oben"], ["kopf-links", "Kopfzeile links"], ["kopf-mitte", "Kopfzeile Mitte"]])}</Feld>
        <Feld label="Größe (px)">{zahl(["logo", "groesse"], 20, 56, 2)}</Feld>
      </Abschnitt>
    </section>
  );
}

// Echte Gerätebreite, eingepasst in die Spalte (GeraeteRahmen, Fehlerkorrektur 0.9.5)
function Rahmen({ geraet, children }) {
  return <GeraeteRahmen geraet={geraet} hoehe="inhalt" rahmenClass="rounded-xl shadow-lg ring-1 ring-black/10" text="Grundgerüst mit den Entwurfswerten">{children}</GeraeteRahmen>;
}

// Gerüst: Menü, Kopfzeile, Kacheln, Liste, Knöpfe – zeigt die Werte sofort (die echte App erst nach „live“)
function Geruest({ w, modus, geraet, name, art = "verwaltung", bsp = beispieleFuer(null, "verwaltung", w) }) {
  const f = w.farben[modus]; const s = w.schrift; const fo = w.form;
  const schatten = { kein: "none", leicht: "0 1px 3px rgba(0,0,0,.08)", deutlich: "0 6px 18px rgba(0,0,0,.14)" }[fo.schatten];
  const pos = geraet === "handy" ? w.menue.handy : geraet === "tablet" ? (w.menue.tablet === "oben" ? "oben" : w.menue.tablet) : w.menue.position;
  const seitlich = pos === "links" || pos === "offen" || pos === "eingeklappt";
  const schmal = pos === "eingeklappt";
  const fontH = `"${s.ueberschrift}", system-ui, sans-serif`; const fontT = `"${s.text}", system-ui, sans-serif`;
  // Logo aus der Marke (Logo.jsx, gleiche Zeichnung wie in der App) in der eingestellten Größe – „Bisheriges Bild“ ohne Bild zeigt das Monogramm
  const Logo = () => <span className="shrink-0 inline-flex"><LogoZeichen werte={w.marke} groesse={w.logo.groesse} titel={w.marke?.name || name} /></span>;
  // Menüpunkte aus den Beispielen der App-Art (Trainer to go: bisherige Muster)
  const punkte = (bsp.menue || []).map((t, i, a) => [t, menueSymbol(i, a.length)]);
  if (art !== "verwaltung") return <ArtMuster art={art} w={w} f={f} fo={fo} s={s} fontH={fontH} fontT={fontT} bsp={bsp} geraet={geraet} schatten={schatten} />;
  const Menue = ({ quer }) => (
    <nav style={{ background: f.menue, color: f.menue_text, borderColor: f.rand, width: quer ? "auto" : schmal ? 64 : Math.min(w.menue.breite, 280), fontFamily: fontT }} className={quer ? "flex items-center gap-1 px-3 py-2 border-b" : "flex flex-col gap-1 p-2.5 border-r shrink-0"}>
      {!quer && w.logo.platz === "menue-oben" && <div className="flex items-center gap-2 px-1.5 pb-2 min-w-0">{schmal ? <Logo /> : <MarkeLogo werte={w.marke} groesse={w.logo.groesse} farbeText={f.menue_text} className="min-w-0" />}</div>}
      {punkte.map(([t, I], i) => <span key={i} style={i === 0 ? { background: f.primaer + "22", color: f.primaer, borderRadius: fo.radius } : { borderRadius: fo.radius }} className="flex items-center gap-2 px-2 py-1.5 text-[0.9em] font-semibold"><I size={17} />{!schmal && t}</span>)}
    </nav>);
  const kopfLogo = w.logo.platz !== "menue-oben" || !seitlich;
  return (
    <div style={{ background: f.hintergrund, color: f.text, fontFamily: fontT, fontSize: s.basis }} className="flex min-h-[480px]">
      {seitlich && <Menue />}
      <div className="flex-1 min-w-0 flex flex-col">
        <header style={{ borderColor: f.rand, padding: `${fo.abstand * 0.6}px ${fo.abstand}px` }} className="flex items-center gap-3 border-b">
          {pos === "burger" && <span style={{ color: f.text }}>☰</span>}
          {kopfLogo && w.logo.platz !== "kopf-mitte" && <Logo />}
          <h2 style={{ fontFamily: fontH, fontWeight: s.gewicht, fontSize: s.basis * 1.6 }} className={w.logo.platz === "kopf-mitte" ? "flex-1" : ""}>{bsp.titel}</h2>
          {kopfLogo && w.logo.platz === "kopf-mitte" && <Logo />}
          <span className="ml-auto flex items-center gap-2" style={{ color: f.text_leise }}><Search size={18} /><Bell size={18} /></span>
        </header>
        {pos === "oben" && <Menue quer />}
        <main style={{ padding: fo.abstand, gap: fo.abstand }} className="grid flex-1 content-start">
          <div style={{ gap: fo.abstand }} className={`grid ${geraet === "handy" ? "grid-cols-2" : "grid-cols-4"}`}>
            {(bsp.kacheln || []).map(([t, z], i) => (
              <div key={i} style={{ background: f.flaeche, borderColor: f.rand, borderRadius: fo.radius_karte, boxShadow: schatten, padding: fo.abstand * 0.8 }} className="border">
                <div style={{ color: f.text_leise }} className="text-[0.8em]">{t}</div>
                <div style={{ fontFamily: fontH, fontWeight: s.gewicht, fontSize: s.basis * 1.7 }}>{z}</div>
              </div>))}
          </div>
          <div style={{ background: f.flaeche, borderColor: f.rand, borderRadius: fo.radius_karte, boxShadow: schatten }} className="border overflow-hidden">
            <div style={{ padding: `${fo.abstand * 0.7}px ${fo.abstand}px`, borderColor: f.rand }} className="flex items-center gap-2 border-b">
              <b style={{ fontFamily: fontH, fontWeight: s.gewicht, fontSize: s.basis * 1.2 }}>{bsp.liste}</b>
              <span style={{ background: f.primaer, color: f.primaer_text, borderRadius: fo.radius }} className="ml-auto px-3 py-1.5 text-[0.85em] font-semibold">{bsp.knopf}</span>
              <span style={{ borderColor: f.rand, borderRadius: fo.radius }} className="px-3 py-1.5 text-[0.85em] font-semibold border">Filter</span>
            </div>
            {(bsp.zeilen || []).map((r, i) => [r[0] || "", r[1] || "", [f.erfolg, f.warnung, f.fehler][i % 3], r[2] || ""]).map(([t, z, c, h], i) => (
              <div key={i} style={{ padding: `${fo.abstand * 0.6}px ${fo.abstand}px`, borderColor: f.rand }} className="flex items-center gap-3 border-b last:border-0">
                <span className="w-2 h-2 rounded-full" style={{ background: c }} /><span className="flex-1 font-semibold">{t}</span><span style={{ color: f.text_leise }} className="text-[0.85em]">{z}</span>
                {geraet !== "handy" && <span style={{ color: c, borderColor: c, borderRadius: 999 }} className="border px-2 text-[0.75em] font-semibold">{h}</span>}
              </div>))}
          </div>
        </main>
        {pos === "unten" && <nav style={{ background: f.menue, color: f.menue_text, borderColor: f.rand }} className="flex justify-around border-t py-2">{punkte.slice(0, 4).map(([t, I], i) => <span key={i} style={i === 0 ? { color: f.primaer } : {}} className="flex flex-col items-center text-[0.7em] font-semibold"><I size={18} />{t}</span>)}</nav>}
      </div>
    </div>);
}

function Testseite({ projekt, breite, werte, modus, onUmdesign, bruecke, onBaustein }) {
  const geraet = geraetVonBreite(breite);
  // Etappe 3: Entwurf sofort in der echten Testseite zeigen – die App (vorschauHelfer.js) übernimmt die Werte nur dort, nichts wird gespeichert
  // Nur echte https-Adressen; eine ungültige Adresse darf den Designer nicht abstürzen lassen
  // Mit „Test & Live“ (Datenbank 0024) zeigt die Testseite die Testfassung (main), sonst die App-Adresse
  const basis = projekt.live_zweig && /^https:\/\/[^/\s]+/i.test(projekt.test_url || "") ? projekt.test_url : projekt.live_url;
  const url = /^https:\/\/[^/\s]+/i.test(basis || "") ? `${basis.replace(/\/$/, "")}${projekt.vorschau_pfad || "/"}?cs=1` : null;
  const rahmen = React.useRef(null);
  const [bereit, setBereit] = useState(null);   // null = noch nicht, true = Testseite übernimmt Entwürfe
  const ziel = (() => { try { return url ? new URL(url).origin : null; } catch { return null; } })();
  const senden = useCallback(() => { try { rahmen.current?.contentWindow?.postMessage({ cs: "design", werte, modus }, ziel); } catch { /* egal */ } }, [werte, modus, ziel]);
  useEffect(() => { senden(); }, [senden]);
  // App-Designer 2.0: Brücke zur Baustein-Galerie (nur Testfassungen auf *.pages.dev) – Nachrichten an genau diese Herkunft
  const galerie = !!bruecke && /^https:\/\/([a-z0-9-]+\.)*pages\.dev$/i.test(ziel || "");
  useEffect(() => {
    if (!galerie) return undefined;
    bruecke.current = (n) => rahmen.current?.contentWindow?.postMessage(n, ziel);
    return () => { bruecke.current = null; };
  }, [galerie, bruecke, ziel]);
  useEffect(() => {
    const h = (e) => {
      if (e.origin !== ziel || e.source !== rahmen.current?.contentWindow || !e.data || typeof e.data !== "object") return;
      if (e.data.cs === "design-ok") setBereit(true);
      // Design-Freigabe (Speichern der Bausteine in der App) – gleiche Regeln wie im Seiten-Designer
      if (e.data.cs === "design-frage" && galerie) designFrageBeantworten(e.data, ziel, (x) => rahmen.current?.contentWindow?.postMessage(x, ziel));
      // Galerie meldet: bereit, Baustein gewählt (Linksklick), Antworten auf Laden/Speichern – Inhalt prüft useBausteinDesigner
      if (galerie && onBaustein) {
        if (e.data.cs === "bausteine-bereit") onBaustein({ cs: "geladen" });
        else if (e.data.cs === "baustein-wahl" && /^[a-z0-9-]{1,40}$/.test(String(e.data.id || ""))) onBaustein({ cs: "baustein-wahl", id: e.data.id });
        else if (e.data.cs === "baustein-stand" || e.data.cs === "baustein-gespeichert") onBaustein(e.data);
      }
      // Rechtsklick in der Galerie: Symbol bzw. Grundbaustein umdesignen (Datenbank 0027) – nur Art und Name, beides streng geprüft
      if (e.data.cs === "umdesign" && onUmdesign && ["symbol", "baustein"].includes(e.data.art) && /^[A-Za-z0-9-]{1,60}$/.test(String(e.data.name || ""))) onUmdesign({ art: e.data.art, name: e.data.name });
    };
    window.addEventListener("message", h); return () => window.removeEventListener("message", h);
  }, [ziel, onUmdesign, galerie, onBaustein]);
  if (!url) return <p className="text-sm text-slate-500 p-4">Die App gibt es noch nicht als Testseite – gestalte im „Gerüst“: dort siehst du das Design schon jetzt an einer Muster-App. Sobald die App eine Adresse hat, erscheint sie hier.</p>;
  return (
    <div className="min-w-0">
      <p className={`text-xs mb-1.5 rounded-lg px-2.5 py-1.5 border ${bereit ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900 text-green-800 dark:text-green-300" : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-slate-600 dark:text-slate-300"}`}>
        {bereit ? "Echte Testseite – zeigt deinen Entwurf sofort (nur hier, nichts wird gespeichert). Darüber liegt wie in der App die Vereinsfarbe." : "Echte Testseite der App. Sobald sie geladen ist, zeigt sie deinen Entwurf sofort (ab Trainer to go mit Grunddesign-Ebene)."}</p>
      <GeraeteRahmen geraet={geraet}>
        <iframe ref={rahmen} title="Testseite der App" src={url} onLoad={() => setTimeout(senden, 400)} className="block w-full h-full bg-white" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
      </GeraeteRahmen>
    </div>);
}

function Vergleich({ entwuerfe, gueltig, liveText = "Live", aktuell, modus, name, art, projekt }) {
  const optionen = [["gueltig", "Gültiges Grunddesign", gueltig], ["aktuell", aktuell.name, aktuell.werte], ...entwuerfe.map((e) => [String(e.id), `${e.name} (${e.stand === "live" ? liveText : STAND_TXT[e.stand]})`, mische(BASIS, e.werte)])];
  const [a, setA] = useState("gueltig"); const [b, setB] = useState("aktuell");
  const wa = optionen.find((o) => o[0] === a)?.[2] || gueltig; const wb = optionen.find((o) => o[0] === b)?.[2] || aktuell.werte;
  const diff = aenderungen(wa, wb);
  const Wahl = ({ v, set, l }) => <label className="text-sm flex items-center gap-2">{l}<select value={v} onChange={(e) => set(e.target.value)} className={`${input} w-auto`}>{optionen.map(([id, t]) => <option key={id} value={id}>{t}</option>)}</select></label>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3"><Wahl v={a} set={setA} l="A" /><Wahl v={b} set={setB} l="B" /></div>
      <div className="grid md:grid-cols-2 gap-3">
        {[[a, wa], [b, wb]].map(([id, w], i) => <div key={i} className="min-w-0"><p className="text-xs font-bold text-slate-500 mb-1">{i ? "B" : "A"} · {optionen.find((o) => o[0] === id)?.[1]}</p><div className="pointer-events-none"><GeraeteRahmen geraet="pc" hoehe="inhalt" rahmenClass="rounded-xl ring-1 ring-black/10"><Geruest w={w} modus={modus} geraet="pc" name={name} art={art} bsp={beispieleFuer(projekt, art, w)} /></GeraeteRahmen></div></div>)}
      </div>
      <div className={`${card} overflow-hidden`}>
        <div className="px-3 py-2 font-display font-bold border-b border-slate-200 dark:border-slate-800">{diff.length} Unterschied{diff.length === 1 ? "" : "e"}</div>
        {diff.length ? <table className="w-full text-sm"><tbody>{diff.map((x) => <tr key={x.k} className="border-b border-slate-100 dark:border-slate-800 last:border-0"><td className="px-3 py-1.5 font-mono text-xs">{x.k}</td><td className="px-3 py-1.5"><Wert v={x.alt} /></td><td className="px-1 text-slate-400">→</td><td className="px-3 py-1.5"><Wert v={x.neu} /></td></tr>)}</tbody></table>
          : <p className="px-3 py-3 text-sm text-slate-500">A und B sind gleich.</p>}
      </div>
    </div>);
}
const Wert = ({ v }) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? <span className="inline-flex items-center gap-1.5 font-mono text-xs"><i className="w-3.5 h-3.5 rounded border border-black/10" style={{ background: v }} />{v}</span> : <span className="font-mono text-xs">{String(v ?? "–")}</span>);

function Hulle({ titel, onClose, children }) {
  return <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div role="dialog" aria-modal="true" aria-label={titel} className={`${card} w-full max-w-xl max-h-[85vh] overflow-auto p-4 shadow-xl`}><h3 className="font-display font-bold text-xl mb-3">{titel}</h3>{children}</div></div>;
}
function NeuDialog({ vorschlag, onClose, onOk }) {
  const [n, setN] = useState(vorschlag);
  return <Hulle titel="Neuer Entwurf" onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); if (n.trim()) onOk(n.trim().slice(0, 80)); }} className="space-y-3"><label className="block text-sm font-semibold">Name<input autoFocus value={n} onChange={(e) => setN(e.target.value)} className={`${input} mt-1`} placeholder="z. B. Frischer & heller" /></label><p className="text-xs text-slate-500">Startet mit den Werten, die gerade im Editor stehen.</p><div className="flex justify-end gap-2"><button type="button" className={ghost} onClick={onClose}>Abbrechen</button><button className={btn} disabled={!n.trim()}><Copy className="w-4 h-4" />Anlegen</button></div></form></Hulle>;
}
function Versionen({ entwurf, onClose, onHolen }) {
  const [v, setV] = useState(null);
  useEffect(() => { supabase.from("ws_design_versionen").select("*").eq("entwurf_id", entwurf.id).order("nr", { ascending: false }).then(({ data }) => setV(data || [])); }, [entwurf.id]);
  return <Hulle titel={`Versionen · ${entwurf.name}`} onClose={onClose}>{!v ? <Loader2 className="w-5 h-5 animate-spin" /> : (
    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
      {v.map((x) => <li key={x.id} className="py-2 flex items-center gap-3 text-sm"><b>Version {x.nr}</b><span className="text-slate-500">{fmt(x.erstellt)}</span><button type="button" className={`${ghost} ml-auto`} onClick={() => onHolen(x.werte, x.nr)}>Zurückholen</button></li>)}
    </ul>)}<div className="flex justify-end mt-3"><button type="button" className={ghost} onClick={onClose}>Schließen</button></div></Hulle>;
}
function SendenDialog({ entwurf, werte, gueltig, rot, onClose, onGesendet, toast }) {
  const liste = aenderungen(gueltig, werte);
  const [text, setText] = useState(() => auftragsText(entwurf.name, liste, werte));
  const [laeuft, setLaeuft] = useState(false);
  const senden = async () => {
    setLaeuft(true);
    const { data, error } = await supabase.rpc("ws_design_senden", { p_entwurf: entwurf.id, p_text: text });
    setLaeuft(false);
    if (error) return toast(fehler(error));
    onGesendet(data);
  };
  return <Hulle titel={`„${entwurf.name}“ als Auftrag senden`} onClose={onClose}>
    <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">{liste.length} Änderung{liste.length === 1 ? "" : "en"} gegenüber dem gültigen Grunddesign. Der Auftrag geht in die Design-Gruppe und läuft wie jeder Auftrag: Freigabe → Sicherheitsprüfung → Zusammenführen → Feature-Prüfung → live.</p>
    {rot > 0 && <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 rounded-lg px-2.5 py-1.5 mb-2">{rot} Prüfung{rot === 1 ? "" : "en"} nicht grün (z. B. Kontrast). Du kannst trotzdem senden – Claude weist im Auftrag darauf hin.</p>}
    <label className="block text-sm font-semibold">Auftragstext (änderbar)<textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} className={`${input} mt-1 font-mono text-xs`} /></label>
    <div className="flex justify-end gap-2 mt-3"><button type="button" className={ghost} onClick={onClose}>Abbrechen</button><button type="button" className={btn} onClick={senden} disabled={laeuft || text.trim().length < 10}>{laeuft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Senden</button></div>
  </Hulle>;
}

function Pruefliste({ befunde, rot, hinweise, onFragen, kiName = "Claude" }) {
  const gruppen = [...new Set(befunde.map((b) => b.gruppe))];
  return (
    <div className="p-3 overflow-auto space-y-3">
      <p className="text-sm">{rot ? <b className="text-red-700 dark:text-red-300">{rot} Pflicht-Prüfung{rot === 1 ? "" : "en"} offen</b> : <b className="text-green-700 dark:text-green-400">Alle Pflicht-Prüfungen grün</b>}{hinweise ? <span className="text-amber-700 dark:text-amber-400"> · {hinweise} Hinweis{hinweise === 1 ? "" : "e"}</span> : null}</p>
      {(rot > 0 || hinweise > 0) && <button type="button" className={`${ghost} w-full`} onClick={onFragen}><Sparkles className="w-4 h-4" />{kiName} um eine Lösung bitten</button>}
      {gruppen.map((g) => (
        <section key={g}><h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{g}</h4>
          <ul className="space-y-1.5 text-sm">{befunde.filter((b) => b.gruppe === g).map((b) => (
            <li key={b.text} className="flex gap-2">{b.ok ? <CircleCheck className="w-4 h-4 text-green-600 shrink-0 mt-0.5" /> : b.stufe === "rot" ? <CircleAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" /> : <TriangleAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
              <span>{b.text}<span className="block text-xs text-slate-500">{b.wert}</span></span></li>))}</ul>
        </section>))}
      <p className="text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800 pt-2">Rot = Pflicht (Barrierefreiheit WCAG 2.1 AA) · Gelb = Empfehlung</p>
    </div>);
}

// Chat mit Claude: läuft über die eigene Werkstatt (Abo), Claude bekommt nur die Werte, keine Werkzeuge.
// Noch kein Design (neues Projekt): Gespräch von Grund auf – Claude fragt zuerst und schlägt dann ein ganzes Grunddesign vor
const IDEEN_START = ["Lass uns das Design von Grund auf planen", "Schlag mir 3 Grundrichtungen vor", "Frag mich zu Zielgruppe und Stimmung", "Passende Farben zu meinem Logo"];
const IDEEN = ["Mach die Knöpfe besser lesbar", "Wärmer und freundlicher, aber seriös", "Moderner Dunkelmodus", "Löse die offenen Prüfungen", "Passt das für Dorf- und Profivereine?"];
function DesignChat({ d, ich, projekt, entwurf, werte, befunde, darf, toast, onUebernehmen, modus = "grund", text, setText, start = false }) {
  const ki = useKiName(projekt.id, "design");
  const chatFeld = useRef(null); useAutoHoehe(chatFeld, text);
  const [liste, setListe] = useState([]);
  const [senden, setSenden] = useState(false);
  const ende = React.useRef(null);
  const holen = useCallback(async () => {
    let q = supabase.from("ws_design_chat").select("*").eq("projekt_id", projekt.id).order("id", { ascending: false }).limit(200);
    q = entwurf ? q.eq("entwurf_id", entwurf.id) : q.is("entwurf_id", null);
    const { data } = await q;
    // Gespräche zum Umdesignen (Rechtsklick in der Galerie) stehen im Umdesign-Entwurf, nicht hier
    // ebenso Gespräche zu einem Baustein (App-Designer 2.0) – die stehen im Inspektor – und zu einer Kachel (Chat zur Kachel im Seiten-Designer, 0041)
    const um = new Set((data || []).filter((m) => !m.frage_id && ["[Umdesign ", "[Baustein ", "[Kachel "].some((p) => String(m.text).startsWith(p))).map((m) => m.id));
    setListe((data || []).filter((m) => !um.has(m.id) && !um.has(m.frage_id)).reverse());
  }, [projekt.id, entwurf]);
  useEffect(() => {
    holen();
    const ch = supabase.channel(`cs-design-chat-${projekt.id}-${entwurf?.id || "ohne"}`).on("postgres_changes", { event: "*", schema: "public", table: "ws_design_chat" }, holen).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [holen, projekt.id, entwurf]);
  useEffect(() => { ende.current?.scrollIntoView({ block: "end" }); }, [liste.length]);
  const werkstattAn = d.pcs.some((p) => p.benutzer_id === ich.id && p.an);
  const wartet = liste.filter((m) => !m.frage_id && m.von === ich.id && ["offen", "laeuft"].includes(m.stand));
  const schicke = async (t) => {
    const inhalt = (t ?? text).trim(); if (!inhalt) return;
    const offen = befunde.filter((b) => !b.ok).map((b) => `${b.text} (${b.wert})`);
    const basis = /prüfung/i.test(inhalt) && offen.length ? `${inhalt}\nOffene Prüfungen: ${offen.join("; ")}` : inhalt;
    // Bereich mitschicken: die Werkstatt wählt danach die KI-Zuständigkeit (Marke → „Bilder & Grafiken“)
    const frage = modus === "marke" ? `[Marke] ${basis}` : modus === "bausteine" ? `[Bausteine] ${basis}` : basis;
    setSenden(true);
    const { error } = await supabase.from("ws_design_chat").insert({ projekt_id: projekt.id, entwurf_id: entwurf?.id || null, text: frage.slice(0, 8000), werte });
    setSenden(false);
    if (error) return toast(fehler(error));
    setText("");
  };
  const entscheide = async (m, e) => {
    if (e === "uebernommen" && !onUebernehmen(m.werte)) return;
    const { error } = await supabase.rpc("ws_design_chat_entscheiden", { p_antwort: m.id, p_entscheidung: e });
    if (error) toast(fehler(error)); else toast(e === "uebernommen" ? "Vorschlag übernommen – zum Behalten speichern" : "Vorschlag abgelehnt");
  };
  const fragen = Object.fromEntries(liste.filter((m) => !m.frage_id).map((m) => [m.id, m]));
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-auto p-3 space-y-2.5 text-sm">
        {!liste.length && (start
          ? <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 p-3 space-y-1.5 text-slate-700 dark:text-slate-200">
              <p className="font-display font-bold text-[15px] flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-emerald-700" />Design von Anfang an planen</p>
              <p>Für {projekt.name} gibt es noch kein Design – genau richtig, um damit anzufangen. Erzähl, für wen die App ist und wie sie wirken soll. {ki.name} stellt ein paar Fragen und schlägt dann ein komplettes Grunddesign vor (Farben, Schrift, Formen, Menü), das du mit einem Klick übernimmst.</p>
              <p className="text-xs text-slate-500">Nichts geht live, bevor du einen Entwurf als Auftrag sendest.</p></div>
          : <div className="text-slate-500 space-y-2"><p>Frag {ki.name} zum Design{entwurf ? ` von „${entwurf.name}“` : ""}. {ki.name} erklärt und schlägt Werte vor – übernommen wird nur, was du anklickst.</p></div>)}
        {liste.map((m) => m.frage_id ? (
          <div key={m.id} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-2.5 max-w-[95%]">
            <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><Bot className="w-3.5 h-3.5" />{ki.von(m.ki)}{fragen[m.frage_id] && fragen[m.frage_id].von !== ich.id ? ` · über die Werkstatt von ${d.benutzer.find((u) => u.id === fragen[m.frage_id].von)?.name || "Mitglied"}` : ""}</div>
            <Markdown text={m.text} klein />
            {m.werte && <Vorschlag m={m} werte={werte} kann={fragen[m.frage_id]?.von === ich.id && darf} onEntscheid={(e) => entscheide(m, e)} />}
          </div>
        ) : (
          <div key={m.id} className="ml-auto rounded-xl bg-emerald-50 dark:bg-emerald-950/50 p-2.5 max-w-[90%]">
            <div className="text-[11px] font-bold text-slate-500">{m.von === ich.id ? "Du" : d.benutzer.find((u) => u.id === m.von)?.name || "Mitglied"} · {fmt(m.erstellt)}</div>
            <Markdown text={m.text} klein />
            {m.stand === "fehler" && <p className="text-xs text-red-600 mt-1">Nicht beantwortet</p>}
          </div>))}
        {wartet.length > 0 && <div className="flex items-center gap-2 text-slate-500">{werkstattAn ? <><Loader2 className="w-4 h-4 animate-spin" />{ki.name} denkt nach … (über deine Werkstatt, ca. 20–60 Sek.)</> : <span className="text-amber-700 dark:text-amber-400">Deine Werkstatt ist aus – schalte sie oben ein, dann antwortet Claude.</span>}</div>}
        <div ref={ende} />
      </div>
      {darf ? (
        <form className="border-t border-slate-200 dark:border-slate-800 p-2.5 space-y-2" onSubmit={(e) => { e.preventDefault(); schicke(); }}>
          <div className="flex flex-wrap gap-1">{(start && !liste.length ? IDEEN_START : IDEEN).map((i) => <button key={i} type="button" disabled={senden} onClick={() => schicke(i)} className="text-xs rounded-full border border-slate-300 dark:border-slate-700 px-2 py-0.5 hover:bg-slate-50 dark:hover:bg-slate-800">{i}</button>)}</div>
          <div className="flex gap-1.5">
            <textarea ref={chatFeld} value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={4000} placeholder="Was soll sich am Design ändern?" className={`${input} resize-none`}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); schicke(); } }} />
            <button className={`${btn} self-end`} disabled={senden || !text.trim()} title="Senden"><Send className="w-4 h-4" /></button>
          </div>
          {!werkstattAn && <p className="text-xs text-amber-700 dark:text-amber-400">{ki.name} antwortet über deine Werkstatt – sie ist gerade aus.</p>}
        </form>) : <p className="border-t border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-500">Mitlesen möglich – fragen dürfen Entwickler mit Design-Recht.</p>}
    </div>);
}

function Vorschlag({ m, werte, kann, onEntscheid }) {
  const liste = aenderungen(werte, mische(werte, m.werte));
  return (
    <div className="mt-2 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 p-2">
      <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />Vorschlag · {liste.length} Änderung{liste.length === 1 ? "" : "en"}</div>
      {liste.length ? <ul className="space-y-0.5">{liste.slice(0, 12).map((x) => <li key={x.k} className="flex items-center gap-1.5 text-xs"><span className="font-mono text-slate-500 truncate">{x.k}</span><span className="ml-auto flex items-center gap-1"><Wert v={x.alt} />→<Wert v={x.neu} /></span></li>)}</ul>
        : <p className="text-xs text-slate-500">Schon so eingestellt.</p>}
      {m.entscheidung ? <p className="text-xs mt-1.5 font-semibold text-slate-500">{m.entscheidung === "uebernommen" ? "Übernommen" : "Abgelehnt"}</p>
        : kann && liste.length > 0 && <div className="flex gap-1.5 mt-2"><button type="button" className={btn} onClick={() => onEntscheid("uebernommen")}><Check className="w-4 h-4" />Übernehmen</button><button type="button" className={ghost} onClick={() => onEntscheid("abgelehnt")}><X className="w-4 h-4" />Ablehnen</button></div>}
    </div>);
}

/** Projekt ohne Design-Gruppe: Designer automatisch einrichten (Admin/Entwickler), sonst Hinweis. */
function DesignerEinrichten({ projekt, d, ich, toast }) {
  const rolle = d.mitglieder.find((m) => m.projekt_id === projekt.id && m.benutzer_id === ich.id)?.rolle;
  const kann = ich.rolle === "admin" || rolle === "entwickler";
  const [fehlerText, setFehlerText] = useState(null);
  useEffect(() => {
    if (!kann) return;
    let aus = false;
    supabase.rpc("ws_design_einrichten", { p_projekt: projekt.id }).then(({ error }) => {
      if (aus) return;
      if (error) { setFehlerText(fehler(error)); toast(fehler(error)); } else d.holen?.();   // nicht nur auf die Live-Aktualisierung verlassen
    });
    return () => { aus = true; };
  }, [kann, projekt.id, toast]);
  return (
    <div className={`${card} p-6 text-slate-600 dark:text-slate-300 flex items-center gap-3`}>
      {kann && !fehlerText ? <><Loader2 className="w-5 h-5 animate-spin text-emerald-700" />App-Designer für „{projekt.name}“ wird eingerichtet …</>
        : kann ? <span>Einrichten hat nicht geklappt: {fehlerText}</span>
        : <span>Der App-Designer für „{projekt.name}“ ist noch nicht eingerichtet. Das macht der Admin oder ein Entwickler des Projekts mit einem Klick auf „App-Designer“.</span>}
    </div>);
}
