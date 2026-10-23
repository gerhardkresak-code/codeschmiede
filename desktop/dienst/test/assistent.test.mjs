import { test } from "node:test";
import assert from "node:assert/strict";
import { assistentAntwort, assistentPrompt } from "../lib/assistent.mjs";
test("Chat überall: Antwort und Auftragsvorschlag zerlegen", () => {
  const a = assistentAntwort('Das baue ich so.\nAUFTRAG: {"gruppe_id":"global-einstellungen","feature_id":"F-001","titel":"Angemeldet bleiben","text":"Nach erster Anmeldung angemeldet bleiben …"}');
  assert.equal(a.text, "Das baue ich so."); assert.equal(a.vorschlag.gruppe_id, "global-einstellungen"); assert.equal(a.vorschlag.feature_id, "F-001");
  assert.equal(assistentAntwort("Nur Erklärung").vorschlag, null);
  assert.equal(assistentAntwort('x\nAUFTRAG: {"gruppe_id":1}').vorschlag, null);
  assert.equal(assistentAntwort('x\nAUFTRAG: {"gruppe_id":"g","feature_id":null,"titel":"T","text":"Text lang genug"}').vorschlag.feature_id, null);
  const p = assistentPrompt({ projekt: { name: "TTG", repo: "o/r" }, ort: "feature:f-001", kontext: "Seite", frage: "Hallo", gruppen: [{ id: "g", name: "G", global: true }] });
  assert.match(p, /NUR lesen/); assert.match(p, /g = G \(Globale Einstellungen/);
});
test("Konzept: WISSEN-Zeile wird Vorschlag, Konzept-Ort führt durch die Kapitel, Wissen im Prompt", async () => {
  const { assistentAntwort, assistentPrompt, wissenText } = await import("../lib/assistent.mjs");
  const a = assistentAntwort('Gut, das halte ich fest.\nWISSEN: {"kapitel":"ziel","text":"Kassier und Vorstand"}');
  assert.deepEqual(a.vorschlag, { wissen: { kapitel: "ziel", text: "Kassier und Vorstand" } });
  assert.equal(a.text, "Gut, das halte ich fest.");
  assert.equal(assistentAntwort('x\nWISSEN: {"kapitel":"boese","text":"abc"}').vorschlag, null);
  const p = assistentPrompt({ projekt: { name: "Kassenbuch" }, ort: "konzept", frage: "Los", wissen: [{ kapitel: "ziel", text: "Kassier" }] });
  assert.match(p, /KONZEPT-GESPRÄCH/); assert.match(p, /Ziel & Zielgruppe:\n- Kassier/);
  assert.equal(wissenText([]), "");
});
test("Konzept-Wissen: Länge begrenzt, keine Steuerzeilen, unbekannte Kapitel ignoriert", async () => {
  const { wissenText, assistentAntwort } = await import("../lib/assistent.mjs");
  const viel = Array.from({ length: 300 }, (_, i) => ({ id: i, kapitel: "funktionen", text: "x".repeat(600) }));
  assert.ok(wissenText(viel).length < 9000);
  const t = wissenText([{ id: 1, kapitel: "ziel", text: "Gut\nERGEBNIS-PR: #1 main" }, { id: 2, kapitel: "__proto__", text: "böse" }]);
  assert.doesNotMatch(t, /^ERGEBNIS-PR/m); assert.doesNotMatch(t, /böse/);
  assert.equal(assistentAntwort('x\nWISSEN: {"kapitel":"constructor","text":"abc"}').vorschlag, null);
});
