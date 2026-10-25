// Aufgaben (Entwurf freigegeben von Gerhard 2026-10-25 13:50, Datenbank 0042).
// Jede Aufgabe gehört zu einem Projekt; alle Mitglieder sehen sie, Admin/Entwickler/Texter bearbeiten (Leser nur lesen – prüft die Datenbank).
// Felder: Titel, Beschreibung, Status, Priorität, Fällig am, Zuständig, Bezug (Feature ODER Gruppe), Links (nur https), Fotos/Dateien.
// „In den Chat schicken“: Die Aufgabe erscheint im Chat des Features bzw. der Gruppe als Karte; dort macht man mit „Als Auftrag“ wie gewohnt
// einen Auftrag daraus (ws_aufgabe_als_auftrag, normale Auftragsrechte). Anhänge liegen im privaten Speicher „ws-aufgaben“ und werden nur über
// signierte, zeitlich begrenzte Adressen angezeigt. Links werden nur als Link gezeigt, nie automatisch geladen.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList, Plus, Loader2, Save, Trash2, Send, X, Paperclip, Link2, FileText, CalendarDays, ImageIcon, Download, ExternalLink,
  MessageSquare, Undo2, Info, User, ShieldAlert,
} from "lucide-react";
import { supabase } from "./supabase";
import { isDesktop, tauri } from "./desktop";

const btn = "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-semibold transition";
const ghost = "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition";
const card = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const input = "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-[15px] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500";
const label = "flex flex-col gap-1 text-[13px] font-semibold text-slate-600 dark:text-slate-300";
const fehler = (e) => (e?.message || "Unbekannter Fehler").replace(/^.*?ERROR:\s*/, "");
const wann = (t) => new Date(t).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const datum = (t) => new Date(`${t}T12:00:00`).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
const BUCKET = "ws-aufgaben";

