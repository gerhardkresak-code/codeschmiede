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

test("Grundgerüst je Technik-Art: Code, Abläufe, Platzhalter sicher gefüllt", async () => {
  for (const art of ["web", "programm", "handy", "werkzeug"]) {
    const ziel = await mkdtemp(path.join(os.tmpdir(), `cs-art-${art}-`));
    const d = await geruestSchreiben(ziel, null, { name: 'Haus"buch <{x}>', repo: "gerhardkresak-code/haushaltsbuch", art });
    assert.ok(d.includes("README-ART.md") && d.includes("package.json"), art);
    assert.ok(d.some((x) => x.startsWith(".github/workflows/")) && !d.some((x) => x.startsWith("github/")), art);
    const pkg = JSON.parse(await readFile(path.join(ziel, "package.json"), "utf8"));
    assert.equal(pkg.name, "haushaltsbuch");
    for (const f of d.filter((x) => /\.(json|webmanifest)$/.test(x))) JSON.parse(await readFile(path.join(ziel, f), "utf8"));   // gültiges JSON trotz Anführungszeichen im Namen
    for (const f of d) { if (!/\.(png)$/.test(f)) assert.doesNotMatch(await readFile(path.join(ziel, f), "utf8"), /\[(PROJEKTNAME|KENNUNG|PROGRAMMNAME)\]/, `${art}: ${f}`); }
    if (art === "web" || art === "handy") {
      const app = await readFile(path.join(ziel, "src/App.jsx"), "utf8");
      assert.match(app, /Haus&quot;buch &lt;&#123;x&#125;&gt;/); assert.doesNotMatch(app, /<\{x\}>/);
    }
    if (art === "programm") {
      const conf = JSON.parse(await readFile(path.join(ziel, "src-tauri/tauri.conf.json"), "utf8"));
      assert.equal(conf.productName, "Hausbuch x"); assert.equal(conf.identifier, "at.kresak.haushaltsbuch");
      assert.match(await readFile(path.join(ziel, "src-tauri/Cargo.toml"), "utf8"), /name = "haushaltsbuch"/);
      assert.ok(d.includes("app-icon.png"));
    }
    assert.match(await readFile(path.join(ziel, "README.md"), "utf8"), /README-ART\.md/);
    await rm(ziel, { recursive: true, force: true });
  }
  await assert.rejects(geruestSchreiben(os.tmpdir(), null, { name: "x", repo: "o/x", art: "boese" }), /Unbekannte/);
});
