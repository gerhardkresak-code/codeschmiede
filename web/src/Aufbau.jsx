// Aufbau wie in der App (Codeschmiede 0.9.12, Anweisung Gerhard 25.10.2026 23:31):
//   Obergruppe (ws_bereiche, app_teil app|erp) = Menübereich · Gruppe (ws_gruppen, app_key) = Menüpunkt · Feature = Inhalt des Menüpunkts.
// Der Stand entspricht src/lib/appStruktur.js + src/lib/appStruktur.features.json im Projekt (Datenbank 0044).
// Ändert der Admin den Aufbau (Gruppe auf eine andere Obergruppe ziehen, Reihenfolge, neue Obergruppe, umbenennen, Feature verschieben),
// protokolliert die Datenbank das (ws_aufbau_aenderungen). „In die App übernehmen“ macht daraus EINEN Auftrag mit der neuen Fassung
// beider Dateien und der Liste der Änderungen – er läuft wie jeder Auftrag über Freigabe, Prüfungen und Live.
import React, { useState } from "react";
import { Shuffle, Send, Loader2, X, FolderPlus, Trash2 } from "lucide-react";
import { supabase } from "./supabase";

const card = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const btn = "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-semibold transition";
const ghost = "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition";
const input = "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-500";
const fehler = (e) => (e?.message || "Unbekannter Fehler").replace(/^.*?ERROR:\s*/, "");

/** Anzeigename einer Obergruppe (ERP-Bereiche mit Vorsilbe). */
export const bereichName = (b) => (b?.app_teil === "erp" ? `ERP · ${b.name}` : b?.name || "");
/** Gruppe gehört zum Menü der App bzw. des ERP, hat aber (noch) keinen Menüpunkt. */
export const ohneMenue = (g, b) => !g.app_key && (b?.app_teil === "app" || b?.app_teil === "erp");

const reihe = (a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0) || String(a.name).localeCompare(String(b.name), "de");
// stunden = geschätzt + gemessen (Werkstatt-Laufzeit), verkauf = Verkaufs-Feature der Preiskalkulation (0.9.13)
const stunden = (f) => Math.round(((Number(f.stunden_schaetzung) || 0) + (Number(f.stunden_gemessen) || 0)) * 10) / 10;
const fz = (f) => ({ id: f.id, name: f.name, ...(f.beschreibung ? { beschreibung: f.beschreibung } : {}), ...(f.stand && f.stand !== "live" ? { stand: f.stand } : {}), ...(stunden(f) ? { stunden: stunden(f) } : {}), ...(f.verkauf_key ? { verkauf: f.verkauf_key } : {}) });

/** Neuer Stand beider Dateien aus der Datenbank (nur Gruppen mit Menüpunkt; ausgebaute Features fallen weg). */
export function aufbauAusDaten(d) {
  const fe = (gid) => d.features.filter((f) => f.gruppe_id === gid && !f.ausgebaut).sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0) || a.id.localeCompare(b.id)).map(fz);
  const teil = (t) => d.bereiche.filter((b) => b.app_teil === t).sort(reihe);
  const og = (t, mitSymbol) => teil(t).map((b) => ({
    key: t === "erp" ? b.id.replace(/^erp-/, "") : b.id, label: b.name, ...(mitSymbol && b.symbol ? { icon: b.symbol } : {}),
    gruppen: d.gruppen.filter((g) => g.bereich_id === b.id && g.app_key).sort(reihe).map((g) => ({ key: g.app_key, label: g.name })),
  }));
  const app = og("app", false); const erp = og("erp", true);
  // Startbereich hat in der App keine Überschrift
  for (const o of app) if (o.key === "start") o.label = null;
  const features = { version: 1, hinweis: "Features je Menüpunkt – gleicher Stand wie die Codeschmiede (src/lib/appStruktur.js). Nummern nie ändern.", app: {}, erp: {}, global: [], website: [], altlast: [], geplant: {} };
  for (const t of ["app", "erp"]) for (const b of teil(t)) for (const g of d.gruppen.filter((x) => x.bereich_id === b.id && x.app_key).sort(reihe)) features[t][g.app_key] = fe(g.id);
  for (const [t, ziel] of [["global", "global"], ["website", "website"], ["sonst", "altlast"]]) {
    for (const b of teil(t)) for (const g of d.gruppen.filter((x) => x.bereich_id === b.id && x.id !== "werkstatt").sort(reihe)) features[ziel].push(...fe(g.id));
  }
  // geplante Gruppen ohne Menüpunkt: ihre Features bleiben in der Datei (Abschnitt „geplant“, Schlüssel = Gruppe der Codeschmiede)
  const geplant = d.gruppen.filter((g) => ohneMenue(g, d.bereiche.find((b) => b.id === g.bereich_id))).map((g) => ({ id: g.id, gruppe: g.name, obergruppe: bereichName(d.bereiche.find((b) => b.id === g.bereich_id)), features: fe(g.id) }));
  for (const g of geplant) if (g.features.length) features.geplant[g.id] = g.features;
  return { app: { obergruppen: app }, erp: { obergruppen: erp }, features, geplant };
}