export const STATUS = { offen: "Offen", arbeit: "In Arbeit", erledigt: "Erledigt" };
const STATUS_CLS = { offen: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200", arbeit: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300", erledigt: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" };
export const PRIO = { hoch: "Hoch", mittel: "Mittel", niedrig: "Niedrig" };
const PRIO_CLS = { hoch: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300", mittel: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", niedrig: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" };
const PRIO_REIHE = { hoch: 0, mittel: 1, niedrig: 2 };

// ---------- Prüfungen (gleich wie in der Datenbank, 0042) ----------
// Erlaubte Anhänge: Endung → [Typ, Art, Höchstgröße]
const TYPEN = {
  png: ["image/png", "bild", 5], jpg: ["image/jpeg", "bild", 5], jpeg: ["image/jpeg", "bild", 5], webp: ["image/webp", "bild", 5],
  pdf: ["application/pdf", "datei", 10], txt: ["text/plain", "datei", 10], csv: ["text/csv", "datei", 10],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "datei", 10],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "datei", 10],
};
export const MAX_ANHAENGE = 20;
const ANNEHMEN = ".png,.jpg,.jpeg,.webp,.pdf,.txt,.csv,.docx,.xlsx";
const LINK = /^https:\/\/[A-Za-z0-9]([A-Za-z0-9-]{0,62}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,62}[A-Za-z0-9])?)+(:[0-9]{1,5})?([/?#][!#$%&()*+,./0-9:;=?@A-Z[\]_a-z~-]*)?$/;
const SCHLUESSEL = /[?&#;](access_token|id_token|refresh_token|token|api_?key|access_?key|key|secret|client_secret|credentials?|password|passwort|pass|pwd|sig|signature|auth|code|session|sid|jwt|x-(amz|goog)-[a-z-]*)=/i;
// eslint-disable-next-line no-control-regex
const UNSICHTBAR = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2028\u2029\u2066-\u2069\ufeff]/;
/** Link prüfen → Fehlertext oder "" (nur https, keine Zugangsdaten in der Adresse). */
export function linkFehler(url) {
  const u = String(url || "").trim();
  if (!u.startsWith("https://")) return "Nur Adressen mit https:// sind erlaubt.";
  if (u.length > 2000 || !LINK.test(u)) return "Die Adresse ist ungültig (keine Leerzeichen, keine Anmeldedaten wie name:passwort@).";
  if (SCHLUESSEL.test(u)) return "Die Adresse enthält einen Zugangsschlüssel (z. B. token= oder key=) – bitte ohne ihn einfügen.";
  return "";
}

// Dateikennung prüfen, bevor hochgeladen wird (eine umbenannte Datei wird abgelehnt)
async function inhaltPasst(datei, endung) {
  const b = new Uint8Array(await datei.slice(0, 4096).arrayBuffer());
  const s = (a, z) => String.fromCharCode(...b.subarray(a, z));
  if (endung === "png") return b[0] === 0x89 && s(1, 4) === "PNG" && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a;
  if (endung === "jpg" || endung === "jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (endung === "webp") return s(0, 4) === "RIFF" && s(8, 12) === "WEBP";
  if (endung === "pdf") return s(0, 5) === "%PDF-";
  if (endung === "docx" || endung === "xlsx") return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
  if (endung === "txt" || endung === "csv") { if (b.includes(0)) return false; try { new TextDecoder("utf-8", { fatal: true }).decode(b.length === 4096 ? b.subarray(0, 4092) : b); return true; } catch { return false; } }
  return false;
}
/** Datei vor dem Hochladen prüfen → { mime, art } oder Fehlertext. */
async function dateiPruefen(datei) {
  const endung = (/\.([A-Za-z0-9]{1,5})$/.exec(datei.name)?.[1] || "").toLowerCase();
  const t = TYPEN[endung];
  if (!t) return "Erlaubt sind Bilder (PNG, JPG, WebP) und Dateien (PDF, TXT, CSV, DOCX, XLSX).";
  if (!datei.size) return "Die Datei ist leer.";
  if (datei.size > t[2] * 1024 * 1024) return t[1] === "bild" ? "Bilder höchstens 5 MB." : "Dateien höchstens 10 MB.";
  if (!(await inhaltPasst(datei, endung))) return `„${datei.name}“ ist keine echte ${endung.toUpperCase()}-Datei.`;
  return { mime: t[0], art: t[1] };
}

const oeffneExtern = (url) => { if (isDesktop()) tauri("plugin:opener|open_url", { url }).catch(() => {}); else window.open(url, "_blank", "noopener,noreferrer"); };

// ---------- Kleine Bausteine ----------
const Pille = ({ cls, children }) => <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>{children}</span>;

// Link nur als Link: kein Vorschaubild, kein automatisches Laden; Öffnen im Browser des Systems ohne Verweis-Angabe
export function SichererLink({ titel, url }) {
  if (linkFehler(url)) return <span className="text-sm text-slate-500 inline-flex items-center gap-1.5"><Link2 className="w-4 h-4" />{titel} (ungültige Adresse)</span>;
  let host = ""; try { host = new URL(url).host; } catch { /* geprüft oben */ }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" title={url}
      onClick={(e) => { if (isDesktop()) { e.preventDefault(); oeffneExtern(url); } }}
      className="inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400 hover:underline min-w-0">
      <Link2 className="w-4 h-4 shrink-0" /><span className="truncate">{titel}</span><span className="text-xs text-slate-500 truncate">· {host}</span><ExternalLink className="w-3.5 h-3.5 shrink-0" />
    </a>);
}

// Signierte Adressen (10 Minuten) für Vorschaubilder – erst beim Anzeigen erzeugt, nach Ablauf neu
function useVorschau(pfade) {
  const [urls, setUrls] = useState({});
  const key = pfade.join("|");
  useEffect(() => {
    if (!pfade.length) { setUrls({}); return undefined; }
    let aus = false;
    const holen = async () => {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrls(pfade, 600);
      if (!aus) setUrls(Object.fromEntries((data || []).filter((x) => x.signedUrl && !x.error).map((x) => [x.path, x.signedUrl])));
    };
    holen(); const t = setInterval(holen, 9 * 60 * 1000);
    return () => { aus = true; clearInterval(t); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return urls;
}

// Lösch-Warteschlange abarbeiten (Datenbank 0042): Dateien gelöschter Anhänge im Speicher entfernen und austragen.
// Läuft nach jedem Löschen und beim Öffnen der Aufgaben (holt auch liegengebliebene nach). Fehler werden gemeldet.
export async function dateienAufraeumen(toast) {
  const { data, error } = await supabase.from("ws_aufgabe_dateien_weg").select("pfad").order("erstellt").limit(200);
  if (error || !data?.length) return;
  const pfade = data.map((x) => x.pfad);
  const weg = await supabase.storage.from(BUCKET).remove(pfade);
  if (weg.error) { toast?.(`Dateien im Speicher nicht gelöscht: ${fehler(weg.error)} – wird beim nächsten Öffnen wiederholt`); return; }
  const { error: e2 } = await supabase.rpc("ws_aufgabe_dateien_erledigt", { p_pfade: pfade });
  if (e2) toast?.(`Löschen nicht vermerkt: ${fehler(e2)}`);
}

async function herunterladen(a, toast) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.pfad, 120, { download: a.dateiname });
  if (error || !data?.signedUrl) return toast?.(error ? fehler(error) : "Datei nicht verfügbar");
  oeffneExtern(data.signedUrl);
}

/** Anhänge anzeigen: Bilder als Vorschau, Dateien als Download. onEntfernen optional. */
export function AnhangListe({ anhaenge, toast, onEntfernen, klein }) {
  const bilder = anhaenge.filter((a) => a.art === "bild"); const dateien = anhaenge.filter((a) => a.art !== "bild");
  const urls = useVorschau(bilder.map((a) => a.pfad));
  if (!anhaenge.length) return null;
  const gr = klein ? "w-20 h-14" : "w-24 h-[72px]";
  return (
    <div className="flex flex-col gap-2">
      {bilder.length > 0 && <div className="flex flex-wrap gap-2">
        {bilder.map((a) => (
          <figure key={a.id} className={`relative ${gr} rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 group`}>
            <button type="button" className="w-full h-full" title={`${a.dateiname} – groß ansehen`} onClick={() => herunterladen(a, toast)}>
              {urls[a.pfad] ? <img src={urls[a.pfad]} alt={a.dateiname} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                : <span className="grid place-items-center w-full h-full text-slate-400"><ImageIcon className="w-5 h-5" /></span>}
            </button>
            <figcaption className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[10px] px-1 truncate">{a.dateiname}</figcaption>
            {onEntfernen && <button type="button" title="Entfernen" aria-label={`${a.dateiname} entfernen`} onClick={() => onEntfernen(a)} className="absolute top-1 right-1 p-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 focus:opacity-100"><X className="w-3.5 h-3.5" /></button>}
          </figure>))}
      </div>}
      {dateien.map((a) => (
        <div key={a.id} className="flex items-center gap-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 min-w-0">
          <FileText className="w-4 h-4 shrink-0 text-slate-500" /><span className="truncate flex-1 min-w-0">{a.dateiname}</span>
          <span className="text-xs text-slate-500 tabular-nums">{(a.groesse / 1024 / 1024).toFixed(1).replace(".", ",")} MB</span>
          <button type="button" className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Herunterladen" aria-label={`${a.dateiname} herunterladen`} onClick={() => herunterladen(a, toast)}><Download className="w-4 h-4" /></button>
          {onEntfernen && <button type="button" className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Entfernen" aria-label={`${a.dateiname} entfernen`} onClick={() => onEntfernen(a)}><Trash2 className="w-4 h-4" /></button>}
        </div>))}
    </div>);
}

// ---------- Daten ----------
function useAufgabenDaten(projektId) {
  const [d, setD] = useState({ aufgaben: null, anhaenge: [], sendungen: [], fehlt: false });
  const timer = useRef(null);
  const holen = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from("ws_aufgaben").select("*").eq("projekt_id", projektId).order("id", { ascending: false }).limit(1000),
      supabase.from("ws_aufgabe_anhaenge").select("*").eq("projekt_id", projektId).eq("fertig", true).order("id").limit(5000),
      supabase.from("ws_aufgabe_sendungen").select("id, aufgabe_id, gruppe_id, feature_id, von, erstellt, auftrag_id, als_auftrag_am, zurueckgezogen").eq("projekt_id", projektId).order("id").limit(5000),
    ]);
    setD({ aufgaben: a.data || [], anhaenge: b.data || [], sendungen: c.data || [], fehlt: !!a.error });
  }, [projektId]);
  useEffect(() => {
    holen();
    const ch = supabase.channel(`cs-aufgaben-${projektId}-${Math.random()}`);
    ["ws_aufgaben", "ws_aufgabe_anhaenge", "ws_aufgabe_sendungen"].forEach((t) =>
      ch.on("postgres_changes", { event: "*", schema: "public", table: t, filter: `projekt_id=eq.${projektId}` }, () => { clearTimeout(timer.current); timer.current = setTimeout(holen, 250); }));
    ch.subscribe();
    return () => { supabase.removeChannel(ch); clearTimeout(timer.current); };
  }, [holen, projektId]);
  return { ...d, holen };
}

