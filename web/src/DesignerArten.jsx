import React from "react";
import { Home, Users, Calendar, Trophy, Settings, ClipboardList, BarChart3, Search, Bell, Sparkles, Heart, ShoppingCart } from "lucide-react";

// App-Designer nach App-Art (Entwurf 1.0, freigegeben von Gerhard 2026-10-23 18:56): Vorschau und Einstellungen passen sich der Art an,
// die Beispieltexte kommen aus dem Konzept (Design-Chat „[Beispiele]“). Beispiele sind nur Vorschau – reiner Text, nie CSS.
export const APP_ARTEN = [
  ["verwaltung", "Verwaltungs-App", "Listen, Formulare, Kennzahlen"],
  ["spiel", "Spiel", "Spielfeld, Punkte, Figuren, Spielknöpfe"],
  ["webseite", "Webseite", "Startseite, Abschnitte, Kontakt"],
  ["shop", "Shop / Buchung", "Produkte oder Termine, Warenkorb, Kasse"],
];
export const ART_BASIS = {
  spiel: { feld: "#14532d", figur: "#f59e0b", figur_form: "rund", punkte: "oben", knoepfe: "gross" },
  webseite: { start: "gross", abschnitte: "spalten", fuss: "dunkel" },
  shop: { karten: "bild", korb: "rechts" },
};

// Allgemeine Muster je Art (erfunden, keine echten Personen); Trainer to go behält seine bisherigen Muster
const STANDARD = {
  verwaltung: { titel: "Übersicht", menue: ["Start", "Einträge", "Kalender", "Auswertung", "Einstellungen"], liste: "Neueste Einträge", knopf: "Neuer Eintrag",
    kacheln: [["Einträge", "128"], ["Offen", "7"], ["Diese Woche", "+12"], ["Erledigt", "94 %"]],
    zeilen: [["Eintrag A", "heute", "offen"], ["Eintrag B", "gestern", "erledigt"], ["Eintrag C", "Fr", "Frist morgen"]] },
  spiel: { spiel: { titel: "Level 3", punkte: "01 250", leben: "♥♥♥", knoepfe: ["◀", "Springen", "▶", "Pause"] } },
  webseite: { webseite: { name: "Meine Seite", held: "Willkommen", text: "Ein kurzer Satz, worum es auf dieser Seite geht.", cta: "Mehr erfahren", teile: ["Angebot", "Über uns", "Kontakt"] } },
  shop: { shop: { produkte: [["Artikel 1", "€ 12,90"], ["Artikel 2", "€ 24,00"], ["Artikel 3", "€ 8,50"]], korb: [["Artikel 1", "€ 12,90"], ["Artikel 3", "€ 8,50"]], kasse: "Zur Kasse" } },
};
const TTG = { titel: "Übersicht", menue: ["Start", "Mannschaft", "Kalender", "Spiele", "Einstellungen"], liste: "Nächste Termine", knopf: "Neuer Termin",
  kacheln: [["Spieler", "24"], ["Trainings", "3"], ["Anwesenheit", "92 %"], ["Nächstes Spiel", "Sa"]],
  zeilen: [["Training U13", "Di 17:30", "Zugesagt 14"], ["Heimspiel gegen SV Muster", "Sa 10:00", "Offen 6"], ["Elternabend", "Mo 19:00", "Frist morgen"]] };

