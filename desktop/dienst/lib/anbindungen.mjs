// Anbindungen je Projekt (Entwurf 1.0 „Neues Projekt“, freigegeben von Gerhard 2026-10-24 14:43): Ampel, Programm in der
// Windows-Sandbox starten, Testlauf eines Werkzeugs. Nur die Werkstatt des Admins. Es wird kein Projekt-Code auf diesem PC
// ausgeführt: gelesen wird über GitHub (gh), ein Programm startet ausschließlich IN der Windows-Sandbox (Wegwerf-Umgebung).
// Keine Zugangsdaten: gh nutzt die eigene Anmeldung, Geheimnisse werden nur dem Namen nach geprüft (nie der Inhalt).
import { existsSync } from "node:fs";
import { lstat, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ohneGeheimnisse } from "./geheim.mjs";

const REPO = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
const ZWEIG = /^[A-Za-z0-9._/-]{1,100}$/;
export const repoGut = (r) => REPO.test(r || "") && !/\/\.\.?$/.test(r);
export const zweigGut = (z) => ZWEIG.test(z || "") && !/\.\./.test(z) && !/^[/.-]/.test(z);
const kurz = (t, n = 200) => String(t || "").replace(/\s+/g, " ").trim().slice(0, n);
const lampe = (stand, text) => ({ stand, text: kurz(text) });

/** Pfad der Windows-Sandbox (null, wenn nicht eingeschaltet oder nicht Windows). */
export function sandboxPfad(plattform = process.platform, env = process.env, gibt = existsSync) {
  if (plattform !== "win32") return null;
  const p = path.win32.join(env.SystemRoot || env.windir || "C:\\Windows", "System32", "WindowsSandbox.exe");
  return gibt(p) ? p : null;
}

async function letzterLauf(sh, repo, { workflow = null, zweig = "main" } = {}) {
  const args = ["run", "list", "--repo", repo, "--branch", zweig, "--limit", "10", "--json", "status,conclusion,workflowName,url,databaseId,createdAt"];
  if (workflow) args.push("--workflow", workflow);
  const { stdout } = await sh("gh", args);
  const laeufe = JSON.parse(stdout || "[]");
  return laeufe.find((l) => l.status === "completed") || laeufe[0] || null;
}
const laufLampe = (l, name, zweig = "main") => !l ? lampe("grau", `${name}: noch nicht gelaufen`)
  : l.status !== "completed" ? lampe("gelb", `${name}: läuft gerade`)
  : l.conclusion === "success" ? lampe("gruen", `${name} auf ${zweig}: grün`)
  : lampe("rot", `${name} auf ${zweig}: ${l.conclusion === "failure" ? "rot" : l.conclusion || "unklar"} – im Prüfstand bzw. bei GitHub ansehen`);

/**
 * Ampel eines Projekts. projekt: { repo, repo_stand, technik_art, datenbank, vorschau_domain, test_url, live_url }.
 * Fehler einzelner Prüfungen machen nur die jeweilige Lampe grau – die Ampel kommt immer zurück.
 */
