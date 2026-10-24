import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { dbEinrichten, dbAmpel, dbOffen, dbLiveEinspielen, ABLAUF_PFAD, CHANGELOG_PFAD, changelogZeile } from "../lib/datenbank.mjs";

const run = promisify(execFile);
const git = async (cwd, ...a) => (await run("git", a, { cwd })).stdout.trim();

test("Einrichten: Umgebungen nur für ihren Zweig, Auftrag nur wenn Ablauf fehlt oder anders, Hinweis auf fehlende Zugänge", async () => {
  const aufrufe = []; let auftrag = null;
  const sh = (inhaltMain, geheim, policies = "") => async (b, a) => {
    aufrufe.push(a.join(" "));
    if (a[0] === "api" && a[1].includes("/contents/")) { if (inhaltMain == null) throw new Error("HTTP 404"); return { stdout: `${"b".repeat(40)}\t${Buffer.from(inhaltMain).toString("base64")}\n` }; }
    if (a[0] === "api" && a[1].endsWith("git/ref/heads/main")) return { stdout: "c".repeat(40) };
    if (a[0] === "api" && a[1].endsWith("deployment-branch-policies") && a.length === 4) return { stdout: typeof policies === "function" ? policies(a[1]) : policies };
    if (a[0] === "secret") return { stdout: geheim ? "SUPABASE_DB_URL\n" : "ANDERES\n" };
    return { stdout: "" };
  };
  const projekt = { repo: "o/app", db_test_ref: "abcdefghijabcdefghij", db_live_ref: null, db_test_bestehend: true, db_live_bestehend: false };
  let t = await dbEinrichten({ sh: sh(null, false, "7\tfeature/*\tbranch\n"), projekt, vorlage: "ABLAUF", auftragAnlegen: async (d) => { auftrag = d; return 42; } });
  assert.match(t, /Auftrag #42/); assert.match(t, /SUPABASE_DB_URL in „test“/);
  assert.deepEqual(auftrag, { dateien: [{ pfad: ABLAUF_PFAD, inhalt: "ABLAUF", basis_blob: "" }], basis_sha: "c".repeat(40) });
  assert.ok(aufrufe.some((x) => x.startsWith("api -X PUT repos/o/app/environments/test")));
  assert.ok(aufrufe.includes("api -X DELETE repos/o/app/environments/test/deployment-branch-policies/7"), "fremde Zweig-Regel entfernt");
  assert.ok(aufrufe.includes("api -X POST repos/o/app/environments/test/deployment-branch-policies -f name=main -f type=branch"));
  assert.ok(aufrufe.includes("variable set BESTEHEND --repo o/app --env test --body ja"));
  assert.ok(!aufrufe.some((x) => x.includes("environments/live")), "ohne Live-Datenbank keine Live-Umgebung");
  aufrufe.length = 0;
  t = await dbEinrichten({ sh: sh("ABLAUF", true, (pfad) => (pfad.includes("/live/") ? "4\tlive\tbranch\n" : "3\tmain\tbranch\n")), projekt: { ...projekt, db_live_ref: "bbcdefghijabcdefghij" }, vorlage: "ABLAUF", auftragAnlegen: async () => assert.fail("kein Auftrag nötig") });
  assert.match(t, /schon auf main/); assert.doesNotMatch(t, /fehlt/);
  assert.ok(!aufrufe.some((x) => x.includes("DELETE")));
  await assert.rejects(dbEinrichten({ sh: sh(null, true), projekt: { ...projekt, db_test_ref: "BÖSE" }, auftragAnlegen: async () => 1 }), /Kennung/);
});

test("Ampel der Datenbank-Station", async () => {
  assert.equal(await dbAmpel({ sh: async () => ({ stdout: "" }), projekt: { repo: "o/a" } }), null);
  const sh = (geheimLive) => async (b, a) => {
    if (a[0] === "api") return { stdout: `${"b".repeat(40)}\t${Buffer.from("x").toString("base64")}` };
    if (a[0] === "secret") return { stdout: a.includes("live") && !geheimLive ? "" : "SUPABASE_DB_URL" };
    if (a[0] === "run") return { stdout: JSON.stringify([{ status: "completed", conclusion: a.includes("live") ? "failure" : "success" }]) };
    return { stdout: "" };
  };
  const projekt = { repo: "o/a", db_test_ref: "abcdefghijabcdefghij", db_live_ref: "bbcdefghijabcdefghij" };
  let a = await dbAmpel({ sh: sh(true), projekt });
  assert.equal(a.datenbank.stand, "gruen"); assert.equal(a.datenbank_live.stand, "rot");
  a = await dbAmpel({ sh: sh(false), projekt });
  assert.equal(a.datenbank_live.stand, "gelb"); assert.match(a.datenbank_live.text, /„live“/);
});

test("Live-Datenbank nach dem Live-Schalten: startet Ablauf auf live und meldet Fehler deutlich", async () => {
  const aufrufe = [];
  const sh = (ergebnis) => async (b, a) => {
    aufrufe.push(a.join(" "));
    if (a[0] === "api") return { stdout: `${"b".repeat(40)}\t${Buffer.from("x").toString("base64")}` };
    if (a[0] === "run") { const k = aufrufe.find((x) => x.startsWith("workflow run"))?.match(/kennung=(\S+)/)?.[1]; return { stdout: JSON.stringify([{ databaseId: 1, status: "completed", conclusion: ergebnis, createdAt: new Date().toISOString(), displayTitle: `Datenbank live ${k}` }]) }; }
    return { stdout: "" };
  };
  const projekt = { repo: "o/a", db_live_ref: "bbcdefghijabcdefghij" };
  assert.equal(await dbLiveEinspielen({ sh: sh("success"), projekt, vorher: "d".repeat(40), kennung: "live-5", pause: async () => {} }), "Live-Datenbank aktuell");
  const start = aufrufe.find((x) => x.startsWith("workflow run"));
  assert.match(start, /^workflow run datenbank.yml --repo o\/a --ref live -f kennung=cs-live-5-\d+ -f vorher=d{40}$/);
  aufrufe.length = 0;
  assert.match(await dbLiveEinspielen({ sh: sh("failure"), projekt, pause: async () => {} }), /ACHTUNG/);
  assert.equal(await dbLiveEinspielen({ sh: sh("success"), projekt: { repo: "o/a" } }), null);
});

test("Offene Datenbank-Dateien: main ohne live", async () => {
  const d = await mkdtemp(path.join(os.tmpdir(), "cs-dbo-"));
  const c = (m) => git(d, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", m);
  await git(d, "init", "-q", "-b", "main"); await mkdir(path.join(d, "supabase/migrations"), { recursive: true });
  await writeFile(path.join(d, "supabase/migrations/001_a.sql"), "select 1;"); await git(d, "add", "-A"); await c("a");
  assert.equal(await dbOffen(git, d), null);   // ohne live
  await git(d, "branch", "live");
  await writeFile(path.join(d, "supabase/migrations/002_b.sql"), 'create table b(); -- token = "abcdefghijklmnop"'); await git(d, "add", "-A"); await c("b");
  const o = await dbOffen(git, d);
  assert.deepEqual(o.map((x) => x.datei), ["002_b.sql"]); assert.doesNotMatch(o[0].sql, /abcdefghijklmnop/);
  await rm(d, { recursive: true, force: true });
});

test("Abläufe zwischen live und main geändert", async () => {
  const { ablaeufeGeaendert } = await import("../lib/datenbank.mjs");
  const d = await mkdtemp(path.join(os.tmpdir(), "cs-abl-"));
  const c = (m) => git(d, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", m);
  await git(d, "init", "-q", "-b", "main"); await mkdir(path.join(d, ".github/workflows"), { recursive: true });
  await writeFile(path.join(d, ".github/workflows/a.yml"), "a"); await git(d, "add", "-A"); await c("a"); await git(d, "branch", "live");
  assert.equal(await ablaeufeGeaendert(git, d), false);
  await writeFile(path.join(d, ".github/workflows/a.yml"), "b"); await git(d, "add", "-A"); await c("b");
  assert.equal(await ablaeufeGeaendert(git, d), true);
  await rm(d, { recursive: true, force: true });
});

test("Einrichten nimmt eine Zeile ins Änderungsprotokoll mit (sonst lehnt die Sicherheitsprüfung ab)", async () => {
  const log = "# Protokoll\n\n| Version | Datum | Wer | Was |\n|---|---|---|---|\n| 1.0 | 2026-01-01 | X | Alt |\n";
  const neu = changelogZeile(log, "2026-10-24");
  const z = neu.split("\n");
  assert.equal(z[4].startsWith("| – (Datenbank-Station) | 2026-10-24 | Codeschmiede"), true);
  assert.equal((z[4].match(/\|/g) || []).length, 5);
  assert.equal(z[5], "| 1.0 | 2026-01-01 | X | Alt |");
  assert.equal(changelogZeile("ohne Tabelle"), null);
  let auftrag = null;
  const sh = async (b, a) => {
    if (a[0] === "api" && a[1].includes("/contents/.github")) throw new Error("HTTP 404");
    if (a[0] === "api" && a[1].includes("/contents/docs/CHANGELOG.md")) return { stdout: `${"d".repeat(40)}\t${Buffer.from(log).toString("base64")}\n` };
    if (a[0] === "api" && a[1].endsWith("git/ref/heads/main")) return { stdout: "c".repeat(40) };
    if (a[0] === "secret") return { stdout: "SUPABASE_DB_URL\n" };
    return { stdout: "" };
  };
  await dbEinrichten({ sh, projekt: { repo: "o/app", db_test_ref: "abcdefghijabcdefghij", db_live_ref: null, db_test_bestehend: true }, vorlage: "ABLAUF", auftragAnlegen: async (d) => { auftrag = d; return 7; } });
  assert.deepEqual(auftrag.dateien.map((d) => d.pfad), [ABLAUF_PFAD, CHANGELOG_PFAD]);
  assert.equal(auftrag.dateien[1].basis_blob, "d".repeat(40));
  assert.match(auftrag.dateien[1].inhalt, /Datenbank-Station/);
});
