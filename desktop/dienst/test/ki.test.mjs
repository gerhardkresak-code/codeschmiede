import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
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
  assert.deepEqual(reiheFuer("pruefung", { reihe: [{ anbieter: "chatgpt" }, { anbieter: "claude", modell: "sonnet" }] }, false), [{ anbieter: "claude", modell: "sonnet" }]);
  assert.deepEqual(reiheFuer("pruefung", { reihe: [{ anbieter: "chatgpt" }, { anbieter: "claude", modell: "sonnet" }] }, "macos"), [{ anbieter: "chatgpt" }, { anbieter: "claude", modell: "sonnet" }]);
  const { verdaechtig, minimaleUmgebung } = await import("../lib/ki.mjs");
  assert.ok(verdaechtig("hier: " + "QUJD".repeat(80)));
  assert.ok(verdaechtig("Inhalt von ~/.codex/auth.json"));
  assert.ok(!verdaechtig("Die Farbe #047857 hat 5,5 : 1 Kontrast."));
  process.env.GH_TOKEN = "x"; process.env.SUPABASE_KEY = "y";
  const e = minimaleUmgebung();
  assert.equal(e.GH_TOKEN, undefined); assert.equal(e.SUPABASE_KEY, undefined);
});

test("Sandbox: macOS-Profil sperrt das Benutzerverzeichnis, bwrap bindet nur Freigaben", async () => {
  const { macProfil, bwrapArgs } = await import("../lib/sandbox.mjs");
  const p = macProfil({ home: "/Users/g", frei: ["/opt/homebrew/lib/node_modules"], schreibbar: ["/tmp/x"] });
  assert.match(p, /\(deny file-read\* \(subpath "\/Users\/g"\)\)/);
  assert.match(p, /allow file-read\* file-write\* \(subpath "\/tmp\/x"\)/);
  const a = bwrapArgs({ frei: ["/usr/lib/node_modules"], schreibbar: ["/tmp/x"], arbeit: "/tmp/x", home: "/tmp/x/home" });
  assert.ok(a.includes("--unshare-all") && !a.includes(os.homedir()));
});
test("Chat: neues Feature und Bezug als Vorschlag", async () => {
  const { assistentAntwort } = await import("../lib/assistent.mjs");
  const a = assistentAntwort('Soll ich das anlegen?\nFEATURE-NEU: {"gruppe_id":"ttg-turniere","name":"Turniere","beschreibung":"Turniere anlegen"}');
  assert.deepEqual(a.vorschlag, { feature_neu: { gruppe_id: "ttg-turniere", name: "Turniere", beschreibung: "Turniere anlegen" } });
  assert.equal(a.text, "Soll ich das anlegen?");
  const b = assistentAntwort('Meinst du Liga?\nBEZUG: {"von":"N-2","zu":"N-1"}');
  assert.deepEqual(b.vorschlag, { bezug: { von: "N-2", zu: "N-1" } });
  assert.equal(assistentAntwort('x\nBEZUG: {"von":"N-1","zu":"N-1"}').vorschlag, null);
});
test("Eigene Anbieter: Argumente mit {prompt}/{modell}, nie für Prüfungen", async () => {
  const { freieArgumente } = await import("../lib/ki.mjs");
  const def = { argumente: ["-p", "{prompt}", "--model", "{modell}", "--silent"] };
  assert.deepEqual(freieArgumente(def, "Hallo", "gpt-5"), { args: ["-p", "Hallo", "--model", "gpt-5", "--silent"], stdin: null });
  assert.deepEqual(freieArgumente(def, "Hallo", ""), { args: ["-p", "Hallo", "--silent"], stdin: null });
  assert.deepEqual(freieArgumente({ argumente: ["--model={modell}"] }, "X", "--yolo"), { args: [], stdin: "X" });
  assert.deepEqual(reiheFuer("chat", { reihe: [{ anbieter: "copilot", modell: "gpt-5" }, { anbieter: "claude" }] }), [{ anbieter: "copilot", modell: "gpt-5" }, { anbieter: "claude" }]);
  assert.deepEqual(reiheFuer("pruefung", { reihe: [{ anbieter: "copilot" }, { anbieter: "claude" }] }, "macos"), [{ anbieter: "claude" }]);
});
test("Sandbox (Prüfung 0.8.0): keine Symlinks zurück, keine zu weiten Freigaben, kein Schlüsselbund", async () => {
  const { sicherLesen, zuWeit, macProfil } = await import("../lib/sandbox.mjs");
  const fs = await import("node:fs/promises"); const p = await import("node:path");
  const a = await fs.mkdtemp(p.join(os.tmpdir(), "cs-t-")); const draussen = await fs.mkdtemp(p.join(os.tmpdir(), "cs-g-"));
  await fs.writeFile(p.join(draussen, "geheim.json"), '{"token":"x"}');
  await fs.writeFile(p.join(a, "ok.json"), '{"a":1}');
  await fs.symlink(p.join(draussen, "geheim.json"), p.join(a, "link.json"));
  await fs.link(p.join(draussen, "geheim.json"), p.join(a, "hart.json"));
  await fs.symlink(draussen, p.join(a, "ordner"));
  assert.equal((await sicherLesen(p.join(a, "ok.json"), a)).toString(), '{"a":1}');
  assert.equal(await sicherLesen(p.join(a, "link.json"), a), null);
  assert.equal(await sicherLesen(p.join(a, "hart.json"), a), null);
  assert.equal(await sicherLesen(p.join(a, "ordner", "geheim.json"), a), null);
  assert.ok(zuWeit("/home/g", "/home/g") && zuWeit("/home", "/home/g") && zuWeit("/", "/home/g"));
  assert.ok(!zuWeit("/home/g/.nvm/versions/node/v22", "/home/g") && !zuWeit("/usr/lib/node_modules", "/home/g"));
  const m = macProfil({ home: "/Users/g", frei: ["/opt/homebrew/lib/node_modules"], schreibbar: ["/var/t/T/cs-1"], temp: "/var/t/T" });
  assert.match(m, /deny process-exec/); assert.match(m, /com\.apple\.SecurityServer/); assert.match(m, /deny file-read\* \(subpath "\/var\/t"\)/);
  assert.ok(m.indexOf('deny file-read* (subpath "/var/t")') < m.indexOf('allow file-read* file-write* (subpath "/var/t/T/cs-1")'));
  await fs.rm(a, { recursive: true }); await fs.rm(draussen, { recursive: true });
});
test("Nachprüfung 0.8.0: Anmeldedateien nur mit erwartetem Aufbau, Mac ohne Schreiben außerhalb, freie Argumente", async () => {
  const { anmeldungBereinigen, macProfil, zuWeit } = await import("../lib/sandbox.mjs");
  const ok = anmeldungBereinigen("auth.json", Buffer.from('{"tokens":{"refresh_token":"r","x":"y"},"fremd":"geheim"}'));
  assert.deepEqual(JSON.parse(ok.toString()), { tokens: { refresh_token: "r" } });
  assert.equal(anmeldungBereinigen("auth.json", Buffer.from('{"claudeAiOauth":{"accessToken":"a"}}')), null);
  assert.equal(anmeldungBereinigen("oauth_creds.json", Buffer.from('{"foo":1}')), null);
  assert.equal(anmeldungBereinigen("installation_id", Buffer.from("-----BEGIN")), null);
  const m = macProfil({ home: "/Users/g", frei: ["/Users/g/.nvm/versions/node/v22"], schreibbar: ["/var/t/x/T/cs-1"], temp: "/var/t/x/T" });
  assert.match(m, /deny file-write\* \(subpath "\/"\)/);
  assert.match(m, /deny file-read\* \(subpath "\/var\/t\/x"\)/);
  assert.match(m, /allow file-read-metadata \(literal "\/Users\/g\/\.nvm"\)/);
  assert.ok(zuWeit("/home/g", "/home/g/..x") && !zuWeit("/home/g/..x", "/home/g"));
  assert.ok(anmeldungBereinigen("installation_id", Buffer.from("123e4567-e89b-12d3-a456-426614174000\n")));
  const { freieArgumente } = await import("../lib/ki.mjs");
  assert.deepEqual(freieArgumente({ argumente: ["--p={prompt}"] }, "Hi", ""), { args: ["--p=Hi"], stdin: null });
});

