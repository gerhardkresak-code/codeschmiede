// Kostenloser Abruf der Claude-Abo-Limits (Knopf „Jetzt aktualisieren“, Entwurf 1.1, freigegeben von Gerhard 2026-10-27 08:27).
// Gleicher Weg wie der Befehl „/usage“ in Claude Code: die Anmeldung von Claude Code auf DIESEM PC fragt bei Anthropic die
// Auslastung ab – verbraucht kein Limit. Keine offizielle Schnittstelle: bricht sie nach einem Update, meldet die Werkstatt das
// sichtbar und macht ersatzweise eine Mini-Anfrage über Claude Code.
// Sicherheit: Die Anmeldung wird nur im Speicher gelesen, nie gespeichert, geloggt oder an etwas anderes als api.anthropic.com geschickt.
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";

export const NUTZUNG_ADRESSE = "https://api.anthropic.com/api/oauth/usage";

/** Antwort von Anthropic in unsere Felder übersetzen (Prozent 0–100, Reset als ISO-Zeit). */
export function nutzungLesen(j) {
  if (!j || typeof j !== "object") return null;
  const p = (o) => {
    const u = o && typeof o === "object" ? Number(o.utilization ?? o.used_percentage) : NaN;
    return Number.isFinite(u) ? Math.max(0, Math.min(100, Math.round(u * 10) / 10)) : null;
  };
  const z = (o) => {
    const v = o && typeof o === "object" ? o.resets_at ?? o.resetsAt : null;
    if (typeof v !== "string" || Number.isNaN(Date.parse(v))) return null;
    const d = new Date(v); return d.getUTCFullYear() >= 2000 && d.getUTCFullYear() < 10000 ? d.toISOString() : null;
  };
  const f = j.five_hour || j.fiveHour; const w = j.seven_day || j.sevenDay;
  const r = { fuenf_std_prozent: p(f), fuenf_std_reset: z(f), woche_prozent: p(w), woche_reset: z(w) };
  return r.fuenf_std_prozent == null && r.woche_prozent == null ? null : r;
}

/** Anmeldung von Claude Code aus einem Text (Datei oder Schlüsselbund) lesen – nur Zugang und Ablaufzeit. */
export function anmeldungLesen(text) {
  let j; try { j = JSON.parse(String(text || "")); } catch { return null; }
  const o = j?.claudeAiOauth;
  if (!o || typeof o.accessToken !== "string" || o.accessToken.length < 20) return null;
  const ab = Number(o.expiresAt);
  return { zugang: o.accessToken, ablauf: Number.isFinite(ab) ? ab : null };
}

function schluesselbund() {
  return new Promise((ok) => {
    execFile("/usr/bin/security", ["find-generic-password", "-s", "Claude Code-credentials", "-w"], { timeout: 5000, windowsHide: true }, (e, out) => ok(e ? null : out));
  });
}

/** Anmeldung dieses PCs finden: Datei ~/.claude/.credentials.json (bzw. CLAUDE_CONFIG_DIR), auf dem Mac der Schlüsselbund. */
export async function anmeldungFinden({ umgebung = process.env, plattform = process.platform, lies = readFile, bund = schluesselbund } = {}) {
  const ordner = umgebung.CLAUDE_CONFIG_DIR && path.isAbsolute(umgebung.CLAUDE_CONFIG_DIR) ? umgebung.CLAUDE_CONFIG_DIR : path.join(os.homedir(), ".claude");
  try { const a = anmeldungLesen(await lies(path.join(ordner, ".credentials.json"), "utf8")); if (a) return a; } catch { /* keine Datei */ }
  if (plattform === "darwin") { const a = anmeldungLesen(await bund()); if (a) return a; }
  return null;
}

/**
 * Limits abrufen. Ergebnis: { werte } bei Erfolg, sonst { grund } (kurzer deutscher Text ohne Geheimnisse).
 * `holen` ist austauschbar (Tests).
 */
export async function nutzungAbrufen({ anmeldung, holen = fetch, jetzt = Date.now() } = {}) {
  if (!anmeldung) return { grund: "Keine Anmeldung von Claude Code auf diesem PC gefunden" };
  if (anmeldung.ablauf && anmeldung.ablauf < jetzt + 60_000) return { grund: "Anmeldung von Claude Code ist abgelaufen (wird bei der nächsten Anfrage erneuert)" };
  const strg = new AbortController(); const uhr = setTimeout(() => strg.abort(), 10_000);
  try {
    const r = await holen(NUTZUNG_ADRESSE, { method: "GET", redirect: "error", signal: strg.signal,
      headers: { Authorization: `Bearer ${anmeldung.zugang}`, "anthropic-beta": "oauth-2025-04-20", Accept: "application/json" } });
    if (!r.ok) return { grund: r.status === 401 || r.status === 403 ? "Anthropic hat die Abfrage abgelehnt (Anmeldung erneuern)" : `Anthropic antwortet mit Fehler ${r.status}` };
    const werte = nutzungLesen(await r.json());
    return werte ? { werte } : { grund: "Antwort von Anthropic hat ein unbekanntes Format (evtl. nach einem Update geändert)" };
  } catch (e) {
    return { grund: e?.name === "AbortError" ? "Anthropic hat nicht rechtzeitig geantwortet" : "Keine Verbindung zu Anthropic" };
  } finally { clearTimeout(uhr); }
}
