// Eigene Design-Freigabe (Entscheidung Gerhard 2026-10-24): Eingebettete Seiten von Trainer to go (Seiten-Designer /designer,
// Baustein-Galerie /bausteine) fragen nach dem Design-Geräteschlüssel der Codeschmiede bzw. lassen eine Nachricht „ttg-design|…“ signieren.
// Gemeinsam für SeitenModus.jsx und die Testseite im App-Designer (App-Designer 2.0, Etappe 1) – gleiche Regeln an beiden Stellen:
// nur für die Testfassungen von Trainer to go (trainer-to-go.pages.dev und deren Zweige), nur im Programm; was signiert werden darf,
// prüft zusätzlich das Programm selbst (Rust, design.rs). Ein Design-Schlüssel öffnet nie die Plattform-Verwaltung.
import { isDesktop, tauri } from "./desktop";

export const TTG_TESTFASSUNG = /^https:\/\/([a-z0-9-]+\.)?trainer-to-go\.pages\.dev$/i;

/** Beantwortet eine Nachricht { cs: "design-frage", id, art, nachricht } – Herkunft und Absender hat der Aufrufer schon geprüft. */
export function designFrageBeantworten(daten, ziel, antworten) {
  const id = Number(daten?.id);
  if (!Number.isSafeInteger(id)) return;
  const antwort = (x) => { try { antworten({ cs: "design-antwort", id, ...x }); } catch { /* egal */ } };
  if (!TTG_TESTFASSUNG.test(ziel || "")) { antwort({ fehler: "Design-Freigabe gibt es nur für die Testfassungen von Trainer to go." }); return; }
  if (!isDesktop()) { antwort({ fehler: "Die Design-Freigabe gibt es nur im Programm Codeschmiede (nicht im Browser)." }); return; }
  const n = typeof daten.nachricht === "string" ? daten.nachricht : "";
  const auftrag = daten.art === "geraet" ? tauri("ws_design_geraet")
    : daten.art === "signieren" && n.length <= 512 && /^ttg-design\|(register|verify|code)\|/.test(n) ? tauri("ws_design_signieren", { nachricht: n })
    : Promise.reject(new Error("Diese Anfrage ist nicht erlaubt."));
  auftrag.then((ergebnis) => antwort({ ergebnis }), (f) => antwort({ fehler: String(f?.message || f || "Fehler").slice(0, 200) }));
}

// Stand der Design-Freigabe dieses PCs (meldet der Seiten-Designer der App: nur frei/wartet/gesperrt/fehlt) – für Einrichtung › Dieser PC.
// Nur eine Anzeige-Hilfe auf diesem PC (localStorage); entschieden wird immer in der App-Datenbank.
const FREIGABE_SCHLUESSEL = "cs-design-freigabe";
const STAENDE = ["frei", "wartet", "gesperrt", "fehlt"];
export function designFreigabeMerken(stand, adresse) {
  if (!STAENDE.includes(stand) || !TTG_TESTFASSUNG.test(adresse || "")) return;
  try { localStorage.setItem(FREIGABE_SCHLUESSEL, JSON.stringify({ stand, zeit: new Date().toISOString(), adresse })); } catch { /* egal */ }
}
export function designFreigabeStand() {
  try { const x = JSON.parse(localStorage.getItem(FREIGABE_SCHLUESSEL) || "null"); return x && STAENDE.includes(x.stand) ? x : null; } catch { return null; }
}
