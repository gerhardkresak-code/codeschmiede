# ADR-001 Codeschmiede als eigenes Programm für alle Projekte
Status: AKZEPTIERT · Datum: 2026-10-22 · Entschieden von: Gerhard Kresak (13:14, 13:16, 13:18, 13:19)

## Entscheidung
Ein Programm „Codeschmiede“ (Tauri, Windows + Mac) mit Projektwechsel für alle Apps; eigenes Repository; Werkstatt mit Claude Agent SDK
und **API-Schlüssel** (nicht Abo-Anmeldung, weil Anthropic die claude.ai-Anmeldung in Drittprodukten nicht erlaubt); Verbrauch und Limits live;
Modellwahl nach Aufwand. Datenbank vorerst im Supabase-Testprojekt von Trainer to go, Umzug in eigene Datenbank (Frankfurt) später.

## Folgen
API-Kosten nach Verbrauch (Monatslimit in der Claude Console und in der Codeschmiede). Ein Werkstatt-PC muss laufen. Tabellen `ws_*` bleiben
von App-Tabellen getrennt; beim Umzug werden nur `ws_*` und die Anmeldekonten der Mitglieder übernommen.

## Verworfen
Eine .exe je Projekt (mehr Pflege); Abo-Anmeldung über das Agent SDK (nicht erlaubt); Claude-Chats als Werkstatt (müssen offen sein).
