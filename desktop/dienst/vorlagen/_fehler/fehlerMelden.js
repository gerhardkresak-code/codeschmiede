// Fehler-Meldungen an die Codeschmiede (Entwurf 1.0 vom 2026-10-24). Meldet Abstürze aus der Live- und Testfassung –
// NUR Technik: Fehlertext, Code-Stelle, Seite ohne Kennungen, Version, Gerät. Keine Namen, E-Mails, Eingaben oder Kennungen.
// Alles wird hier vor dem Senden bereinigt und in der Codeschmiede noch einmal. Ohne Einstellungen (Umgebungsvariablen) ist der Melder aus.
//   VITE_CS_FEHLER_URL        Adresse der Codeschmiede-Datenbank (https://….supabase.co)
//   VITE_CS_FEHLER_ANON       öffentlicher Schlüssel der Codeschmiede-Datenbank (darf nur die Melde-Funktion aufrufen)
//   VITE_CS_FEHLER_SCHLUESSEL Melde-Schlüssel dieser App (csf_…), erzeugt in der Codeschmiede unter „Anbindungen“
const URL_ = import.meta.env.VITE_CS_FEHLER_URL;
const ANON = import.meta.env.VITE_CS_FEHLER_ANON;
const A = ANON; // kurzer Name: der Kopf „apikey“ trägt nur den öffentlichen Schlüssel
const SCHLUESSEL = import.meta.env.VITE_CS_FEHLER_SCHLUESSEL;
const VERSION = import.meta.env.VITE_APP_VERSION || "";
const MAX_JE_SEITE = 20;

export function bereinigen(t, n) {
  return String(t ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    // Inhalte in Anführungszeichen (Werte, Namen) – kurze technische Bezeichner wie 'map' bleiben
    .replace(/(["“„«`])[^"“”„«»`\n]{0,250}(["”“»`])/g, '"…"')
    .replace(/'(?![a-z_$][A-Za-z0-9_$.]{0,40}')[^'\n]{0,250}'/g, "'…'")
    .replace(/(Failing row contains|DETAIL:|Key \([^)]*\)=)[^\n]*/g, "$1 …")
    .replace(/\b[A-ZÄÖÜ][a-zäöüß]+[ -][A-ZÄÖÜ][a-zäöüß]+\b/g, "[name]")
    .replace(/(für|bei|von) [A-ZÄÖÜ][^\s:,.]{1,40}/g, "$1 [name]")
    .replace(/-----BEGIN[^-]*-----[\s\S]*?-----END[^-]*-----/g, "[schlüssel]")
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[token]")
    .replace(/(sk-ant-|sk-|gh[pousr]_|github_pat_|sbp_|sb_secret_|xox[bpas]-|AIza|AKIA)[A-Za-z0-9_-]{6,}/g, "[schlüssel]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[e-mail]")
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, "[id]")
    .replace(/\?[^\s"'<>)]*/g, "?…")
    .replace(/\+?[0-9][0-9 /().-]{6,}[0-9]/g, "[zahl]")
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, "[id]")
    .slice(0, n);
}
export function seiteOhneKennungen(pfad) {
  return String(pfad || "").split("?")[0].split("#")[0].replace(/\/[^/]*[0-9][^/]*/g, "/:id").replace(/[^A-Za-z0-9/_:.-]/g, "").slice(0, 200);
}
function geraet() {
  const b = typeof window !== "undefined" ? window.innerWidth : 1200;
  return b < 640 ? "handy" : b < 1024 ? "tablet" : "pc";
}
function browser() {
  const u = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const m = /(Edg|Chrome|Firefox|Safari)\/(\d+)/.exec(u);
  return m ? `${m[1] === "Edg" ? "Edge" : m[1]} ${m[2]}` : "";
}
function stelleAus(stack) {
  const z = String(stack || "").split("\n").find((l) => /:\d+:\d+/.test(l)) || "";
  const m = /([^/\s(]+\.[a-z]+):(\d+):(\d+)/.exec(z);
  return m ? `${m[1]}:${m[2]}:${m[3]}` : "";
}

let gesendet = 0; const schon = new Set();
export function fehlerMelden(fehler, extra = {}) {
  try {
    if (!URL_ || !ANON || !/^csf_[0-9a-f]{32}$/.test(SCHLUESSEL || "") || !import.meta.env.PROD) return;
    if (gesendet >= MAX_JE_SEITE) return;
    const nachricht = bereinigen(fehler?.message ? `${fehler.name || "Error"}: ${fehler.message}` : String(fehler), 500);
    if (!nachricht || schon.has(nachricht)) return;
    schon.add(nachricht); gesendet += 1;
    const stack = String(fehler?.stack || extra.ablauf || "");
    const host = window.location.hostname;
    const daten = {
      nachricht, stelle: bereinigen(extra.stelle || stelleAus(stack), 300), seite: seiteOhneKennungen(window.location.pathname),
      ablauf: bereinigen(stack.split("\n").slice(0, 15).join("\n"), 2000), version: String(VERSION).slice(0, 40),
      umgebung: /\.pages\.dev$|^main\.|^test\.|^staging\.|^localhost$/.test(host) ? "test" : "live", geraet: geraet(), browser: browser(),
    };
    fetch(`${URL_.replace(/\/$/, "")}/rest/v1/rpc/ws_fehler_melden`, {
      method: "POST", keepalive: true, credentials: "omit",
      headers: { "Content-Type": "application/json", apikey: A, Authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ p_schluessel: SCHLUESSEL, p_daten: daten }),
    }).catch(() => {});
  } catch { /* der Melder darf die App nie stören */ }
}

/** Einmal beim Start aufrufen: fängt ungefangene Fehler und abgelehnte Promises. */
export function fehlerMelderStarten() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => fehlerMelden(e.error || e.message, { stelle: e.filename ? `${String(e.filename).split("/").pop()}:${e.lineno}:${e.colno}` : "" }));
  window.addEventListener("unhandledrejection", (e) => fehlerMelden(e.reason || "Unbehandelte Ablehnung"));
}
