import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ampelPruefen, sandboxKonfig, sandboxStarten, testlaufStarten, zweigGut, sandboxPfad } from "../lib/anbindungen.mjs";

const ghFake = (antworten) => async (b, args) => {
  const k = args.slice(0, 2).join(" ") + (args.includes("--workflow") ? ` ${args[args.indexOf("--workflow") + 1]}` : "");
  const a = antworten[k];
  if (a instanceof Error) throw a;
  return { stdout: a ?? "" };
};

test("Zweig-Prüfung", () => {
  assert.ok(zweigGut("main") && zweigGut("auftrag/12-neu"));
  assert.ok(!zweigGut("../x") && !zweigGut("-x") && !zweigGut("a b") && !zweigGut(""));
});

test("Sandbox-Pfad nur unter Windows", () => {
  assert.equal(sandboxPfad("linux"), null);
  assert.match(sandboxPfad("win32", { SystemRoot: "C:\\Windows" }, () => true), /WindowsSandbox\.exe$/);
  assert.equal(sandboxPfad("win32", {}, () => false), null);
});

test("Ampel Web-App: Repository, Prüfung, Testseite, Datenbank", async () => {
  const sh = ghFake({ "repo view": "PUBLIC", "run list": JSON.stringify([{ status: "completed", conclusion: "success" }]) });
  const a = await ampelPruefen({ sh, projekt: { repo: "o/app", technik_art: "web", datenbank: "spielwiese", vorschau_domain: "app.pages.dev" }, holen: async () => ({ ok: true, status: 200 }) });
  assert.equal(a.github.stand, "gruen"); assert.equal(a.pruefung.stand, "gruen"); assert.equal(a.testseite.stand, "gruen");
  assert.equal(a.datenbank.stand, "gelb"); assert.match(a.datenbank.text, /Bestätigung/);
  assert.ok(!("sandbox" in a) && !("build" in a));
  for (const v of Object.values(a)) assert.ok(v.text.length <= 200);
});

test("Ampel Programm: roter Build, Sandbox fehlt, ohne Signatur; Fehler einzelner Prüfungen werden grau", async () => {
  const sh = ghFake({ "repo view": "PRIVATE", "run list pruefung.yml": new Error("HTTP 404"), "run list programm.yml": JSON.stringify([{ status: "completed", conclusion: "failure" }]), "secret list": "ANDERES\n" });
  const a = await ampelPruefen({ sh, projekt: { repo: "o/prog", technik_art: "programm", datenbank: "keine" }, plattform: "win32", sandbox: () => null });
  assert.equal(a.github.stand, "gruen"); assert.match(a.github.text, /privat/);
  assert.equal(a.pruefung.stand, "grau"); assert.equal(a.build.stand, "rot"); assert.equal(a.signatur.stand, "grau");
  assert.equal(a.sandbox.stand, "gelb"); assert.ok(!("testseite" in a));
});

test("Ampel ohne Repository und mit ungültiger Testseite", async () => {
  const a = await ampelPruefen({ sh: async () => { throw new Error("darf nicht"); }, projekt: { repo: null, technik_art: "handy", test_url: "http://unsicher" } });
  assert.equal(a.github.stand, "rot"); assert.equal(a.testseite.stand, "rot");
});

test("Sandbox-Konfiguration: nur lesbar, Datei geprüft, XML sicher", () => {
  const k = sandboxKonfig("C:\\Daten\\a&b", "Prog_0.1.0_x64-setup.exe");
  assert.match(k, /<ReadOnly>true<\/ReadOnly>/); assert.match(k, /a&amp;b/); assert.match(k, /<ClipboardRedirection>Disable/);
  assert.throws(() => sandboxKonfig("C:\\x", "boese\".exe"), /Dateiname/);
  assert.throws(() => sandboxKonfig("C:\\x", "skript.bat"), /Dateiname/);
});

test("Sandbox starten: lädt genau eine .exe und startet nur die Sandbox", async () => {
  const basis = await mkdtemp(path.join(os.tmpdir(), "cs-sb-"));
  const aufrufe = [];
  const sh = async (b, args) => {
    aufrufe.push(args.join(" "));
    if (args[0] === "run" && args[1] === "list") return { stdout: JSON.stringify([{ databaseId: 77, url: "https://github.com/o/prog/actions/runs/77" }]) };
    if (args[0] === "run" && args[1] === "download") { const dir = args[args.indexOf("--dir") + 1]; await writeFile(path.join(dir, "Prog_0.1.0_x64-setup.exe"), "MZ"); return { stdout: "" }; }
    throw new Error("unerwartet");
  };
  let gestartet = null;
  const r = await sandboxStarten({ sh, repo: "o/prog", zweig: "main", basis, projektId: "prog", plattform: "win32", sandbox: () => "C:\\Windows\\System32\\WindowsSandbox.exe", starten: async (exe, args) => { gestartet = { exe, args }; } });
  assert.equal(r.datei, "Prog_0.1.0_x64-setup.exe");
  assert.match(gestartet.exe, /WindowsSandbox\.exe$/); assert.match(gestartet.args[0], /77\.wsb$/);
  assert.match(await readFile(gestartet.args[0], "utf8"), /Prog_0\.1\.0_x64-setup\.exe/);
  assert.ok(aufrufe.some((x) => x.includes("--name installation-windows")));
  // zwei Dateien im Build -> Fehler
  const sh2 = async (b, args) => {
    if (args[1] === "list") return { stdout: JSON.stringify([{ databaseId: 78 }]) };
    const dir = args[args.indexOf("--dir") + 1]; await writeFile(path.join(dir, "a.exe"), "MZ"); await writeFile(path.join(dir, "b.dll"), "x"); return { stdout: "" };
  };
  await assert.rejects(sandboxStarten({ sh: sh2, repo: "o/prog", basis, projektId: "prog", plattform: "win32", sandbox: () => "x", starten: async () => assert.fail("darf nicht starten") }), /genau eine/);
  // ohne erfolgreichen Build / ohne Sandbox / böser Zweig
  await assert.rejects(sandboxStarten({ sh: async () => ({ stdout: "[]" }), repo: "o/prog", basis, projektId: "p", plattform: "win32", sandbox: () => "x", starten: async () => {} }), /erfolgreichen Build/);
  await assert.rejects(sandboxStarten({ sh, repo: "o/prog", basis, projektId: "p", plattform: "win32", sandbox: () => null, starten: async () => {} }), /nicht eingeschaltet/);
  await assert.rejects(sandboxStarten({ sh, repo: "o/prog", zweig: "../x", basis, projektId: "p", starten: async () => {} }), /Zweig/);
  await rm(basis, { recursive: true, force: true });
});

test("Testlauf startet den Ablauf „Lauf“", async () => {
  const aufrufe = [];
  const r = await testlaufStarten({ sh: async (b, a) => { aufrufe.push(a.join(" ")); return { stdout: "" }; }, repo: "o/tool", zweig: "main" });
  assert.equal(aufrufe[0], "workflow run lauf.yml --repo o/tool --ref main"); assert.match(r.link, /lauf\.yml$/);
  await assert.rejects(testlaufStarten({ sh: async () => ({}), repo: "o/../x" }), /Repository/);
});
