// App-Designer 2.0 · Etappe 3 „Neuer Baustein“-Assistent (Entwurf 1.0, freigegeben von Gerhard 2026-10-24 22:08; 22:35/22:45 „fertigstellen“).
// Ein neuer Baustein ist neuer Code – darum läuft er als Auftrag (Freigabe, Prüfungen, Test, Live). Der Assistent sammelt dafür in vier Schritten:
//   1 Was?      – Beschreiben, Vorlage wählen (feste Arten) oder Einlesen (Bild als Anhang: nur PNG/JPEG/WebP bis 2 MB, keine Fotos von Personen)
//   2 Gestalten – Vorschau im Stil der App (Grunddesign), Farbe hell/dunkel, Symbol (Lucide), Größe, Variante, Ecken, Kontrast-Wächter, Design-Chat als Hilfe
//   3 Zuweisen  – Gruppen und Features dieses Projekts (Häkchen)
//   4 Bauen     – ws_design_auftrag_neu (Datenbank 0039): Auftrag + Beschreibung + geprüfte Daten (Art, Gestaltung, Zuweisung) + Bild in EINEM Schritt.
// Die Werkstatt bekommt die Daten als abgegrenzten Datenblock (desktop/dienst/lib/bausteinAuftrag.mjs). Arten gleich wie dort und in 0039 (Test).
import React, { Suspense, lazy, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, X, Loader2, Send, PenLine, LayoutTemplate, ImagePlus, Trash2, Bot, Contrast, CircleCheck, CircleAlert, TriangleAlert,
  MousePointerClick, FileDown, FileUp, ChevronsUpDown, CircleDot, LayoutDashboard, List, Table2, BarChart3, Megaphone, Layers, CalendarDays, IdCard, Shapes,
  Search, Monitor, Smartphone, Sun, Moon, Hammer, ShieldCheck, Info,
} from "lucide-react";
import { supabase } from "./supabase";
import { pruefeBaustein, zusammenfassung, verhaeltnis, kontrast, lesbarMachen, istHex, SOLL } from "./kontrast";
const SymbolWahl = lazy(() => import("./SymbolWahl"));
const SymbolZeichen = lazy(() => import("./SymbolWahl").then((m) => ({ default: m.SymbolZeichen })));

const card = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const btn = "inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-display font-bold tracking-wide transition text-sm";
const ghost = "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50";
const input = "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";
const fehler = (e) => (e?.message || "Unbekannter Fehler").replace(/^.*?ERROR:\s*/, "");

// Kennung, Anzeigename, Symbol, Standard-Symbol (Lucide-Name), Bedienelement? (Kontrast der Form 3 : 1), Form Pflicht?
export const ARTEN = [
  ["knopf", "Knopf", MousePointerClick, "Check", true, false],
  ["download", "Download-Knopf", FileDown, "FileDown", true, false],
  ["hochladen", "Hochladen", FileUp, "Upload", true, true],
  ["eingabe", "Eingabefeld", PenLine, "PenLine", true, true],
  ["auswahl", "Auswahl", ChevronsUpDown, "ChevronsUpDown", true, true],
  ["schalter", "Schalter", CircleDot, "Power", true, true],
  ["karte", "Karte/Kachel", LayoutDashboard, "LayoutDashboard", false, false],
  ["liste", "Liste", List, "List", false, false],
  ["tabelle", "Tabelle", Table2, "Table2", false, false],
  ["diagramm", "Diagramm", BarChart3, "TrendingUp", false, false],
  ["hinweis", "Hinweis/Banner", Megaphone, "Info", false, false],
  ["dialog", "Dialog", Layers, "Layers", false, false],
  ["kalender", "Kalender-Eintrag", CalendarDays, "CalendarDays", false, false],
  ["spieler", "Spieler-Karte", IdCard, "Shirt", false, false],
  ["eigene", "Eigene", Shapes, "Shapes", false, false],
];
const ART = Object.fromEntries(ARTEN.map((a) => [a[0], a]));
const WEGE = [["beschreiben", "Beschreiben", PenLine, "Du beschreibst, was der Baustein zeigen und können soll."],
  ["vorlage", "Vorlage wählen", LayoutTemplate, "Du gehst von einer bekannten Art aus und passt sie an."],
  ["einlesen", "Einlesen", ImagePlus, "Bild, Screenshot oder Skizze hochladen – Claude baut den Baustein im Stil der App nach."]];
const GROESSEN = [["klein", "Klein", 32, 13], ["mittel", "Mittel", 40, 14], ["gross", "Groß", 48, 16]];
const VARIANTEN = [["voll", "Voll"], ["umriss", "Umriss"], ["leise", "Leise"]];
const SCHRITTE = ["Was?", "Gestalten", "Zuweisen", "Bauen lassen"];
const BILD_TYPEN = ["image/png", "image/jpeg", "image/webp"];
const BILD_MAX = 2 * 1024 * 1024;

export const assistentLeer = () => ({ schritt: 0, weg: "beschreiben", name: "", text: "", art: "knopf", g: {}, zuweisung: { gruppen: [], features: [] }, bild: null });

// Farbe mit dem Seitenhintergrund mischen (für „Leise“)
function mische(a, b, anteil) {
  if (!istHex(a) || !istHex(b)) return istHex(b) ? b : "#ffffff";
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  return "#" + [16, 8, 0].map((s) => Math.round(((x >> s) & 255) * anteil + ((y >> s) & 255) * (1 - anteil)).toString(16).padStart(2, "0")).join("");
}
const bestText = (bg) => (kontrast("#ffffff", bg) >= kontrast("#111111", bg) ? "#ffffff" : "#111111");

