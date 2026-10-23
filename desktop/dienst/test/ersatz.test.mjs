import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { kopiereProjekt, vergleiche, uebernehmen, gesperrt, prText } from "../lib/ersatz.mjs";

async function aufbau() {
  const t = await mkdtemp(path.join(os.tmpdir(), "cs-ersatz-test-"));
  const q = path.join(t, "auftrag"); const k = path.join(t, "kopie");
  await mkdir(path.join(q, "src"), { recursive: true }); await mkdir(path.join(q, "node_modules", "x"), { recursive: true }); await mkdir(k);
  await writeFile(path.join(q, ".git"), "gitdir: /irgendwo\n"); await writeFile(path.join(q, "src", "a.js"), "eins"); await writeFile(path.join(q, "src", "weg.js"), "weg");
  await writeFile(path.join(q, ".env"), "GEHEIM=1"); await writeFile(path.join(q, "node_modules", "x", "i.js"), "x");
  return { t, q, k };
}

test("Kopie ohne .git, node_modules und Geheimnisse", async () => {
  const { t, q, k } = await aufbau();
  const liste = await kopiereProjekt(q, k);
  assert.deepEqual(liste.sort(), ["src/a.js", "src/weg.js"]);
  assert.ok(!existsSync(path.join(k, ".git")) && !existsSync(path.join(k, ".env")));
  await rm(t, { recursive: true, force: true });
});

test("Änderungen übernehmen, Löschen, neue Ordner mit gesperrten Dateien werden erkannt", async () => {
  const { t, q, k } = await aufbau();
  const original = await kopiereProjekt(q, k);
  await writeFile(path.join(k, "src", "a.js"), "zwei"); await unlink(path.join(k, "src", "weg.js")); await writeFile(path.join(k, "src", "neu.js"), "neu");
  let a = await vergleiche(q, k, original);
  assert.deepEqual(a.geaendert.map((x) => x.r).sort(), ["src/a.js", "src/neu.js"]); assert.deepEqual(a.geloescht, ["src/weg.js"]);
  const ok = await uebernehmen(q, a);
  assert.ok(ok.ok); assert.equal(await readFile(path.join(q, "src", "a.js"), "utf8"), "zwei"); assert.ok(!existsSync(path.join(q, "src", "weg.js")));
  // neuer Ordner mit gesperrter Datei, Symlink, .git-Datei
  await mkdir(path.join(k, "neu", ".claude"), { recursive: true }); await writeFile(path.join(k, "neu", ".claude", "settings.json"), "{}");
  a = await vergleiche(q, k, original);
  assert.equal((await uebernehmen(q, a)).ok, false);
  await rm(path.join(k, "neu"), { recursive: true });
  await symlink("/etc/passwd", path.join(k, "src", "link.js"));
  a = await vergleiche(q, k, original); assert.equal((await uebernehmen(q, a)).ok, false);
  await rm(t, { recursive: true, force: true });
});

test("Sperrliste und PR-Text", () => {
  for (const p of [".github/workflows/x.yml", "app/package.json", "npm-shrinkwrap.json", "AGENTS.md", "sub/CLAUDE.md", ".gitattributes", ".env.local", "x/.git/config", ".codex/a", ".npmrc"]) assert.ok(gesperrt(p), p);
  for (const p of ["src/a.js", "docs/handbuch.md", "vite.config.js"]) assert.ok(!gesperrt(p), p);
  const t = prText("Fixes #12 @gerhard ``` boom");
  assert.ok(!t.includes("#12") && !t.includes("@gerhard") && t.startsWith("```text"));
});

test("Harte Links und symlinkte Elternordner werden abgelehnt", async () => {
  const { link } = await import("node:fs/promises");
  const { t, q, k } = await aufbau();
  const original = await kopiereProjekt(q, k);
  const geheim = path.join(t, "geheim.txt"); await writeFile(geheim, "SCHLÜSSEL");
  await link(geheim, path.join(k, "src", "hart.js"));
  let a = await vergleiche(q, k, original);
  assert.equal((await uebernehmen(q, a)).ok, false);
  await unlink(path.join(k, "src", "hart.js"));
  // im echten Ordner ist „lib“ eine Verknüpfung nach draußen, Codex legt in der Kopie einen echten Ordner „lib“ an
  const draussen = path.join(t, "draussen"); await mkdir(draussen); await symlink(draussen, path.join(q, "lib"));
  await mkdir(path.join(k, "lib")); await writeFile(path.join(k, "lib", "x.js"), "x");
  a = await vergleiche(q, k, original);
  assert.equal((await uebernehmen(q, a)).ok, false);
  assert.ok(!existsSync(path.join(draussen, "x.js")));
  await rm(t, { recursive: true, force: true });
});
