import { test } from "node:test";
import assert from "node:assert/strict";
import { zaehlen } from "../src/zaehlen.mjs";

test("zählt je Kategorie", () => {
  assert.deepEqual(zaehlen([{ kategorie: "A" }, { kategorie: "B" }, { kategorie: "A" }]), { A: 2, B: 1 });
});