/** Gestaltung mit allen abgeleiteten Werten (Grunddesign als Ausgang). */
export function gestaltungVoll(g, werte, art) {
  const hell = werte?.farben?.hell || {}; const dunkel = werte?.farben?.dunkel || {};
  const seite = { hell: istHex(hell.hintergrund) ? hell.hintergrund : "#ffffff", dunkel: istHex(dunkel.hintergrund) ? dunkel.hintergrund : "#0a0a0a" };
  const farbe = istHex(g.farbe) ? g.farbe : istHex(hell.primaer) ? hell.primaer : "#059669";
  const farbe_dunkel = istHex(g.farbe_dunkel) ? g.farbe_dunkel : istHex(dunkel.primaer) && !istHex(g.farbe) ? dunkel.primaer : lesbarMachen(farbe, seite.dunkel, SOLL.bedien);
  const variante = VARIANTEN.some(([v]) => v === g.variante) ? g.variante : "voll";
  const text = istHex(g.text) ? g.text : bestText(farbe);
  const text_dunkel = istHex(g.text_dunkel) ? g.text_dunkel : bestText(farbe_dunkel);
  const groesse = GROESSEN.some(([x]) => x === g.groesse) ? g.groesse : "mittel";
  const ecken = Number.isFinite(g.ecken) ? Math.min(32, Math.max(0, Math.round(g.ecken))) : (werte?.form?.radius ?? 8);
  const symbol = /^[A-Z][A-Za-z0-9]{1,40}$/.test(g.symbol || "") ? g.symbol : ART[art]?.[3] || "Shapes";
  // Flächen je Variante (für Vorschau und Kontrast-Wächter)
  const flaeche = (m) => { const f = m === "hell" ? farbe : farbe_dunkel; const t = m === "hell" ? text : text_dunkel; const s = seite[m];
    if (variante === "voll") return { bg: f, text: t, rand: f };
    if (variante === "umriss") return { bg: s, text: f, rand: f };
    return { bg: mische(f, s, m === "hell" ? 0.12 : 0.22), text: m === "hell" ? lesbarMachen(f, mische(f, s, 0.12)) : lesbarMachen(f, mische(f, s, 0.22)), rand: mische(f, s, 0.3) }; };
  return { farbe, farbe_dunkel, text, text_dunkel, variante, groesse, ecken, symbol, seite, hell: flaeche("hell"), dunkel: flaeche("dunkel") };
}

/** Daten für ws_design_auftrag_neu – genau das Schema aus 0039 (ws_baustein_daten_ok). */
export function assistentDaten(w, voll) {
  return {
    art: w.art, weg: w.weg,
    gestaltung: { farbe: voll.farbe, farbe_dunkel: voll.farbe_dunkel, text: voll.text, text_dunkel: voll.text_dunkel, symbol: voll.symbol, groesse: voll.groesse, variante: voll.variante, ecken: voll.ecken },
    zuweisung: { gruppen: w.zuweisung.gruppen.slice(0, 40), features: w.zuweisung.features.slice(0, 40) },
  };
}

export function auftragsText(w, voll, befunde, namen) {
  const art = ART[w.art]?.[1] || w.art; const sum = zusammenfassung(befunde);
  const gr = w.zuweisung.gruppen.map((id) => namen.gruppen.get(id) || id); const fe = w.zuweisung.features.map((id) => `${id} ${namen.features.get(id) || ""}`.trim());
  return [
    `Neuen Baustein bauen: ${w.name.trim()} (${art}).`,
    `Weg im Assistenten: ${WEGE.find(([k]) => k === w.weg)?.[1] || w.weg}${w.bild ? " – Bild-Vorlage hängt am Auftrag" : ""}.`,
    w.text.trim() ? `\nWas er zeigen und können soll:\n${w.text.trim()}` : "",
    `\nGestaltung aus dem Assistenten (Ausgangswerte; Grundwerte des Grunddesigns gehen vor):`,
    `- Variante ${VARIANTEN.find(([v]) => v === voll.variante)?.[1]}, Größe ${GROESSEN.find(([g]) => g === voll.groesse)?.[1]}, Ecken ${voll.ecken} px, Symbol ${voll.symbol} (Lucide)`,
    `- Farbe hell ${voll.farbe} mit Text ${voll.text} · dunkel ${voll.farbe_dunkel} mit Text ${voll.text_dunkel}`,
    `- Kontrast-Wächter: ${sum.pflicht ? `${sum.pflicht} Pflicht-Prüfung(en) offen – bitte lesbar umsetzen` : "alles lesbar"}${sum.hinweise ? `, ${sum.hinweise} Hinweis(e)` : ""}`,
    gr.length || fe.length ? `\nVerwenden in: ${[...gr.map((x) => `Gruppe „${x}“`), ...fe.map((x) => `Feature ${x}`)].join(", ")}` : "\nZuweisung: noch keine – erst in die Bibliothek und die Galerie aufnehmen.",
    "\nRegeln (Baustein-Bibliothek): erst prüfen, ob es schon einen passenden Baustein gibt (docs/BAUSTEINE.md); nur Grundwerte aus dem Grunddesign verwenden;",
    "Varianten und Zustände (laden, leer, Fehler, gesperrt) vorsehen; Hell- und Dunkelmodus; in die Galerie /bausteine aufnehmen (data-cs-baustein);",
    "danach `node tools/bausteine.mjs` ausführen und docs/BAUSTEINE.md mit einchecken; Handbuch und CHANGELOG mitführen.",
  ].filter(Boolean).join("\n").slice(0, 7900);
}

