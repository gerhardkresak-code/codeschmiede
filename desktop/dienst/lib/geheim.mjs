// Entfernt Geheimnisse aus Texten, bevor sie ins Live-Log oder in Erlaubnis-Anfragen gehen (AGENTS.md: keine Geheimnisse in Logs).
const MUSTER = [
  /sk-ant-[A-Za-z0-9_-]{10,}/g,                       // Anthropic-Schlüssel
  /gh[pousr]_[A-Za-z0-9]{20,}/g,                      // GitHub-Token
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /sbp_[A-Za-z0-9]{20,}/g,                            // Supabase-Zugangstoken
  /sb_secret_[A-Za-z0-9_-]{10,}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
  /AKIA[0-9A-Z]{16}/g,                                // AWS
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{10,}/g,   // Stripe
  /(?<![A-Za-z0-9])sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,                  // OpenAI u. Ä.
  /Bearer\s+[A-Za-z0-9._~+\/-]{16,}=*/g,
];
// Zugangsdaten in Adressen (postgres://name:passwort@…) – Name bleibt, Passwort fällt weg
const URL_PASSWORT = /\b([a-z][a-z0-9+.-]*:\/\/[^\s:@\/]+:)[^\s@\/]+@/gi;
// Schalter wie persist-credentials: false sind keine Geheimnisse (Datenbank-Station 2026-10-24).
// NAME = wert, auch mit Unterstrich davor/danach (GITHUB_TOKEN=…, SUPABASE_SERVICE_ROLE_KEY: "…", password = "a b c")
const ZUWEISUNG = /([A-Za-z0-9_]*(?:pass(?:wort|word)?|pwd|secret|token|api[_-]?key|apikey|private[_-]?key|service[_-]?role[_-]?key|credential)[A-Za-z0-9_]*)(\s*[:=]\s*)(?!["']?(?:true|false|null|none|omit|include|same-origin)["']?(?=[\s,;})\]]|$))(?:"[^"\n]{4,}"|'[^'\n]{4,}'|[^\s"'&]{4,})/gi;

export function ohneGeheimnisse(text) {
  if (text == null) return text;
  let s = String(text);
  for (const m of MUSTER) s = s.replace(m, "[entfernt]");
  s = s.replace(URL_PASSWORT, "$1[entfernt]@");
  s = s.replace(ZUWEISUNG, (_a, k, z) => `${k}${z}[entfernt]`);
  return s;
}

export function kuerzen(text, max = 1500) {
  const s = String(text ?? "");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// Dateien, von denen nie ein Ausschnitt ins Live-Log geht
export function heikleDatei(name) {
  const b = String(name || "").split(/[\\/]/).pop().toLowerCase();
  return /^\.env/.test(b) || /\.(pem|key|p12|pfx)$/.test(b) || /^credentials/.test(b) || b === "zugriff.token" || /^id_(rsa|ed25519|ecdsa)/.test(b);
}
