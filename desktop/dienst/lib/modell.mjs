// Modellwahl nach Aufwand und Komplexität (Gerhard, 2026-10-22 13:18).
// klein = haiku, mittel = sonnet, groß = opus. Bei Fehlschlag eine Stufe höher; wird das Abo-Limit knapp, eine Stufe niedriger.
export const STUFEN = ["haiku", "sonnet", "opus"];

const GROSS = /\b(datenbank|migration|rls|rechte|berechtigung|login|anmeldung|passwort|sicherheit|datenschutz|dsgvo|zahlung|abo|rechnung|kinder|ausbau|umbau|architektur|refactor)/i;
const KLEIN = /\b(text|tippfehler|rechtschreib|beschriftung|übersetz|farbe|symbol|icon|abstand|überschrift|hinweistext|formulierung)/i;

// abo: „frei“ | „klein“ (Abo-Limit wird knapp → eine Stufe niedriger, mindestens klein)
export function waehleModell(auftrag, { versuch = 0, gruppenName = "", abo = "frei" } = {}) {
  const text = `${auftrag.titel || ""} ${auftrag.text || ""} ${gruppenName}`;
  let stufe;
  if (auftrag.art === "ausbauen" || GROSS.test(text)) stufe = 2;
  else if (auftrag.art === "text" || (KLEIN.test(text) && text.length < 400)) stufe = 0;
  else stufe = 1;
  let ziel = Math.min(STUFEN.length - 1, stufe + versuch);
  if (abo === "klein") ziel = Math.max(0, ziel - 1);
  return STUFEN[ziel];
}
