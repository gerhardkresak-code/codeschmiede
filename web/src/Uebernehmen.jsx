// App-Designer 2.0 · Etappe 4 „Übernehmen“ (Entwurf 1.0, freigegeben von Gerhard 2026-10-24 22:08; 22:35/22:45 „fertigstellen“).
// Eine Übersicht aller offenen Design-Änderungen, getrennt nach
//   * „Wirkt sofort nach Freigabe (Design-Paket)“ – Bausteine einzeln mit Vorher/Nachher, Seiten/Kacheln, Akzentfarbe. Das liegt in der App
//     (Trainer to go: DesignPackage) – darum zeigt die Codeschmiede hier den Freigabe-Reiter der App (Seiten-Designer, Reiter „freigabe“),
//     gespeichert und freigegeben wird dort mit deren Rechteprüfung. Ausrollen: „Sofort für alle“ (Standard), „Schrittweise“ (Warnung),
//     „Nur Testfassung“ (Kennzeichnung im Paket, gilt nur auf den Zweig-Adressen *.pages.dev), Versionen mit „Zurück auf Version N“.
//   * „Braucht neuen Code (Auftrag mit Prüfungen)“ – Grunddesign-Entwürfe (ws_design_entwuerfe) und neue Bausteine/Kachel-Arten (Aufträge).
import React, { Suspense, lazy } from "react";
import { CheckCheck, Hammer, Zap, Palette, Send, FlaskConical, Rocket, Info, ExternalLink } from "lucide-react";
import { BausteinAuftraege, istDesignAuftrag } from "./BausteinAssistent";
const SeitenModus = lazy(() => import("./SeitenModus"));

const card = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const ghost = "inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50";
const fmt = (x) => new Date(x).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Offene Punkte, die einen Auftrag brauchen (für die Zahl am Knopf „Übernehmen“). */
export function offeneAuftragsPunkte(d, projekt, entwuerfe) {
  const e = (entwuerfe || []).filter((x) => x.stand === "entwurf" || x.stand === "gesendet").length;
  const a = d.auftraege.filter((x) => istDesignAuftrag(x, projekt) && !["wissen", "erledigt"].includes(x.stand)).length;
  return e + a;
}

export default function Uebernehmen({ projekt, d, ich, werte, dunkel, darf, toast, entwuerfe = [], onGrunddesign, onFreigabeOffen, sofortAnzahl = null }) {
  const offenEntwuerfe = entwuerfe.filter((x) => x.stand === "entwurf" || x.stand === "gesendet");
  const testLive = !!projekt.live_zweig;
  return (
    <div className="flex flex-col gap-3">
      <section className={`${card} p-3 flex flex-wrap items-center gap-3`} aria-label="Übernehmen">
        <CheckCheck className="w-5 h-5 text-emerald-700" aria-hidden="true" />
        <div className="flex-1 min-w-[240px]">
          <h2 className="font-display font-bold text-lg">Übernehmen und freigeben</h2>
          <p className="text-xs text-slate-500">Alles, was am Design offen ist: was sofort wirkt (Design-Paket der App) und was neuen Code braucht (Auftrag mit Prüfungen).</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-full px-2.5 py-1 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold inline-flex items-center gap-1"><Zap className="w-3.5 h-3.5" aria-hidden="true" />wirkt sofort{sofortAnzahl != null ? ` · ${sofortAnzahl}` : ""}</span>
          <span className="rounded-full px-2.5 py-1 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold inline-flex items-center gap-1"><Hammer className="w-3.5 h-3.5" aria-hidden="true" />braucht Auftrag · {offeneAuftragsPunkte(d, projekt, entwuerfe)}</span>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 flex flex-col gap-2">
          <Suspense fallback={<p className="text-sm text-slate-500 p-4">Lädt …</p>}>
            <SeitenModus key="uebernehmen" tab="freigabe" titel="Wirkt sofort nach Freigabe (Design-Paket)" kompakt projekt={projekt} d={d} ich={ich} werte={werte} dunkel={dunkel} darf={darf} toast={toast} onFreigabeOffen={onFreigabeOffen} />
          </Suspense>
        </div>
        <aside className="flex flex-col gap-3">
          <section className={`${card} p-3 flex flex-col gap-2`} aria-label="Braucht neuen Code">
            <h3 className="font-display font-bold flex items-center gap-1.5"><Hammer className="w-4 h-4 text-amber-600" aria-hidden="true" />Braucht neuen Code (Auftrag mit Prüfungen)</h3>
            <p className="text-xs text-slate-500">Wird gebaut, geprüft und ist erst nach dem Zusammenführen verfügbar (Testfassung, dann live).</p>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 pt-1">Grunddesign (Farben, Schrift, Menü, Marke)</h4>
            {!offenEntwuerfe.length ? <p className="text-xs text-slate-500">Kein offener Grunddesign-Entwurf.</p> : (
              <ul className="flex flex-col gap-1">{offenEntwuerfe.map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5">
                  <Palette className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                  <span className="flex-1 min-w-0 truncate font-semibold" title={e.name}>{e.name} · v{e.version}</span>
                  {e.stand === "gesendet"
                    ? <span className="rounded-full px-2 py-0.5 font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 whitespace-nowrap">{e.auftrag_id ? `Auftrag #${e.auftrag_id}` : "gesendet"}</span>
                    : <button type="button" className={`${ghost} h-7 text-xs`} onClick={() => onGrunddesign?.(e)} title={`geändert ${fmt(e.geaendert)}`}><Send className="w-3.5 h-3.5" />Öffnen &amp; senden</button>}
                </li>))}</ul>)}
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 pt-1">Neue Bausteine und Kachel-Arten</h4>
            <BausteinAuftraege d={d} projekt={projekt} max={10} />
          </section>

          <section className={`${card} p-3 flex flex-col gap-2 text-xs text-slate-600 dark:text-slate-300`} aria-label="Wie ausrollen">
            <h3 className="font-display font-bold text-sm flex items-center gap-1.5"><Info className="w-4 h-4 text-emerald-700" aria-hidden="true" />Wie ausrollen?</h3>
            <p className="flex items-start gap-1.5"><Rocket className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-700" aria-hidden="true" /><span><b>Sofort für alle</b> (Standard) – alle sehen es nach dem Freigeben.</span></p>
            <p className="flex items-start gap-1.5"><Zap className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" aria-hidden="true" /><span><b>Schrittweise</b> – bis zur ersten Stufe sieht es niemand, danach nur der gewählte Anteil der Vereine.</span></p>
            <p className="flex items-start gap-1.5"><FlaskConical className="w-3.5 h-3.5 shrink-0 mt-0.5 text-sky-600" aria-hidden="true" /><span><b>Nur Testfassung</b> – Test und Live teilen eine Datenbank; die Version ist im Paket gekennzeichnet und gilt nur auf der Testfassung{testLive && projekt.test_url ? ` (${projekt.test_url.replace(/^https:\/\//, "")})` : " (Zweig-Adressen *.pages.dev)"}. Live mit „Auch live“ in der Versionsliste – am besten direkt nach „Live schalten“ unter „Zu erledigen“.</span></p>
            <p>Jede Fassung bleibt gespeichert – „Zurück auf Version N“ ist ein Klick.</p>
            {testLive && projekt.test_url && <a className={`${ghost} self-start`} href={projekt.test_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5" />Testfassung öffnen</a>}
          </section>
        </aside>
      </div>
    </div>);
}
