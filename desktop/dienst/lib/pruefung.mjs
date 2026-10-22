// Auswertung der Prüfungen (Sicherheitsprüfung, Feature-Prüfung) und Adresse der Testseite eines Zweigs.

// Letzte Zeile „PRÜFUNG: GRÜN“ oder „PRÜFUNG: ROT“; alles davor ist der Befund. Fehlt die Zeile, gilt Rot (sicher ist sicher).
// Streng (Prüfung 2026-10-22, O2): nur die tatsächlich letzte nicht leere Zeile zählt, und sie muss genau so lauten.
export function pruefErgebnis(text) {
  const zeilen = String(text || "").trim().split(/\r?\n/);
  while (zeilen.length && !zeilen[zeilen.length - 1].trim()) zeilen.pop();
  const letzte = (zeilen[zeilen.length - 1] || "").trim().replace(/^\*\*(.*)\*\*$/, "$1");
  const m = letzte.match(/^PR(?:Ü|UE)FUNG: (GR(?:Ü|UE)N|ROT)$/);
  const befundText = zeilen.slice(0, -1).join("\n").trim();
  if (!m) return { ergebnis: "rot", befund: `Prüfung ohne eindeutiges Ergebnis in der letzten Zeile:\n${String(text || "").trim()}` };
  const gruen = m[1].startsWith("GR");
  return { ergebnis: gruen ? "gruen" : "rot", befund: befundText || (gruen ? "Keine Befunde." : "Rot ohne Begründung") };
}

// Cloudflare Pages: Zweig-Adresse = Zweigname klein, alles außer a-z0-9 → „-“, höchstens 28 Zeichen, ohne Bindestrich am Ende
export function cfAlias(zweig) {
  return String(zweig || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 28).replace(/^-+|-+$/g, "");
}