/** Text des Auftrags „Aufbau übernehmen“. */
export function aufbauAuftragText(d, aenderungen) {
  const a = aufbauAusDaten(d);
  const liste = aenderungen.map((x) => `- ${x.text}`).join("\n");
  const verschoben = aenderungen.filter((x) => x.art === "feature_gruppe");
  return [
    "Aufbau übernehmen (Codeschmiede › Zentrale, Anweisung Gerhard 25.10.2026 23:31): Der Aufbau der App wurde in der Codeschmiede geändert.",
    "",
    "Änderungen:",
    liste,
    "",
    "So umsetzen:",
    "1. In `src/lib/appStruktur.js` die Abschnitte `app` und `erp` von `APP_STRUKTUR` EXAKT durch die Fassung unten ersetzen (Format wie bisher: gruppen als { key, label }). Kommentare und Funktionen bleiben.",
    "2. `src/lib/appStruktur.features.json` EXAKT durch die Fassung unten ersetzen.",
    verschoben.length
      ? "3. Verschobene Features: den Inhalt im Code vom alten in den neuen Menüpunkt umziehen (Reiter/Unterseite/Komponente), Verweise, Rechte und Handbuch-Kapitel nachziehen – nichts darf verloren gehen."
      : "3. Es wurden keine Features zwischen Menüpunkten verschoben – reine Menü-Änderung.",
    "4. Neue Obergruppen erscheinen im Menü automatisch, sobald sie einen Menüpunkt enthalten. Geplante Gruppen ohne Menüpunkt (Liste ganz unten) NICHT als Menüpunkt anlegen – ihre Features stehen im Abschnitt „geplant“ der Datei.",
    "5. `node tools/struktur_pruefen.mjs` muss grün sein; Handbuch (Navigation/Kapitel), docs/CHANGELOG.md und docs/AUFBAU.md ergänzen.",
    "",
    "Neue Fassung `app` / `erp`:",
    "```json",
    JSON.stringify({ app: a.app, erp: a.erp }, null, 1),
    "```",
    "",
    "Neue Fassung `src/lib/appStruktur.features.json`:",
    "```json",
    JSON.stringify(a.features, null, 1),
    "```",
    ...(a.geplant.length ? ["", "Geplante Gruppen ohne Menüpunkt (nur zur Info):", ...a.geplant.map((g) => `- ${g.obergruppe} › ${g.gruppe} (${g.features.length} Features)`)] : []),
  ].join("\n");
}

