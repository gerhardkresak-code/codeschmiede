// Werkstatt-Dienst der Codeschmiede.
// Läuft auf einem Werkstatt-PC, solange im Programm „Werkstatt an“ ist. Holt wartende Aufträge, arbeitet sie mit Claude ab
// (Claude Agent SDK, API-Schlüssel aus dem Tresor des PCs über die Umgebung ANTHROPIC_API_KEY) und meldet alles live zurück.
// Konzept: docs/KONZEPT.md · Regeln: AGENTS.md
//
// Steuerung über stdin (eine JSON-Zeile je Nachricht):
//   1. Zeile: { supabase_url, anon_key, access_token, user_id, admin, daten_ordner, pc_name }
//   danach:   { token: "<neues Zugriffstoken>" }  oder  { stop: true }
// Meldungen über stdout (eine JSON-Zeile je Meldung): { typ: "status"|"fehler", text, auftrag }

import { createInterface } from "node:readline";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createClient } from "@supabase/supabase-js";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { ohneGeheimnisse, kuerzen } from "./lib/geheim.mjs";
import { waehleModell } from "./lib/modell.mjs";
import { werteAus, zweigName, passtRegel } from "./lib/ergebnis.mjs";

const sh = promisify(execFile);
const melde = (typ, text, auftrag) => process.stdout.write(JSON.stringify({ typ, text, auftrag: auftrag ?? null, zeit: new Date().toISOString() }) + "\n");

let cfg = null;
let token = null;
let db = null;
let pcId = null;
let laeuft = null;         // { id, abort }
let stopp = false;

// ---------- Erlaubte Werkzeuge ohne Rückfrage (alles andere fragt Gerhard im Programm) ----------
const ERLAUBT = [
  "Read", "Grep", "Glob", "Edit", "Write", "NotebookEdit", "TodoWrite", "Task",
  "Bash(git status*)", "Bash(git diff*)", "Bash(git log*)", "Bash(git add *)", "Bash(git commit *)", "Bash(git fetch*)",
  "Bash(git checkout -b feature/cs-*)", "Bash(git switch -c feature/cs-*)", "Bash(git push -u origin feature/cs-*)", "Bash(git push origin feature/cs-*)",
  "Bash(gh pr create *)", "Bash(gh pr view*)", "Bash(gh pr checks*)", "Bash(ls*)", "Bash(cat *)", "Bash(npm run build*)", "Bash(npm test*)",
  "Bash(node --check *)", "Bash(python3 tools/*)",
];
const VERBOTEN = [
  "Bash(git push origin main*)", "Bash(git push -f*)", "Bash(git push --force*)", "Bash(git reset --hard origin*)",
  "Bash(rm -rf /*)", "Bash(rm -rf ~*)", "Bash(gh repo delete*)", "Bash(gh secret*)", "Bash(curl * | sh*)",
];

// ---------- Hilfen ----------
async function existiert(p) { try { await access(p); return true; } catch { return false; } }
async function git(cwd, ...args) { return (await sh("git", args, { cwd, maxBuffer: 20 * 1024 * 1024 })).stdout.trim(); }
async function log(auftrag, art, text, ausschnitt) {
  await db.from("ws_live_log").insert({ auftrag_id: auftrag, art, text: kuerzen(ohneGeheimnisse(text), 500), ausschnitt: ausschnitt ? kuerzen(ohneGeheimnisse(ausschnitt), 2000) : null });
}
async function nachricht(auftrag, art, text) {
  await db.from("ws_nachrichten").insert({ auftrag_id: auftrag, von: null, art, text: kuerzen(ohneGeheimnisse(text), 8000) });
}
const sitzungenDatei = () => path.join(cfg.daten_ordner, "sitzungen.json");
async function sitzungen() { try { return JSON.parse(await readFile(sitzungenDatei(), "utf8")); } catch { return {}; } }
async function merkeSitzung(id, wert) { const s = await sitzungen(); s[id] = wert; await writeFile(sitzungenDatei(), JSON.stringify(s, null, 2)); }