// ---------------------------------------------------------------------------------------------------------------- Vorschau im App-Stil
function Muster({ art, voll, modus, werte, handy }) {
  const f = werte?.farben?.[modus] || {}; const s = werte?.schrift || {}; const fo = werte?.form || {};
  const b = voll[modus]; const [, , hoehe, schrift] = GROESSEN.find(([g]) => g === voll.groesse);
  const fontH = `"${s.ueberschrift || "Barlow Semi Condensed"}", system-ui, sans-serif`; const fontT = `"${s.text || "Barlow"}", system-ui, sans-serif`;
  const S = ({ className = "w-4 h-4" }) => <Suspense fallback={null}><SymbolZeichen name={voll.symbol} className={className} /></Suspense>;
  const knopf = (t, extra = null) => <span style={{ background: b.bg, color: b.text, border: `1px solid ${b.rand}`, borderRadius: voll.ecken, height: hoehe, fontSize: schrift, padding: "0 14px", fontFamily: fontT }} className="inline-flex items-center gap-2 font-semibold">{<S />}{t}{extra}</span>;
  const karteStil = { background: f.flaeche, color: f.text, border: `1px solid ${f.rand}`, borderRadius: fo.radius_karte ?? 16, fontFamily: fontT };
  const leise = { color: f.text_leise };
  const inhalt = {
    knopf: knopf("Training anlegen"),
    download: <span className="inline-flex flex-col gap-1">{knopf(handy ? "" : "Trainingsplan herunterladen")}<span style={{ ...leise, fontSize: 12 }}>{handy ? "PDF" : "PDF · 240 KB"}</span></span>,
    hochladen: <div style={{ border: `1.5px dashed ${b.rand}`, borderRadius: voll.ecken, background: modus === "hell" ? mische(voll.farbe, f.flaeche || "#ffffff", 0.06) : mische(voll.farbe_dunkel, f.flaeche || "#141414", 0.1), color: f.text, padding: 16, fontFamily: fontT }} className="flex flex-col items-center gap-1 text-center w-full max-w-xs">
      <span style={{ color: b.rand }}><S className="w-6 h-6" /></span><b style={{ fontSize: schrift }}>Datei hierher ziehen oder auswählen</b><span style={{ ...leise, fontSize: 12 }}>PDF oder Bild · bis 10 MB</span></div>,
    eingabe: <label className="flex flex-col gap-1 w-full max-w-xs" style={{ fontFamily: fontT, color: f.text, fontSize: 13 }}>Mannschaft
      <span style={{ background: modus === "hell" ? "#ffffff" : f.flaeche, border: `1px solid ${b.rand}`, borderRadius: voll.ecken, height: hoehe, fontSize: schrift, color: f.text_leise }} className="flex items-center gap-2 px-3"><span style={{ color: b.rand }}><S /></span>z. B. U11</span></label>,
    auswahl: <span style={{ background: modus === "hell" ? "#ffffff" : f.flaeche, border: `1px solid ${b.rand}`, borderRadius: voll.ecken, height: hoehe, fontSize: schrift, color: f.text, fontFamily: fontT }} className="inline-flex items-center justify-between gap-6 px-3 min-w-[200px]">U11 – Mittwoch<span style={{ color: b.rand }}><S /></span></span>,
    schalter: <span className="inline-flex items-center gap-3" style={{ fontFamily: fontT, color: f.text, fontSize: schrift }}><span style={{ background: b.bg, border: `1px solid ${b.rand}`, width: hoehe * 1.15, height: hoehe * 0.6, borderRadius: 999 }} className="relative inline-block"><span style={{ background: b.text, width: hoehe * 0.44, height: hoehe * 0.44, borderRadius: 999, top: hoehe * 0.07, right: hoehe * 0.07 }} className="absolute" /></span>Erinnerung an Eltern</span>,
    karte: <div style={{ ...karteStil, padding: 14 }} className="w-full max-w-[220px] flex flex-col gap-1"><span style={{ background: b.bg, color: b.text, borderRadius: voll.ecken }} className="w-9 h-9 grid place-items-center"><S /></span><span style={{ ...leise, fontSize: 12 }}>Anwesenheit</span><b style={{ fontFamily: fontH, fontSize: 26 }}>92 %</b></div>,
    liste: <div style={karteStil} className="w-full max-w-sm overflow-hidden">{["Mia Beispiel", "Leo Muster", "Ana Probe"].map((t, i) => <div key={t} style={{ borderTop: i ? `1px solid ${f.rand}` : "none", fontSize: schrift }} className="flex items-center gap-2 px-3 py-2"><span style={{ background: b.bg, color: b.text, borderRadius: voll.ecken }} className="w-7 h-7 grid place-items-center"><S className="w-3.5 h-3.5" /></span><b className="flex-1">{t}</b><span style={leise}>U11</span></div>)}</div>,
    tabelle: <div style={karteStil} className="w-full max-w-sm overflow-hidden"><table className="w-full" style={{ fontSize: schrift - 1 }}><thead><tr style={{ background: mische(voll.farbe, f.flaeche || "#ffffff", 0.12), color: f.text }}>{["Name", "Team", "Anw."].map((t) => <th key={t} className="text-left px-3 py-1.5 font-semibold">{t}</th>)}</tr></thead>
      <tbody>{[["Mia Beispiel", "U11", "92 %"], ["Leo Muster", "U11", "61 %"]].map((z) => <tr key={z[0]} style={{ borderTop: `1px solid ${f.rand}` }}>{z.map((c) => <td key={c} className="px-3 py-1.5">{c}</td>)}</tr>)}</tbody></table></div>,
    diagramm: <div style={{ ...karteStil, padding: 12 }} className="w-full max-w-sm"><div style={{ ...leise, fontSize: 12 }}>Trainingsbeteiligung</div><div className="flex items-end gap-2 h-24 mt-2">{[60, 82, 45, 90, 70, 96].map((h, i) => <span key={i} style={{ height: `${h}%`, background: i === 5 ? b.bg : mische(modus === "hell" ? voll.farbe : voll.farbe_dunkel, f.flaeche || "#ffffff", 0.45), borderRadius: Math.min(voll.ecken, 6) }} className="flex-1" />)}</div></div>,
    hinweis: <div style={{ background: b.bg, color: b.text, border: `1px solid ${b.rand}`, borderRadius: voll.ecken, fontFamily: fontT, fontSize: schrift }} className="w-full max-w-md flex items-start gap-2 p-3"><S className="w-5 h-5 shrink-0" /><span><b>Training fällt aus.</b> Der Platz ist gesperrt – Ersatztermin folgt.</span></div>,
    dialog: <div style={{ ...karteStil, padding: 16, boxShadow: "0 12px 30px rgba(0,0,0,.18)" }} className="w-full max-w-xs flex flex-col gap-2"><b style={{ fontFamily: fontH, fontSize: 18 }} className="flex items-center gap-2"><span style={{ color: b.rand }}><S /></span>Training absagen?</b><span style={{ ...leise, fontSize: 13 }}>Alle Eltern bekommen eine Nachricht.</span><span className="flex justify-end gap-2 pt-1"><span style={{ border: `1px solid ${f.rand}`, borderRadius: voll.ecken, fontSize: 13 }} className="px-3 py-1.5 font-semibold">Abbrechen</span>{knopf("Absagen")}</span></div>,
    kalender: <div style={{ ...karteStil, borderLeft: `4px solid ${b.rand}`, padding: 10 }} className="w-full max-w-xs flex gap-3"><span style={{ background: b.bg, color: b.text, borderRadius: voll.ecken }} className="w-11 h-11 grid place-items-center text-center leading-tight"><b style={{ fontSize: 15 }}>18</b></span><span className="flex flex-col"><b style={{ fontSize: schrift }}>Training U11</b><span style={{ ...leise, fontSize: 12 }}>Mi 17:30 – 19:00 · Platz 2</span></span></div>,
    spieler: <div style={{ ...karteStil, padding: 12 }} className="w-full max-w-[220px] flex items-center gap-3"><span style={{ background: b.bg, color: b.text, borderRadius: 999 }} className="w-12 h-12 grid place-items-center font-bold">MB</span><span className="flex flex-col"><b style={{ fontSize: schrift }}>Mia Beispiel</b><span style={{ ...leise, fontSize: 12 }}>Nr. 7 · Mittelfeld</span><span style={{ color: b.rand, fontSize: 12 }} className="inline-flex items-center gap-1"><S className="w-3.5 h-3.5" />U11</span></span></div>,
    eigene: <div style={{ background: b.bg, color: b.text, border: `1px solid ${b.rand}`, borderRadius: voll.ecken, padding: 14, fontFamily: fontT }} className="w-full max-w-xs flex items-center gap-2"><S className="w-5 h-5" /><span style={{ fontSize: schrift }}>Eigener Baustein</span></div>,
  }[art];
  return <div style={{ background: f.hintergrund || voll.seite[modus], color: f.text, fontFamily: fontT }} className={`rounded-xl p-5 min-h-[180px] grid place-items-center ${handy ? "max-w-[390px] mx-auto" : "w-full"}`}>{inhalt}</div>;
}