/** Hinweis „Aufbau geändert“ mit Liste und Knopf „In die App übernehmen“ (nur Admin). */
export function AufbauBanner({ d, ich, offen, toast, onFertig }) {
  const [auf, setAuf] = useState(false); const [busy, setBusy] = useState(false);
  if (ich.rolle !== "admin" || !offen?.length) return null;
  const projekt = d.projekte.find((p) => p.id === d.projektId);
  const ziel = d.gruppen.find((g) => g.id === "global-einstellungen") || d.gruppen.find((g) => d.bereiche.find((b) => b.id === g.bereich_id)?.global) || d.gruppen[0];
  const uebernehmen = async () => {
    if (!ziel) return; setBusy(true);
    try {
      const titel = `Aufbau übernehmen: ${offen.length} Änderung${offen.length === 1 ? "" : "en"}`;
      const { data, error } = await supabase.from("ws_auftraege").insert({ gruppe_id: ziel.id, titel, art: "aendern", erstellt_von: ich.id }).select().single();
      if (error) throw error;
      const r = await supabase.from("ws_nachrichten").insert({ auftrag_id: data.id, von: ich.id, art: "text", text: aufbauAuftragText(d, offen), kanal: "codeschmiede" });
      if (r.error) throw r.error;
      // nur die Änderungen, die im Text stehen (später entstandene bleiben offen)
      const u = await supabase.rpc("ws_aufbau_uebergeben", { p_projekt: d.projektId, p_auftrag: data.id, p_bis: Math.max(...offen.map((x) => x.id)) });
      if (u.error) throw u.error;
      toast(`Auftrag #${data.id} angelegt – der Aufbau geht wie jede Änderung über Freigabe und Prüfungen in ${projekt?.name || "die App"}`);
      setAuf(false); onFertig?.();
    } catch (e) { toast(fehler(e)); } finally { setBusy(false); }
  };
  return (
    <div className={`${card} mb-4 border-orange-300 dark:border-orange-800 bg-orange-50/60 dark:bg-orange-950/30 px-4 py-3`} role="status">
      <div className="flex flex-wrap items-center gap-3">
        <Shuffle className="w-5 h-5 text-orange-600" />
        <div className="flex-1 min-w-[220px]"><b>Aufbau geändert:</b> {offen.length} Änderung{offen.length === 1 ? "" : "en"} noch nicht in der App.
          <button type="button" className="ml-2 text-sm underline text-orange-800 dark:text-orange-200" onClick={() => setAuf(!auf)}>{auf ? "ausblenden" : "ansehen"}</button></div>
        <button type="button" className={btn} disabled={busy || !ziel} onClick={uebernehmen}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}In die App übernehmen</button>
      </div>
      {auf && <ul className="mt-2 text-sm grid gap-0.5 list-disc pl-6 text-slate-700 dark:text-slate-300">{offen.map((x) => <li key={x.id}>{x.text}</li>)}</ul>}
      <p className="text-xs text-slate-500 mt-1.5">Die Codeschmiede zeigt den neuen Aufbau sofort. In der App wirkt er, sobald der Auftrag freigegeben, geprüft und zusammengeführt ist (Testfassung) bzw. live geschaltet wird.</p>
    </div>
  );
}

/** Dialog: neue Obergruppe (App oder ERP). */
export function NeueObergruppe({ d, toast, onClose, onFertig }) {
  const [name, setName] = useState(""); const [teil, setTeil] = useState("app"); const [busy, setBusy] = useState(false);
  const anlegen = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("ws_bereich_anlegen", { p_projekt: d.projektId, p_name: name, p_teil: teil });
    setBusy(false);
    if (error) toast(fehler(error)); else { toast(`Obergruppe „${name.trim()}“ angelegt – jetzt Gruppen hineinziehen`); onFertig?.(data); onClose(); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Neue Obergruppe">
      <div className={`${card} w-full max-w-md p-5 grid gap-3`}>
        <div className="flex items-center justify-between"><h2 className="font-display font-bold text-xl flex items-center gap-2"><FolderPlus className="w-5 h-5 text-emerald-700" />Neue Obergruppe</h2><button type="button" onClick={onClose} aria-label="Schließen"><X className="w-5 h-5" /></button></div>
        <label className="grid gap-1 text-sm font-semibold">Name<input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Ausbildung" maxLength={40} autoFocus /></label>
        <div className="grid gap-1 text-sm font-semibold">Wo?
          <div className="flex gap-2">{[["app", "Menü der App"], ["erp", "Plattform-ERP"]].map(([k, l]) => <label key={k} className={`flex-1 rounded-lg border px-3 py-2 cursor-pointer text-sm ${teil === k ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" : "border-slate-300 dark:border-slate-700"}`}><input type="radio" className="sr-only" checked={teil === k} onChange={() => setTeil(k)} />{l}</label>)}</div>
        </div>
        <p className="text-xs text-slate-500">Die Obergruppe erscheint im Menü, sobald eine Gruppe darin liegt und der Aufbau übernommen ist.</p>
        <div className="flex justify-end gap-2"><button type="button" className={ghost} onClick={onClose}>Abbrechen</button><button type="button" className={btn} disabled={busy || name.trim().length < 2} onClick={anlegen}>Anlegen</button></div>
      </div>
    </div>
  );
}

