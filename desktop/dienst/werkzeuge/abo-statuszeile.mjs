#!/usr/bin/env node
// Statuszeile für Claude Code: zeigt Modell und Abo-Limits an und legt die Limits für die Codeschmiede ab
// (~/.codeschmiede/abo.json; der Werkstatt-Dienst überträgt sie in die Codeschmiede).
// Einrichtung (die Codeschmiede macht das auf Wunsch selbst): in ~/.claude/settings.json
//   "statusLine": { "type": "command", "command": "node \"<Pfad>/abo-statuszeile.mjs\"" }
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

let roh = "";
process.stdin.on("data", (d) => { roh += d; });
process.stdin.on("end", () => {
  let j = {}; try { j = JSON.parse(roh); } catch { /* leer */ }
  const rl = j.rate_limits;
  if (rl) {
    try {
      const ordner = path.join(homedir(), ".codeschmiede");
      mkdirSync(ordner, { recursive: true });
      writeFileSync(path.join(ordner, "abo.json"), JSON.stringify({ rate_limits: rl, zeit: Date.now() }));
    } catch { /* nicht schlimm */ }
  }
  const p = (w) => (w?.used_percentage != null ? `${Math.round(w.used_percentage)} %` : "–");
  const modell = j.model?.display_name || "";
  process.stdout.write(rl ? `${modell} · Abo 5 Std.: ${p(rl.five_hour)} · Woche: ${p(rl.seven_day)}` : modell);
});