// Gleiche Grenzen wie ws_beispiele_ok (Datenbank 0022) – unpassende Werte fallen weg, statt die Vorschau zu stören
const text = (v, n) => (typeof v === "string" && v.trim() && v.length <= n && !/[<>{}\\`\n\r]/.test(v) ? v : null);
const liste = (v, anz, n) => (Array.isArray(v) ? v.map((x) => text(x, n)).filter(Boolean).slice(0, anz) : null);
const zeilen = (v, anz, sp, n) => (Array.isArray(v) ? v.filter(Array.isArray).map((r) => r.slice(0, sp).map((x) => text(x, n) || "")).filter((r) => r.some(Boolean)).slice(0, anz) : null);
const nichtLeer = (o) => Object.fromEntries(Object.entries(o).filter(([, x]) => x != null && !(Array.isArray(x) && !x.length) && !(typeof x === "object" && !Array.isArray(x) && !Object.keys(x).length)));
export function beispieleBereinigen(b) {
  if (!b || typeof b !== "object" || Array.isArray(b)) return undefined;
  const r = nichtLeer({ titel: text(b.titel, 40), knopf: text(b.knopf, 40), liste: text(b.liste, 40), menue: liste(b.menue, 7, 24), kacheln: zeilen(b.kacheln, 4, 2, 24), zeilen: zeilen(b.zeilen, 5, 4, 40) });
  if (b.spiel && typeof b.spiel === "object") { const s = nichtLeer({ titel: text(b.spiel.titel, 30), punkte: text(b.spiel.punkte, 30), leben: text(b.spiel.leben, 30), knoepfe: liste(b.spiel.knoepfe, 4, 14) }); if (Object.keys(s).length) r.spiel = s; }
  if (b.webseite && typeof b.webseite === "object") { const s = nichtLeer({ name: text(b.webseite.name, 60), held: text(b.webseite.held, 60), cta: text(b.webseite.cta, 60), text: text(b.webseite.text, 200), teile: liste(b.webseite.teile, 4, 24) }); if (Object.keys(s).length) r.webseite = s; }
  if (b.shop && typeof b.shop === "object") { const s = nichtLeer({ produkte: zeilen(b.shop.produkte, 6, 2, 30), korb: zeilen(b.shop.korb, 6, 2, 30), kasse: text(b.shop.kasse, 24) }); if (Object.keys(s).length) r.shop = s; }
  return Object.keys(r).length ? r : undefined;
}
/** Muster-Inhalte für die Vorschau: Standard der Art (bzw. Trainer to go) + angepasste Beispiele aus dem Entwurf. */
export function beispieleFuer(projekt, art, w) {
  const basis = art === "verwaltung" && projekt?.id === "trainer-to-go" ? TTG : STANDARD[art] || STANDARD.verwaltung;
  const b = w?.beispiele || {};
  const r = { ...STANDARD.verwaltung, ...basis, ...Object.fromEntries(Object.entries(b).filter(([k]) => !["spiel", "webseite", "shop"].includes(k))) };
  for (const k of ["spiel", "webseite", "shop"]) r[k] = { ...(STANDARD[k]?.[k] || {}), ...(b[k] || {}) };
  return r;
}

const SYMBOLE = [Home, ClipboardList, Calendar, BarChart3, Settings, Users, Trophy];
export const menueSymbol = (i, n) => (i === n - 1 && n > 2 ? Settings : SYMBOLE[i % SYMBOLE.length]);

/** Einstellungen, die nur für diese Art gelten. */
export function ArtEinstellungen({ art, w, wahl, farbe, onBeispiele, bearbeitbar, Abschnitt, Feld }) {
  return (
    <>
      {art === "spiel" && <Abschnitt titel="Spiel-Bausteine">
        <Feld label="Spielfeld-Farbe">{farbe(["spiel", "feld"])}</Feld>
        <Feld label="Figuren-Farbe">{farbe(["spiel", "figur"])}</Feld>
        <Feld label="Figuren-Stil">{wahl(["spiel", "figur_form"], [["rund", "Rund"], ["kantig", "Kantig"], ["pixel", "Pixel"]])}</Feld>
        <Feld label="Punkteanzeige">{wahl(["spiel", "punkte"], [["oben", "Oben"], ["aus", "Aus"]])}</Feld>
        <Feld label="Spielknöpfe">{wahl(["spiel", "knoepfe"], [["gross", "Groß (Handy)"], ["klein", "Klein"]])}</Feld>
        <p className="text-xs text-slate-500">Tabellen-Varianten braucht ein Spiel nicht – Menü und Farben gelten für Start- und Pausenbildschirm.</p>
      </Abschnitt>}
      {art === "webseite" && <Abschnitt titel="Webseite">
        <Feld label="Startbereich">{wahl(["webseite", "start"], [["gross", "Groß"], ["schlicht", "Schlicht"]])}</Feld>
        <Feld label="Abschnitte">{wahl(["webseite", "abschnitte"], [["spalten", "Spalten"], ["untereinander", "Untereinander"]])}</Feld>
        <Feld label="Fußzeile">{wahl(["webseite", "fuss"], [["dunkel", "Dunkel"], ["hell", "Hell"]])}</Feld>
      </Abschnitt>}
      {art === "shop" && <Abschnitt titel="Shop / Buchung">
        <Feld label="Produktkarten">{wahl(["shop", "karten"], [["bild", "Mit Bild"], ["liste", "Als Liste"]])}</Feld>
        <Feld label="Warenkorb">{wahl(["shop", "korb"], [["rechts", "Rechts"], ["unten", "Unten"]])}</Feld>
      </Abschnitt>}
      <div className="rounded-lg border border-dashed border-emerald-500 p-2.5 my-2 text-xs flex flex-col gap-1.5">
        <b className="text-sm flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-emerald-700" />Beispiele aus dem Konzept</b>
        <span className="text-slate-500">Claude ersetzt Menüpunkte, Kennzahlen und Beispieltexte der Vorschau durch passende aus eurem Konzept (nur Beispieldaten).</span>
        <button type="button" disabled={!bearbeitbar} onClick={onBeispiele} className="self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-semibold">Beispiele anpassen</button>
        {w.beispiele && <span className="text-slate-500">Dieser Entwurf hat eigene Beispiele.</span>}
      </div>
    </>);
}

/** Muster-Oberflächen für Spiel, Webseite, Shop (Verwaltungs-App = bisheriges Gerüst). */
export function ArtMuster({ art, w, f, fo, s, fontH, fontT, bsp, geraet, schatten }) {
  const handy = geraet === "handy";
  if (art === "spiel") {
    const sp = w.spiel; const b = bsp.spiel; const form = { rund: "50%", kantig: "8px", pixel: "2px" }[sp.figur_form];
    const gross = sp.knoepfe === "gross";
    return (
      <div style={{ background: sp.feld, color: "#fff", fontFamily: fontT, fontSize: s.basis }} className="min-h-[480px] grid grid-rows-[auto_1fr_auto]">
        <div style={{ fontFamily: fontH, fontWeight: s.gewicht, fontSize: s.basis * 1.3, padding: `${fo.abstand * 0.6}px ${fo.abstand}px` }} className="flex items-center justify-between tabular-nums">
          <span>{b.titel}</span>{sp.punkte === "oben" && <><span>{b.punkte}</span><span style={{ color: sp.figur }} className="inline-flex items-center gap-0.5"><Heart size={16} fill="currentColor" />{b.leben}</span></>}
        </div>
        <div style={{ margin: `0 ${fo.abstand}px`, borderRadius: fo.radius_karte, backgroundImage: "repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 40px,transparent 40px 80px)" }} className="relative border-2 border-white/20 min-h-[260px]">
          <i style={{ left: "18%", top: "60%", width: 38, height: 38, background: sp.figur, borderRadius: form, imageRendering: "pixelated" }} className="absolute shadow-[0_0_0_3px_rgba(0,0,0,.25)]" />
          <i style={{ left: "62%", top: "28%", width: 28, height: 28, background: f.fehler, borderRadius: fo.radius }} className="absolute" />
          <i style={{ left: "80%", top: "66%", width: 28, height: 28, background: f.fehler, borderRadius: fo.radius }} className="absolute" />
          <span style={{ left: "44%", top: "50%", background: f.warnung }} className="absolute w-3 h-3 rounded-full" />
        </div>
        <div style={{ gap: fo.abstand * 0.5, padding: fo.abstand }} className="flex justify-center flex-wrap">
          {(b.knoepfe || []).map((k, i) => (
            <span key={i} style={{ borderRadius: fo.radius, fontFamily: fontH, fontWeight: s.gewicht, padding: gross ? "12px 22px" : "6px 12px", fontSize: gross ? s.basis * 1.15 : s.basis * 0.9,
              ...(i === 1 ? { background: sp.figur, color: "#1c1300" } : { background: "rgba(255,255,255,.12)", border: "2px solid rgba(255,255,255,.35)" }) }}>{k}</span>))}
        </div>
      </div>);
  }
  if (art === "webseite") {
    const ws = w.webseite; const b = bsp.webseite;
    return (
      <div style={{ background: f.hintergrund, color: f.text, fontFamily: fontT, fontSize: s.basis }} className="min-h-[480px] flex flex-col">
        <header style={{ borderColor: f.rand, padding: `${fo.abstand * 0.6}px ${fo.abstand}px` }} className="flex items-center gap-3 border-b">
          <b style={{ fontFamily: fontH, fontWeight: s.gewicht, color: f.primaer, fontSize: s.basis * 1.3 }}>{b.name}</b>
          {!handy && <span style={{ color: f.text_leise }} className="ml-auto flex gap-4 text-[0.9em]">{(b.teile || []).map((t) => <span key={t}>{t}</span>)}</span>}
          {handy && <span className="ml-auto">☰</span>}
        </header>
        <section style={{ padding: ws.start === "gross" ? `${fo.abstand * 3}px ${fo.abstand}px` : `${fo.abstand * 1.4}px ${fo.abstand}px`, background: ws.start === "gross" ? `linear-gradient(0deg, ${f.hintergrund}, ${f.primaer}18)` : f.hintergrund }}>
          <h2 style={{ fontFamily: fontH, fontWeight: s.gewicht, fontSize: s.basis * (ws.start === "gross" ? 2.4 : 1.7), lineHeight: 1.1 }}>{b.held}</h2>
          <p style={{ color: f.text_leise, maxWidth: "46ch" }} className="my-2">{b.text}</p>
          <span style={{ background: f.primaer, color: f.primaer_text, borderRadius: fo.radius }} className="inline-block px-4 py-2 font-semibold">{b.cta}</span>
        </section>
        <div style={{ gap: fo.abstand, padding: fo.abstand }} className={`grid ${ws.abschnitte === "spalten" && !handy ? "grid-cols-3" : "grid-cols-1"}`}>
          {(b.teile || []).map((t) => <div key={t} style={{ background: f.flaeche, borderColor: f.rand, borderRadius: fo.radius_karte, boxShadow: schatten, padding: fo.abstand }} className="border"><b style={{ fontFamily: fontH }}>{t}</b><p style={{ color: f.text_leise }} className="text-[0.85em] mt-1">Kurzer Beispieltext zu diesem Abschnitt.</p></div>)}
        </div>
        <footer style={{ background: ws.fuss === "dunkel" ? f.text : f.flaeche, color: ws.fuss === "dunkel" ? f.hintergrund : f.text_leise, borderColor: f.rand, padding: `${fo.abstand * 0.7}px ${fo.abstand}px` }} className="mt-auto border-t text-[0.8em]">© 2026 {b.name} · Impressum · Datenschutz</footer>
      </div>);
  }
  if (art === "shop") {
    const sh = w.shop; const b = bsp.shop; const unten = sh.korb === "unten" || handy;
    return (
      <div style={{ background: f.hintergrund, color: f.text, fontFamily: fontT, fontSize: s.basis, padding: fo.abstand, gap: fo.abstand }} className={`min-h-[480px] grid ${unten ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_220px]"} content-start`}>
        <div style={{ gap: fo.abstand * 0.7 }} className={sh.karten === "bild" ? "grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] content-start" : "flex flex-col"}>
          {(b.produkte || []).map(([n, p], i) => (
            <div key={i} style={{ background: f.flaeche, borderColor: f.rand, borderRadius: fo.radius_karte, boxShadow: schatten }} className={`border overflow-hidden ${sh.karten === "liste" ? "flex items-center gap-3 p-2" : ""}`}>
              {sh.karten === "bild" ? <i style={{ background: f.primaer + "1f" }} className="block h-20" /> : <i style={{ background: f.primaer + "1f", borderRadius: fo.radius }} className="block w-10 h-10 shrink-0" />}
              <div className={sh.karten === "bild" ? "p-2.5" : "flex-1 flex items-center justify-between gap-2"}><b className="block">{n}</b><span style={{ color: f.primaer }} className="font-semibold tabular-nums">{p}</span></div>
            </div>))}
        </div>
        <aside style={{ background: f.flaeche, borderColor: f.rand, borderRadius: fo.radius_karte, padding: fo.abstand * 0.8, gap: 6 }} className="border flex flex-col self-start tabular-nums">
          <b style={{ fontFamily: fontH }} className="flex items-center gap-1.5"><ShoppingCart size={16} />Warenkorb</b>
          {(b.korb || []).map(([n, p], i) => <div key={i} className="flex justify-between text-[0.9em]"><span>{n}</span><span>{p}</span></div>)}
          <span style={{ background: f.primaer, color: f.primaer_text, borderRadius: fo.radius }} className="text-center py-2 font-semibold mt-1">{b.kasse}</span>
        </aside>
      </div>);
  }
  return null;
}
export { Search, Bell };
