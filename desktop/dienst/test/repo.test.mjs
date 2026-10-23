import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { geruestSchreiben, repoName, repoOk, vorlageFuellen } from "../lib/repo.mjs";

test("Repository: Name und Prüfung", () => {
  assert.equal(repoName("isoki-aufmass"), "isoki-aufmass");
  assert.equal(repoName("..böse//x"), "b-se-x");
  assert.ok(repoOk("gerhardkresak-code/neu")); assert.ok(!repoOk("x/..")); assert.ok(!repoOk("a/b/c")); assert.ok(!repoOk("-a/b"));
  assert.equal(vorlageFuellen("Name [PROJEKTNAME] · [OWNER/REPO] · [NAME]", { name: "Kasse", repo: "o/kasse", inhaber: "G" }), "Name Kasse · o/kasse · G");
});

test("Grundgerüst aus dem Regelwerk (falls Vorlage vorhanden) plus README/Konzept/Wissen", async () => {
  const ziel = await mkdtemp(path.join(os.tmpdir(), "cs-geruest-"));
  const vorlage = existsSync("/home/claude/ai-dev-os/project-template") ? "/home/claude/ai-dev-os/project-template" : null;
  const d = await geruestSchreiben(ziel, vorlage, { name: "Kassenbuch", repo: "gerhardkresak-code/kassenbuch", beschreibung: "Für Vereine", inhaber: "Gerhard", konzeptMd: "# Konzept – Kassenbuch\n" });
  assert.ok(d.includes("README.md") && d.includes("docs/KONZEPT.md") && d.includes("docs/WISSEN.md"));
  assert.match(await readFile(path.join(ziel, "README.md"), "utf8"), /Für Vereine/);
  if (vorlage) {
    assert.ok(d.includes("AGENTS.md") && d.includes(".github/pull_request_template.md") && !d.some((x) => x.startsWith("github/")));
    const a = await readFile(path.join(ziel, "AGENTS.md"), "utf8");
    assert.match(a, /Kassenbuch/); assert.doesNotMatch(a, /\[PROJEKTNAME\]/); assert.match(a, /gerhardkresak-code\/kassenbuch/);
    assert.match(await readFile(path.join(ziel, "docs/CHANGELOG.md"), "utf8"), /Repository angelegt/);
  }
  await rm(ziel, { recursive: true, force: true });
});