// ---------------------------------------------------------------------------------------------------------------- Assistent
export default function BausteinAssistent({ projekt, d, toast, werte, dunkel = false, wert, setWert, onClose, onChat }) {
  const w = wert || assistentLeer();
  const setze = (k, v) => setWert((alt) => ({ ...(alt || assistentLeer()), [k]: typeof v === "function" ? v((alt || assistentLeer())[k]) : v }));
  const setzeG = (patch) => setze("g", (g) => ({ ...g, ...patch }));
  const [busy, setBusy] = useState(false); const [ergebnis, setErgebnis] = useState(null);
  const [modus, setModus] = useState(dunkel ? "dunkel" : "hell"); const [handy, setHandy] = useState(false); const [q, setQ] = useState("");
  const g = d.gruppen.find((x) => x.id === projekt.design_gruppe_id);
  const voll = useMemo(() => gestaltungVoll(w.g, werte, w.art), [w.g, werte, w.art]);
  const art = ART[w.art] || ART.knopf;
  const befunde = pruefeBaustein({ hell: voll.hell, dunkel: voll.dunkel }, voll.seite, { interaktiv: art[4], rahmenPflicht: art[5] });
  const sum = zusammenfassung(befunde);
  // Gruppen und Features dieses Projekts (ohne Design-Gruppe; d enthält nur das gewählte Projekt)
  const namen = useMemo(() => ({ gruppen: new Map(d.gruppen.map((x) => [x.id, x.name])), features: new Map(d.features.map((x) => [x.id, x.name])) }), [d.gruppen, d.features]);
  const KENNUNG = /^[A-Za-z0-9_.:-]{1,80}$/;
  const gruppen = d.gruppen.filter((x) => x.id !== projekt.design_gruppe_id && KENNUNG.test(x.id));
  const s = q.trim().toLowerCase();
  const passt = (t) => !s || String(t || "").toLowerCase().includes(s);

  const lesbar = (bf) => {
    const dk = bf.modus === "dunkel";
    if (bf.feld === "text" && voll.variante === "voll") setzeG({ [dk ? "text_dunkel" : "text"]: bf.vorschlag });
    else setzeG({ [dk ? "farbe_dunkel" : "farbe"]: bf.vorschlag });
  };
  const umschalten = (liste, id) => setze("zuweisung", (z) => { const l = z[liste]; return { ...z, [liste]: l.includes(id) ? l.filter((x) => x !== id) : l.length >= 40 ? l : [...l, id] }; });

  const bildWaehlen = (datei) => {
    if (!datei) return;
    if (!BILD_TYPEN.includes(datei.type)) { toast("Bitte ein PNG-, JPG- oder WebP-Bild wählen (kein SVG)"); return; }
    if (datei.size > BILD_MAX) { toast("Das Bild ist größer als 2 MB"); return; }
    const r = new FileReader();
    r.onload = () => { const url = String(r.result || ""); if (!/^data:image\/(png|jpeg|webp);base64,/.test(url)) { toast("Bild nicht lesbar"); return; }
      setze("bild", { url, name: datei.name.slice(0, 120), groesse: datei.size }); };
    r.readAsDataURL(datei);
  };

  const weiterOk = [w.name.trim().length >= 2 && (w.weg !== "einlesen" || !!w.bild) && (w.weg === "vorlage" || w.text.trim().length >= 10 || !!w.bild), true, true, true][w.schritt];
  const text = auftragsText(w, voll, befunde, namen);
  const bauen = async () => {
    if (!g || busy) return; setBusy(true);
    try {
      const { data, error } = await supabase.rpc("ws_design_auftrag_neu", { p_projekt: projekt.id, p_titel: w.name.trim().slice(0, 60), p_text: text,
        p_daten: assistentDaten(w, voll), p_bild: w.bild?.url || null, p_dateiname: w.bild?.name || null });
      if (error) throw error;
      setErgebnis(data); toast(`Auftrag #${data} angelegt – Baustein „${w.name.trim()}“`); setWert(assistentLeer());
    } catch (e) { toast(fehler(e)); } finally { setBusy(false); }
  };
  const chat = () => {
    onChat(`Ich lege mit dem Assistenten einen neuen Baustein an: „${w.name || "…"}“ (${art[1]}). ${w.text || ""}\nBisher: Variante ${voll.variante}, Größe ${voll.groesse}, Farbe ${voll.farbe}/${voll.farbe_dunkel}, Symbol ${voll.symbol}.${sum.pflicht ? ` Kontrast offen: ${befunde.filter((x) => !x.ok).map((x) => `${x.modus} ${x.was} ${verhaeltnis(x.wert)}`).join("; ")}.` : ""}\nWie würdest du ihn im Stil unseres Grunddesigns gestalten (Farbe, Symbol, Größe, Zustände, Handy)? Für Dorf- und Profivereine.`);
    onClose();
  };

  const Farbe = ({ k, t }) => <label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm">{t}
    <span className="flex items-center gap-1.5"><input type="color" aria-label={t} value={voll[k]} onChange={(e) => setzeG({ [k]: e.target.value.toLowerCase() })} className="w-8 h-7 rounded border border-slate-300 dark:border-slate-700 bg-transparent cursor-pointer" />
      <span className="font-mono text-xs w-[64px]">{voll[k]}</span></span></label>;

  return (
    <div className="fixed inset-0 z-40 bg-black/45 p-3 sm:p-6 overflow-auto" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Neuer Baustein – Assistent" className={`${card} w-full max-w-5xl mx-auto flex flex-col shadow-xl`}>
        <div className="flex items-center gap-2 p-3 border-b border-slate-200 dark:border-slate-800">
          <button type="button" className={ghost} onClick={onClose} title="Eingaben bleiben erhalten"><ArrowLeft className="w-4 h-4" />Zurück zum Designer</button>
          <h3 className="font-display font-bold text-xl flex items-center gap-2 ml-1"><Shapes className="w-5 h-5 text-emerald-700" aria-hidden="true" />Neuer Baustein</h3>
          <ol className="ml-auto hidden md:flex items-center gap-1" aria-label="Schritte">{SCHRITTE.map((t, i) => (
            <li key={t}><button type="button" disabled={!!ergebnis} onClick={() => { if (i <= w.schritt || (i === w.schritt + 1 && weiterOk)) setze("schritt", i); }} aria-current={w.schritt === i ? "step" : undefined}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-sm font-semibold ${w.schritt === i ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : i < w.schritt ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"}`}>
              <span className={`w-5 h-5 grid place-items-center rounded-full text-[11px] ${w.schritt === i ? "bg-emerald-700 text-white" : i < w.schritt ? "bg-emerald-100 dark:bg-emerald-900" : "bg-slate-100 dark:bg-slate-800"}`}>{i < w.schritt ? <Check className="w-3 h-3" /> : i + 1}</span>{t}</button></li>))}</ol>
          <button type="button" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 md:ml-1 ml-auto" onClick={onClose} aria-label="Schließen"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 min-h-[420px]">
          {ergebnis ? (
            <div className="max-w-lg mx-auto flex flex-col items-center text-center gap-3 py-8">
              <CircleCheck className="w-10 h-10 text-green-600" aria-hidden="true" />
              <h4 className="font-display font-bold text-xl">Auftrag #{ergebnis} ist unterwegs</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300">Claude baut den Baustein in der Werkstatt. Danach: deine Freigabe, Sicherheitsprüfung, Zusammenführen, Prüfung in der Testfassung, live. Den Stand siehst du im App-Designer › Bausteine und unter „Übernehmen“.</p>
              <BausteinAuftraege d={d} projekt={projekt} nur={ergebnis} />
              <div className="flex gap-2"><button type="button" className={ghost} onClick={() => setErgebnis(null)}>Noch einen Baustein</button><button type="button" className={btn} onClick={onClose}><Check className="w-4 h-4" />Fertig</button></div>
            </div>
          ) : w.schritt === 0 ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <section className="flex flex-col gap-3" aria-label="Was soll es werden?">
                <h4 className="font-display font-bold text-[17px]">1 · Was soll es werden?</h4>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Weg">{WEGE.map(([k, t, I, info]) => (
                  <button key={k} type="button" role="radio" aria-checked={w.weg === k} onClick={() => setze("weg", k)} title={info}
                    className={`rounded-xl border p-2.5 flex flex-col items-center gap-1 text-sm font-semibold ${w.weg === k ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200" : "border-slate-200 dark:border-slate-800 hover:border-emerald-500"}`}><I className="w-5 h-5" aria-hidden="true" />{t}</button>))}</div>
                <p className="text-xs text-slate-500">{WEGE.find(([k]) => k === w.weg)?.[3]}</p>
                <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">Name<input id="cs-bs-name" className={input} value={w.name} maxLength={60} onChange={(e) => setze("name", e.target.value)} placeholder="z. B. Download-Knopf für Trainingspläne" autoFocus /></label>
                <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">{w.weg === "vorlage" ? "Was soll anders sein? (optional)" : "Beschreibung – was soll er zeigen und können?"}
                  <textarea id="cs-bs-text" className={`${input} min-h-[110px]`} value={w.text} maxLength={6000} onChange={(e) => setze("text", e.target.value)} placeholder="z. B. lädt den Plan als PDF, zeigt Dateigröße und einen Fortschritt. Am Handy nur das Symbol." /></label>
                <p className="text-xs text-slate-500">Bitte keine Daten von Vereinsmitgliedern oder Kindern hineinschreiben.</p>
                {w.weg === "einlesen" && (
                  <div className="flex flex-col gap-2">
                    {!w.bild ? (
                      <label className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center text-xs cursor-pointer hover:border-emerald-600"
                        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); bildWaehlen(e.dataTransfer.files?.[0]); }}>
                        <ImagePlus className="w-6 h-6 text-emerald-700" aria-hidden="true" /><b className="text-sm">Bild, Screenshot oder Skizze hierher ziehen oder auswählen</b>
                        <span className="text-slate-500">PNG, JPG oder WebP · bis 2 MB · hängt nur an diesem Auftrag und wird nach dem Abschluss gelöscht</span>
                        <input id="cs-bs-bild" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { bildWaehlen(e.target.files?.[0]); e.target.value = ""; }} />
                      </label>
                    ) : (
                      <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-2">
                        <img src={w.bild.url} alt="Vorlage für den Baustein" className="w-24 h-16 object-contain rounded bg-white ring-1 ring-black/5" />
                        <span className="flex-1 min-w-0 text-xs text-slate-500 break-words">{w.bild.name} · {Math.round(w.bild.groesse / 1024)} KB</span>
                        <button type="button" className={ghost} onClick={() => setze("bild", null)} aria-label="Bild entfernen"><Trash2 className="w-4 h-4" /></button>
                      </div>)}
                    <p className="text-xs rounded-lg px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />Keine Fotos von Personen (vor allem Kindern) und keine echten Namen im Bild – nur Screenshots, Muster oder Skizzen.</p>
                  </div>)}
              </section>
              <section className="flex flex-col gap-2" aria-label="Art">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Art</h4>
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5 gap-1.5" role="radiogroup" aria-label="Art des Bausteins">{ARTEN.map(([k, t, I]) => (
                  <button key={k} type="button" role="radio" aria-checked={w.art === k} onClick={() => { setze("art", k); setzeG({ symbol: undefined }); }}
                    className={`rounded-lg border px-1.5 py-2 flex flex-col items-center gap-1 text-[12px] font-semibold text-center leading-tight ${w.art === k ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200" : "border-slate-200 dark:border-slate-800 hover:border-emerald-500"}`}><I className="w-5 h-5" aria-hidden="true" />{t}</button>))}</div>
                <div className="mt-2"><Muster art={w.art} voll={voll} modus={modus} werte={werte} handy={false} /></div>
                <p className="text-xs text-slate-500">Vorschau im Stil von {projekt.name} – im nächsten Schritt gestaltest du sie.</p>
              </section>
            </div>
          ) : w.schritt === 1 ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <section className="flex flex-col gap-2 min-w-0" aria-label="Vorschau">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-display font-bold text-[17px] flex-1">2 · Gestalten – Vorschau im Stil von {projekt.name}</h4>
                  <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">{[[false, "PC", Monitor], [true, "Handy", Smartphone]].map(([h, t, I]) => <button key={t} type="button" aria-pressed={handy === h} onClick={() => setHandy(h)} title={t} className={`p-1.5 rounded-md ${handy === h ? "bg-white dark:bg-slate-900 shadow-sm" : ""}`}><I className="w-4 h-4" /></button>)}</div>
                  <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">{[["hell", "Hell", Sun], ["dunkel", "Dunkel", Moon]].map(([m, t, I]) => <button key={m} type="button" aria-pressed={modus === m} onClick={() => setModus(m)} title={t} className={`p-1.5 rounded-md ${modus === m ? "bg-white dark:bg-slate-900 shadow-sm" : ""}`}><I className="w-4 h-4" /></button>)}</div>
                </div>
                <Muster art={w.art} voll={voll} modus={modus} werte={werte} handy={handy} />
                <div className="grid sm:grid-cols-2 gap-2"><Muster art={w.art} voll={voll} modus={modus === "hell" ? "dunkel" : "hell"} werte={werte} handy /></div>
                <section aria-label="Kontrast-Wächter" className={`rounded-lg border p-2 flex flex-col gap-1 ${sum.pflicht ? "border-red-300 dark:border-red-900 bg-red-50/60 dark:bg-red-950/30" : sum.hinweise ? "border-amber-300 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30" : "border-green-300 dark:border-green-900 bg-green-50/60 dark:bg-green-950/30"}`}>
                  <h5 className="text-xs font-bold flex items-center gap-1"><Contrast className="w-3.5 h-3.5" aria-hidden="true" />Kontrast-Wächter · {sum.pflicht ? `${sum.pflicht} schlecht lesbar` : sum.hinweise ? `${sum.hinweise} Hinweis${sum.hinweise === 1 ? "" : "e"}` : "alles lesbar"}</h5>
                  <ul className="flex flex-col gap-1">{befunde.map((x, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs">
                      {x.ok ? <CircleCheck className="w-3.5 h-3.5 text-green-600 shrink-0" aria-label="in Ordnung" /> : x.stufe === "pflicht" ? <CircleAlert className="w-3.5 h-3.5 text-red-600 shrink-0" aria-label="zu wenig Kontrast" /> : <TriangleAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-label="Hinweis" />}
                      <span className="flex-1 min-w-0">{x.modus === "hell" ? "Hell" : "Dunkel"}: {x.was} <span className="text-slate-500">{verhaeltnis(x.wert)} (mind. {String(x.soll).replace(".", ",")})</span></span>
                      {!x.ok && x.vorschlag && <button type="button" className="text-[11px] font-semibold rounded-md border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 hover:bg-white dark:hover:bg-slate-900 inline-flex items-center gap-1" onClick={() => lesbar(x)}>
                        <i className="w-3 h-3 rounded-sm border border-black/10" style={{ background: x.vorschlag }} aria-hidden="true" />lesbar machen</button>}
                    </li>))}</ul>
                  <p className="text-[10px] text-slate-500">Text mind. 4,5 : 1, Bedienelemente mind. 3 : 1 (WCAG 2.1 AA), hell und dunkel. Bauen geht trotzdem – Claude setzt es lesbar um.</p>
                </section>
              </section>
              <aside className="flex flex-col gap-3 text-sm" aria-label="Einstellungen">
                <div className="flex flex-col gap-1.5"><h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">Farbe</h5>
                  <Farbe k="farbe" t="Hauptfarbe (hell)" /><Farbe k="farbe_dunkel" t="Hauptfarbe (dunkel)" />
                  {voll.variante === "voll" && <><Farbe k="text" t="Schrift (hell)" /><Farbe k="text_dunkel" t="Schrift (dunkel)" /></>}
                  <button type="button" className="text-xs text-emerald-700 dark:text-emerald-400 underline self-start" onClick={() => setzeG({ farbe: undefined, farbe_dunkel: undefined, text: undefined, text_dunkel: undefined })}>Farben aus dem Grunddesign</button></div>
                <div className="flex flex-col gap-1"><span>Variante</span>
                  <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold w-max" role="radiogroup" aria-label="Variante">{VARIANTEN.map(([v, t]) => <button key={v} type="button" role="radio" aria-checked={voll.variante === v} onClick={() => setzeG({ variante: v })} className={`px-2.5 py-1 rounded-md ${voll.variante === v ? "bg-white dark:bg-slate-900 shadow-sm" : ""}`}>{t}</button>)}</div></div>
                <div className="flex flex-col gap-1"><span>Größe</span>
                  <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold w-max" role="radiogroup" aria-label="Größe">{GROESSEN.map(([v, t]) => <button key={v} type="button" role="radio" aria-checked={voll.groesse === v} onClick={() => setzeG({ groesse: v })} className={`px-2.5 py-1 rounded-md ${voll.groesse === v ? "bg-white dark:bg-slate-900 shadow-sm" : ""}`}>{t}</button>)}</div></div>
                <label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">Ecken
                  <span className="flex items-center gap-2"><input type="range" min={0} max={32} value={voll.ecken} onChange={(e) => setzeG({ ecken: Number(e.target.value) })} className="w-28 accent-emerald-700" /><span className="w-10 text-right tabular-nums text-xs">{voll.ecken} px</span></span></label>
                <div className="flex flex-col gap-1"><span className="flex items-center gap-2">Symbol <span className="text-xs text-slate-500 font-mono">{voll.symbol}</span><Suspense fallback={null}><SymbolZeichen name={voll.symbol} /></Suspense></span>
                  <Suspense fallback={<Loader2 className="w-4 h-4 animate-spin text-emerald-700" />}><SymbolWahl wert={voll.symbol} onWahl={(n) => setzeG({ symbol: n })} /></Suspense></div>
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 p-2.5 flex flex-col gap-1.5">
                  <p className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5"><Bot className="w-4 h-4 shrink-0 text-emerald-700" aria-hidden="true" />Unsicher? Frag im Design-Chat – Claude kennt das Grunddesign. Deine Eingaben bleiben hier erhalten.</p>
                  <button type="button" className={ghost} onClick={chat}><Bot className="w-4 h-4" />Im Design-Chat fragen</button></div>
              </aside>
            </div>
          ) : w.schritt === 2 ? (
            <section className="flex flex-col gap-3" aria-label="Zuweisen">
              <div className="flex flex-wrap items-center gap-2"><h4 className="font-display font-bold text-[17px] flex-1">3 · Zuweisen – wo soll der Baustein verwendet werden?</h4>
                <span className="text-xs text-slate-500">{w.zuweisung.gruppen.length} Gruppe{w.zuweisung.gruppen.length === 1 ? "" : "n"} · {w.zuweisung.features.length} Feature{w.zuweisung.features.length === 1 ? "" : "s"}</span></div>
              <label className="relative max-w-sm"><Search className="w-4 h-4 absolute left-2.5 top-2 text-slate-400" aria-hidden="true" /><span className="sr-only">Gruppe oder Feature suchen</span>
                <input className={`${input} pl-8`} placeholder="Gruppe oder Feature suchen" value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} /></label>
              {!gruppen.length ? <p className="text-sm text-slate-500">Dieses Projekt hat noch keine Gruppen – der Baustein kommt dann zuerst nur in die Bibliothek.</p> : (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 max-h-[440px] overflow-auto pr-1">
                  {gruppen.map((gr) => { const fs = d.features.filter((f) => f.gruppe_id === gr.id && KENNUNG.test(f.id)); const sichtbar = passt(gr.name) || fs.some((f) => passt(f.name) || passt(f.id)); if (!sichtbar) return null;
                    const bereich = d.bereiche.find((b) => b.id === gr.bereich_id); return (
                      <div key={gr.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2">
                        <label className="flex items-center gap-2 font-semibold text-sm"><input type="checkbox" className="accent-emerald-700 w-4 h-4" checked={w.zuweisung.gruppen.includes(gr.id)} onChange={() => umschalten("gruppen", gr.id)} />
                          <span className="flex-1 min-w-0 truncate">{gr.name}</span>{bereich && <span className="text-[11px] text-slate-500 font-normal truncate max-w-[40%]">{bereich.global ? "Global" : bereich.name}</span>}</label>
                        {fs.length > 0 && <ul className="mt-1 pl-6 flex flex-col gap-0.5">{fs.filter((f) => passt(f.name) || passt(f.id) || passt(gr.name)).slice(0, 30).map((f) => (
                          <li key={f.id}><label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-emerald-700" checked={w.zuweisung.features.includes(f.id)} onChange={() => umschalten("features", f.id)} />
                            <span className="font-mono text-slate-500">{f.id}</span><span className="truncate">{f.name}</span></label></li>))}</ul>}
                      </div>); })}
                </div>)}
              <p className="text-xs text-slate-500">Höchstens 40 Gruppen und 40 Features. Ohne Häkchen wird der Baustein nur in die Bibliothek und die Galerie aufgenommen.</p>
            </section>
          ) : (
            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" aria-label="Bauen lassen">
              <div className="flex flex-col gap-3">
                <h4 className="font-display font-bold text-[17px]">4 · Als Auftrag bauen lassen</h4>
                <p className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2"><Hammer className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" aria-hidden="true" />Ein neuer Baustein ist neuer Code: Claude baut ihn als Auftrag in der Design-Gruppe, mit Prüfungen und deiner Freigabe. Erst danach ist er in der App verfügbar.</p>
                <dl className="text-sm grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
                  <dt className="text-slate-500">Name</dt><dd className="font-semibold break-words">{w.name}</dd>
                  <dt className="text-slate-500">Art</dt><dd>{art[1]} · {WEGE.find(([k]) => k === w.weg)?.[1]}{w.bild ? " · mit Bild-Vorlage" : ""}</dd>
                  <dt className="text-slate-500">Gestaltung</dt><dd className="flex items-center gap-1.5 flex-wrap"><i className="w-3.5 h-3.5 rounded border border-black/10" style={{ background: voll.farbe }} aria-hidden="true" /><i className="w-3.5 h-3.5 rounded border border-black/10" style={{ background: voll.farbe_dunkel }} aria-hidden="true" />{VARIANTEN.find(([v]) => v === voll.variante)?.[1]} · {GROESSEN.find(([v]) => v === voll.groesse)?.[1]} · {voll.ecken} px · {voll.symbol}</dd>
                  <dt className="text-slate-500">Kontrast</dt><dd className={sum.pflicht ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-400"}>{sum.pflicht ? `${sum.pflicht} Prüfung(en) offen – Claude setzt es lesbar um` : "alles lesbar"}</dd>
                  <dt className="text-slate-500">Zuweisung</dt><dd>{w.zuweisung.gruppen.length + w.zuweisung.features.length ? [...w.zuweisung.gruppen.map((x) => namen.gruppen.get(x) || x), ...w.zuweisung.features.map((x) => namen.features.get(x) || x)].join(", ") : "noch keine (nur Bibliothek)"}</dd>
                </dl>
                {!g && <p className="text-sm text-red-700 dark:text-red-300">Der App-Designer ist für dieses Projekt noch nicht eingerichtet.</p>}
                <div className="flex flex-wrap gap-2 items-center">
                  <button type="button" className={btn} disabled={busy || !g || w.name.trim().length < 2} onClick={bauen}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Als Auftrag bauen lassen</button>
                  <span className="text-xs text-slate-500 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />Freigabe → Sicherheitsprüfung → Zusammenführen → Testfassung → live</span>
                </div>
                <BausteinAuftraege d={d} projekt={projekt} />
              </div>
              <label className="flex flex-col gap-1 text-sm text-slate-500 min-w-0">Auftragstext (so bekommt ihn die Werkstatt, zusammen mit den geprüften Angaben)
                <textarea readOnly value={text} rows={16} className={`${input} font-mono text-xs`} /></label>
            </section>
          )}
        </div>

        {!ergebnis && <div className="flex items-center gap-2 p-3 border-t border-slate-200 dark:border-slate-800">
          <button type="button" className={ghost} disabled={w.schritt === 0} onClick={() => setze("schritt", w.schritt - 1)}><ArrowLeft className="w-4 h-4" />Zurück</button>
          <span className="flex-1 text-xs text-slate-500 text-center">Schritt {w.schritt + 1} von 4 · {SCHRITTE[w.schritt]}</span>
          {w.schritt < 3 && <button type="button" className={btn} disabled={!weiterOk} onClick={() => setze("schritt", w.schritt + 1)}
            title={!weiterOk ? (w.weg === "einlesen" && !w.bild ? "Bitte ein Bild wählen" : "Bitte Namen und Beschreibung (mind. 10 Zeichen) angeben") : ""}>Weiter<ArrowRight className="w-4 h-4" /></button>}
        </div>}
      </div>
    </div>);
}

