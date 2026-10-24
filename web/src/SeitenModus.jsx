// App-Designer › Seiten (Entwurf 1.0, freigegeben von Gerhard 2026-10-24 13:49): der Seiten-Designer der App
// (Startseiten je Rolle, Übersichten, Arbeitsseiten; PC/Tablet/Handy; Individualdesign je Verein) direkt hier.
// Er läuft in der App selbst (Testfassung, eigene Seite /designer, nur eingebettet in der Codeschmiede) – gespeichert
// und freigegeben wird dort mit der Rechteprüfung der App-Datenbank; die Codeschmiede speichert dafür nichts.
// Das gewählte Grunddesign (oben im App-Designer) wirkt sofort mit. Neue Kachel-Arten gehen als Auftrag.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGrid, Send, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { supabase } from "./supabase";
import GeraeteRahmen from "./GeraeteRahmen";
import { designFrageBeantworten } from "./designFrage";

const card = "rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const ghost = "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold disabled:opacity-50";
const btn = "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50";
const input = "rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-sm";

export function seitenBasis(projekt) {
  const b = projekt?.live_zweig && /^https:\/\/[^/\s]+/i.test(projekt?.test_url || "") ? projekt.test_url : projekt?.live_url;
  return /^https:\/\/[^/\s]+$/i.test(String(b || "").replace(/\/$/, "")) ? String(b).replace(/\/$/, "") : null;
}

export default function SeitenModus({ projekt, d, ich, werte, dunkel, darf, toast, tab = null }) {
  const basis = seitenBasis(projekt);
  // tab: Reiter des Seiten-Designers beim Öffnen (z. B. „freigabe“ aus dem Baustein-Inspektor) – nur feste Namen
  const url = basis ? `${basis}/designer?cs=1${tab && /^(designer|seiten|freigabe)$/.test(tab) ? `&tab=${tab}` : ""}` : null;
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
    };
    window.addEventListener("message", h); return () => window.removeEventListener("message", h);
  }, [ziel]);

  // Neue Kachel-Art: als Auftrag in die Design-Gruppe (läuft wie jeder Auftrag: Freigabe, Prüfungen, Test, Live)
  const g = d.gruppen.find((x) => x.id === projekt.design_gruppe_id);
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
        <h2 className="font-display font-bold">Seiten</h2>
        <span className="text-xs text-slate-500">Startseiten je Rolle, Übersichten, Arbeitsseiten · PC/Tablet/Handy · für alle Vereine oder einzelne (Individualdesign). Freigeben mit „Sofort“ wirkt sofort in der App; „Schrittweise“ erst ab der ersten Stufe.</span>
        <span className="flex-1" />
        <button type="button" className={ghost} title="Neu laden" onClick={() => { setBereit(false); setSchluessel((k) => k + 1); }}><RefreshCw className="w-4 h-4" /></button>
        <a className={ghost} href={url} target="_blank" rel="noopener noreferrer" title="Nur eingebettet nutzbar – außerhalb zeigt die App „Seite nicht gefunden“"><ExternalLink className="w-4 h-4" /></a>
      </div>
      <p className={`text-xs rounded-lg px-2.5 py-1.5 border ${bereit ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900 text-green-800 dark:text-green-300" : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300"}`}>
        {bereit ? "Seiten-Designer der App – mit dem oben gewählten Grunddesign. Speichern und Freigeben laufen in der App (Testfassung) mit deinen Design-Rechten."
          : "Der Seiten-Designer lädt aus der Testfassung der App. Beim ersten Mal dort mit deinem Betreiber-Konto anmelden; der Inhaber gibt diesen PC einmal für das Design frei."}
      </p>
      {/* Echte PC-Breite (1280 px), eingepasst in die Spalte – sonst klappt das Menü der App auf Symbole zusammen (Fehlerkorrektur 0.9.5) */}
      <GeraeteRahmen geraet="pc" hoehe="fuellen" className="h-[calc(100vh-260px)] min-h-[620px]" rahmenClass="rounded-xl bg-white ring-1 ring-black/10">
        <iframe key={schluessel} ref={rahmen} title="Seiten-Designer der App" src={url} onLoad={() => setTimeout(senden, 400)}
          className="block w-full h-full bg-white" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
      </GeraeteRahmen>
      {darf && g && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="sd-wunsch" className="text-sm text-slate-600 dark:text-slate-300">Eine Kachel-Art fehlt?</label>
          <input id="sd-wunsch" className={`${input} flex-1 min-w-[220px]`} maxLength={300} placeholder="z. B. Geburtstage der Woche, Wetter am Platz …" value={wunsch} onChange={(e) => setWunsch(e.target.value)} />
          <button type="button" className={btn} disabled={busy || wunsch.trim().length < 10} onClick={auftrag}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Als Auftrag wünschen</button>
        </div>)}
    </section>);
}
