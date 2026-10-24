import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { zweigStand, codeBaum, codeDatei, handSchreiben, pfadOk } from "../lib/code.mjs";

const sh = promisify(execFile);
const git = async (cwd, ...a) => (await sh("git", a, { cwd })).stdout.trim();
const gitRoh = async (cwd, ...a) => (await sh("git", a, { cwd, encoding: "buffer" })).stdout;

async function testRepo() {
  const d = await mkdtemp(path.join(os.tmpdir(), "cs-code-"));
  await git(d, "init", "-q", "-b", "main");
  await mkdir(path.join(d, "src"));
  await writeFile(path.join(d, "src/a.js"), "export const a = 1;\n");
  await writeFile(path.join(d, ".env"), "GEHEIM=1\n");
  await mkdir(path.join(d, "config")); await writeFile(path.join(d, "config/.env"), "X=geheimgeheim\n"); await writeFile(path.join(d, "config/z.js"), "z\n");
  await writeFile(path.join(d, "conf.js"), 'const api_key = "abcdefghijkl";\n');
  await writeFile(path.join(d, "bild.png"), Buffer.from([0x89, 0x50, 0x00, 0x01]));
  await git(d, "add", "-A");
  await git(d, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "x");
  return d;
}

test("Pfad-Prüfung", () => {
  assert.ok(pfadOk("src/a.js") && pfadOk("README.md"));
  for (const p of ["../x", "a/../b", "/etc/x", ".git/config", "a\\b", "-x", "", ".", "./a", "a/.", "a/", "a//b", "a:b", "a."]) assert.ok(!pfadOk(p), p);
});

test("Baum und Dateien: geheim gesperrt, Geheimnisse maskiert, Binär ohne Inhalt", async () => {
  const d = await testRepo();
  const sha = await zweigStand(git, d, "main");
  await assert.rejects(zweigStand(git, d, "gibtsnicht"), /gibt es nicht/);
  const baum = await codeBaum(git, d, sha);
  assert.deepEqual(baum.map((x) => x.p).sort(), [".env", "bild.png", "conf.js", "config/.env", "config/z.js", "src/a.js"]);
  assert.equal(baum.find((x) => x.p === ".env").x, 1);
  const a = await codeDatei(git, gitRoh, d, sha, "src/a.js");
  assert.equal(a.inhalt, "export const a = 1;\n"); assert.equal(a.nur_lesen, false); assert.match(a.blob_sha, /^[0-9a-f]{40}$/);
  const env = await codeDatei(git, gitRoh, d, sha, ".env");
  assert.equal(env.inhalt, null); assert.match(env.hinweis, /Geheime/);
  const c = await codeDatei(git, gitRoh, d, sha, "conf.js");
  assert.equal(c.nur_lesen, true); assert.doesNotMatch(c.inhalt, /abcdefghijkl/);
  const b = await codeDatei(git, gitRoh, d, sha, "bild.png");
  assert.equal(b.inhalt, null); assert.match(b.hinweis, /Binär/);
  await assert.rejects(codeDatei(git, gitRoh, d, sha, "../x"), /Ungültiger Pfad/);
  // Prüfung H1: Ordner-Pfade dürfen nie den Inhalt (z. B. .env) liefern
  for (const p of [".", "./", "config/", "config/.", "config", "src"]) await assert.rejects(codeDatei(git, gitRoh, d, sha, p), /Ungültiger Pfad|nicht gefunden/, p);
  await assert.rejects(codeDatei(git, gitRoh, d, sha, "fehlt.js"), /nicht gefunden/);
  await rm(d, { recursive: true, force: true });
});

test("Hand-Änderung schreiben: Konflikt, neue Datei, Verknüpfung abgelehnt", async () => {
  const d = await testRepo();
  const blob = await git(d, "rev-parse", "HEAD:src/a.js");
  // Konflikt: falscher Ausgangsstand
  let r = await handSchreiben(git, d, "HEAD", [{ pfad: "src/a.js", inhalt: "neu", basis_blob: "0".repeat(40) }]);
  assert.equal(r.ok, false); assert.deepEqual(r.konflikte, ["src/a.js"]);
  assert.equal(await readFile(path.join(d, "src/a.js"), "utf8"), "export const a = 1;\n");
  // gültig + neue Datei in neuem Ordner
  r = await handSchreiben(git, d, "HEAD", [{ pfad: "src/a.js", inhalt: "export const a = 2;\n", basis_blob: blob }, { pfad: "neu/b.js", inhalt: "b", basis_blob: null }]);
  assert.equal(r.ok, true); assert.equal(await readFile(path.join(d, "src/a.js"), "utf8"), "export const a = 2;\n");
  assert.equal(await readFile(path.join(d, "neu/b.js"), "utf8"), "b");
  // „neue Datei“, die es in Wahrheit schon gibt -> Konflikt
  r = await handSchreiben(git, d, "HEAD", [{ pfad: "conf.js", inhalt: "x", basis_blob: null }]);
  assert.equal(r.ok, false);
  // Verknüpfung im Weg
  const aussen = await mkdtemp(path.join(os.tmpdir(), "cs-aussen-"));
  await symlink(aussen, path.join(d, "link"));
  await assert.rejects(handSchreiben(git, d, "HEAD", [{ pfad: "link/x.js", inhalt: "x", basis_blob: null }]), /Ungültiger Ordner/);
  await assert.rejects(handSchreiben(git, d, "HEAD", [{ pfad: ".env", inhalt: "x" }]), /Ungültiger Pfad/);
  await assert.rejects(handSchreiben(git, d, "HEAD", [{ pfad: "neu/c.js", inhalt: 'const token = "abcdefghijklmnop";', basis_blob: null }]), /Geheimnis/);
  await rm(d, { recursive: true, force: true }); await rm(aussen, { recursive: true, force: true });
});
