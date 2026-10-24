// Code ansehen und von Hand ändern (Entwurf „Code-Editor“ 1.0, freigegeben von Gerhard 2026-10-24 14:57, Datenbank 0031).
// Ansehen: nur lesen aus dem Abgleich-Klon (git ls-tree / cat-file) – es wird kein Projekt-Code ausgeführt.
// Geheime Dateien werden nie ausgeliefert; Dateien mit erkannten Geheimnissen nur maskiert und nur zum Ansehen.
// Ändern: Hand-Änderung als Auftrag – Dateien in den Auftrags-Zweig schreiben, Commit, Push, Pull Request (keine Hooks).
import { lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { heikleDatei, ohneGeheimnisse } from "./geheim.mjs";

export const MAX_DATEI = 512 * 1024;
export const MAX_BAUM = 20000;
const SHA = /^[0-9a-f]{40}$/;
export const zweigOk = (z) => /^[A-Za-z0-9._/-]{1,100}$/.test(z || "") && !/\.\./.test(z) && !/^[/.-]/.test(z);
// Wie public.ws_code_pfad_ok (Datenbank 0032): keine „.“/„..“-Abschnitte, kein / am Anfang/Ende, kein //, kein Doppelpunkt
export const pfadOk = (p) => typeof p === "string" && p.length >= 1 && p.length <= 400 && !/(^|\/)\.\.?(\/|$)/.test(p) && !p.startsWith("/")
  && !p.endsWith("/") && !p.includes("//") && !/[\x00-\x1f\\:]/.test(p) && !/(^|\/)\.git(\/|$)/.test(p) && !/^-/.test(p) && !/[ .](\/|$)/.test(p) && !/[*?"<>|]/.test(p)
  && !/(^|\/)(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.[^/]*)?(\/|$)/i.test(p);
// Wie public.ws_code_geheim (Datenbank 0032)
export const geheimPfad = (p) => heikleDatei(p) || /(^|\/)\.env|\.(pem|key|p12|pfx|jks|keystore)$|(^|\/)credentials|(^|\/)id_(rsa|ed25519|ecdsa)|(^|\/)\.dev\.vars$|(^|\/)\.npmrc$|(^|\/)\.netrc$|(^|\/)serviceaccount[^/]*\.json$|(^|\/)secrets?\.[^/]*$/i.test(p);

/** Stand eines Zweigs im Klon (nach Abruf). git(dir, ...args) gibt stdout (getrimmt) zurück. */
export async function zweigStand(git, repo, zweig) {
  if (!zweigOk(zweig)) throw new Error("Ungültiger Zweig");
  const sha = await git(repo, "rev-parse", "--verify", "--quiet", `refs/heads/${zweig}^{commit}`).catch(() => "");
  if (!SHA.test(sha)) throw new Error(`Zweig „${zweig}“ gibt es nicht`);
  return sha;
}

/** Dateibaum eines Stands: [{ p: Pfad, g: Größe, s: Blob-Sha, x?: 1 = gesperrt }] */
export async function codeBaum(git, repo, sha) {
  if (!SHA.test(sha)) throw new Error("Ungültiger Stand");
  const roh = await git(repo, "ls-tree", "-r", "-l", "--full-tree", "-z", sha);
  const baum = [];
  for (const z of roh.split("\0")) {
    if (!z) continue;
    const tab = z.indexOf("\t"); if (tab < 0) continue;
    const [modus, typ, blob, groesse] = z.slice(0, tab).trim().split(/\s+/);
    const p = z.slice(tab + 1);
    if (typ !== "blob" || modus === "120000" || !pfadOk(p)) continue;   // keine Verknüpfungen, keine Untermodule
    baum.push(geheimPfad(p) ? { p, g: Number(groesse) || 0, s: blob, x: 1 } : { p, g: Number(groesse) || 0, s: blob });
    if (baum.length >= MAX_BAUM) break;
  }
  return baum;
}

const istBinaer = (buf) => buf.includes(0) || !(() => { try { new TextDecoder("utf-8", { fatal: true }).decode(buf); return true; } catch { return false; } })();

/** Eine Datei: { inhalt, blob_sha, nur_lesen, hinweis } – nie geheime Dateien, nie über 512 KB, nie Binärdateien. */
export async function codeDatei(git, gitRoh, repo, sha, pfad) {
  if (!SHA.test(sha)) throw new Error("Ungültiger Stand");
  if (!pfadOk(pfad)) throw new Error("Ungültiger Pfad");
  if (geheimPfad(pfad)) return { inhalt: null, blob_sha: null, nur_lesen: true, hinweis: "Geheime Datei – wird nicht angezeigt" };
  // Genau ein Eintrag mit genau diesem Pfad (Prüfung H1: „.“ oder „ordner/“ listet sonst den Ordner-Inhalt)
  const eintraege = (await git(repo, "--literal-pathspecs", "ls-tree", "-l", "--full-tree", "-z", sha, "--", pfad)).split("\0").filter(Boolean);
  const treffer = eintraege.filter((z) => z.slice(z.indexOf("\t") + 1) === pfad);
  if (eintraege.length !== 1 || treffer.length !== 1) throw new Error("Datei nicht gefunden");
  const [modus, typ, blob, groesse] = treffer[0].split("\t")[0].trim().split(/\s+/);
  if (typ !== "blob" || !SHA.test(blob || "")) throw new Error("Datei nicht gefunden");
  if (geheimPfad(treffer[0].slice(treffer[0].indexOf("\t") + 1))) return { inhalt: null, blob_sha: null, nur_lesen: true, hinweis: "Geheime Datei – wird nicht angezeigt" };
  if (modus === "120000") return { inhalt: null, blob_sha: blob, nur_lesen: true, hinweis: "Verknüpfung – wird nicht angezeigt" };
  if (Number(groesse) > MAX_DATEI) return { inhalt: null, blob_sha: blob, nur_lesen: true, hinweis: `Zu groß (${Math.round(Number(groesse) / 1024)} KB) – nur bis 512 KB` };
  const buf = await gitRoh(repo, "cat-file", "blob", blob);
  if (istBinaer(buf)) return { inhalt: null, blob_sha: blob, nur_lesen: true, hinweis: "Binärdatei (z. B. Bild) – nicht im Editor" };
  const text = buf.toString("utf8");
  const maskiert = ohneGeheimnisse(text);
  if (maskiert !== text) return { inhalt: maskiert, blob_sha: blob, nur_lesen: true, hinweis: "Enthält vermutlich Geheimnisse – nur maskiert und nur zum Ansehen" };
  return { inhalt: text, blob_sha: blob, nur_lesen: false, hinweis: null };
}

/**
 * Hand-Änderung in den Auftrags-Ordner schreiben. Prüft vorher je Datei, ob sich main seit dem Öffnen geändert hat
 * (basis_blob ≠ aktueller Blob) – dann wird nichts geschrieben. Gibt { ok, konflikte, dateien } zurück.
 */
export async function handSchreiben(git, ordner, basisRef, aenderungen) {
  const wurzel = await realpath(ordner);
  const konflikte = [];
  for (const a of aenderungen) {
    if (!pfadOk(a.pfad) || geheimPfad(a.pfad)) throw new Error(`Ungültiger Pfad: ${a.pfad}`);
    if (typeof a.inhalt !== "string" || Buffer.byteLength(a.inhalt) > MAX_DATEI) throw new Error(`Inhalt ungültig: ${a.pfad}`);
    if (ohneGeheimnisse(a.inhalt) !== a.inhalt) throw new Error(`In ${a.pfad} steht vermutlich ein Geheimnis (Schlüssel, Passwort, Token) – nicht übernommen. Geheimnisse gehören in die Umgebungsvariablen.`);
    const jetzt = await git(ordner, "rev-parse", "--verify", "--quiet", `${basisRef}:./${a.pfad}`).catch(() => "");
    if ((a.basis_blob || "") !== (SHA.test(jetzt) ? jetzt : "")) konflikte.push(a.pfad);
  }
  if (konflikte.length) return { ok: false, konflikte, dateien: [] };
  const dateien = [];
  for (const a of aenderungen) {
    const ziel = path.join(wurzel, ...a.pfad.split("/"));
    if (!ziel.startsWith(wurzel + path.sep)) throw new Error(`Pfad außerhalb des Projekts: ${a.pfad}`);
    // Kein Teil des Wegs darf eine Verknüpfung sein (sonst schriebe man außerhalb)
    let teil = wurzel;
    for (const s of a.pfad.split("/").slice(0, -1)) {
      teil = path.join(teil, s);
      try { const st = await lstat(teil); if (st.isSymbolicLink() || !st.isDirectory()) throw new Error(`Ungültiger Ordner im Pfad: ${a.pfad}`); }
      catch (e) { if (e?.code === "ENOENT") { await mkdir(teil); } else throw e; }
    }
    try { const st = await lstat(ziel); if (st.isSymbolicLink() || !st.isFile()) throw new Error(`Ziel ist keine normale Datei: ${a.pfad}`); }
    catch (e) { if (e?.code !== "ENOENT") throw e; }
    await writeFile(ziel, a.inhalt, { encoding: "utf8" });
    dateien.push(a.pfad);
  }
  return { ok: true, konflikte: [], dateien };
}
