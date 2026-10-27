import { test } from "node:test";
import assert from "node:assert/strict";
import { nutzungLesen, anmeldungLesen, anmeldungFinden, nutzungAbrufen, NUTZUNG_ADRESSE } from "../lib/nutzung.mjs";

test("Antwort von Anthropic wird übersetzt (Prozent, Reset)", () => {
  const r = nutzungLesen({ five_hour: { utilization: 42.04, resets_at: "2026-10-27T10:40:00+00:00" }, seven_day: { utilization: 100, resets_at: "2026-10-29T08:00:00Z" } });
  assert.deepEqual(r, { fuenf_std_prozent: 42, fuenf_std_reset: "2026-10-27T10:40:00.000Z", woche_prozent: 100, woche_reset: "2026-10-29T08:00:00.000Z" });
  // Werte über 100 werden begrenzt, 1 % bleibt 1 % (kein Umrechnen von Bruchteilen)
  assert.equal(nutzungLesen({ five_hour: { utilization: 1 } }).fuenf_std_prozent, 1);
  assert.equal(nutzungLesen({ five_hour: { utilization: 130 } }).fuenf_std_prozent, 100);
  assert.equal(nutzungLesen({ irgendwas: 1 }), null);
  assert.equal(nutzungLesen(null), null);
});

test("Anmeldung lesen: nur gültige Struktur", () => {
  assert.deepEqual(anmeldungLesen(JSON.stringify({ claudeAiOauth: { accessToken: "x".repeat(30), expiresAt: 123 } })), { zugang: "x".repeat(30), ablauf: 123 });
  assert.equal(anmeldungLesen("kein json"), null);
  assert.equal(anmeldungLesen(JSON.stringify({ claudeAiOauth: { accessToken: "kurz" } })), null);
});

test("Anmeldung finden: Datei zuerst, Mac-Schlüsselbund als Rückfall", async () => {
  const gut = JSON.stringify({ claudeAiOauth: { accessToken: "a".repeat(30) } });
  assert.ok(await anmeldungFinden({ umgebung: {}, plattform: "linux", lies: async () => gut }));
  assert.equal(await anmeldungFinden({ umgebung: {}, plattform: "win32", lies: async () => { throw new Error("fehlt"); } }), null);
  assert.ok(await anmeldungFinden({ umgebung: {}, plattform: "darwin", lies: async () => { throw new Error("fehlt"); }, bund: async () => gut }));
});

test("Abruf: Erfolg, Ablehnung, abgelaufen, falsches Format, nur Anthropic-Adresse", async () => {
  const anmeldung = { zugang: "z".repeat(30), ablauf: Date.now() + 3_600_000 };
  let adresse = null; let kopf = null;
  const ok = await nutzungAbrufen({ anmeldung, holen: async (u, o) => { adresse = u; kopf = o.headers; return { ok: true, json: async () => ({ five_hour: { utilization: 5 } }) }; } });
  assert.equal(ok.werte.fuenf_std_prozent, 5);
  assert.equal(adresse, NUTZUNG_ADRESSE);
  assert.ok(adresse.startsWith("https://api.anthropic.com/"));
  assert.equal(kopf.Authorization, `Bearer ${"z".repeat(30)}`);
  const nein = await nutzungAbrufen({ anmeldung, holen: async () => ({ ok: false, status: 401 }) });
  assert.match(nein.grund, /abgelehnt/);
  assert.ok(!nein.grund.includes("z".repeat(30)));
  const alt = await nutzungAbrufen({ anmeldung: { ...anmeldung, ablauf: Date.now() - 1 }, holen: async () => { throw new Error("darf nicht fragen"); } });
  assert.match(alt.grund, /abgelaufen/);
  const fmt = await nutzungAbrufen({ anmeldung, holen: async () => ({ ok: true, json: async () => ({ neu: true }) }) });
  assert.match(fmt.grund, /Format/);
  const weg = await nutzungAbrufen({ anmeldung, holen: async () => { throw new Error(`Fehler mit ${"z".repeat(30)}`); } });
  assert.equal(weg.grund, "Keine Verbindung zu Anthropic");
  assert.match((await nutzungAbrufen({})).grund, /Keine Anmeldung/);
});
