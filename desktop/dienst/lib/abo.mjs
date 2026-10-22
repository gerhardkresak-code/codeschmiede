// Abo-Nutzungslimits (5-Stunden-Fenster und Woche) aus den Daten von Claude Code lesen.
// Quellen: (1) Meldungen im Ausgabestrom von Claude Code, (2) die Statuszeile von Claude Code (Felder
// rate_limits.five_hour / rate_limits.seven_day mit used_percentage und resets_at, siehe Claude-Code-Doku „Status line“).

const zahl = (v) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);
const zeit = (v) => {
  const n = zahl(v);
  if (n != null) return new Date(n < 1e12 ? n * 1000 : n).toISOString();
  if (typeof v === "string" && !Number.isNaN(Date.parse(v))) return new Date(v).toISOString();
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
