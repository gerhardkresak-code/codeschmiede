// Erlaubnis-Brücke für Claude Code (MCP-Server über stdin/stdout).
// Claude Code fragt hier, wenn ein Werkzeug nicht ohnehin erlaubt ist (--permission-prompt-tool mcp__werkstatt__erlaubnis).
// Die Anfrage landet in der Codeschmiede (ws_erlaubnisse); Gerhard oder wer das Recht hat, entscheidet im Programm.
// Umgebung: CS_SUPABASE_URL, CS_ANON_KEY, CS_TOKEN_DATEI (aktuelles Zugriffstoken), CS_AUFTRAG, CS_GRUPPE
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { ohneGeheimnisse, kuerzen } from "./lib/geheim.mjs";
import { passtRegel, fuehrtCodeAus, dauerErlaubbar } from "./lib/ergebnis.mjs";

const AUFTRAG = Number(process.env.CS_AUFTRAG);
const GRUPPE = process.env.CS_GRUPPE;
const db = createClient(process.env.CS_SUPABASE_URL, process.env.CS_ANON_KEY, {
  accessToken: async () => (await readFile(process.env.CS_TOKEN_DATEI, "utf8")).trim(),
  auth: { persistSession: false, autoRefreshToken: false },
});

function beschreibe(werkzeug, eingabe) {
  if (werkzeug === "Bash") return String(eingabe?.command || "");
  if (eingabe?.file_path) return String(eingabe.file_path);
  if (eingabe?.url) return String(eingabe.url);
  return JSON.stringify(eingabe || {}).slice(0, 300);
}

async function entscheide(werkzeug, eingabe) {
  const text = ohneGeheimnisse(beschreibe(werkzeug, eingabe));
  const { data: regeln } = await db.from("ws_erlaubnisse").select("werkzeug, eingabe, ws_auftraege!inner(gruppe_id)")
    .eq("status", "immer").eq("ws_auftraege.gruppe_id", GRUPPE);
  if ((regeln || []).some((r) => passtRegel(r, werkzeug, text))) return true;
  // Bei Befehlen, die Code ausführen: zeigen, welche Dateien die Werkstatt geändert hat (der Befehl führt sie ggf. aus)
  let grund = "Die Werkstatt braucht das für diesen Auftrag.";
  if (werkzeug === "Bash" && !dauerErlaubbar(text) && !fuehrtCodeAus(text)) grund = "Einmalige Erlaubnis. Kein „Immer erlauben“ für diesen Befehl.";
  if (werkzeug === "Bash" && fuehrtCodeAus(text)) {
    try {
      const { stdout } = await promisify(execFile)("git", ["status", "--porcelain"], { cwd: process.cwd() });
      const dateien = stdout.trim().split("\n").filter(Boolean).slice(0, 20).map((z) => z.slice(3)).join(", ");
      grund = `Führt Code aus. Kein „Immer erlauben“ möglich. ${dateien ? `Von der Werkstatt geänderte Dateien: ${dateien}` : "Keine geänderten Dateien."}`;
    } catch { grund = "Führt Code aus. Kein „Immer erlauben“ möglich."; }
  }
  const { data: anf, error } = await db.from("ws_erlaubnisse")
    .insert({ auftrag_id: AUFTRAG, werkzeug, eingabe: kuerzen(text, 1000), grund: kuerzen(ohneGeheimnisse(grund), 1000) }).select().single();
  if (error) return false;
  await db.from("ws_live_log").insert({ auftrag_id: AUFTRAG, art: "erlaubnis", text: kuerzen(`Wartet auf deine Erlaubnis: ${werkzeug} ${text}`, 300) });
  const bis = Date.now() + 30 * 60 * 1000;
  while (Date.now() < bis) {
    await new Promise((r) => setTimeout(r, 2000));
    const { data } = await db.from("ws_erlaubnisse").select("status").eq("id", anf.id).single();
    if (data && data.status !== "offen") return data.status !== "abgelehnt";
  }
  return false;
}

const server = new McpServer({ name: "werkstatt", version: "0.1.0" });
server.tool(
  "erlaubnis",
  "Fragt in der Codeschmiede um Erlaubnis für ein Werkzeug der Werkstatt.",
  { tool_name: z.string(), input: z.any(), tool_use_id: z.string().optional() },
  async ({ tool_name, input }) => {
    let ok = false;
    try { ok = await entscheide(tool_name, input); } catch { ok = false; }
    const antwort = ok
      ? { behavior: "allow", updatedInput: input }
      : { behavior: "deny", message: "Nicht erlaubt (oder keine Antwort innerhalb von 30 Minuten). Suche einen anderen Weg oder stelle eine RÜCKFRAGE." };
    return { content: [{ type: "text", text: JSON.stringify(antwort) }] };
  },
);
await server.connect(new StdioServerTransport());
