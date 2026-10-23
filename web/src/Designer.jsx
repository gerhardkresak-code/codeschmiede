import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Palette, Shapes, Stamp, Save, Send, Copy, Plus, Trash2, Undo2, Redo2, History, GitCompareArrows, Monitor, Tablet, Smartphone,
  Sun, Moon, CircleCheck, CircleAlert, Loader2, ExternalLink, LayoutTemplate, Home, Users, Calendar, Trophy, Settings, Bell, Search,
} from "lucide-react";
import { supabase } from "./supabase";

// App-Designer · Etappe 1 (Entwurf 0.9, freigegeben von Gerhard 2026-10-22 22:40)
// Ein Grunddesign je Projekt (nicht je Rolle). Ändern → Entwurf speichern (jede Fassung bleibt) → vergleichen → als Auftrag senden.
// Wirksam wird es erst über den normalen Weg: Freigabe → Sicherheitsprüfung → Zusammenführen → Feature-Prüfung → live.
// Etappe 2: Chat mit Claude + Prüfungen erweitert · Etappe 3: Trainer to go liest die Werte zentral · Etappe 4/5: Bausteine, Marke.

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
    else if (typeof v === typeof z[k] && (typeof z[k] !== "string" || !z[k].startsWith("#") || /^#[0-9a-f]{6}$/i.test(v))) z[k] = v; }); }; geh(r, w); return r; };
const setze = (o, pfad, v) => { const r = tief(o); let z = r; pfad.slice(0, -1).forEach((k) => { z[k] = z[k] || {}; z = z[k]; }); z[pfad[pfad.length - 1]] = v; return r; };
const flach = (o, p = "") => Object.entries(o || {}).filter(([k]) => !VERBOTEN.has(k)).flatMap(([k, v]) => (v && typeof v === "object" ? flach(v, p + k + ".") : [[p + k, v]]));

// Kontrast nach WCAG 2.1
const lum = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return 0; const n = parseInt(m[1], 16);
  return [16, 8, 0].map((s) => ((n >> s) & 255) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0); };
const kontrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
function pruefungen(w) {
  const out = [];
  ["hell", "dunkel"].forEach((m) => {
    const f = w.farben[m]; const t = m === "hell" ? "Hell" : "Dunkel";
    [["text", "hintergrund", 4.5, "Text auf Hintergrund"], ["text", "flaeche", 4.5, "Text auf Karten"], ["text_leise", "flaeche", 4.5, "Leiser Text auf Karten"],
      ["primaer_text", "primaer", 4.5, "Knopf-Text auf Hauptfarbe"], ["menue_text", "menue", 4.5, "Menü-Text"], ["primaer", "hintergrund", 3, "Hauptfarbe als Rahmen/Symbol"]]
      .forEach(([a, b, soll, name]) => { const k = kontrast(f[a], f[b]); out.push({ ok: k >= soll, text: `${t}: ${name}`, wert: `${k.toFixed(1)} : 1 (mind. ${soll})` }); });
  });
  out.push({ ok: w.schrift.basis >= 14, text: "Grundschrift gut lesbar", wert: `${w.schrift.basis} px (mind. 14)` });
  out.push({ ok: w.logo.groesse >= 24, text: "Logo groß genug für Handy", wert: `${w.logo.groesse} px (mind. 24)` });
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
- Nur zentral über die Design-Werte der App (CSS-Variablen in src/index.css, tailwind.config.js), keine Einzelfarben in Seiten.
- Hell- und Dunkelmodus, PC/Tablet/Handy prüfen; Kontrast mind. 4,5 : 1.
- Handbuch/DESIGN.md und CHANGELOG mitführen.

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
  useEffect(() => {
    holen();
    const ch = supabase.channel("cs-designer-" + d.projektId).on("postgres_changes", { event: "*", schema: "public", table: "ws_design_entwuerfe" }, holen).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [holen, d.projektId]);

  const live = entwuerfe.find((e) => e.stand === "live");
  const gueltig = useMemo(() => mische(BASIS, live?.werte), [live]);
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

  if (!projekt) return null;
  if (!projekt.design_gruppe_id) return <div className={`${card} p-6 text-slate-600 dark:text-slate-300`}>Für dieses Projekt ist noch keine Design-Gruppe festgelegt. Der Admin legt sie fest (Datenbank: <code>ws_projekte.design_gruppe_id</code>).</div>;
  const befunde = pruefungen(werte);
  const rot = befunde.filter((b) => !b.ok).length;

  return (
    <div className="space-y-3">
      {/* Kopfleiste: Entwurf wählen, rückgängig, speichern, vergleichen, senden */}
      <div className={`${card} p-2.5 flex flex-wrap items-center gap-2`}>
        <div role="tablist" aria-label="Bereich" className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5">
          {[["grund", "Grunddesign", Palette], ["bausteine", "Bausteine", Shapes], ["marke", "Marke", Stamp]].map(([id, t, I]) => (
            <button key={id} type="button" role="tab" aria-selected={modus === id} onClick={() => setModus(id)}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-semibold ${modus === id ? "bg-white dark:bg-slate-900 shadow-sm text-emerald-800 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300"}`}><I className="w-4 h-4" />{t}</button>))}
        </div>
        <span className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
        <label className="sr-only" htmlFor="ds-entwurf">Entwurf</label>
        <select id="ds-entwurf" value={aktivId || ""} onChange={(e) => oeffne(entwuerfe.find((x) => String(x.id) === e.target.value))} className={`${input} w-auto max-w-[260px]`}>
          <option value="">{live ? `Gültiges Grunddesign (${live.name})` : "Gültiges Grunddesign (Ausgangswerte)"}</option>
          {entwuerfe.filter((e) => e.stand !== "live").map((e) => <option key={e.id} value={e.id}>{e.name} · {STAND_TXT[e.stand]} · v{e.version}</option>)}
        </select>
        {aktiv && <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${STAND_CLS[aktiv.stand]}`}>{STAND_TXT[aktiv.stand]}</span>}
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
      {!darf && <p className="text-sm text-slate-500">Nur ansehen: Gestalten dürfen Entwickler mit dem Recht „Aufträge geben“ im Bereich der Design-Gruppe.</p>}
      {fest && <p className="text-sm text-slate-600 dark:text-slate-300">Dieser Entwurf ist {STAND_TXT[aktiv.stand].toLowerCase()} und damit fest{aktiv.auftrag_id ? ` (Auftrag #${aktiv.auftrag_id})` : ""}. Für Änderungen eine Kopie anlegen.</p>}

      {modus !== "grund" ? <Spaeter modus={modus} /> : (
        <div className="grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)_280px] lg:grid-cols-[300px_minmax(0,1fr)]">
          <Einstellungen w={werte} aendere={aendere} bearbeitbar={bearbeitbar} />
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
              {mitte === "geruest" && <Rahmen breite={GERAETE[geraet][0]}><Geruest w={werte} modus={dunkel ? "dunkel" : "hell"} geraet={geraet} name={projekt.name} /></Rahmen>}
              {mitte === "testseite" && <Testseite projekt={projekt} breite={GERAETE[geraet][0]} />}
              {mitte === "vergleich" && <Vergleich entwuerfe={entwuerfe} gueltig={gueltig} aktuell={{ name: aktiv ? `${aktiv.name}${geaendert ? " (ungespeichert)" : ""}` : "Im Editor", werte }} modus={dunkel ? "dunkel" : "hell"} name={projekt.name} />}
            </div>
          </section>
          <aside className={`${card} p-3 space-y-2 lg:col-span-2 xl:col-span-1 self-start`}>
            <h3 className="font-display font-bold text-lg flex items-center gap-2">Prüfungen {rot ? <span className="text-xs font-bold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 rounded-full px-2">{rot} offen</span> : <span className="text-xs font-bold bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 rounded-full px-2">alles grün</span>}</h3>
            <ul className="space-y-1.5 text-sm">
              {befunde.map((b) => <li key={b.text} className="flex gap-2">{b.ok ? <CircleCheck className="w-4 h-4 text-green-600 shrink-0 mt-0.5" /> : <CircleAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />}<span>{b.text}<span className="block text-xs text-slate-500">{b.wert}</span></span></li>)}
            </ul>
            <p className="text-xs text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-800">Chat mit Claude zum Design kommt in Etappe 2. Bis dahin: Entwurf senden – der Auftrags-Chat läuft wie gewohnt.</p>
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

function Einstellungen({ w, aendere, bearbeitbar }) {
  const [m, setM] = useState("hell");
  const dis = !bearbeitbar;
  const zahl = (pfad, min, max, schritt = 1) => { const v = pfad.reduce((o, k) => o[k], w);
    return <span className="flex items-center gap-2"><input type="range" min={min} max={max} step={schritt} value={v} disabled={dis} onChange={(e) => aendere(pfad, Number(e.target.value))} className="w-28 accent-emerald-700" /><span className="w-10 text-right tabular-nums text-xs">{v}</span></span>; };
  const wahl = (pfad, opts) => <select value={String(pfad.reduce((o, k) => o[k], w))} disabled={dis} onChange={(e) => { const v = e.target.value; aendere(pfad, /^\d+$/.test(v) ? Number(v) : v === "true" ? true : v === "false" ? false : v); }} className={`${input} w-40`}>{opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>;
  return (
    <section className={`${card} p-3 self-start`} aria-label="Einstellungen Grunddesign">
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
      <Abschnitt titel="Menüleiste" offen={false}>
        <Feld label="Position (PC)">{wahl(["menue", "position"], [["links", "Links"], ["oben", "Oben"]])}</Feld>
        <Feld label="Aufklappbar">{wahl(["menue", "aufklappbar"], [[true, "Ja"], [false, "Nein"]].map(([v, t]) => [String(v), t]))}</Feld>
        <Feld label="Breite (px)">{zahl(["menue", "breite"], 200, 320, 8)}</Feld>
        <Feld label="Tablet">{wahl(["menue", "tablet"], [["eingeklappt", "Eingeklappt (nur Symbole)"], ["offen", "Offen"], ["oben", "Oben"]])}</Feld>
        <Feld label="Handy">{wahl(["menue", "handy"], [["unten", "Leiste unten"], ["burger", "Menü-Knopf oben"]])}</Feld>
      </Abschnitt>
      <Abschnitt titel="Logo-Platz" offen={false}>
        <Feld label="Platz">{wahl(["logo", "platz"], [["menue-oben", "Menü oben"], ["kopf-links", "Kopfzeile links"], ["kopf-mitte", "Kopfzeile Mitte"]])}</Feld>
        <Feld label="Größe (px)">{zahl(["logo", "groesse"], 20, 56, 2)}</Feld>
      </Abschnitt>
    </section>
  );
}

function Rahmen({ breite, children }) {
  return <div className="mx-auto transition-all" style={{ width: breite, maxWidth: "100%" }}><div className="rounded-xl overflow-hidden shadow-lg ring-1 ring-black/10">{children}</div><p className="text-center text-xs text-slate-500 mt-1.5">{breite} px · Vorschau des Grundgerüsts mit den Entwurfswerten</p></div>;
}

// Gerüst: Menü, Kopfzeile, Kacheln, Liste, Knöpfe – zeigt die Werte sofort (die echte App erst nach „live“)
function Geruest({ w, modus, geraet, name }) {
  const f = w.farben[modus]; const s = w.schrift; const fo = w.form;
  const schatten = { kein: "none", leicht: "0 1px 3px rgba(0,0,0,.08)", deutlich: "0 6px 18px rgba(0,0,0,.14)" }[fo.schatten];
  const pos = geraet === "handy" ? w.menue.handy : geraet === "tablet" ? (w.menue.tablet === "oben" ? "oben" : w.menue.tablet) : w.menue.position;
  const seitlich = pos === "links" || pos === "offen" || pos === "eingeklappt";
  const schmal = pos === "eingeklappt";
  const fontH = `"${s.ueberschrift}", system-ui, sans-serif`; const fontT = `"${s.text}", system-ui, sans-serif`;
  const Logo = () => <span style={{ width: w.logo.groesse, height: w.logo.groesse, borderRadius: fo.radius, background: f.primaer, color: f.primaer_text, fontFamily: fontH, fontWeight: 700, fontSize: w.logo.groesse * 0.5 }} className="grid place-items-center shrink-0">{name.slice(0, 1)}</span>;
  const punkte = [["Start", Home], ["Mannschaft", Users], ["Kalender", Calendar], ["Spiele", Trophy], ["Einstellungen", Settings]];
  const Menue = ({ quer }) => (
    <nav style={{ background: f.menue, color: f.menue_text, borderColor: f.rand, width: quer ? "auto" : schmal ? 64 : Math.min(w.menue.breite, 280), fontFamily: fontT }} className={quer ? "flex items-center gap-1 px-3 py-2 border-b" : "flex flex-col gap-1 p-2.5 border-r shrink-0"}>
      {!quer && w.logo.platz === "menue-oben" && <div className="flex items-center gap-2 px-1.5 pb-2"><Logo />{!schmal && <b style={{ fontFamily: fontH }}>{name}</b>}</div>}
      {punkte.map(([t, I], i) => <span key={t} style={i === 0 ? { background: f.primaer + "22", color: f.primaer, borderRadius: fo.radius } : { borderRadius: fo.radius }} className="flex items-center gap-2 px-2 py-1.5 text-[0.9em] font-semibold"><I size={17} />{!schmal && t}</span>)}
    </nav>);
  const kopfLogo = w.logo.platz !== "menue-oben" || !seitlich;
  return (
    <div style={{ background: f.hintergrund, color: f.text, fontFamily: fontT, fontSize: s.basis }} className="flex min-h-[480px]">
      {seitlich && <Menue />}
      <div className="flex-1 min-w-0 flex flex-col">
        <header style={{ borderColor: f.rand, padding: `${fo.abstand * 0.6}px ${fo.abstand}px` }} className="flex items-center gap-3 border-b">
          {pos === "burger" && <span style={{ color: f.text }}>☰</span>}
          {kopfLogo && w.logo.platz !== "kopf-mitte" && <Logo />}
          <h2 style={{ fontFamily: fontH, fontWeight: s.gewicht, fontSize: s.basis * 1.6 }} className={w.logo.platz === "kopf-mitte" ? "flex-1" : ""}>Übersicht</h2>
          {kopfLogo && w.logo.platz === "kopf-mitte" && <Logo />}
          <span className="ml-auto flex items-center gap-2" style={{ color: f.text_leise }}><Search size={18} /><Bell size={18} /></span>
        </header>
        {pos === "oben" && <Menue quer />}
        <main style={{ padding: fo.abstand, gap: fo.abstand }} className="grid flex-1 content-start">
          <div style={{ gap: fo.abstand }} className={`grid ${geraet === "handy" ? "grid-cols-2" : "grid-cols-4"}`}>
            {[["Spieler", "24"], ["Trainings", "3"], ["Anwesenheit", "92 %"], ["Nächstes Spiel", "Sa"]].map(([t, z]) => (
              <div key={t} style={{ background: f.flaeche, borderColor: f.rand, borderRadius: fo.radius_karte, boxShadow: schatten, padding: fo.abstand * 0.8 }} className="border">
                <div style={{ color: f.text_leise }} className="text-[0.8em]">{t}</div>
                <div style={{ fontFamily: fontH, fontWeight: s.gewicht, fontSize: s.basis * 1.7 }}>{z}</div>
              </div>))}
          </div>
          <div style={{ background: f.flaeche, borderColor: f.rand, borderRadius: fo.radius_karte, boxShadow: schatten }} className="border overflow-hidden">
            <div style={{ padding: `${fo.abstand * 0.7}px ${fo.abstand}px`, borderColor: f.rand }} className="flex items-center gap-2 border-b">
              <b style={{ fontFamily: fontH, fontWeight: s.gewicht, fontSize: s.basis * 1.2 }}>Nächste Termine</b>
              <span style={{ background: f.primaer, color: f.primaer_text, borderRadius: fo.radius }} className="ml-auto px-3 py-1.5 text-[0.85em] font-semibold">Neuer Termin</span>
              <span style={{ borderColor: f.rand, borderRadius: fo.radius }} className="px-3 py-1.5 text-[0.85em] font-semibold border">Filter</span>
            </div>
            {[["Training U13", "Di 17:30", f.erfolg, "Zugesagt 14"], ["Heimspiel gegen SV Muster", "Sa 10:00", f.warnung, "Offen 6"], ["Elternabend", "Mo 19:00", f.fehler, "Frist morgen"]].map(([t, z, c, h]) => (
              <div key={t} style={{ padding: `${fo.abstand * 0.6}px ${fo.abstand}px`, borderColor: f.rand }} className="flex items-center gap-3 border-b last:border-0">
                <span className="w-2 h-2 rounded-full" style={{ background: c }} /><span className="flex-1 font-semibold">{t}</span><span style={{ color: f.text_leise }} className="text-[0.85em]">{z}</span>
                {geraet !== "handy" && <span style={{ color: c, borderColor: c, borderRadius: 999 }} className="border px-2 text-[0.75em] font-semibold">{h}</span>}
              </div>))}
          </div>
        </main>
        {pos === "unten" && <nav style={{ background: f.menue, color: f.menue_text, borderColor: f.rand }} className="flex justify-around border-t py-2">{punkte.slice(0, 4).map(([t, I], i) => <span key={t} style={i === 0 ? { color: f.primaer } : {}} className="flex flex-col items-center text-[0.7em] font-semibold"><I size={18} />{t}</span>)}</nav>}
      </div>
    </div>);
}

function Testseite({ projekt, breite }) {
  const url = projekt.live_url ? `${projekt.live_url.replace(/\/$/, "")}${projekt.vorschau_pfad || "/"}?cs=1` : null;
  if (!url) return <p className="text-sm text-slate-500 p-4">Für dieses Projekt ist keine Adresse der App hinterlegt.</p>;
  return (
    <div className="mx-auto" style={{ width: breite, maxWidth: "100%" }}>
      <p className="text-xs text-slate-600 dark:text-slate-300 mb-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-2.5 py-1.5">Echte Testseite der App – zeigt das <b>gültige</b> Design. Ein Entwurf erscheint hier, sobald sein Auftrag eine Testseite hat (Live-Vorschau beim Auftrag). Ab Etappe 3 auch sofort.</p>
      <iframe title="Testseite der App" src={url} className="w-full h-[640px] rounded-xl bg-white ring-1 ring-black/10" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
    </div>);
}

function Vergleich({ entwuerfe, gueltig, aktuell, modus, name }) {
  const optionen = [["gueltig", "Gültiges Grunddesign", gueltig], ["aktuell", aktuell.name, aktuell.werte], ...entwuerfe.map((e) => [String(e.id), `${e.name} (${STAND_TXT[e.stand]})`, mische(BASIS, e.werte)])];
  const [a, setA] = useState("gueltig"); const [b, setB] = useState("aktuell");
  const wa = optionen.find((o) => o[0] === a)?.[2] || gueltig; const wb = optionen.find((o) => o[0] === b)?.[2] || aktuell.werte;
  const diff = aenderungen(wa, wb);
  const Wahl = ({ v, set, l }) => <label className="text-sm flex items-center gap-2">{l}<select value={v} onChange={(e) => set(e.target.value)} className={`${input} w-auto`}>{optionen.map(([id, t]) => <option key={id} value={id}>{t}</option>)}</select></label>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3"><Wahl v={a} set={setA} l="A" /><Wahl v={b} set={setB} l="B" /></div>
      <div className="grid md:grid-cols-2 gap-3">
        {[[a, wa], [b, wb]].map(([id, w], i) => <div key={i} className="min-w-0"><p className="text-xs font-bold text-slate-500 mb-1">{i ? "B" : "A"} · {optionen.find((o) => o[0] === id)?.[1]}</p><div className="rounded-xl overflow-hidden ring-1 ring-black/10 pointer-events-none" style={{ zoom: 0.62 }}><Geruest w={w} modus={modus} geraet="pc" name={name} /></div></div>)}
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
function Spaeter({ modus }) {
  const t = modus === "bausteine" ? ["Bausteine & Seiten-Vorlagen", "Kacheln, Diagramme, Listen, Formulare und Seiten-Vorlagen – mit Chat bearbeitbar. Kommt in Etappe 4 (zuerst Bestandsaufnahme der vorhandenen Bausteine in Trainer to go)."]
    : ["Marke", "Logo-Designer (Teile verschieben, hell/dunkel, 64/32/16 px) und Projektlogos in der Projektliste. Kommt in Etappe 5 – das Codeschmiede-Logo „Glühendes C“ ist bereits gewählt."];
  return <div className={`${card} p-8 text-center`}><h3 className="font-display font-bold text-xl">{t[0]}</h3><p className="text-sm text-slate-500 max-w-xl mx-auto mt-1">{t[1]}</p></div>;
}