function verbinde() {
  db = createClient(cfg.supabase_url, cfg.anon_key, {
    accessToken: async () => token,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------- Werkstatt-PC anmelden und lebendig halten ----------
async function pcAnmelden() {
  const datei = path.join(cfg.daten_ordner, "pc.json");
  try { pcId = JSON.parse(await readFile(datei, "utf8")).id; } catch { pcId = null; }
  if (pcId) {
    const { data } = await db.from("ws_werkstatt_pcs").update({ an: true, zuletzt: new Date().toISOString() }).eq("id", pcId).select().maybeSingle();
    if (data) return;
  }
  const { data, error } = await db.from("ws_werkstatt_pcs").insert({ benutzer_id: cfg.user_id, name: cfg.pc_name || os.hostname(), an: true, admin_pc: !!cfg.admin }).select().single();
  if (error) throw new Error("Werkstatt-PC konnte nicht angemeldet werden: " + error.message);
  pcId = data.id;
  await writeFile(datei, JSON.stringify({ id: pcId }));
}
async function lebenszeichen(an = true) {
  if (pcId) await db.from("ws_werkstatt_pcs").update({ an, zuletzt: new Date().toISOString() }).eq("id", pcId);
}

// ---------- Limits ----------
async function limitOk() {
  const [{ data: e }, { data: gesamt }] = await Promise.all([
    db.from("ws_einstellungen").select("*").maybeSingle(),
    db.rpc("ws_verbrauch_gesamt_monat"),
  ]);
  if (!e?.monatslimit_usd) return { ok: false, grund: "Kein Monatslimit festgelegt" };
  const anteil = (Number(gesamt || 0) / Number(e.monatslimit_usd)) * 100;
  if (e.stopp_am_limit && anteil >= 100) return { ok: false, grund: "Monatslimit erreicht" };
  return { ok: true, warnung: anteil >= e.warnung_prozent, anteil };
}

// ---------- Projekt-Repository und Arbeitsordner ----------
async function arbeitsordner(projekt, auftrag) {
  if (!projekt.repo) throw new Error(`Projekt „${projekt.name}“ hat noch kein GitHub-Repository hinterlegt.`);
  const basis = path.join(cfg.daten_ordner, "projekte", projekt.id);
  const repo = path.join(basis, "repo");
  await mkdir(basis, { recursive: true });
  if (!(await existiert(path.join(repo, ".git")))) {
    await sh("gh", ["repo", "clone", projekt.repo, repo], { maxBuffer: 50 * 1024 * 1024 });
  }
  await git(repo, "fetch", "origin", "main");
  const ordner = path.join(basis, `auftrag-${auftrag.id}`);
  const zweig = zweigName(auftrag.id, auftrag.titel);
  if (!(await existiert(ordner))) {
    try { await git(repo, "worktree", "add", "-b", zweig, ordner, "origin/main"); }
    catch { await git(repo, "worktree", "add", ordner, zweig); } // Zweig gibt es schon (Fortsetzung)
  }
  return { ordner, zweig };
}

// ---------- Erlaubnis-Anfragen ----------
function beschreibe(werkzeug, eingabe) {
  if (werkzeug === "Bash") return String(eingabe?.command || "");
  if (eingabe?.file_path) return String(eingabe.file_path);
  if (eingabe?.url) return String(eingabe.url);
  return JSON.stringify(eingabe || {}).slice(0, 300);
}
async function erlaubnis(auftrag, werkzeug, eingabe, signal) {
  const text = ohneGeheimnisse(beschreibe(werkzeug, eingabe));
  // Regeln „immer erlauben“ dieser Gruppe
  const { data: regeln } = await db.from("ws_erlaubnisse").select("werkzeug, eingabe, auftrag_id, ws_auftraege!inner(gruppe_id)")
    .eq("status", "immer").eq("ws_auftraege.gruppe_id", auftrag.gruppe_id);
  if ((regeln || []).some((r) => passtRegel(r, werkzeug, text))) return true;
  const { data: anf, error } = await db.from("ws_erlaubnisse").insert({ auftrag_id: auftrag.id, werkzeug, eingabe: kuerzen(text, 1000), grund: "Die Werkstatt braucht das für diesen Auftrag." }).select().single();
  if (error) return false;
  await log(auftrag.id, "erlaubnis", `Wartet auf deine Erlaubnis: ${werkzeug} ${kuerzen(text, 120)}`);
  melde("status", "Wartet auf Erlaubnis", auftrag.id);
  const bis = Date.now() + 30 * 60 * 1000;
  while (Date.now() < bis && !signal?.aborted && !stopp) {
    await new Promise((r) => setTimeout(r, 2000));
    const { data } = await db.from("ws_erlaubnisse").select("status").eq("id", anf.id).single();
    if (data && data.status !== "offen") return data.status !== "abgelehnt";
  }
  return false;
}

// ---------- Live-Log aus dem Verlauf ----------
async function verarbeiteNachricht(auftrag, m, ordner) {
  if (m.type !== "assistant") return;
  for (const b of m.message?.content || []) {
    if (b.type !== "tool_use") continue;
    const i = b.input || {};
    const datei = i.file_path ? path.relative(ordner, i.file_path) || i.file_path : "";
    if (b.name === "Read") await log(auftrag.id, "lesen", `Liest ${datei}`);
    else if (b.name === "Grep" || b.name === "Glob") await log(auftrag.id, "lesen", `Sucht ${i.pattern || ""}`);
    else if (b.name === "Edit") await log(auftrag.id, "aendern", `Ändert ${datei}`,
      [...String(i.old_string || "").split("\n").slice(0, 12).map((z) => "- " + z), ...String(i.new_string || "").split("\n").slice(0, 12).map((z) => "+ " + z)].join("\n"));
    else if (b.name === "Write") await log(auftrag.id, "neu", `Schreibt ${datei}`, String(i.content || "").split("\n").slice(0, 12).map((z) => "+ " + z).join("\n"));
    else if (b.name === "Bash") await log(auftrag.id, /test|build|check/.test(i.command || "") ? "test" : "info", `Führt aus: ${kuerzen(i.command, 200)}`);
    else await log(auftrag.id, "info", `Werkzeug: ${b.name}`);
  }
}

// ---------- Auftrag ausführen ----------
function auftragstext(auftrag, projekt, gruppe, feature, nachrichten, zweig, neuesProjekt) {
  const verlauf = nachrichten.map((n) => `${n.von ? "Gerhard/Team" : "Werkstatt"} (${n.art}): ${n.text}`).join("\n");
  return [
    `Du bist die Werkstatt der Codeschmiede für das Projekt „${projekt.name}“ (Repository ${projekt.repo}).`,
    `Auftrag #${auftrag.id} – Gruppe „${gruppe?.name || "?"}“${feature ? `, Feature „${feature.name}“ (${feature.id})` : ", ganze Gruppe"}. Art: ${auftrag.art}.`,
    auftrag.baustein ? `Gezeigter Baustein: ${JSON.stringify(auftrag.baustein)}` : "",
    `Verlauf:\n${verlauf}`,
    "",
    "Regeln:",
    "- Halte dich an AGENTS.md/CLAUDE.md dieses Repositorys und an Gerhards Regelwerk (Pflicht-Start, Risikostufen, Deutsch).",
    neuesProjekt ? "- Neues Projekt: Stelle zuerst deine Fragen zu Ziel, Zielgruppe, Technik und Rahmen, bevor du baust." : "",
    `- Du arbeitest im aktuellen Ordner auf dem Zweig ${zweig}. Niemals direkt auf main. Keine Personendaten Dritter, keine Geheimnisse in Dateien.`,
    "- Bei sichtbaren Neuerungen Handbuch/Doku mitziehen; jede Änderung in docs/CHANGELOG.md (neue Zeile oben).",
    "- Brauchst du eine Entscheidung von Gerhard: beende deine Antwort mit einer Zeile, die mit „RÜCKFRAGE:“ beginnt (mit Empfehlung).",
    `- Wenn fertig: Prüfungen ausführen, committen, \`git push -u origin ${zweig}\`, Pull Request mit \`gh pr create --base main --fill\` öffnen,`,
    "  dann als letzte Zeile genau: „ERGEBNIS-PR: #<Nummer> <Zweig>“ und davor eine kurze Liste, was du gemacht hast.",
  ].filter(Boolean).join("\n");
}

async function fuehreAus(auftrag, { fortsetzen = false } = {}) {
  const abort = new AbortController();
  laeuft = { id: auftrag.id, abort };
  melde("status", fortsetzen ? "Setzt Auftrag fort" : "Übernimmt Auftrag", auftrag.id);
  try {
    const { data: gruppe } = await db.from("ws_gruppen").select("*, ws_bereiche!inner(projekt_id)").eq("id", auftrag.gruppe_id).single();
    const { data: projekt } = await db.from("ws_projekte").select("*").eq("id", gruppe.ws_bereiche.projekt_id).single();
    const feature = auftrag.feature_id ? (await db.from("ws_features").select("*").eq("id", auftrag.feature_id).single()).data : null;
    const { data: nachrichten } = await db.from("ws_nachrichten").select("*").eq("auftrag_id", auftrag.id).order("id");
    const { data: pgr } = await db.from("ws_gruppen").select("id, ws_bereiche!inner(projekt_id)").eq("ws_bereiche.projekt_id", gruppe.ws_bereiche.projekt_id);
    const { count } = await db.from("ws_auftraege").select("id", { count: "exact", head: true })
      .in("gruppe_id", (pgr || []).map((x) => x.id)).in("stand", ["freigabe", "zusammen", "sicherheit", "wissen"]);
    const { ordner, zweig } = await arbeitsordner(projekt, auftrag);
    const merk = (await sitzungen())[auftrag.id] || {};
    const versuch = merk.versuch || 0;
    const modell = waehleModell({ ...auftrag, text: nachrichten.map((n) => n.text).join(" ") }, { versuch, gruppenName: gruppe.name });
    await db.from("ws_auftraege").update({ stand: "laeuft", werkstatt_pc: pcId, modell, zweig }).eq("id", auftrag.id);
    await log(auftrag.id, "info", `Werkstatt-PC ${cfg.pc_name || os.hostname()} arbeitet mit Modell ${modell} auf ${zweig}`);

    const prompt = fortsetzen
      ? `Antwort von Gerhard/Team auf deine Rückfrage:\n${nachrichten.filter((n) => n.von).slice(-1)[0]?.text || ""}\n\nArbeite weiter nach denselben Regeln.`
      : auftragstext(auftrag, projekt, gruppe, feature, nachrichten, zweig, (count || 0) === 0 && projekt.id !== "trainer-to-go");

    let ende = null; let kosten = 0; let ein = 0; let aus = 0; let sitzung = merk.sitzung;
    for await (const m of query({
      prompt,
      options: {
        cwd: ordner, model: modell, abortController: abort, resume: fortsetzen ? merk.sitzung : undefined,
        permissionMode: "default", allowedTools: ERLAUBT, disallowedTools: VERBOTEN, settingSources: ["project"],
        canUseTool: async (werkzeug, eingabe, { signal } = {}) =>
          (await erlaubnis(auftrag, werkzeug, eingabe, signal))
            ? { behavior: "allow", updatedInput: eingabe }
            : { behavior: "deny", message: "Von Gerhard nicht erlaubt (oder keine Antwort). Suche einen anderen Weg oder stelle eine RÜCKFRAGE." },
      },
    })) {
      if (m.type === "system" && m.session_id) sitzung = m.session_id;
      await verarbeiteNachricht(auftrag, m, ordner);
      if (m.type === "result") {
        ende = m; sitzung = m.session_id || sitzung;
        kosten = Number(m.total_cost_usd || 0); ein = m.usage?.input_tokens || 0; aus = m.usage?.output_tokens || 0;
      }
    }
    await merkeSitzung(auftrag.id, { sitzung, versuch });
    await db.from("ws_verbrauch").insert({ auftrag_id: auftrag.id, projekt_id: projekt.id, modell, kosten_usd: kosten, tokens_ein: ein, tokens_aus: aus, werkstatt_pc: pcId });

    if (!ende || ende.subtype !== "success") throw new Error(ende?.subtype ? `Lauf beendet: ${ende.subtype}` : "Lauf ohne Ergebnis beendet");
    const r = werteAus(ende.result);
    if (r.art === "frage") {
      await nachricht(auftrag.id, "frage", r.text);
      await db.from("ws_auftraege").update({ stand: "frage" }).eq("id", auftrag.id);
      melde("status", "Rückfrage gestellt", auftrag.id);
    } else if (r.art === "pr") {
      await nachricht(auftrag.id, "ergebnis", r.text || "Fertig zur Freigabe.");
      await db.from("ws_auftraege").update({ stand: "freigabe", pr_nummer: r.nummer, zweig: r.zweig }).eq("id", auftrag.id);
      melde("status", `Fertig zur Freigabe: PR #${r.nummer}`, auftrag.id);
    } else {
      await nachricht(auftrag.id, "frage", `${r.text}\n\n(Es gibt noch keinen Pull Request. Soll ich weitermachen oder etwas ändern?)`);
      await db.from("ws_auftraege").update({ stand: "frage" }).eq("id", auftrag.id);
    }
  } catch (e) {
    const text = ohneGeheimnisse(e?.message || String(e));
    melde("fehler", text, auftrag.id);
    try {
      const s = await sitzungen(); const v = (s[auftrag.id]?.versuch || 0) + 1; await merkeSitzung(auftrag.id, { ...(s[auftrag.id] || {}), versuch: v });
      await log(auftrag.id, "fehler", `Fehler: ${text}`);
      await nachricht(auftrag.id, "frage", `Ich bin auf ein Problem gestoßen: ${text}\nSoll ich es noch einmal versuchen (mit stärkerem Modell) oder den Auftrag anpassen?`);
      await db.from("ws_auftraege").update({ stand: "frage" }).eq("id", auftrag.id);
    } catch { /* Datenbank nicht erreichbar – nächster Durchlauf versucht es wieder */ }
  } finally {
    laeuft = null;
  }
}

// ---------- Schleife ----------
async function naechsterAuftrag() {
  if (laeuft || stopp) return;
  // 1. Fortsetzen: eigene Rückfragen, auf die geantwortet wurde
  const { data: fragen } = await db.from("ws_auftraege").select("*").eq("werkstatt_pc", pcId).eq("stand", "frage").order("id");
  for (const a of fragen || []) {
    const { data: n } = await db.from("ws_nachrichten").select("von, art, id").eq("auftrag_id", a.id).order("id", { ascending: false }).limit(1);
    if (n?.[0]?.von) {
      const lim = await limitOk(); if (!lim.ok) { melde("status", lim.grund); return; }
      return fuehreAus(a, { fortsetzen: true });
    }
  }
  // 2. Neue Aufträge (nur Gruppen ohne laufenden Auftrag, nur mit Werkstatt-Recht)
  const { data: offen } = await db.from("ws_auftraege").select("*").eq("stand", "wartet").order("id").limit(20);
  if (!offen?.length) return;
  const lim = await limitOk(); if (!lim.ok) { melde("status", lim.grund); return; }
  for (const a of offen) {
    const { count } = await db.from("ws_auftraege").select("id", { count: "exact", head: true }).eq("gruppe_id", a.gruppe_id).in("stand", ["laeuft", "frage"]);
    if (count) continue;
    const { data: darf } = await db.rpc("ws_ist_werkstatt_fuer", { p_gruppe: a.gruppe_id });
    if (!darf) continue;
    const { data: geholt } = await db.from("ws_auftraege").update({ stand: "laeuft", werkstatt_pc: pcId }).eq("id", a.id).eq("stand", "wartet").select().maybeSingle();
    if (geholt) return fuehreAus(geholt);
  }
}

async function start() {
  await mkdir(cfg.daten_ordner, { recursive: true });
  verbinde();
  await pcAnmelden();
  melde("status", "Werkstatt bereit");
  setInterval(() => lebenszeichen(true).catch(() => {}), 60 * 1000);
  const schleife = async () => {
    try { await naechsterAuftrag(); } catch (e) { melde("fehler", ohneGeheimnisse(e?.message || String(e))); }
    if (!stopp) setTimeout(schleife, 5000);
  };
  schleife();
}

async function beenden() {
  stopp = true;
  laeuft?.abort.abort();
  try { await lebenszeichen(false); } catch { /* egal */ }
  melde("status", "Werkstatt aus");
  setTimeout(() => process.exit(0), 300);
}

// ---------- Steuerung über stdin ----------
const rl = createInterface({ input: process.stdin });
rl.on("line", async (zeile) => {
  let m; try { m = JSON.parse(zeile); } catch { return; }
  if (!cfg) {
    if (!process.env.ANTHROPIC_API_KEY) { melde("fehler", "Kein API-Schlüssel – bitte im Programm hinterlegen."); process.exit(2); }
    cfg = m; token = m.access_token;
    start().catch((e) => { melde("fehler", ohneGeheimnisse(e?.message || String(e))); process.exit(1); });
  } else if (m.token) token = m.token;
  else if (m.stop) beenden();
});
rl.on("close", () => beenden());
process.on("SIGTERM", beenden);