/** Kleiner Dialog: umbenennen (Obergruppe oder Gruppe). */
export function Umbenennen({ titel, alt, onClose, onSpeichern }) {
  const [name, setName] = useState(alt || ""); const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={titel}>
      <div className={`${card} w-full max-w-md p-5 grid gap-3`}>
        <div className="flex items-center justify-between"><h2 className="font-display font-bold text-xl">{titel}</h2><button type="button" onClick={onClose} aria-label="Schließen"><X className="w-5 h-5" /></button></div>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus aria-label="Neuer Name" />
        <p className="text-xs text-slate-500">Der neue Name gilt nach „In die App übernehmen“ auch im Menü der App.</p>
        <div className="flex justify-end gap-2"><button type="button" className={ghost} onClick={onClose}>Abbrechen</button>
          <button type="button" className={btn} disabled={busy || name.trim().length < 2 || name.trim() === alt} onClick={async () => { setBusy(true); await onSpeichern(name.trim()); setBusy(false); }}>Speichern</button></div>
      </div>
    </div>
  );
}

// Gruppe löschen (Anweisung Gerhard 26.10.2026 08:07, „Ohne Menüpunkt und leer“): nur geplante/ungenutzte Gruppen ohne Menüpunkt,
// ohne Features und ohne Aufträge. Gibt den Grund zurück, warum es (noch) nicht geht – sonst null. Die Datenbank prüft dasselbe (0048).
export function gruppeLoeschbar(g, b, d, konzeptId) {
  if (!g || !b) return "Gruppe nicht gefunden";
  if (b.global) return "Gruppen der globalen Einstellungen bleiben";
  if (g.app_key) return "Menüpunkt der App – entfernen nur über einen Ausbau-Auftrag";
  if (g.id === konzeptId || (d.projekte || []).some((p) => [p.design_gruppe_id, p.konzept_gruppe_id, p.db_gruppe_id].includes(g.id))) return "Wird vom Projekt verwendet (Konzept, Designer oder Datenbank)";
  const nf = (d.features || []).filter((f) => f.gruppe_id === g.id).length;
  if (nf) return `Enthält noch ${nf} Feature${nf > 1 ? "s" : ""} – zuerst verschieben`;
  if ((d.auftraege || []).some((a) => a.gruppe_id === g.id)) return "Hat Aufträge – bleibt als Verlauf erhalten";
  return null;
}

export function GruppeLoeschen({ g, onClose, onLoeschen }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Gruppe löschen">
      <div className={`${card} w-full max-w-md p-5 grid gap-3`}>
        <div className="flex items-center justify-between"><h2 className="font-display font-bold text-xl">Gruppe löschen</h2><button type="button" onClick={onClose} aria-label="Schließen"><X className="w-5 h-5" /></button></div>
        <p>Die Gruppe <b>„{g.name}“</b> ist leer und hat keinen Menüpunkt in der App. Sie wird endgültig entfernt.</p>
        <p className="text-xs text-slate-500">Aufgaben, die dieser Gruppe zugeordnet waren, bleiben erhalten (ohne Gruppe). Die Änderung erscheint unter „In die App übernehmen“.</p>
        <div className="flex justify-end gap-2"><button type="button" className={ghost} onClick={onClose}>Abbrechen</button>
          <button type="button" className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-sm font-semibold" disabled={busy}
            onClick={async () => { setBusy(true); await onLoeschen(); setBusy(false); }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Löschen</button></div>
      </div>
    </div>
  );
}