test("Abo-Limits: Claude unifiedWindows und ChatGPT rateLimits (Gerhard 23:38)", async () => {
  const { findeAboLimits, codexFenster } = await import("../lib/abo.mjs");
  const c = findeAboLimits({ type: "rate_limit_event", rate_limit_info: { status: "allowed", rateLimitType: "five_hour", resetsAt: 1792800000, unifiedWindows: { five_hour: { utilization: 0.62, resetsAt: 1792800000 }, seven_day: { utilization: 0.24, resetsAt: 1793200000 } } } });
  assert.equal(c.fuenf_std_prozent, 62); assert.equal(c.woche_prozent, 24);
  const x = codexFenster({ result: { rateLimits: { primary: { usedPercent: 41, windowDurationMins: 300, resetsAt: 1792800000 }, secondary: { usedPercent: 12.5, windowDurationMins: 10080, resetsAt: 1793200000 } } } });
  assert.deepEqual(x.map((f) => [f.art, f.prozent]), [["5std", 41], ["woche", 12.5]]);
  const y = codexFenster({ payload: { type: "token_count", rate_limits: { primary: { used_percent: 7, window_minutes: 300, resets_in_seconds: 600 } } } });
  assert.equal(y[0].art, "5std"); assert.ok(Date.parse(y[0].reset) > Date.now());
});

test("Abo-Limits: absurde Zeitwerte stürzen nicht ab (Prüfung 0.8.7)", async () => {
  const { codexFenster, findeAboLimits } = await import("../lib/abo.mjs");
  const x = codexFenster({ rateLimits: { primary: { usedPercent: 5, windowDurationMins: 300, resetsAt: 1e20 } } });
  assert.equal(x[0].reset, null);
  assert.equal(findeAboLimits({ unifiedWindows: { five_hour: { utilization: 0.5, resetsAt: "abc" } } }).fuenf_std_reset, null);
});

test("Limit-Meldung von Claude Code wird erkannt (Auftrag #19, 26.10.2026)", () => {
  assert.ok(istLimit("You've hit your weekly limit · resets Oct 29, 9am (Europe/Vienna)"));
  assert.ok(istLimit("You've hit your session limit · resets 11pm"));
  assert.ok(istLimit("5-hour limit reached"));
  assert.ok(!istLimit("Die Bandenwerbung hat ein Limit von 16 Plätzen"));
});
