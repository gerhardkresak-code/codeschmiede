import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { dbEinrichten, dbAmpel, dbOffen, ABLAUF_PFAD } from "../lib/datenbank.mjs";

const run = promisify(execFile);
const git = async (cwd, ...a) => (await run("git", a, { cwd })).stdout.trim();

test("Einrichten: Variablen, Auftrag nur wenn Ablauf fehlt oder anders, Hinweis auf fehlendes Geheimnis", async () => {
  const aufrufe = []; let auftrag = null;
  const sh = (inhaltMain, geheim) => async (b, a) => {
    aufrufe.push(a.join(" "));
    if (a[0] === "api" && a[1].includes("/contents/")) { if (inhaltMain == null) { const e = new Error("HTTP 404"); throw e; } return { stdout: `${"b".repeat(40)}\t${Buffer.from(inhaltMain).toString("base64")}\n` }; }
    if (a[0] === "api" && a[1].endsWith("git/ref/heads/main")) return { stdout: "c".repeat(40) };
    if (a[0] === "secret") return { stdout: geheim ? "SUPABASE_ACCESS_TOKEN\n" : "ANDERES\n" };
    return { stdout: "" };
  };
  const projekt = { repo: "o/app", db_test_ref: "abcdefghijabcdefghij", db_live_ref: null, db_test_bestehend: true, db_live_bestehend: false };
  let t = await dbEinrichten({ sh: sh(null, false), projekt, vorlage: "ABLAUF", auftragAnlegen: async (d) => { auftrag = d; return 42; } });
  assert.match(t, /Auftrag #42/); assert.match(t, /SUPABASE_ACCESS_TOKEN/);
  assert.deepEqual(auftrag, { pfad: ABLAUF_PFAD, inhalt: "ABLAUF", basis_blob: "", basis_sha: "c".repeat(40) });
  assert.ok(aufrufe.includes("variable set SUPABASE_TEST_REF --repo o/app --body abcdefghijabcdefghij"));
  assert.ok(aufrufe.includes("variable set SUPABASE_TEST_BESTEHEND --repo o/app --body ja"));
  assert.ok(aufrufe.includes("variable delete SUPABASE_LIVE_REF --repo o/app"));
  auftrag = null;
  t = await dbEinrichten({ sh: sh("ABLAUF", true), projekt, vorlage: "ABLAUF", auftragAnlegen: async () => assert.fail("kein Auftrag nötig") });
  assert.match(t, /schon auf main/); assert.doesNotMatch(t, /fehlt/);
  t = await dbEinrichten({ sh: sh("ALT", true), projekt, vorlage: "ABLAUF", auftragAnlegen: async (d) => { auftrag = d; return 7; } });
  assert.equal(auftrag.basis_blob, "b".repeat(40));
  await assert.rejects(dbEinrichten({ sh: sh(null, true), projekt: { ...projekt, db_test_ref: "BÖSE" }, auftragAnlegen: async () => 1 }), /Kennung/);
});

test("Ampel der Datenbank-Station", async () => {
  assert.equal(await dbAmpel({ sh: async () => ({ stdout: "" }), projekt: { repo: "o/a" } }), null);
  const sh = async (b, a) => {
    if (a[0] === "api") return { stdout: `${"b".repeat(40)}\t${Buffer.from("x").toString("base64")}` };
    if (a[0] === "secret") return { stdout: "SUPABASE_ACCESS_TOKEN" };
    if (a[0] === "run") return { stdout: JSON.stringify([{ status: "completed", conclusion: a.includes("live") ? "failure" : "success" }]) };
    return { stdout: "" };
  };
  const a = await dbAmpel({ sh, projekt: { repo: "o/a", db_test_ref: "abcdefghijabcdefghij", db_live_ref: "bbcdefghijabcdefghij" } });
  assert.equal(a.datenbank.stand, "gruen"); assert.equal(a.datenbank_live.stand, "rot");
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
