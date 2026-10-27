# Konzept: Oberfläche 2.0 & Chat (Entwurf 1.1)

Stand 2026-10-27 · Anweisung Gerhard 08:18 · Entwurf: `docs/entwurf-1.1-oberflaeche-chat.html` · **freigegeben 08:27 („freigegeben. Auch gleich live schalten“), gebaut als 0.10.0** (Ausnahme: im Claude-Chat gebaut, weil die Werkstatt bis 29.10. im Wochenlimit ist – Entscheidung Gerhard 08:28)

## Entscheidungen (Gerhard 2026-10-27)
- **Umfang:** neuer Chat wie bei Claude **und** die ganze Oberfläche aufgeräumt (Empfehlung übernommen).
- **Limits:** Knopf „Jetzt aktualisieren“ im Limits-Fenster. Bei Claude kostenloser Nutzungs-Abruf (wie `/usage` in Claude Code, keine offizielle Schnittstelle). Bricht der Abruf nach einem Update, steht das sichtbar dran und der Knopf macht ersatzweise eine Mini-Anfrage. Kein automatisches Abfragen im Takt.
- **KI-Anbieter (zwingend verwenden, 3 beim Programmieren):** zurückgestellt („warte noch“). Bis zur Entscheidung gilt weiter: Bauen Claude, ChatGPT nur Ersatz; Prüfung unter Windows nur Claude.
- **Abgleich Claude-Chat ↔ Codeschmiede:** besteht bereits (AGENTS.md, Kanal `claude-chat`) – nichts ändern.

## Oberfläche
- **Navigation** in Gruppen: Arbeiten (Chat, Zentrale, Zu erledigen, Aufgaben) · Gestalten & Bauen (App-Designer, Live-Vorschau, Code, Fehler) · Ablauf (Zweige & Versionen, Prüfstand, Wissen) · Dokumentation · unten **Verwaltung** (Benutzer & Rechte, KI-Anbieter, Anbindungen, Globale Einstellungen, Einrichtung, Verbrauch & Limits).
- **Kopfzeile:** Projektwechsel, Suche/Springen (Strg K), Limits-Pille (5 Std. und Woche als Mini-Balken), Glocke für Rückfragen/Freigaben, Benutzer.
- **Zentrale:** Kennzahlen (wartet auf dich, in Arbeit, in Prüfung, live diese Woche), Auftragsliste mit Weg-Anzeige der 7 Stationen, Aufbau der App als Baum.

## Chat
- Links Unterhaltungen je Projekt (angeheftet: Konzept), gruppiert nach Heute/Gestern/Woche, Suche, „Neuer Chat“.
- Mitte Gespräch; Rückfragen als Karte zum Anklicken, angelegte Aufträge als Karte mit Stand.
- Eingabe mit **@Feature** und **#Gruppe** (Vorschlagsliste beim Tippen, Pfeiltasten/Enter), Anhänge, Anzeige des eingestellten Anbieters (nur lesend).
- Rechts ein- und ausblendbar: Bezüge des Chats (Features, Aufträge, ins Wissen übernommen).
- Ohne Bezug geht eine Nachricht ins Konzept; mit Bezug landet sie zusätzlich beim Feature/der Gruppe. Gebaut wird erst nach Klärung und Freigabe (Regel 2026-10-26).

## Technik (0.10.0)
- Datenbank `0050_unterhaltungen_limits_abruf.sql`: `ws_unterhaltungen` (nur eigene sichtbar/änderbar, höchstens 500 je Projekt), `ws_claude_chat.unterhaltung_id` und `anhaenge`
  (geprüft durch `ws_chat_anhaenge_ok`: höchstens 5, nur eigener Ordner im eigenen Projekt, feste Dateitypen, ≤ 10 MB), Speicher `ws-chat`
  (`<benutzer>/<projekt>/<uuid>.<endung>`, nur die Person selbst), `ws_abo_abruf()` (höchstens alle 15 s) und Rückmeldefelder an `ws_abo_limits`. Test `supabase/tests/t37_unterhaltungen.sql`.
- Werkstatt: Verlauf je Unterhaltung, Anhänge in `.cs-anhaenge/<frage>/` des Lese-Ordners (danach gelöscht), Texte als Datenblock in der Frage
  (`lib/anhaenge.mjs`); Limits-Abruf alle 4 s auf Anforderung (`lib/nutzung.mjs`, Anmeldung nur im Speicher, nur an `api.anthropic.com`).
- Oberfläche: `web/src/App.jsx` (Rahmen, Kopfzeile, Befehlsleiste, Kennzahlen), `web/src/Chat.jsx`, `web/src/Bezuege.jsx` (#Gruppe), `web/src/AboLimits.jsx` (Knopf).

## Handbuch: So arbeitest du mit dem Chat
1. **Menü › Arbeiten › Chat** öffnen. Oben links steht immer **Konzept · <Projekt>** – dort landet alles, was keinen eigenen Chat braucht.
2. **Neuer Chat** startet eine eigene Unterhaltung. Sie wird mit der ersten Nachricht angelegt und nach ihr benannt (Stift = umbenennen,
   Nadel = anheften, Papierkorb = löschen samt Anhängen).
3. Beim Schreiben **@** tippen (oder Knopf „@ Feature“) und ein Feature wählen; **#** wählt eine Gruppe. Erwähnte Features sind in der Nachricht
   grün und lassen sich anklicken – dann öffnet sich das Feature in der Zentrale.
4. **Anhang**: Bilder, PDF oder Textdateien anhängen, einfügen (Strg V) oder hineinziehen – höchstens 5 je Nachricht, je 10 MB.
   Keine Fotos von Kindern und keine Mitgliederdaten.
5. Die eingestellte KI (unten rechts im Eingabefeld) antwortet über deine Werkstatt. Rückfragen beantwortest du per Klick. Erst wenn alles geklärt ist,
   legt sie die Aufträge an – gebaut wird nach deiner Freigabe in der Zentrale.
6. **Bezüge** (Knopf oben rechts, nur auf großen Bildschirmen) zeigt alle Features, Gruppen, Aufträge und Wissens-Einträge dieses Chats.
7. **Limits**: Klick auf die Limits-Anzeige oben → **Jetzt aktualisieren**. Die Werkstatt muss dafür laufen. Steht dort ein Hinweis
   („kostenloser Abruf ging nicht …“), hat sie ersatzweise eine kleine Anfrage gemacht oder den Grund angegeben.
8. **Strg K** öffnet „Suchen & Springen“ für Seiten, Features, Aufträge und Unterhaltungen.