export async function ampelPruefen({ sh, projekt, plattform = process.platform, holen = fetch, sandbox = sandboxPfad }) {
  const a = {}; const art = projekt.technik_art || "web"; const repo = projekt.repo;
  const versuch = async (schluessel, f) => { try { a[schluessel] = await f(); } catch (e) { a[schluessel] = lampe("grau", `Nicht prüfbar: ${kurz(ohneGeheimnisse(String(e?.stderr || e?.message || "")), 120)}`); } };
  if (!repo) a.github = lampe(projekt.repo_stand === "angefragt" || projekt.repo_stand === "laeuft" ? "gelb" : "rot",
    projekt.repo_stand === "fehler" ? "Repository anlegen hat nicht geklappt – unter „Projekte verwalten“ nochmal" : projekt.repo_stand ? "Repository wird angelegt" : "Noch kein Repository – unter „Projekte verwalten“ anlegen");
  else if (!repoGut(repo)) a.github = lampe("rot", "Ungültige Repository-Angabe");
  else {
    await versuch("github", async () => {
      const { stdout } = await sh("gh", ["repo", "view", repo, "--json", "visibility", "--jq", ".visibility"]);
      return lampe("gruen", `Repository da (${/PRIVATE|INTERNAL/i.test(stdout) ? "privat" : "öffentlich"})`);
    });
    await versuch("pruefung", async () => laufLampe(await letzterLauf(sh, repo, { workflow: "pruefung.yml" }), "Letzte Prüfung"));
    if (art === "programm") {
      await versuch("build", async () => laufLampe(await letzterLauf(sh, repo, { workflow: "programm.yml" }), "Build Windows/Mac"));
      await versuch("signatur", async () => {
        const { stdout } = await sh("gh", ["secret", "list", "--repo", repo, "--json", "name", "--jq", ".[].name"]);
        return stdout.split(/\s+/).includes("TAURI_SIGNING_PRIVATE_KEY") ? lampe("gruen", "Automatische Updates: Signatur-Schlüssel hinterlegt")
          : lampe("grau", "Automatische Updates noch nicht eingerichtet (optional, eigener Schritt)");
      });
    }
    if (art === "werkzeug") await versuch("testlauf", async () => laufLampe(await letzterLauf(sh, repo, { workflow: "lauf.yml" }), "Letzter Lauf"));
  }
  if (art === "programm") {
    a.sandbox = plattform !== "win32" ? lampe("grau", "Windows-Sandbox gibt es nur unter Windows")
      : sandbox(plattform) ? lampe("gruen", "Windows-Sandbox auf diesem PC bereit")
      : lampe("gelb", "Windows-Sandbox einschalten: Windows-Features › „Windows-Sandbox“ (nur Windows Pro/Enterprise), danach neu starten");
  }
  if (art === "web" || art === "handy") {
    const ziel = projekt.test_url || (projekt.vorschau_domain ? `https://${projekt.vorschau_domain}` : null) || projekt.live_url;
    if (!ziel) a.testseite = lampe("gelb", "Testseite fehlt: Cloudflare Pages mit dem Repository verbinden und die Adresse unter „Projekte verwalten“ eintragen");
    else await versuch("testseite", async () => {
      if (!/^https:\/\/[A-Za-z0-9.-]+(\/.*)?$/.test(ziel)) return lampe("rot", "Ungültige Adresse");
      const r = await holen(ziel, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(8000) });
      if (r.status >= 300 && r.status < 400 || r.type === "opaqueredirect") return lampe("gelb", "Testseite leitet weiter – bitte die Zieladresse direkt eintragen");
      return r.ok ? lampe("gruen", `Testseite erreichbar (${new URL(ziel).host})`) : lampe("gelb", `Testseite antwortet mit ${r.status}`);
    });
  }
  a.datenbank = projekt.datenbank === "spielwiese" ? lampe("gelb", "Spielwiese noch nicht eingerichtet – braucht Supabase Pro; wird erst nach deiner Bestätigung angelegt")
    : projekt.datenbank === "eigen" ? lampe("grau", "Eigenes Supabase-Projekt – geprüft wird mit der Datenbank-Station (nächster Schritt)")
    : lampe("grau", "Keine Datenbank – jederzeit nachrüstbar");
  a.fehler = lampe("grau", "Fehler-Meldungen aus der App kommen mit einem späteren Schritt");
  return a;
}

const xml = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
/** Konfiguration der Windows-Sandbox: Ordner nur lesbar eingebunden, Installation startet in der Sandbox. */
export function sandboxKonfig(ordner, datei, { netz = false } = {}) {
  if (!/^[\p{L}\p{N} ._()+-]{1,120}\.exe$/iu.test(datei)) throw new Error("Unerwarteter Dateiname der Installation");
  const drinnen = "C:\\Users\\WDAGUtilityAccount\\Desktop\\Test";
  return `<Configuration>
  <VGpu>Disable</VGpu>
  <Networking>${netz ? "Default" : "Disable"}</Networking>
  <ProtectedClient>Enable</ProtectedClient>
  <ClipboardRedirection>Disable</ClipboardRedirection>
  <PrinterRedirection>Disable</PrinterRedirection>
  <AudioInput>Disable</AudioInput>
  <VideoInput>Disable</VideoInput>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>${xml(ordner)}</HostFolder>
      <SandboxFolder>${xml(drinnen)}</SandboxFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>"${xml(`${drinnen}\\${datei}`)}"</Command>
  </LogonCommand>
</Configuration>
`;
}

