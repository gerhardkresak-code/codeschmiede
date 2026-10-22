// Wertet die letzte Antwort der Werkstatt aus: Rückfrage, Pull Request oder sonstiges Ende.
export function werteAus(text) {
  const s = String(text || "").trim();
  const frage = s.match(/^\s*R(?:Ü|UE)CKFRAGE:\s*([\s\S]+)$/im);
  if (frage) return { art: "frage", text: frage[1].trim() };
  const pr = s.match(/ERGEBNIS-PR:\s*#?(\d+)\s+(\S+)/i);
  if (pr) {
    const zusammenfassung = s.replace(/ERGEBNIS-PR:.*$/im, "").trim();
    return { art: "pr", nummer: Number(pr[1]), zweig: pr[2], text: zusammenfassung };
  }
  return { art: "ohne-pr", text: s };
}

export function zweigName(id, titel) {
  const kurz = String(titel || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "auftrag";
  return `feature/cs-${id}-${kurz}`;
}

// „Immer erlauben“: gleiche Werkzeug-Art und bei Befehlen gleicher Anfang (erste zwei Wörter)
export function passtRegel(regel, werkzeug, eingabe) {
  if (regel.werkzeug !== werkzeug) return false;
  if (werkzeug !== "Bash") return true;
  const anfang = (x) => String(x || "").trim().split(/\s+/).slice(0, 2).join(" ");
  return anfang(regel.eingabe) === anfang(eingabe);
}
