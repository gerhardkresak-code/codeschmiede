# Konzept zuerst – Gruppe „Konzept“ und Projektwissen

Entwurf 1.0 (Artefakt „Codeschmiede Konzept-Gruppe“), freigegeben von Gerhard am 23.10.2026, 18:06. **Umgesetzt in 0.8.1.**

## Anweisung
„Den Chat rechts zum Ausklappen bitte entfernen. Lege bei neuen Projekten in der Gruppe App als erstes Konzept an. Hier wird das
Grundkonzept besprochen, bevor die App überhaupt gebaut wird … und geht dann auch in das Wissen über.“ (17:52)

Antworten (17:55): Aufgaben der Chat-Spalte → Gruppe Konzept · neue **und** bestehende Projekte · Ergebnis → Wissensdatenbank.

## Umsetzung
- `ws_projekte.konzept_gruppe_id` → Gruppe `<projekt>-konzept` „Konzept“ (Symbol lightbulb), erste Gruppe im Bereich „App“;
  fehlt der Bereich (Trainer to go), entsteht er als erster Bereich. Neue Projekte bekommen sie beim Anlegen.
- Konzept-Arbeitsplatz (`web/src/Konzept.jsx`): Chat mit Claude (Ort `konzept`) + Konzept-Stand mit den Kapiteln
  Ziel & Zielgruppe, Kernfunktionen, Daten & Datenschutz, Design-Vorgaben, Abläufe & Rollen, Offene Fragen (+ Sonstiges).
- Claude schlägt geklärte Entscheidungen mit der Zeile `WISSEN: {"kapitel","text"}` vor; übernommen wird nur nach „Ja“
  (`ws_wissen_uebernehmen`, Text aus dem gespeicherten Vorschlag). Admin und Entwickler können auch selbst eintragen; löschen darf,
  wer eingetragen hat, oder der Admin (protokolliert).
- `ws_wissen` sehen alle Mitglieder des Projekts. Es fließt ein in: Chat (alle Orte), Design-Chat (Ziel, Funktionen, Design),
  Bau-Aufträge der Werkstatt („PROJEKTWISSEN aus dem Konzept“).
- Die Chat-Spalte rechts entfällt. Projektfragen, Konzept-Karte („Konzept freigeben & bauen“), Feature- und Bezugsvorschläge laufen im
  Konzept-Chat; bisherige Gespräche erscheinen dort. Es bleiben der Chat im Feature-Arbeitsplatz und der Design-Chat.
