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
// Befehle, die Code aus dem Arbeitsordner ausführen: nie „immer“, jedes Mal neu fragen (Prüfung 2026-10-22, O2)
export function fuehrtCodeAus(befehl) {
  return /^\s*(?:\S*\/)?(?:npm|npx|pnpm|yarn|bun|node|deno|python\d*(?:\.\d+)?|py|pip\d*|make|sh|bash|zsh|pwsh|powershell|cmd|cargo|go|java|ruby|perl|php|tsx|ts-node|vite|vitest|jest|playwright)(?:\.exe|\.cmd)?\b/i.test(String(befehl || ""));
}

// „Immer erlauben“ gilt nur für genau denselben Befehl bzw. dieselbe Eingabe (Prüfung 2026-10-22, Befund ROT):
// verkettete Befehle (; && || | ` $( ) und Umleitungen werden nie über eine Regel erlaubt.
export function passtRegel(regel, werkzeug, eingabe) {
  if (regel.werkzeug !== werkzeug) return false;
  const norm = (x) => String(x ?? "").trim().replace(/\s+/g, " ");
  if (!norm(eingabe) || !norm(regel.eingabe)) return false;
  if (werkzeug === "Bash" && /[;&|`<>\n]|\$\(/.test(String(eingabe))) return false;
  if (werkzeug === "Bash" && fuehrtCodeAus(eingabe)) return false;
  return norm(regel.eingabe) === norm(eingabe);
}
