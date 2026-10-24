// [PROJEKTNAME] – Werkzeug ohne Oberfläche. Grundgerüst aus der Codeschmiede.
// Läuft in GitHub (Ablauf „Lauf“, per Knopf in der Codeschmiede oder nach Zeitplan); Ergebnisse landen in ausgabe/.
import { mkdir, writeFile } from "node:fs/promises";
import { zaehlen } from "./zaehlen.mjs";

const beispiel = [{ kategorie: "A" }, { kategorie: "B" }, { kategorie: "A" }];
const ergebnis = zaehlen(beispiel);
await mkdir("ausgabe", { recursive: true });
await writeFile("ausgabe/ergebnis.json", JSON.stringify({ zeit: new Date().toISOString(), ergebnis }, null, 2));
console.log("Fertig:", ergebnis);
