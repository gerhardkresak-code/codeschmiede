# Konzept: Oberfläche 2.0 & Chat (Entwurf 1.1)

Stand 2026-10-27 · Anweisung Gerhard 08:18 · Entwurf: `docs/entwurf-1.1-oberflaeche-chat.html` · wartet auf Freigabe

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
