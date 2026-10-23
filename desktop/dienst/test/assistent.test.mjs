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
