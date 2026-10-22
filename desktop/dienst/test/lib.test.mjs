import { test } from "node:test";
import assert from "node:assert/strict";
import { ohneGeheimnisse } from "../lib/geheim.mjs";
import { waehleModell } from "../lib/modell.mjs";
import { werteAus, zweigName, passtRegel } from "../lib/ergebnis.mjs";

test("Geheimnisse werden entfernt", () => {
  assert.equal(ohneGeheimnisse("key sk-ant-abc123def456ghi789"), "key [entfernt]");
  assert.equal(ohneGeheimnisse("password=geheim123"), "password=[entfernt]");
  assert.equal(ohneGeheimnisse("export GH=ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaa"), "export GH=[entfernt]");
  assert.equal(ohneGeheimnisse("normaler Text bleibt"), "normaler Text bleibt");
});

test("Modellwahl nach Aufwand", () => {
  assert.equal(waehleModell({ art: "text", titel: "Hinweistext ändern" }), "haiku");
  assert.equal(waehleModell({ art: "aendern", titel: "Neue Filter in der Übungsliste" }), "sonnet");
  assert.equal(waehleModell({ art: "aendern", titel: "Rechte für Kassier in der Datenbank" }), "opus");
  assert.equal(waehleModell({ art: "aendern", titel: "Neue Filter" }, { versuch: 1 }), "opus");
  assert.equal(waehleModell({ art: "ausbauen", titel: "x" }), "opus");
});

test("Ergebnis auswerten", () => {
  assert.deepEqual(werteAus("Ich brauche eine Entscheidung.\nRÜCKFRAGE: Linie oder Balken?"), { art: "frage", text: "Linie oder Balken?" });
  const r = werteAus("- Filter gebaut\nERGEBNIS-PR: #17 feature/cs-5-filter");
  assert.equal(r.art, "pr"); assert.equal(r.nummer, 17); assert.equal(r.zweig, "feature/cs-5-filter");
  assert.equal(werteAus("fertig").art, "ohne-pr");
  assert.equal(zweigName(5, "Kantine: Allergene je Artikel!"), "feature/cs-5-kantine-allergene-je-artikel");
});

test("Immer-erlauben-Regeln", () => {
  assert.ok(passtRegel({ werkzeug: "Bash", eingabe: "npm run build" }, "Bash", "npm run build -- --mode test"));
  assert.ok(!passtRegel({ werkzeug: "Bash", eingabe: "npm run build" }, "Bash", "npm install x"));
  assert.ok(passtRegel({ werkzeug: "WebFetch", eingabe: "a" }, "WebFetch", "b"));
});
