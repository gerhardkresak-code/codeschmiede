import { test } from "node:test";
import assert from "node:assert/strict";
import { liveAusfuehren, datenbankPasst, pruefPrompt } from "../lib/live.mjs";

const A = "a".repeat(40), B = "b".repeat(40), C = "c".repeat(40);
// Nachgebautes gh: Zweige, Bäume, Prüfläufe
function fakeGh({ zweige, baeume = {}, laeufe = {} }) {
  const aufrufe = [];
  const sh = async (befehl, args) => {
    assert.equal(befehl, "gh"); aufrufe.push(args);
    const pfad = args.find((x) => x.startsWith("repos/"));
    let m;
    if (args.includes("-X")) {
      const ref = args.find((x) => x.startsWith("ref="))?.slice(4) || `refs/heads/${pfad.split("/heads/")[1]}`;
      zweige[ref.replace("refs/heads/", "")] = args.find((x) => x.startsWith("sha=")).slice(4);
      return { stdout: "{}" };
    }
    if ((m = pfad.match(/git\/ref\/heads\/(.+)$/))) { if (!zweige[m[1]]) { const e = new Error("gh: Not Found (HTTP 404)"); throw e; } return { stdout: zweige[m[1]] + "\n" }; }
    if ((m = pfad.match(/git\/trees\/([0-9a-f]+)/))) return { stdout: JSON.stringify({ truncated: false, tree: (baeume[m[1]] || []).map((n) => ({ path: `supabase/migrations/${n}` })).concat([{ path: "src/x.js" }]) }) };
    if (pfad.includes("/contents/package.json")) return { stdout: Buffer.from(JSON.stringify({ version: "1.2.3" })).toString("base64") };
    if ((m = pfad.match(/commits\/([0-9a-f]+)\/check-runs/))) return { stdout: laeufe[m[1]] || "" };
    throw new Error("unerwartet " + args.join(" "));
  };
  return { sh, aufrufe, zweige };
}

test("Einrichten legt live auf main an, vorhandenes live bleibt", async () => {
  const g = fakeGh({ zweige: { main: A }, baeume: { [A]: ["0001.sql"] } });
  const r = await liveAusfuehren({ sh: g.sh, auftrag: { art: "einrichten", repo: "o/app" } });
  assert.equal(g.zweige.live, A); assert.equal(r.commit, A); assert.deepEqual(r.migrationen, ["0001.sql"]); assert.equal(r.bezeichnung, "v1.2.3 · aaaaaaa");
  const g2 = fakeGh({ zweige: { main: B, live: A } });
  const r2 = await liveAusfuehren({ sh: g2.sh, auftrag: { art: "einrichten", repo: "o/app" } });
  assert.equal(r2.commit, A); assert.ok(!g2.aufrufe.some((a) => a.includes("-X")));
});

test("Live schalten nur bei fertig gebauter Testfassung", async () => {
  const g = fakeGh({ zweige: { main: B, live: A }, laeufe: { [B]: "in_progress\t\n" } });
  await assert.rejects(liveAusfuehren({ sh: g.sh, auftrag: { art: "live", repo: "o/app" } }), /noch gebaut/);
  const g2 = fakeGh({ zweige: { main: B, live: A }, laeufe: { [B]: "completed\tfailure\n" } });
  await assert.rejects(liveAusfuehren({ sh: g2.sh, auftrag: { art: "live", repo: "o/app" } }), /fehlgeschlagen/);
  const g3 = fakeGh({ zweige: { main: B, live: A }, laeufe: { [B]: "completed\tsuccess\n" } });
  const r = await liveAusfuehren({ sh: g3.sh, auftrag: { art: "live", repo: "o/app" } });
  assert.equal(g3.zweige.live, B); assert.equal(r.commit, B);
  const patch = g3.aufrufe.find((a) => a.includes("PATCH")); assert.ok(patch.includes("force=false"));
});

test("Zurück nur, wenn die Version zur Datenbank passt", async () => {
  const g = fakeGh({ zweige: { main: C, live: B }, baeume: { [A]: ["0001.sql"], [C]: ["0001.sql", "0002.sql"] } });
  await assert.rejects(liveAusfuehren({ sh: g.sh, auftrag: { art: "zurueck", repo: "o/app", commit_sha: A } }), /0002\.sql/);
  assert.equal(g.zweige.live, B);
  const g2 = fakeGh({ zweige: { main: C, live: C }, baeume: { [B]: ["0001.sql", "0002.sql"], [C]: ["0001.sql", "0002.sql"] } });
  await liveAusfuehren({ sh: g2.sh, auftrag: { art: "zurueck", repo: "o/app", commit_sha: B } });
  assert.equal(g2.zweige.live, B); assert.ok(g2.aufrufe.find((a) => a.includes("PATCH")).includes("force=true"));
});

test("Ungültige Eingaben werden abgelehnt", async () => {
  const g = fakeGh({ zweige: { main: A, live: A } });
  await assert.rejects(liveAusfuehren({ sh: g.sh, auftrag: { art: "live", repo: "../x" } }), /Ungültiges Repository/);
  await assert.rejects(liveAusfuehren({ sh: g.sh, auftrag: { art: "zurueck", repo: "o/app", commit_sha: "main" } }), /Ungültiges Ziel/);
  assert.equal(datenbankPasst(["a", "b"], ["a"]), null);
  assert.match(datenbankPasst(["a"], ["a", "b"]), /b/);
});

test("Prüf-Text nennt Umfang und Ergebniszeile", () => {
  const p = pruefPrompt({ projekt: { name: "TTG" }, umfang: "gruppe", gruppe: { name: "Kassa" }, features: [{ id: "F-1", name: "Beiträge" }] });
  assert.match(p, /Gruppe „Kassa“/); assert.match(p, /F-1 „Beiträge“/); assert.match(p, /PRÜFUNG: GRÜN/); assert.match(p, /änderst nichts/);
});