/** Zahl offener Aufgaben, die mir zugewiesen sind (Plakette im Menü). Ohne Datenbank 0042: 0. */
export function useMeineAufgaben(projektId, ichId) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!projektId || !ichId) { setN(0); return undefined; }
    let aus = false;
    const holen = async () => {
      const { count, error } = await supabase.from("ws_aufgaben").select("id", { count: "exact", head: true })
        .eq("projekt_id", projektId).eq("zustaendig", ichId).neq("status", "erledigt");
      if (!aus) setN(error ? 0 : count || 0);
    };
    holen();
    const ch = supabase.channel(`cs-meine-aufgaben-${projektId}-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ws_aufgaben", filter: `projekt_id=eq.${projektId}` }, holen).subscribe();
    return () => { aus = true; supabase.removeChannel(ch); };
  }, [projektId, ichId]);
  return n;
}

// Wer im Projekt? (Zuständig: Mitglieder des Projekts und Admins)
function personen(d) {
  const ids = new Set(d.mitglieder.filter((m) => m.projekt_id === d.projektId).map((m) => m.benutzer_id));
  return d.benutzer.filter((u) => u.aktiv && (ids.has(u.id) || u.rolle === "admin")).sort((a, b) => a.name.localeCompare(b.name, "de"));
}
const rolleVon = (d, ich) => (ich.rolle === "admin" ? "admin" : d.mitglieder.find((m) => m.projekt_id === d.projektId && m.benutzer_id === ich.id)?.rolle);

// ---------- Seite „Aufgaben“ ----------
export default function Aufgaben({ d, ich, toast, onOeffneChat }) {
  const daten = useAufgabenDaten(d.projektId);
  useEffect(() => { dateienAufraeumen(toast); }, [d.projektId]); // eslint-disable-line react-hooks/exhaustive-deps
  const rolle = rolleVon(d, ich);
  const kann = ["admin", "entwickler", "texter"].includes(rolle);
  const [filter, setFilter] = useState("offen"); const [wer, setWer] = useState("alle");
  const [sel, setSel] = useState(null);       // id oder "neu"
  const leute = useMemo(() => personen(d), [d]);
  const name = (id) => d.benutzer.find((u) => u.id === id)?.name || "Mitglied";
  const konzeptId = d.projekte.find((p) => p.id === d.projektId)?.konzept_gruppe_id;
  const gruppen = d.gruppen.filter((g) => g.id !== konzeptId);
  const features = d.features.filter((f) => !f.ausgebaut && gruppen.some((g) => g.id === f.gruppe_id));
  const bezug = (a) => (a.feature_id ? `Feature · ${d.features.find((f) => f.id === a.feature_id)?.name || a.feature_id}` : a.gruppe_id ? `Gruppe · ${d.gruppen.find((g) => g.id === a.gruppe_id)?.name || a.gruppe_id}` : "");
  const ziel = (s) => (s.feature_id ? `Feature · ${d.features.find((f) => f.id === s.feature_id)?.name || s.feature_id}` : `Gruppe · ${d.gruppen.find((g) => g.id === s.gruppe_id)?.name || s.gruppe_id}`);

  if (daten.fehlt) return <div className={`${card} p-6 text-sm text-slate-500 flex items-center gap-2`}><Info className="w-5 h-5" />Die Aufgaben brauchen die Datenbank 0042 (supabase/migrations/0042_aufgaben.sql). Bitte einspielen.</div>;
  if (daten.aufgaben === null) return <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Lädt …</p>;

  const zahl = (s) => daten.aufgaben.filter((a) => s === "alle" || a.status === s).length;
  const sicht = daten.aufgaben
    .filter((a) => filter === "alle" || a.status === filter)
    .filter((a) => wer === "alle" || (wer === "ohne" ? !a.zustaendig : a.zustaendig === wer))
    .sort((a, b) => (a.status === "erledigt") - (b.status === "erledigt") || PRIO_REIHE[a.prioritaet] - PRIO_REIHE[b.prioritaet]
      || (a.faellig || "9999").localeCompare(b.faellig || "9999") || b.id - a.id);
  const aktuell = sel === "neu" ? null : daten.aufgaben.find((a) => a.id === sel) || null;

  return (
    <section className="flex flex-col gap-3" aria-label="Aufgaben">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5" role="group" aria-label="Status-Filter">
          {[["offen", "Offen"], ["arbeit", "In Arbeit"], ["erledigt", "Erledigt"], ["alle", "Alle"]].map(([k, t]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
              className={`px-2.5 py-1 rounded-md text-sm ${filter === k ? "bg-emerald-700 text-white font-semibold" : "text-slate-600 dark:text-slate-300"}`}>{t} <span className="tabular-nums opacity-80">{zahl(k)}</span></button>))}
        </div>
        <label className="sr-only" htmlFor="ws-aufgaben-wer">Zuständig</label>
        <select id="ws-aufgaben-wer" className={`${input} !w-auto !py-1.5 text-sm`} value={wer} onChange={(e) => setWer(e.target.value)}>
          <option value="alle">Alle Personen</option>
          <option value={ich.id}>Mir zugewiesen</option>
          {leute.filter((u) => u.id !== ich.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          <option value="ohne">Ohne Zuständige</option>
        </select>
        <span className="flex-1" />
        {kann && <button type="button" className={btn} onClick={() => setSel("neu")}><Plus className="w-4 h-4" />Neue Aufgabe</button>}
      </div>

      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] items-start">
        <ul className="flex flex-col gap-2" aria-label="Liste der Aufgaben">
          {!sicht.length && <li className={`${card} p-6 text-sm text-slate-500 text-center`}>{daten.aufgaben.length ? "Keine Aufgaben in dieser Ansicht." : "Noch keine Aufgaben. Mit „Neue Aufgabe“ hältst du fest, was geändert werden soll – mit Screenshots, Dateien und Links."}</li>}
          {sicht.map((a) => {
            const an = daten.anhaenge.filter((x) => x.aufgabe_id === a.id); const nb = an.filter((x) => x.art === "bild").length;
            const letzte = [...daten.sendungen].reverse().find((s) => s.aufgabe_id === a.id && !s.zurueckgezogen);
            const ueberfaellig = a.faellig && a.status !== "erledigt" && a.faellig < new Date().toISOString().slice(0, 10);
            return (
              <li key={a.id}>
                <button type="button" aria-current={sel === a.id} onClick={() => setSel(a.id)}
                  className={`w-full text-left ${card} p-3 flex flex-col gap-1.5 ${sel === a.id ? "border-emerald-600 ring-1 ring-emerald-600" : "hover:border-emerald-600"} ${a.status === "erledigt" ? "opacity-70" : ""}`}>
                  <div className="flex items-start gap-2"><span className="font-display font-semibold text-[16px] leading-tight flex-1 min-w-0">{a.titel}</span>
                    <Pille cls={PRIO_CLS[a.prioritaet]}>{PRIO[a.prioritaet]}</Pille><Pille cls={STATUS_CLS[a.status]}>{STATUS[a.status]}</Pille></div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {a.faellig && <span className={`inline-flex items-center gap-1 ${ueberfaellig ? "text-red-700 dark:text-red-400 font-semibold" : ""}`}><CalendarDays className="w-3.5 h-3.5" />fällig {datum(a.faellig)}</span>}
                    {bezug(a) && <span>{bezug(a)}</span>}
                    {a.zustaendig && <span className="inline-flex items-center gap-1"><User className="w-3.5 h-3.5" />{name(a.zustaendig)}</span>}
                    {nb > 0 && <span className="inline-flex items-center gap-1" title="Bilder"><ImageIcon className="w-3.5 h-3.5" />{nb}</span>}
                    {an.length - nb > 0 && <span className="inline-flex items-center gap-1" title="Dateien"><FileText className="w-3.5 h-3.5" />{an.length - nb}</span>}
                    {a.links.length > 0 && <span className="inline-flex items-center gap-1" title="Links"><Link2 className="w-3.5 h-3.5" />{a.links.length}</span>}
                    {letzte && <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold"><MessageSquare className="w-3.5 h-3.5" />im Chat: {ziel(letzte)}{letzte.auftrag_id ? ` · Auftrag #${letzte.auftrag_id}` : ""}</span>}
                  </div>
                </button>
              </li>);
          })}
        </ul>

        <div className="lg:sticky lg:top-3">
          {sel === "neu" || aktuell
            ? <Detail key={aktuell?.id || "neu"} a={aktuell} d={d} ich={ich} kann={kann} toast={toast} leute={leute} gruppen={gruppen} features={features}
                anhaenge={aktuell ? daten.anhaenge.filter((x) => x.aufgabe_id === aktuell.id) : []} sendungen={aktuell ? daten.sendungen.filter((s) => s.aufgabe_id === aktuell.id) : []}
                ziel={ziel} name={name} onNeu={(id) => { setSel(id); daten.holen(); }} onWeg={() => { setSel(null); daten.holen(); }} onAenderung={daten.holen} onOeffneChat={onOeffneChat} />
            : <div className={`${card} p-6 text-sm text-slate-500`}>Aufgabe links wählen{kann ? " oder „Neue Aufgabe“ anlegen" : ""}.</div>}
        </div>
      </div>
    </section>);
}

