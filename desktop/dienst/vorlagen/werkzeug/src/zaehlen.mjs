/** Zählt Einträge je Kategorie – Beispiel-Logik, an dem die Tests zeigen, dass alles läuft. */
export function zaehlen(eintraege) {
  const r = {};
  for (const e of eintraege) r[e.kategorie] = (r[e.kategorie] || 0) + 1;
  return r;
}
