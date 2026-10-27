// Abo-Nutzungslimits (5-Stunden-Fenster und Woche) aus den Daten von Claude Code lesen.
// Quellen: (1) Meldungen im Ausgabestrom von Claude Code, (2) die Statuszeile von Claude Code (Felder
// rate_limits.five_hour / rate_limits.seven_day mit used_percentage und resets_at, siehe Claude-Code-Doku „Status line“).

const zahl = (v) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);
// Ungültige oder absurde Zeitwerte → null statt Absturz (Prüfung 0.8.7 L1)
const iso = (d) => (Number.isFinite(d.getTime()) && d.getUTCFullYear() >= 2000 && d.getUTCFullYear() < 10000 ? d.toISOString() : null);
const zeit = (v) => {
  const n = zahl(v);
  if (n != null) return iso(new Date(n < 1e12 ? n * 1000 : n));
  if (typeof v === "string" && !Number.isNaN(Date.parse(v))) return iso(new Date(v));
  return null;
};
const prozent = (o) => {
  if (!o || typeof o !== "object") return null;
  let p = zahl(o.used_percentage ?? o.usedPercentage ?? o.percent);
  if (p == null) { const u = zahl(o.utilization); if (u != null) p = u <= 1 ? u * 100 : u; }
  return p == null ? null : Math.max(0, Math.min(100, Math.round(p * 10) / 10));
};

// Sucht in einem beliebigen Objekt nach Angaben zum 5-Stunden- und Wochenfenster
export function findeAboLimits(obj, tiefe = 0) {
  if (!obj || typeof obj !== "object" || tiefe > 6) return null;
  const rl = obj.rate_limits || obj.rateLimits;
  if (rl && typeof rl === "object") {
    const f = rl.five_hour || rl.fiveHour; const w = rl.seven_day || rl.sevenDay;
    const r = {
      fuenf_std_prozent: prozent(f), fuenf_std_reset: zeit(f?.resets_at ?? f?.resetsAt),
      woche_prozent: prozent(w), woche_reset: zeit(w?.resets_at ?? w?.resetsAt),
    };
    if (r.fuenf_std_prozent != null || r.woche_prozent != null) return r;
  }
  // Neuere Claude-Code-Versionen: rate_limit_info.unifiedWindows = { five_hour: { utilization 0–1, resetsAt }, seven_day: {…} }
  // (Gerhard 2026-10-23 23:38 „Abo-Limits liefern keine Werte“ – dieses Feld wurde bisher nicht gelesen)
  const uw = obj.unifiedWindows || obj.unified_windows;
  if (uw && typeof uw === "object") {
    const f = uw.five_hour || uw.fiveHour; const w = uw.seven_day || uw.sevenDay;
    const r = { fuenf_std_prozent: prozent(f), fuenf_std_reset: zeit(f?.resetsAt ?? f?.resets_at), woche_prozent: prozent(w), woche_reset: zeit(w?.resetsAt ?? w?.resets_at) };
    if (r.fuenf_std_prozent != null || r.woche_prozent != null) return r;
  }
  // Einzelne Meldung zu einem Fenster (z. B. { rateLimitType: "five_hour", utilization, resetsAt })
  const typ = String(obj.rateLimitType || obj.rate_limit_type || obj.window || "").toLowerCase();
  if (/five|5h|session/.test(typ) && prozent(obj) != null) return { fuenf_std_prozent: prozent(obj), fuenf_std_reset: zeit(obj.resetsAt ?? obj.resets_at) };
  if (/seven|week|7d/.test(typ) && prozent(obj) != null) return { woche_prozent: prozent(obj), woche_reset: zeit(obj.resetsAt ?? obj.resets_at) };
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") { const r = findeAboLimits(v, tiefe + 1); if (r) return r; }
  }
  return null;
}

// Was darf die Werkstatt bei diesem Stand? „frei“, „klein“ (eine Modellstufe niedriger) oder „pause“ (keinen neuen Auftrag)
export function aboEntscheidung(limits, { kleinAb = 75, pauseAb = 95 } = {}) {
  if (!limits) return "frei";
  const jetzt = Date.now();
  const gilt = (p, reset) => (p == null ? null : reset && Date.parse(reset) < jetzt ? 0 : p);
  const hoechster = Math.max(gilt(limits.fuenf_std_prozent, limits.fuenf_std_reset) ?? 0, gilt(limits.woche_prozent, limits.woche_reset) ?? 0);
  if (hoechster >= pauseAb) return "pause";
  if (hoechster >= kleinAb) return "klein";
  return "frei";
}

/**
 * Limits von ChatGPT (Codex): Antwort von „account/rateLimits/read“ (codex app-server) oder Zeile „rate_limits“ aus den Sitzungsdateien.
 * Ergebnis: [{ art: "5std" | "woche" | "tag" | "fenster", prozent, reset }] – nur Zahlen, nichts anderes.
 */
export function codexFenster(obj, tiefe = 0, bezug = Date.now()) {
  if (!obj || typeof obj !== "object" || tiefe > 6) return null;
  const rl = obj.rateLimits || obj.rate_limits;
  if (rl && typeof rl === "object" && (rl.primary || rl.secondary)) {
    const aus = [];
    for (const f of [rl.primary, rl.secondary]) {
      if (!f || typeof f !== "object") continue;
      const p = zahl(f.usedPercent ?? f.used_percent); if (p == null) continue;
      const min = zahl(f.windowDurationMins ?? f.window_minutes ?? f.windowMinutes);
      const reset = zeit(f.resetsAt ?? f.resets_at) || (zahl(f.resets_in_seconds ?? f.resetsInSeconds) != null ? iso(new Date(bezug + zahl(f.resets_in_seconds ?? f.resetsInSeconds) * 1000)) : null);
      const art = min == null ? "fenster" : min <= 360 ? "5std" : min <= 1500 ? "tag" : min <= 11000 ? "woche" : "fenster";
      aus.push({ art, prozent: Math.max(0, Math.min(100, Math.round(p * 10) / 10)), reset });
    }
    if (aus.length) return aus;
  }
  for (const v of Object.values(obj)) if (v && typeof v === "object") { const r = codexFenster(v, tiefe + 1, bezug); if (r) return r; }
  return null;
}

const MONATE = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
/**
 * Limit-Meldung von Claude Code auswerten (Auftrag #19, 26.10.2026): „You've hit your weekly limit · resets Oct 29, 9am (Europe/Vienna)“.
 * Ergebnis: { woche: boolean, bis: Zeitpunkt (ms) oder null }. Die Uhrzeit gilt in der Zeitzone dieses PCs.
 */
export function limitAusText(text, jetzt = Date.now()) {
  const t = String(text || "");
  const woche = /week|woche/i.test(t);
  const m = /resets?\s+(?:([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+)?(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(t);
  if (!m) return { woche, bis: null };
  const d = new Date(jetzt);
  let h = Number(m[3]) % 24; const min = Number(m[4] || 0);
  if (m[5]) { h = h % 12; if (/pm/i.test(m[5])) h += 12; }
  if (m[1] && MONATE[m[1].toLowerCase()] != null) {
    const ziel = new Date(d.getFullYear(), MONATE[m[1].toLowerCase()], Number(m[2]), h, min);
    if (ziel.getTime() < jetzt - 24 * 3600 * 1000) ziel.setFullYear(ziel.getFullYear() + 1);
    return { woche, bis: ziel.getTime() };
  }
  const ziel = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, min);
  if (ziel.getTime() <= jetzt) ziel.setDate(ziel.getDate() + 1);
  return { woche, bis: ziel.getTime() };
}
