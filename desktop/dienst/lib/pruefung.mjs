// Auswertung der Prüfungen (Sicherheitsprüfung, Feature-Prüfung) und Adresse der Testseite eines Zweigs.

// Letzte Zeile „PRÜFUNG: GRÜN“ oder „PRÜFUNG: ROT“; alles davor ist der Befund. Fehlt die Zeile, gilt Rot (sicher ist sicher).
export function pruefErgebnis(text) {
  const s = String(text || "").trim();
  const treffer = [...s.matchAll(/^\s*PR(?:Ü|UE)FUNG:\s*(GR(?:Ü|UE)N|ROT)\b.*$/gim)];
  if (!treffer.length) return { ergebnis: "rot", befund: s ? `Prüfung ohne eindeutiges Ergebnis:\n${s}` : "Prüfung ohne Ergebnis" };
  const letzte = treffer[treffer.length - 1];
  const gruen = /GR/i.test(letzte[1]);
  const befund = s.slice(0, letzte.index).trim() || (gruen ? "Keine Befunde." : "Rot ohne Begründung");
  return { ergebnis: gruen ? "gruen" : "rot", befund };
}

// Cloudflare Pages: Zweig-Adresse = Zweigname klein, alles außer a-z0-9 → „-“, höchstens 28 Zeichen, ohne Bindestrich am Ende
export function cfAlias(zweig) {
  return String(zweig || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 28).replace(/^-+|-+$/g, "");
}
