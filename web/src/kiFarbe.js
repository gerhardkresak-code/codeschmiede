// Eigene Farbe je KI-Anbieter (Gerhard 2026-10-23 22:50 „für jeden der Anbieter eine eigene Farbe oben bei den Zuteilungen“).
// Claude bleibt Smaragd (Markenfarbe der Codeschmiede); feste Farben für bekannte Anbieter, sonst stabil aus der Kennung gewählt.
// Klassen stehen ausgeschrieben, damit Tailwind sie findet.
const F = {
  smaragd: { chip: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", punkt: "bg-emerald-500" },
  himmel: { chip: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300", punkt: "bg-sky-500" },
  indigo: { chip: "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300", punkt: "bg-indigo-500" },
  violett: { chip: "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300", punkt: "bg-violet-500" },
  grau: { chip: "border-zinc-400 bg-zinc-100 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200", punkt: "bg-zinc-600 dark:bg-zinc-300" },
  orange: { chip: "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300", punkt: "bg-orange-500" },
  pink: { chip: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800 dark:border-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300", punkt: "bg-fuchsia-500" },
  limette: { chip: "border-lime-300 bg-lime-50 text-lime-800 dark:border-lime-800 dark:bg-lime-950 dark:text-lime-300", punkt: "bg-lime-500" },
  cyan: { chip: "border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-300", punkt: "bg-cyan-500" },
  rose: { chip: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300", punkt: "bg-rose-500" },
  bernstein: { chip: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300", punkt: "bg-amber-500" },
  blaugruen: { chip: "border-teal-300 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300", punkt: "bg-teal-500" },
};
const FEST = { claude: "smaragd", chatgpt: "himmel", gemini: "indigo", copilot: "violett", grok: "grau", "mistral-vibe": "orange", mistral: "orange", cursor: "pink", opencode: "limette", antigravity: "cyan" };
const REST = ["rose", "bernstein", "blaugruen", "violett", "cyan", "pink", "limette", "orange"];

/** { chip, punkt } für eine Anbieter-Kennung. */
export function kiFarbe(id) {
  const s = String(id || "");
  if (Object.hasOwn(FEST, s)) return F[FEST[s]];
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return F[REST[h % REST.length]];
}