/**
 * Letzte erfolgreiche Windows-Installation eines Zweigs herunterladen und in der Windows-Sandbox starten.
 * starten(pfadSandboxExe, [wsbDatei]) startet nur WindowsSandbox.exe – die Installation selbst läuft ausschließlich darin.
 */
export async function sandboxStarten({ sh, repo, zweig = "main", basis, projektId, starten, netz = false, plattform = process.platform, sandbox = sandboxPfad }) {
  if (!repoGut(repo)) throw new Error("Ungültiges Repository");
  const pid = String(projektId || "").replace(/[^a-z0-9-]/gi, "");
  if (!pid) throw new Error("Ungültige Projekt-Kennung");
  if (!zweigGut(zweig)) throw new Error("Ungültiger Zweig");
  const exe = sandbox(plattform);
  if (!exe) throw new Error(plattform === "win32" ? "Windows-Sandbox ist nicht eingeschaltet (Windows-Features › „Windows-Sandbox“, nur Pro/Enterprise)" : "Die Windows-Sandbox gibt es nur unter Windows");
  const lauf = (await (async () => {
    const { stdout } = await sh("gh", ["run", "list", "--repo", repo, "--workflow", "programm.yml", "--branch", zweig, "--status", "success", "--limit", "1", "--json", "databaseId,url"]);
    return JSON.parse(stdout || "[]")[0];
  })());
  if (!lauf?.databaseId) throw new Error(`Für „${zweig}“ gibt es noch keinen erfolgreichen Build – erst wenn „Programm bauen“ grün ist`);
  const id = String(lauf.databaseId).replace(/\D/g, "");
  // Größe vor dem Herunterladen prüfen (höchstens 400 MB)
  const { stdout: art } = await sh("gh", ["api", `repos/${repo}/actions/runs/${id}/artifacts`, "--jq", '.artifacts[] | select(.name == "installation-windows") | .size_in_bytes']);
  const groesse = Number(String(art).trim().split(/\s+/)[0]);
  if (!Number.isFinite(groesse) || groesse <= 0) throw new Error("Im Build fehlt die Windows-Installation");
  if (groesse > 400 * 1024 * 1024) throw new Error("Windows-Installation ist größer als 400 MB");
  const ordner = path.join(basis, pid, id);
  await rm(path.dirname(ordner), { recursive: true, force: true }).catch(() => {});   // ältere Downloads dieses Projekts weg
  await mkdir(ordner, { recursive: true });
  await sh("gh", ["run", "download", id, "--repo", repo, "--name", "installation-windows", "--dir", ordner], { maxBuffer: 20 * 1024 * 1024, timeout: 300000 });
  // Genau eine echte .exe, keine Verknüpfung, höchstens 400 MB
  const dateien = (await readdir(ordner)).filter((f) => !f.endsWith(".wsb"));
  const exes = dateien.filter((f) => /\.exe$/i.test(f));
  if (exes.length !== 1 || dateien.length !== 1) throw new Error("Im Build steckt nicht genau eine Installationsdatei");
  const st = await lstat(path.join(ordner, exes[0]));
  if (!st.isFile() || st.isSymbolicLink() || st.size > 400 * 1024 * 1024) throw new Error("Installationsdatei ungültig oder zu groß");
  const wsb = path.join(path.dirname(ordner), `${id}.wsb`);
  await writeFile(wsb, sandboxKonfig(ordner, exes[0], { netz }));
  await starten(exe, [wsb]);
  return { datei: exes[0], link: lauf.url };
}

/** Testlauf eines Werkzeugs anstoßen (Ablauf „Lauf“ in GitHub). */
export async function testlaufStarten({ sh, repo, zweig = "main" }) {
  if (!repoGut(repo)) throw new Error("Ungültiges Repository");
  if (!zweigGut(zweig)) throw new Error("Ungültiger Zweig");
  await sh("gh", ["workflow", "run", "lauf.yml", "--repo", repo, "--ref", zweig]);
  return { link: `https://github.com/${repo}/actions/workflows/lauf.yml` };
}
