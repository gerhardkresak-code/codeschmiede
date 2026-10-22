// Modellwahl nach Aufwand und Komplexität (Gerhard, 2026-10-22 13:18).
// klein = haiku, mittel = sonnet, groß = opus. Bei Fehlschlag eine Stufe höher.
export const STUFEN = ["haiku", "sonnet", "opus"];

const GROSS = /\b(datenbank|migration|rls|rechte|berechtigung|login|anmeldung|passwort|sicherheit|datenschutz|dsgvo|zahlung|abo|rechnung|kinder|ausbau|umbau|architektur|refactor)/i;
const KLEIN = /\b(text|tippfehler|rechtschreib|beschriftung|übersetz|farbe|symbol|icon|abstand|überschrift|hinweistext|formulierung)/i;

export function waehleModell(auftrag, { versuch = 0, gruppenName = "" } = {}) {
  const text = `${auftrag.titel || ""} ${auftrag.text || ""} ${gruppenName}`;
  let stufe;
  if (auftrag.art === "ausbauen" || GROSS.test(text)) stufe = 2;
  else if (auftrag.art === "text" || (KLEIN.test(text) && text.length < 400)) stufe = 0;
  else stufe = 1;
  return STUFEN[Math.min(STUFEN.length - 1, stufe + versuch)];
}
