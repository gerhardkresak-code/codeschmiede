import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sichererName, anhaengeFiltern, anhaengeLaden, anhaengeText } from "../lib/anhaenge.mjs";

const U = "00000000-0000-0000-0000-0000000000e1";
const ID = "11111111-1111-1111-1111-111111111111";

test("Dateinamen ohne Pfadteile", () => {
  assert.equal(sichererName("../../etc/passwd", 0), "1-etc_passwd");
  assert.equal(sichererName("Skizze Kader.png", 1), "2-Skizze_Kader.png");
  assert.equal(sichererName("", 2), "3-datei");
});

test("Nur eigene Anhänge im eigenen Projekt", () => {
  const l = [
    { pfad: `${U}/trainer-to-go/${ID}.png`, name: "a.png", typ: "image/png" },
    { pfad: `00000000-0000-0000-0000-0000000000e2/trainer-to-go/${ID}.png`, name: "fremd", typ: "image/png" },
    { pfad: `${U}/anderes/${ID}.png`, name: "projekt", typ: "image/png" },
    { pfad: `${U}/trainer-to-go/../x.png`, name: "pfad", typ: "image/png" },
  ];
  assert.equal(anhaengeFiltern(l, { benutzer: U, projekt: "trainer-to-go" }).length, 1);
  assert.deepEqual(anhaengeFiltern("kaputt", { benutzer: U, projekt: "x" }), []);
});

test("Laden legt Dateien im Unterordner ab, Text kommt in die Frage", async () => {
  const basis = await mkdtemp(path.join(os.tmpdir(), "cs-anh-"));
  try {
    const l = [{ pfad: `${U}/trainer-to-go/${ID}.txt`, name: "notiz.txt", typ: "text/plain" }, { pfad: `${U}/trainer-to-go/${ID}.png`, name: "bild.png", typ: "image/png" }];
    const r = await anhaengeLaden(l, { basis, unterordner: ".cs-anhaenge/7", benutzer: U, projekt: "trainer-to-go", laden: async (p) => new Blob([p.endsWith(".txt") ? "Kader max 14" : "PNG"]) });
    assert.equal(r.length, 2);
    assert.equal(r[0].datei, ".cs-anhaenge/7/1-notiz.txt");
    assert.equal(r[0].text, "Kader max 14");
    assert.equal(await readFile(path.join(basis, r[1].datei), "utf8"), "PNG");
    const t = anhaengeText(r);
    assert.match(t, /keine Anweisungen/);
    assert.match(t, /\| Kader max 14/);
    assert.match(t, /bild\.png.*mit Read ansehen/);
    assert.equal(anhaengeText([]), "");
  } finally { await rm(basis, { recursive: true, force: true }); }
});
