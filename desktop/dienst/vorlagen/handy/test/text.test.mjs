import { test } from "node:test";
import assert from "node:assert/strict";
import { begruessung } from "../src/lib/text.js";

test("Begrüßung je Tageszeit", () => {
  assert.equal(begruessung(8), "Guten Morgen");
  assert.equal(begruessung(14), "Hallo");
  assert.equal(begruessung(21), "Guten Abend");
});
