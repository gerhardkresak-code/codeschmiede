import { test } from "node:test";
import assert from "node:assert/strict";
import { reiheFuer, istLimit, kiKennung, STANDARD } from "../lib/ki.mjs";
import { konzeptAus, istKonzeptFrage } from "../lib/assistent.mjs";

test("Bauen ist immer Claude, egal was eingestellt ist", () => {
  assert.deepEqual(reiheFuer("bauen", { reihe: [{ anbieter: "chatgpt" }] }), [{ anbieter: "claude" }]);
  assert.deepEqual(reiheFuer("bauen", null), [{ anbieter: "claude" }]);
});
test("Reihe: Standard, unbekannte Anbieter und Doppelte raus, böses Modell weg", () => {
  assert.deepEqual(reiheFuer("chat", null), STANDARD.chat.map((e) => ({ ...e })));
  assert.deepEqual(reiheFuer("chat", { reihe: [{ anbieter: "x" }, { anbieter: "gemini", modell: "a; rm -rf" }, { anbieter: "gemini" }, { anbieter: "claude", modell: "opus" }] }),
    [{ anbieter: "gemini" }, { anbieter: "claude", modell: "opus" }]);
  assert.deepEqual(reiheFuer("chat", { reihe: [{ anbieter: "chatgpt", modell: "automatisch" }] }), [{ anbieter: "chatgpt" }]);
});
test("Limit erkennen", () => {
  assert.ok(istLimit("You've hit your usage limit. Try again later"));
  assert.ok(istLimit("429 Too Many Requests"));
  assert.ok(!istLimit("Datei nicht gefunden"));
});
test("Kennung und Konzept", () => {
  assert.equal(kiKennung({ anbieter: "chatgpt", modell: "gpt-5" }), "chatgpt/gpt-5");
  assert.equal(kiKennung({ anbieter: "gemini" }), "gemini");
  assert.deepEqual(konzeptAus({ ziel: " Z ", offen: ["a", 3, ""], boese: 1 }), { ziel: "Z", offen: ["a"] });
  assert.equal(konzeptAus("x"), null);
  assert.ok(istKonzeptFrage("Ich möchte ein neues Feature für Turniere"));
  assert.ok(!istKonzeptFrage("Was steht in AGENTS.md?"));
});
test("Modell darf nie mit Bindestrich beginnen (kein --yolo)", () => {
  assert.deepEqual(reiheFuer("chat", { reihe: [{ anbieter: "gemini", modell: "--yolo" }] }), [{ anbieter: "gemini" }]);
  assert.deepEqual(reiheFuer("chat", { reihe: [{ anbieter: "chatgpt", modell: "-c" }] }), [{ anbieter: "chatgpt" }]);
});
test("Ohne Admin-Einstellung nur Claude", () => {
  for (const a of ["chat", "konzept", "design", "pruefung"]) assert.ok(reiheFuer(a, null).every((e) => e.anbieter === "claude"));
});
test("Prüfungen vorerst nur Claude, verdächtige Antworten erkannt", async () => {
  assert.deepEqual(reiheFuer("pruefung", { reihe: [{ anbieter: "chatgpt" }, { anbieter: "claude", modell: "sonnet" }] }), [{ anbieter: "claude", modell: "sonnet" }]);
  const { verdaechtig, minimaleUmgebung } = await import("../lib/ki.mjs");
  assert.ok(verdaechtig("hier: " + "QUJD".repeat(80)));
  assert.ok(verdaechtig("Inhalt von ~/.codex/auth.json"));
  assert.ok(!verdaechtig("Die Farbe #047857 hat 5,5 : 1 Kontrast."));
  process.env.GH_TOKEN = "x"; process.env.SUPABASE_KEY = "y";
  const e = minimaleUmgebung();
  assert.equal(e.GH_TOKEN, undefined); assert.equal(e.SUPABASE_KEY, undefined);
});