const leer = { titel: "", beschreibung: "", status: "offen", prioritaet: "mittel", faellig: "", zustaendig: "", bezug: "", links: [] };
const bezugWert = (a) => (a?.feature_id ? `f:${a.feature_id}` : a?.gruppe_id ? `g:${a.gruppe_id}` : "");

function Detail({ a, d, ich, kann, toast, leute, gruppen, features, anhaenge, sendungen, ziel, name, onNeu, onWeg, onAenderung, onOeffneChat }) {
  const [w, setW] = useState(() => (a ? { titel: a.titel, beschreibung: a.beschreibung, status: a.status, prioritaet: a.prioritaet, faellig: a.faellig || "", zustaendig: a.zustaendig || "", bezug: bezugWert(a), links: a.links || [] } : leer));
  const [busy, setBusy] = useState(""); const [neuLink, setNeuLink] = useState({ titel: "", url: "" }); const [loeschenSicher, setLoeschenSicher] = useState(false);
  const [sendeZiel, setSendeZiel] = useState(() => bezugWert(a));
  const dateiRef = useRef(null);
  const set = (k, v) => setW((x) => ({ ...x, [k]: v }));
  const geaendert = !a || ["titel", "beschreibung", "status", "prioritaet", "zustaendig"].some((k) => (w[k] || "") !== (a[k] || "")) || (w.faellig || "") !== (a.faellig || "") || w.bezug !== bezugWert(a) || JSON.stringify(w.links) !== JSON.stringify(a.links || []);
  const darfLoeschen = a && (ich.rolle === "admin" || (kann && a.erstellt_von === ich.id));
  const nurLesen = !kann;
  const titelFehler = w.titel.trim().length < 2 ? "Titel mit mindestens 2 Zeichen" : UNSICHTBAR.test(w.titel) ? "Der Titel enthält unsichtbare Zeichen" : "";

  const speichern = async () => {
    if (titelFehler) return toast(titelFehler);
    setBusy("speichern");
    const zeile = { titel: w.titel.trim().slice(0, 120), beschreibung: w.beschreibung.slice(0, 8000), status: w.status, prioritaet: w.prioritaet, faellig: w.faellig || null,
      zustaendig: w.zustaendig || null, feature_id: w.bezug.startsWith("f:") ? w.bezug.slice(2) : null, gruppe_id: w.bezug.startsWith("g:") ? w.bezug.slice(2) : null, links: w.links };
    const r = a ? await supabase.from("ws_aufgaben").update(zeile).eq("id", a.id).select("id").single()
      : await supabase.from("ws_aufgaben").insert({ ...zeile, projekt_id: d.projektId }).select("id").single();
    setBusy("");
    if (r.error) return toast(fehler(r.error));
    toast(a ? "Aufgabe gespeichert" : "Aufgabe angelegt – jetzt kannst du Fotos und Dateien anhängen");
    if (!a) onNeu(r.data.id); else onAenderung();
  };

  const linkDazu = () => {
    const t = neuLink.titel.trim() || (() => { try { return new URL(neuLink.url.trim()).host; } catch { return ""; } })();
    const f = linkFehler(neuLink.url); if (f) return toast(f);
    if (!t || t.length > 120 || UNSICHTBAR.test(t)) return toast("Bitte einen kurzen Titel für den Link (höchstens 120 Zeichen)");
    if (w.links.length >= 20) return toast("Höchstens 20 Links je Aufgabe");
    set("links", [...w.links, { titel: t, url: neuLink.url.trim() }]); setNeuLink({ titel: "", url: "" });
  };

  const hochladen = async (liste) => {
    if (!a) return;
    const dateien = [...liste];
    if (anhaenge.length + dateien.length > 20) return toast("Höchstens 20 Anhänge je Aufgabe");
    setBusy("hochladen");
    let ok = 0;
    for (const datei of dateien) {
      const p = await dateiPruefen(datei);
      if (typeof p === "string") { toast(p); continue; }
      const { data, error } = await supabase.rpc("ws_aufgabe_anhang_neu", { p_aufgabe: a.id, p_dateiname: datei.name, p_mime: p.mime, p_groesse: datei.size });
      const res = data?.[0];
      if (error || !res) { toast(error ? fehler(error) : "Anhang nicht angelegt"); continue; }
      const up = await supabase.storage.from(BUCKET).upload(res.pfad, datei, { contentType: p.mime, upsert: false, cacheControl: "60" });
      if (up.error) { await supabase.rpc("ws_aufgabe_anhang_loeschen", { p_id: res.id }); toast(`„${datei.name}“ nicht hochgeladen: ${fehler(up.error)}`); continue; }
      // Datenbank vergleicht Größe und Typ der angekommenen Datei mit der Reservierung; erst dann ist der Anhang sichtbar
      const best = await supabase.rpc("ws_aufgabe_anhang_bestaetigen", { p_id: res.id });
      if (best.error || best.data !== true) { toast(`„${datei.name}“ abgelehnt: ${best.error ? fehler(best.error) : "Größe oder Typ passen nicht"}`); continue; }
      ok++;
    }
    setBusy(""); if (dateiRef.current) dateiRef.current.value = "";
    if (ok < dateien.length) await dateienAufraeumen(toast);
    if (ok) { toast(ok === 1 ? "Anhang hochgeladen" : `${ok} Anhänge hochgeladen`); onAenderung(); }
  };
  const entfernen = async (x) => {
    const { error } = await supabase.rpc("ws_aufgabe_anhang_loeschen", { p_id: x.id });
    if (error) return toast(fehler(error));
    toast(`„${x.dateiname}“ entfernt`); onAenderung();
    await dateienAufraeumen(toast);
  };
  const loeschen = async () => {
    if (!loeschenSicher) { setLoeschenSicher(true); setTimeout(() => setLoeschenSicher(false), 6000); return; }
    setBusy("loeschen");
    const { error } = await supabase.rpc("ws_aufgabe_loeschen", { p_aufgabe: a.id });
    setBusy(""); if (error) return toast(fehler(error));
    toast("Aufgabe gelöscht"); onWeg();
    await dateienAufraeumen(toast);
  };
  const senden = async () => {
    if (geaendert) return toast("Bitte zuerst speichern – geschickt wird der gespeicherte Stand");
    if (!sendeZiel) return toast("Bitte ein Ziel wählen: Feature oder Gruppe");
    setBusy("senden");
    const { error } = await supabase.rpc("ws_aufgabe_senden", { p_aufgabe: a.id, p_feature: sendeZiel.startsWith("f:") ? sendeZiel.slice(2) : null, p_gruppe: sendeZiel.startsWith("g:") ? sendeZiel.slice(2) : null });
    setBusy("");
    if (error) return toast(fehler(error));
    toast("Im Chat – dort mit „Als Auftrag“ weitermachen"); onAenderung();
  };
  const zurueckziehen = async (s) => { const { error } = await supabase.rpc("ws_aufgabe_sendung_zurueckziehen", { p_sendung: s.id }); if (error) toast(fehler(error)); else { toast("Aus dem Chat zurückgezogen"); onAenderung(); } };
  const zumChat = (s) => onOeffneChat?.({ f: s.feature_id || null, g: s.feature_id ? d.features.find((f) => f.id === s.feature_id)?.gruppe_id || s.gruppe_id : s.gruppe_id });

  const zielAuswahl = (id, wert, onWert, mitLeer) => (
    <select id={id} className={input} value={wert} onChange={(e) => onWert(e.target.value)} disabled={nurLesen}>
      {mitLeer && <option value="">— kein Bezug —</option>}
      {!mitLeer && <option value="">Ziel wählen …</option>}
      {features.length > 0 && <optgroup label="Features">{features.map((f) => <option key={f.id} value={`f:${f.id}`}>Feature · {f.name}</option>)}</optgroup>}
      <optgroup label="Gruppen">{gruppen.map((g) => <option key={g.id} value={`g:${g.id}`}>Gruppe · {g.name}</option>)}</optgroup>
    </select>);

  return (
    <div className={`${card} p-4 flex flex-col gap-3`} aria-label={a ? `Aufgabe ${a.titel}` : "Neue Aufgabe"}>
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-emerald-700" /><h2 className="font-display font-bold text-lg flex-1 min-w-0 truncate">{a ? a.titel : "Neue Aufgabe"}</h2>
        {a && <span className="text-xs text-slate-500">#{a.id}</span>}
      </div>
      {nurLesen && <p className="text-xs text-slate-500 flex items-center gap-1.5"><Info className="w-4 h-4" />Als Leser siehst du die Aufgaben, bearbeiten können Admin, Entwickler und Texter.</p>}
      <label className={label} htmlFor="ws-aufgabe-titel">Titel
        <input id="ws-aufgabe-titel" className={input} value={w.titel} maxLength={120} disabled={nurLesen} onChange={(e) => set("titel", e.target.value)} placeholder="z. B. Schnellzugriffe am Handy zu klein" /></label>
      <label className={label} htmlFor="ws-aufgabe-text">Was soll geändert werden?
        <textarea id="ws-aufgabe-text" className={`${input} min-h-[110px] resize-y`} value={w.beschreibung} maxLength={8000} disabled={nurLesen} onChange={(e) => set("beschreibung", e.target.value)}
          placeholder="Beschreibe möglichst genau, was du siehst und was anders werden soll. Keine Daten von Mitgliedern." /></label>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <div className={label}>Status
          <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5" role="group" aria-label="Status">
            {Object.entries(STATUS).map(([k, t]) => <button key={k} type="button" disabled={nurLesen} aria-pressed={w.status === k} onClick={() => set("status", k)}
              className={`flex-1 px-2 py-1 rounded-md text-sm ${w.status === k ? "bg-emerald-700 text-white font-semibold" : "text-slate-600 dark:text-slate-300"}`}>{t}</button>)}
          </div></div>
        <label className={label} htmlFor="ws-aufgabe-prio">Priorität
          <select id="ws-aufgabe-prio" className={input} value={w.prioritaet} disabled={nurLesen} onChange={(e) => set("prioritaet", e.target.value)}>
            {Object.entries(PRIO).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label className={label} htmlFor="ws-aufgabe-faellig">Fällig am
          <input id="ws-aufgabe-faellig" type="date" className={input} value={w.faellig} min="2020-01-01" max="2100-12-31" disabled={nurLesen} onChange={(e) => set("faellig", e.target.value)} /></label>
        <label className={label} htmlFor="ws-aufgabe-wer">Zuständig
          <select id="ws-aufgabe-wer" className={input} value={w.zustaendig} disabled={nurLesen} onChange={(e) => set("zustaendig", e.target.value)}>
            <option value="">— niemand —</option>{leute.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      </div>
      <label className={label} htmlFor="ws-aufgabe-bezug">Bezug (Feature oder Gruppe)
        {zielAuswahl("ws-aufgabe-bezug", w.bezug, (v) => set("bezug", v), true)}</label>

      <div className="flex flex-col gap-1.5">
        <div className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">Links</div>
        {w.links.map((l, i) => (
          <div key={`${l.url}-${i}`} className="flex items-center gap-2 min-w-0"><div className="flex-1 min-w-0"><SichererLink titel={l.titel} url={l.url} /></div>
            {!nurLesen && <button type="button" className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Link entfernen" aria-label={`Link ${l.titel} entfernen`} onClick={() => set("links", w.links.filter((_, j) => j !== i))}><X className="w-4 h-4" /></button>}</div>))}
        {!nurLesen && w.links.length < 20 && <div className="grid gap-1.5 grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
          <input className={`${input} !py-1.5 text-sm`} aria-label="Titel des Links" placeholder="Titel" maxLength={120} value={neuLink.titel} onChange={(e) => setNeuLink((x) => ({ ...x, titel: e.target.value }))} />
          <input className={`${input} !py-1.5 text-sm`} aria-label="Adresse (https)" placeholder="https://…" maxLength={2000} value={neuLink.url} onChange={(e) => setNeuLink((x) => ({ ...x, url: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); linkDazu(); } }} />
          <button type="button" className={ghost} disabled={!neuLink.url.trim()} onClick={linkDazu}><Plus className="w-4 h-4" />Link</button>
        </div>}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">Fotos und Dateien <span className="text-xs font-normal text-slate-500">{anhaenge.length}/{MAX_ANHAENGE}</span></div>
        {a ? <>
          <AnhangListe anhaenge={anhaenge} toast={toast} onEntfernen={nurLesen ? null : entfernen} />
          {!nurLesen && anhaenge.length < MAX_ANHAENGE && <>
            <input ref={dateiRef} type="file" multiple accept={ANNEHMEN} className="sr-only" id="ws-aufgabe-datei" onChange={(e) => e.target.files?.length && hochladen(e.target.files)} />
            <label htmlFor="ws-aufgabe-datei" className={`${ghost} cursor-pointer self-start ${busy === "hochladen" ? "pointer-events-none opacity-50" : ""}`}>{busy === "hochladen" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}Foto oder Datei hinzufügen</label>
            <p className="text-xs text-slate-500">Bilder PNG, JPG, WebP bis 5 MB · Dateien PDF, TXT, CSV, DOCX, XLSX bis 10 MB · höchstens {MAX_ANHAENGE}.</p>
          </>}
        </> : <p className="text-xs text-slate-500">Nach dem Anlegen kannst du Fotos, Screenshots und Dateien anhängen.</p>}
        <p className="text-xs rounded-lg border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 px-2.5 py-2 flex gap-2"><ShieldAlert className="w-4 h-4 shrink-0 mt-px" />Keine Fotos von Personen oder Kindern und keine Daten von Mitgliedern hochladen. Screenshots mit Beispieldaten genügen.</p>
      </div>

      {!nurLesen && <div className="flex flex-wrap gap-2 items-center">
        <button type="button" className={btn} disabled={!!busy || !geaendert || !!titelFehler} onClick={speichern}>{busy === "speichern" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{a ? "Speichern" : "Anlegen"}</button>
        {a && geaendert && <span className="text-xs text-amber-700 dark:text-amber-300">Nicht gespeichert</span>}
        <span className="flex-1" />
        {darfLoeschen && <button type="button" className={`${ghost} ${loeschenSicher ? "!border-red-600 !text-red-700 dark:!text-red-400" : ""}`} disabled={!!busy} onClick={loeschen}><Trash2 className="w-4 h-4" />{loeschenSicher ? "Wirklich löschen?" : "Löschen"}</button>}
      </div>}

      {a && <div className="rounded-xl border-2 border-orange-500/70 p-3 flex flex-col gap-2">
        <div className="font-display font-semibold flex items-center gap-2"><Send className="w-4 h-4" />In den Chat schicken</div>
        {!nurLesen && <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <label className="sr-only" htmlFor="ws-aufgabe-ziel">Ziel</label>
          <div className="flex-1 min-w-0">{zielAuswahl("ws-aufgabe-ziel", sendeZiel, setSendeZiel, false)}</div>
          <button type="button" className={btn} disabled={!!busy || !sendeZiel} onClick={senden}>{busy === "senden" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Senden</button>
        </div>}
        <p className="text-xs text-slate-500">Kommt als Nachricht mit Beschreibung, Links, Bildern und Dateien in den Chat des Features bzw. der Gruppe. Dort mit „Als Auftrag“ weitermachen. Die Aufgabe merkt sich, wohin sie ging.</p>
        {sendungen.length > 0 && <ul className="flex flex-col gap-1 text-sm">
          {[...sendungen].reverse().map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <MessageSquare className="w-4 h-4 text-slate-500" /><span className="font-semibold">{ziel(s)}</span><span className="text-xs text-slate-500">{wann(s.erstellt)} · {name(s.von)}</span>
              {s.auftrag_id ? <Pille cls={STATUS_CLS.erledigt}>Auftrag #{s.auftrag_id}</Pille> : s.zurueckgezogen ? <Pille cls={STATUS_CLS.offen}>zurückgezogen</Pille> : <Pille cls={STATUS_CLS.arbeit}>wartet im Chat</Pille>}
              <span className="flex-1" />
              {!s.zurueckgezogen && <button type="button" className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold hover:underline" onClick={() => zumChat(s)}>Im Chat öffnen</button>}
              {!nurLesen && !s.auftrag_id && !s.zurueckgezogen && <button type="button" className="text-xs text-slate-500 hover:underline inline-flex items-center gap-1" onClick={() => zurueckziehen(s)}><Undo2 className="w-3.5 h-3.5" />Zurückziehen</button>}
            </li>))}
        </ul>}
      </div>}
      {a && <p className="text-[11px] text-slate-400">Angelegt {wann(a.erstellt)}{a.erstellt_von ? ` von ${name(a.erstellt_von)}` : ""} · zuletzt geändert {wann(a.geaendert)}{a.geaendert_von ? ` von ${name(a.geaendert_von)}` : ""}</p>}
    </div>);
}

// ---------- Im Feature- bzw. Gruppen-Chat ----------
/** Aufgaben, die in diesen Chat geschickt wurden und noch kein Auftrag sind – als Karte mit „Als Auftrag“. */
export function AufgabenImChat({ g, f, d, ich, kannAuftrag, toast }) {
  const [liste, setListe] = useState([]); const [anh, setAnh] = useState([]); const [busy, setBusy] = useState(0);
  const holen = useCallback(async () => {
    let q = supabase.from("ws_aufgabe_sendungen").select("*").eq("projekt_id", d.projektId).is("auftrag_id", null).is("zurueckgezogen", null).order("id");
    q = f ? q.eq("feature_id", f.id) : q.eq("gruppe_id", g.id);
    const { data, error } = await q;
    if (error) { setListe([]); return; }
    setListe(data || []);
    const ids = [...new Set((data || []).flatMap((s) => s.anhaenge || []))];
    setAnh(ids.length ? (await supabase.from("ws_aufgabe_anhaenge").select("*").in("id", ids).eq("fertig", true)).data || [] : []);
  }, [d.projektId, g.id, f?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    holen();
    const ch = supabase.channel(`cs-aufgaben-chat-${d.projektId}-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ws_aufgabe_sendungen", filter: `projekt_id=eq.${d.projektId}` }, holen)
      .on("postgres_changes", { event: "*", schema: "public", table: "ws_aufgabe_anhaenge", filter: `projekt_id=eq.${d.projektId}` }, holen).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [holen, d.projektId]);
  if (!liste.length) return null;
  const name = (id) => d.benutzer.find((u) => u.id === id)?.name || "Mitglied";
  const kannBearbeiten = ["admin", "entwickler", "texter"].includes(rolleVon(d, ich));
  const alsAuftrag = async (s) => {
    setBusy(s.id); const { data, error } = await supabase.rpc("ws_aufgabe_als_auftrag", { p_sendung: s.id }); setBusy(0);
    if (error) toast(fehler(error)); else { toast(`Auftrag #${data} an Werkstatt ${g.name} gestellt`); await d.holen?.(); holen(); }
  };
  const zurueck = async (s) => { const { error } = await supabase.rpc("ws_aufgabe_sendung_zurueckziehen", { p_sendung: s.id }); if (error) toast(fehler(error)); else holen(); };
  return liste.map((s) => (
    <div key={s.id} className="self-stretch rounded-xl border-2 border-orange-500/70 bg-orange-50/60 dark:bg-orange-950/20 p-3 text-sm flex flex-col gap-2" aria-label={`Aufgabe ${s.titel}`}>
      <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 flex-wrap"><ClipboardList className="w-3.5 h-3.5" />Aufgabe von {name(s.von)} · {wann(s.erstellt)}
        {!f && s.feature_id && <span className="px-1.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">für Feature {d.features.find((x) => x.id === s.feature_id)?.name || s.feature_id}</span>}</div>
      <div className="font-display font-semibold text-[15px]">{s.titel}</div>
      <p className="whitespace-pre-wrap break-words">{s.text}</p>
      {s.links?.length > 0 && <div className="flex flex-col gap-1">{s.links.map((l, i) => <SichererLink key={i} titel={l.titel} url={l.url} />)}</div>}
      <AnhangListe anhaenge={anh.filter((x) => (s.anhaenge || []).includes(x.id))} toast={toast} klein />
      <div className="flex flex-wrap gap-2 items-center">
        {kannAuftrag ? <button type="button" className={btn} disabled={busy === s.id} onClick={() => alsAuftrag(s)}>{busy === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Als Auftrag</button>
          : <span className="text-xs text-slate-500">Einen Auftrag daraus macht, wer in diesem Bereich Aufträge geben darf.</span>}
        {kannBearbeiten && <button type="button" className={ghost} onClick={() => zurueck(s)}><Undo2 className="w-4 h-4" />Zurückziehen</button>}
        <span className="text-xs text-slate-500">Anhänge gehen mit dem Auftrag an die Werkstatt (nur als Daten).</span>
      </div>
    </div>));
}

/** Unter der ersten Nachricht eines Auftrags „aus Aufgabe“: Links und Anhänge (signierte Adressen erst beim Anzeigen). */
export function AufgabeBeilagen({ daten, toast }) {
  const ids = Array.isArray(daten?.anhaenge) ? daten.anhaenge.filter((x) => Number.isSafeInteger(x)).slice(0, 20) : [];
  const links = Array.isArray(daten?.links) ? daten.links.filter((l) => l && typeof l.titel === "string" && typeof l.url === "string").slice(0, 20) : [];
  const [anh, setAnh] = useState([]);
  const key = ids.join(",");
  useEffect(() => {
    if (!ids.length) { setAnh([]); return undefined; }
    let aus = false;
    supabase.from("ws_aufgabe_anhaenge").select("*").in("id", ids).eq("fertig", true).then(({ data }) => { if (!aus) setAnh(data || []); });
    return () => { aus = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!links.length && !ids.length) return null;
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {links.map((l, i) => <SichererLink key={i} titel={l.titel} url={l.url} />)}
      <AnhangListe anhaenge={anh} toast={toast} klein />
      {ids.length > anh.length && <span className="text-[11px] text-slate-500">{ids.length - anh.length} Anhang/Anhänge nicht mehr vorhanden</span>}
    </div>);
}
