// App-Designer › Seiten (Entwurf 1.0, freigegeben von Gerhard 2026-10-24 13:49): der Seiten-Designer der App
// (Startseiten je Rolle, Übersichten, Arbeitsseiten; PC/Tablet/Handy; Individualdesign je Verein) direkt hier.
// Er läuft in der App selbst (Testfassung, eigene Seite /designer, nur eingebettet in der Codeschmiede) – gespeichert
// und freigegeben wird dort mit der Rechteprüfung der App-Datenbank; die Codeschmiede speichert dafür nichts.
// Das gewählte Grunddesign (oben im App-Designer) wirkt sofort mit. Neue Kachel-Arten gehen als Auftrag.
// Chat zur Kachel (Entwurf frei Gerhard 2026-10-25 13:31, Datenbank 0041): Der Seiten-Designer zeigt rechts „Mit KI besprechen“ und schickt
// per postMessage nur die Werte der gewählten Kachel. Die Codeschmiede stellt die Frage im Design-Chat (ws_design_chat, eigene Werkstatt),
// liest das Gespräch dieses Schlüssels und schickt es zurück. Die App greift nie auf die Codeschmiede-Datenbank zu.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGrid, Send, Loader2, RefreshCw, ExternalLink, Hammer, X } from "lucide-react";
import { supabase } from "./supabase";
import GeraeteRahmen from "./GeraeteRahmen";
import { designFrageBeantworten, designFreigabeMerken } from "./designFrage";
import { isDesktop } from "./desktop";
import { kiAnzeigename } from "./kiName";
import { SCHLUESSEL, praefixVon, sauber, kachelBereinigen, frageText, gespraech, fuerRahmen, kiAuswahl, brauchtNeuenCode, auftragText } from "./kachelChat";

const card = "rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const ghost = "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold disabled:opacity-50";
const btn = "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50";
const input = "rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-sm";
const fehlerText = (e) => (e?.message || "Unbekannter Fehler").replace(/^.*?ERROR:\s*/, "").slice(0, 300);
// LIKE-Muster: „_“ und „%“ im Schlüssel wörtlich nehmen (genau gefiltert wird danach in gespraech())
const likeMuster = (t) => `${t.replace(/[\\%_]/g, (z) => `\\${z}`)}%`;

export function seitenBasis(projekt) {
  const b = projekt?.live_zweig && /^https:\/\/[^/\s]+/i.test(projekt?.test_url || "") ? projekt.test_url : projekt?.live_url;
  return /^https:\/\/[^/\s]+$/i.test(String(b || "").replace(/\/$/, "")) ? String(b).replace(/\/$/, "") : null;
}