// ---------------------------------------------------------------------------------------------------------------- Auftragsstatus
const STAND = { wartet: ["Wartet auf die Werkstatt", "amber"], laeuft: ["Claude baut", "blue"], frage: ["Rückfrage an dich", "amber"], nacharbeit: ["Nacharbeit", "amber"],
  freigabe: ["Wartet auf Freigabe", "violet"], sicherheit: ["Sicherheitsprüfung", "blue"], zusammen: ["Zusammenführen", "violet"], feature: ["Prüfung in der Testfassung", "blue"],
  wissen: ["Fertig (Testfassung/live)", "green"], erledigt: ["Erledigt", "green"] };
const FARBE = { amber: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300", blue: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300", green: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" };
export const istDesignAuftrag = (a, projekt) => a.gruppe_id === projekt.design_gruppe_id && /^(Neuer Baustein: |Neue Kachel für den Seiten-Designer: )/.test(String(a.titel || ""));
export const standText = (s) => STAND[s]?.[0] || s;

/** Liste der Baustein-/Kachel-Aufträge des Designers mit Stand (live aus d.auftraege). */
export function BausteinAuftraege({ d, projekt, nur = null, offen = false, max = 6 }) {
  const liste = d.auftraege.filter((a) => istDesignAuftrag(a, projekt) && (nur == null || a.id === nur) && (!offen || !["wissen", "erledigt"].includes(a.stand)))
    .sort((a, b) => b.id - a.id).slice(0, max);
  if (!liste.length) return nur == null ? <p className="text-xs text-slate-500">Noch keine neuen Bausteine als Auftrag.</p> : <p className="text-xs text-slate-500 inline-flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" />Auftrag wird geladen …</p>;
  return (
    <ul className="flex flex-col gap-1 w-full text-left" aria-label="Aufträge für neue Bausteine">{liste.map((a) => { const [t, c] = STAND[a.stand] || [a.stand, "amber"]; return (
      <li key={a.id} className="flex items-center gap-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5">
        <span className="font-mono text-slate-500">#{a.id}</span><span className="flex-1 min-w-0 truncate font-semibold" title={a.titel}>{String(a.titel).replace(/^Neuer Baustein: |^Neue Kachel für den Seiten-Designer: /, "")}</span>
        <span className={`rounded-full px-2 py-0.5 font-semibold whitespace-nowrap ${FARBE[c]}`}>{a.offeneFrage ? "Rückfrage an dich" : t}</span></li>); })}</ul>);
}
