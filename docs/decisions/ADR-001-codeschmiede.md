# ADR-001 Codeschmiede als eigenes Programm für alle Projekte
Status: AKZEPTIERT (geändert 14:22) · Datum: 2026-10-22 · Entschieden von: Gerhard Kresak (13:14, 13:16, 13:18, 13:19, 14:22)

## Entscheidung
Ein Programm „Codeschmiede“ (Tauri, Windows + Mac) mit Projektwechsel für alle Apps; eigenes Repository; eigene Datenbank (Supabase,
Frankfurt). Die Werkstatt startet das **offizielle Claude Code**, das jede Person auf ihrem PC mit ihrem **eigenen Claude-Abo** angemeldet hat
(14:22, ersetzt „API-Schlüssel“ von 13:14). Die **Abo-Nutzungslimits** (5-Stunden-Fenster, Woche) sind immer sichtbar; die Werkstatt
wählt das Modell nach Aufwand und geht bei knappem Abo eine Stufe kleiner bzw. pausiert.

## Begründung
Gerhard will über sein Abo arbeiten, nicht zusätzlich nach Verbrauch zahlen. Anthropic erlaubt keine claude.ai-Anmeldung in eigenen
Produkten auf Basis des Agent SDK – deshalb meldet die Person sich im offiziellen Claude Code selbst an, und die Codeschmiede speichert keine
Claude-Zugangsdaten.

## Folgen
Nur interne Nutzung durch Gerhard und sein Team (jede Person mit eigenem Abo). Soll das Programm an Dritte gehen, braucht es API-Schlüssel.
Werkstatt-Arbeit zählt auf dasselbe Abo wie die Chats in claude.ai. Ein Werkstatt-PC muss laufen; Claude Code, Node, Git und GitHub CLI
müssen dort installiert und angemeldet sein.

## Verworfen
Eine .exe je Projekt (mehr Pflege); Abo-Anmeldung über das Agent SDK (nicht erlaubt); API-Schlüssel (Zusatzkosten, 14:22 verworfen);
Claude-Chats als Werkstatt (müssen offen sein).
