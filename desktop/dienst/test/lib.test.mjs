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

import { findeAboLimits, aboEntscheidung } from "../lib/abo.mjs";
test("Abo-Limits aus der Statuszeile", () => {
  const r = findeAboLimits({ rate_limits: { five_hour: { used_percentage: 23.5, resets_at: 1738425600 }, seven_day: { used_percentage: 41.2, resets_at: 1738857600 } } });
  assert.equal(r.fuenf_std_prozent, 23.5); assert.equal(r.woche_prozent, 41.2);
  assert.equal(r.fuenf_std_reset, new Date(1738425600 * 1000).toISOString());
});
test("Abo-Limits aus einer einzelnen Meldung", () => {
  const r = findeAboLimits({ type: "system", info: { rateLimitType: "seven_day", utilization: 0.82, resetsAt: 1900000000 } });
  assert.equal(r.woche_prozent, 82);
});
test("Abo-Entscheidung und Modell", () => {
  const spaeter = new Date(Date.now() + 3600e3).toISOString();
  assert.equal(aboEntscheidung({ fuenf_std_prozent: 50, fuenf_std_reset: spaeter, woche_prozent: 10, woche_reset: spaeter }), "frei");
  assert.equal(aboEntscheidung({ fuenf_std_prozent: 80, fuenf_std_reset: spaeter }), "klein");
  assert.equal(aboEntscheidung({ woche_prozent: 97, woche_reset: spaeter }), "pause");
  assert.equal(aboEntscheidung({ fuenf_std_prozent: 99, fuenf_std_reset: new Date(Date.now() - 1000).toISOString() }), "frei");
  assert.equal(waehleModell({ art: "aendern", titel: "Rechte in der Datenbank" }, { abo: "klein" }), "sonnet");
  assert.equal(waehleModell({ art: "text", titel: "Text" }, { abo: "klein" }), "haiku");
});