// titel/kompakt: eingebettet unter „Übernehmen“ (App-Designer 2.0 · Etappe 4) – nur Freigabe & Versionen, ohne Kachel-Wunsch
// onFreigabeOffen(n): Zahl der offenen Änderungen, die der Freigabe-Reiter der App meldet (nur die Zahl)
export default function SeitenModus({ projekt, d, ich, werte, dunkel, darf, toast, tab = null, titel = "Seiten", kompakt = false, onFreigabeOffen }) {
  const basis = seitenBasis(projekt);
  // tab: Reiter des Seiten-Designers beim Öffnen (z. B. „freigabe“ aus dem Baustein-Inspektor) – nur feste Namen
  const url = basis ? `${basis}/designer?cs=1${tab && /^(designer|stil|seiten|freigabe)$/.test(tab) ? `&tab=${tab}` : ""}` : null;
  const ziel = (() => { try { return url ? new URL(url).origin : null; } catch { return null; } })();
  const rahmen = useRef(null);
  const [schluessel, setSchluessel] = useState(0);
  const [bereit, setBereit] = useState(false);
  const [wunsch, setWunsch] = useState(""); const [busy, setBusy] = useState(false);
  const senden = useCallback(() => {
    try { rahmen.current?.contentWindow?.postMessage({ cs: "hallo" }, ziel); rahmen.current?.contentWindow?.postMessage({ cs: "design", werte, modus: dunkel ? "dunkel" : "hell" }, ziel); } catch { /* egal */ }
  }, [werte, dunkel, ziel]);
  useEffect(() => { senden(); }, [senden]);
  useEffect(() => {
    const h = (e) => {
      if (e.origin !== ziel || e.source !== rahmen.current?.contentWindow || !e.data || typeof e.data !== "object") return;
      if (e.data.cs === "bereit" || e.data.cs === "design-ok") setBereit(true);
      // Eigene Design-Freigabe (Entscheidung Gerhard 2026-10-24): Regeln gemeinsam mit der Baustein-Galerie in designFrage.js
      if (e.data.cs === "design-frage") designFrageBeantworten(e.data, ziel, (x) => rahmen.current?.contentWindow?.postMessage(x, ziel));
      if (e.data.cs === "design-status") designFreigabeMerken(e.data.stand, ziel);
      if (e.data.cs === "freigabe-offen" && Number.isSafeInteger(e.data.anzahl) && e.data.anzahl >= 0 && e.data.anzahl < 10000) onFreigabeOffen?.(e.data.anzahl);
      // Chat zur Kachel – Inhalte sind Daten; geprüft wird in den Funktionen unten
      if (e.data.cs === "kachel-chat-abo") {
        const sl = e.data.schluessel;
        if (sl === null) setKcAbo(null); else if (typeof sl === "string" && SCHLUESSEL.test(sl)) { setKcAbo(sl); setKcTick((t) => t + 1); }
      }
      if (e.data.cs === "kachel-chat-senden") kc.current.senden(e.data);
      if (e.data.cs === "kachel-chat-entscheiden") kc.current.entscheiden(e.data);
      if (e.data.cs === "kachel-chat-auftrag") kc.current.auftrag(e.data);
    };
    window.addEventListener("message", h); return () => window.removeEventListener("message", h);
  }, [ziel, onFreigabeOffen]);

  // Neue Kachel-Art: als Auftrag in die Design-Gruppe (läuft wie jeder Auftrag: Freigabe, Prüfungen, Test, Live)
  const g = d.gruppen.find((x) => x.id === projekt.design_gruppe_id);

  // ---------------------------------------------------------------- Chat zur Kachel
  const [kcAbo, setKcAbo] = useState(null); const [kcTick, setKcTick] = useState(0);
  const [kcKi, setKcKi] = useState({ kis: [{ id: "claude", name: "Claude" }], standard: "claude", namen: {} });
  const kcListe = useRef([]);
  const anRahmen = useCallback((x) => { try { rahmen.current?.contentWindow?.postMessage(x, ziel); } catch { /* egal */ } }, [ziel]);
  // KI-Auswahl: Zuständigkeit „design“ des Projekts, davon was die eigene Werkstatt nutzen kann (gekoppelt bzw. zugelassen)
  useEffect(() => {
    let aus = false;
    (async () => {
      const [{ data: z }, { data: kopp }, { data: an }] = await Promise.all([
        supabase.from("ws_ki_zustaendigkeit").select("reihe").eq("projekt_id", projekt.id).eq("aufgabe", "design").maybeSingle(),
        supabase.from("ws_ki_kopplung").select("anbieter, gekoppelt, zugelassen").eq("benutzer_id", ich?.id || ""),
        supabase.from("ws_ki_anbieter").select("id, name")]);
      if (aus) return;
      const namen = Object.fromEntries((an || []).map((a) => [a.id, a.name]));
      setKcKi({ ...kiAuswahl(z?.reihe, kopp || [], (id) => kiAnzeigename(id, namen)), namen });
    })().catch(() => {});
    return () => { aus = true; };
  }, [projekt.id, ich?.id]);
  const werkstattAn = (d.pcs || []).some((p) => p.benutzer_id === ich?.id && p.an);
  // Nur im Programm sinnvoll: dort läuft die eigene Werkstatt, die antwortet
  const kcBereit = isDesktop() && !!darf;
  const kcHinweis = !isDesktop() ? "Nur im Programm Codeschmiede – dort antwortet deine Werkstatt. Im Browser kannst du hier nicht fragen."
    : !darf ? "Fragen dürfen Entwickler mit Design-Recht in diesem Projekt." : !werkstattAn ? "Deine Werkstatt ist gerade aus – die Frage wartet, bis sie läuft." : "";
  // Gespräch dieses Schlüssels lesen (eigene Fragen + Antworten darauf) und live an den Seiten-Designer schicken
  useEffect(() => {
    if (!kcAbo) return undefined;
    let aus = false;
    const holen = async () => {
      const { data: fragen } = await supabase.from("ws_design_chat").select("id, frage_id, von, text, werte, ki, stand, entscheidung, erstellt")
        .eq("projekt_id", projekt.id).is("entwurf_id", null).is("frage_id", null).eq("von", ich?.id || "").like("text", likeMuster(praefixVon(kcAbo)))
        .order("id", { ascending: false }).limit(40);
      const ids = (fragen || []).map((m) => m.id);
      const { data: antworten } = ids.length ? await supabase.from("ws_design_chat").select("id, frage_id, von, text, werte, ki, stand, entscheidung, erstellt").in("frage_id", ids) : { data: [] };
      if (aus) return;
      const g = gespraech([...(antworten || []), ...(fragen || [])].sort((a, b) => b.id - a.id), kcAbo, ich?.id);
      kcListe.current = g;
      const name = (k) => (k ? kiAnzeigename(k, kcKi.namen) : kcKi.kis[0]?.name || "Claude");
      anRahmen({ cs: "kachel-chat", schluessel: kcAbo, nachrichten: g.map((m) => fuerRahmen(m, kcAbo, name)), kis: kcKi.kis, standard: kcKi.standard, bereit: kcBereit, hinweis: kcHinweis });
    };
    holen().catch(() => {});
    const ch = supabase.channel(`cs-kachel-chat-${projekt.id}-${kcAbo.replace(/[^A-Za-z0-9_-]/g, "-")}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ws_design_chat", filter: `projekt_id=eq.${projekt.id}` }, () => holen().catch(() => {})).subscribe();
    return () => { aus = true; supabase.removeChannel(ch); };
  }, [kcAbo, kcTick, projekt.id, ich?.id, kcKi, kcBereit, kcHinweis, anRahmen]);
  const [kcBestaetigung, setKcBestaetigung] = useState(null);   // { schluessel, titel, text } – Dialog „Auftrag stellen?“
  const [kcStellt, setKcStellt] = useState(false);
  const [kcFrei, setKcFrei] = useState(false);   // „Auftrag stellen“ erst nach 1 s (kein versehentlicher Klick)
  const kcRuheBis = useRef(0);
  useEffect(() => {
    if (!kcBestaetigung) return undefined;
    setKcFrei(false); const t = setTimeout(() => setKcFrei(true), 1000);
    return () => clearTimeout(t);
  }, [kcBestaetigung]);
  const auftragStellen = async () => {
    const b = kcBestaetigung; if (!b || !g || !kcFrei) return; setKcStellt(true);
    const { data, error } = await supabase.rpc("ws_design_auftrag", { p_projekt: projekt.id, p_art: "kachel", p_titel: b.titel, p_text: b.text });
    setKcStellt(false); setKcBestaetigung(null);
    if (error) { toast(fehlerText(error)); anRahmen({ cs: "kachel-chat-auftrag-stand", ok: false, text: fehlerText(error) }); return; }
    toast(`Auftrag #${data} an Werkstatt ${g.name} gestellt`);
    anRahmen({ cs: "kachel-chat-auftrag-stand", ok: true, nr: Number(data) || null });
  };
  const auftragAbbrechen = () => { kcRuheBis.current = Date.now() + 30000; setKcBestaetigung(null); anRahmen({ cs: "kachel-chat-auftrag-stand", ok: false, text: "Abgebrochen – kein Auftrag gestellt." }); };
  const kc = useRef({});
  kc.current = {
    senden: async (n) => {
      const sl = n.schluessel;
      if (typeof sl !== "string" || !SCHLUESSEL.test(sl)) return;
      if (!kcBereit) { anRahmen({ cs: "kachel-chat-fehler", schluessel: sl, text: kcHinweis }); return; }
      const t = typeof n.text === "string" ? sauber(n.text, 3000).trim() : "";
      if (!t) return;
      // Nur die erlaubten Kachel-Felder; Seite und Gerät aus dem Schlüssel; KI nur aus der angebotenen Liste
      const zeile = { projekt_id: projekt.id, entwurf_id: null, text: frageText(sl, t, n.info), werte: { kachel: kachelBereinigen(n.kachel, sl) } };
      if (typeof n.ki === "string" && kcKi.kis.some((k) => k.id === n.ki)) zeile.ki = n.ki;
      const { error } = await supabase.from("ws_design_chat").insert(zeile);
      if (error) { toast(fehlerText(error)); anRahmen({ cs: "kachel-chat-fehler", schluessel: sl, text: fehlerText(error) }); }
    },
    entscheiden: async (n) => {
      const id = Number(n.id); const ent = n.entscheidung;
      if (!Number.isSafeInteger(id) || !["uebernommen", "abgelehnt"].includes(ent)) return;
      // Nur Antworten aus dem gerade gezeigten eigenen Gespräch, mit Vorschlag und noch offen
      const m = kcListe.current.find((x) => x.id === id && x.frage_id && x.werte?.kachel && !x.entscheidung);
      if (!m) return;
      const { error } = await supabase.rpc("ws_design_chat_entscheiden", { p_antwort: id, p_entscheidung: ent });
      if (error) toast(fehlerText(error)); else toast(ent === "uebernommen" ? "Vorschlag in den Entwurf übernommen – freigeben wie gewohnt über „Zur Freigabe“" : "Vorschlag abgelehnt");
    },
    // „Als Auftrag“ (Befund M1): der Rahmen nennt nur Schlüssel und Antwort; Text baut die Codeschmiede selbst, gestellt wird erst nach Bestätigung hier
    auftrag: (n) => {
      const sl = n.schluessel; const id = Number(n.antwortId);
      if (typeof sl !== "string" || sl !== kcAbo || !Number.isSafeInteger(id)) return;
      const nein = (text) => anRahmen({ cs: "kachel-chat-auftrag-stand", ok: false, text });
      // Nur ein Dialog zur Zeit; nach „Abbrechen“ 30 s keine neue Anfrage (kein Bedrängen durch den eingebetteten Rahmen)
      if (kcBestaetigung) return;
      if (Date.now() < kcRuheBis.current) { nein("Gerade abgebrochen – in einer halben Minute wieder möglich."); return; }
      if (!darf || !g) { nein(!g ? "Der App-Designer ist für dieses Projekt noch nicht eingerichtet." : "Aufträge stellen Entwickler mit Design-Recht."); return; }
      const antwort = kcListe.current.find((x) => x.id === id && x.frage_id);
      const frage = antwort && kcListe.current.find((x) => x.id === antwort.frage_id && !x.frage_id && x.von === ich?.id && String(x.text).startsWith(praefixVon(sl)));
      if (!antwort || !frage || !brauchtNeuenCode(antwort)) { nein("Zu dieser Antwort gibt es keinen Auftrag."); return; }
      setKcBestaetigung({ schluessel: sl, ...auftragText({ schluessel: sl, frage, antwort }) });
    },
  };
  const auftrag = async () => {
    const t = wunsch.trim(); if (t.length < 10 || !g) return; setBusy(true);
    try {
      // Auftrag und Beschreibung in EINEM Schritt (Datenbank 0036, ws_design_auftrag) – die Werkstatt startet nie ohne Beschreibung
      const { data, error } = await supabase.rpc("ws_design_auftrag", { p_projekt: projekt.id, p_art: "kachel", p_titel: t.length > 43 ? t.slice(0, 42) + "…" : t,
        p_text: `Neue Kachel-Art für den Seiten-Designer (App-Designer › Seiten): ${t}\n\nAls Baustein in der Bibliothek des Designers anlegen (alle Geräte, Varianten wie die übrigen Kacheln, sicherer Rückfall), Handbuch und CHANGELOG mitführen.` });
      if (error) throw error;
      setWunsch(""); toast(`Auftrag #${data} an Werkstatt ${g.name} gestellt`);
    } catch (e) { toast(e?.message || "Auftrag nicht gestellt"); } finally { setBusy(false); }
  };

  if (!url) return <p className={`${card} p-4 text-sm text-slate-500`}>Die App hat noch keine Adresse – sobald es eine Testfassung gibt, gestaltest du hier ihre Seiten.</p>;
  return (
    <section className={`${card} p-3 flex flex-col gap-3`} aria-label="Seiten-Designer">
      <div className="flex flex-wrap items-center gap-2">
        <LayoutGrid className="w-4 h-4 text-emerald-700" />
        <h2 className="font-display font-bold">{titel}</h2>
        {kompakt ? <span className="text-xs text-slate-500">Bausteine, Seiten und Akzentfarbe aus dem Design-Paket der App – Einzelzeilen mit Vorher/Nachher, Ausrollen und Versionen. Gespeichert und freigegeben wird in der App mit deinen Design-Rechten.</span>
        : <span className="text-xs text-slate-500">Seite wählen, „Gilt für“ (alle Vereine, Paket, Verein, Rolle) · je Kachel Hintergrund frei (Kontrast-Wächter), Rahmen, Variante, Geräte · Schnellzugriffe zusammenstellen · Akzentfarbe der App. Freigeben mit „Sofort“ wirkt sofort in der App.</span>}
        <span className="flex-1" />
        <button type="button" className={ghost} title="Neu laden" onClick={() => { setBereit(false); setSchluessel((k) => k + 1); }}><RefreshCw className="w-4 h-4" /></button>
        <a className={ghost} href={url} target="_blank" rel="noopener noreferrer" title="Nur eingebettet nutzbar – außerhalb zeigt die App „Seite nicht gefunden“"><ExternalLink className="w-4 h-4" /></a>
      </div>
      <p className={`text-xs rounded-lg px-2.5 py-1.5 border ${bereit ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900 text-green-800 dark:text-green-300" : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300"}`}>
        {bereit ? "Seiten-Designer der App – mit dem oben gewählten Grunddesign. Speichern und Freigeben laufen in der App (Testfassung) mit deinen Design-Rechten."
          : "Der Seiten-Designer lädt aus der Testfassung der App. Beim ersten Mal dort mit deinem Betreiber-Konto anmelden; der Inhaber gibt diesen PC einmal für das Design frei."}
      </p>
      {/* Echte PC-Breite (1280 px), eingepasst in die Spalte – sonst klappt das Menü der App auf Symbole zusammen (Fehlerkorrektur 0.9.5) */}
      <GeraeteRahmen geraet="pc" hoehe="fuellen" className={kompakt ? "h-[calc(100vh-320px)] min-h-[560px]" : "h-[calc(100vh-260px)] min-h-[620px]"} rahmenClass="rounded-xl bg-white ring-1 ring-black/10">
        <iframe key={schluessel} ref={rahmen} title="Seiten-Designer der App" src={url} onLoad={() => setTimeout(senden, 400)}
          className="block w-full h-full bg-white" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
      </GeraeteRahmen>
      {darf && g && !kompakt && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="sd-wunsch" className="text-sm text-slate-600 dark:text-slate-300">Eine Kachel-Art fehlt?</label>
          <input id="sd-wunsch" className={`${input} flex-1 min-w-[220px]`} maxLength={300} placeholder="z. B. Geburtstage der Woche, Wetter am Platz …" value={wunsch} onChange={(e) => setWunsch(e.target.value)} />
          <button type="button" className={btn} disabled={busy || wunsch.trim().length < 10} onClick={auftrag}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Als Auftrag wünschen</button>
        </div>)}
      {kcBestaetigung && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="kc-auftrag-titel"
          onKeyDown={(e) => { if (e.key === "Escape" && !kcStellt) auftragAbbrechen(); }}>
          <div className={`${card} w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl`}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <Hammer className="w-4 h-4 text-emerald-700" aria-hidden="true" />
              <h3 id="kc-auftrag-titel" className="font-display font-bold flex-1">Auftrag stellen?</h3>
              <button type="button" className={ghost} aria-label="Abbrechen" disabled={kcStellt} onClick={auftragAbbrechen}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-4 py-3 overflow-auto flex flex-col gap-2 text-sm">
              <p className="text-slate-600 dark:text-slate-300">Aus dem Chat zur Kachel entsteht dieser Auftrag an die Werkstatt {g?.name || ""}. Er läuft wie jeder Auftrag (Freigabe, Prüfungen, Test, Live).</p>
              <p><span className="text-slate-500">Name:</span> <b>Neue Kachel für den Seiten-Designer: {kcBestaetigung.titel}</b></p>
              <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 text-xs font-mono">{kcBestaetigung.text}</pre>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-800">
              <button type="button" className={ghost} disabled={kcStellt} autoFocus onClick={auftragAbbrechen}>Abbrechen</button>
              <button type="button" className={btn} disabled={kcStellt || !kcFrei} onClick={auftragStellen}>{kcStellt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hammer className="w-4 h-4" />}Auftrag stellen</button>
            </div>
          </div>
        </div>)}
    </section>);
}
