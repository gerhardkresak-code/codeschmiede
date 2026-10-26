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

## Ergänzung 18:33 – Konzept-Dokument
„Konzept hat keine Gruppen und/oder Features. Hier schreibt man nur, und alles Relevante wird ins Wissen und als Konzept gespeichert.“
Antwort: Konzept-Dokument. Umsetzung: Ansicht „Konzept-Dokument“ im Konzept-Arbeitsplatz, automatisch aus `ws_wissen`, Download als `.md`.

## Ergänzung 0.9.14 (26.10.2026 08:07) – Der allgemeine Chat läuft über Konzept, die KI erledigt die Arbeit
**Anweisung Gerhard:** „Der allgemeine Chat wie hier bei dir soll über Konzept laufen.“ Entscheidung: „Der eingestellte KI-Anbieter erledigt das.“

- Der Chat in der Gruppe **Konzept** ist der allgemeine Chat zum Projekt – Grundkonzept und jedes neue Vorhaben. Es antwortet der KI-Anbieter, der in der
  Codeschmiede für „Konzept“ eingestellt ist (`kiAntwort(projekt, "konzept", …)`).
- **Rückfragen zum Anklicken:** Die KI beendet die Antwort mit `FRAGEN: [{"frage","optionen":[…]}]` (1–4 Fragen, je 2–5 Antworten, Empfehlung zuerst).
  In der Codeschmiede erscheinen die Antworten als Knöpfe, dazu ein Feld für eine eigene Antwort; „Antworten senden“ schickt alle gesammelt.
- **Aufträge selbst anlegen:** Ist alles geklärt, endet die Antwort mit `AUFTRAEGE: [{gruppe_id, feature_id, titel, text, konzept}]` (1–5, keine offenen
  Punkte). Die Werkstatt legt sie gleich nach der Antwort an (`ws_konzept_auftraege_anlegen`, Datenbank 0048) – nur aus dem geprüften Vorschlag, nur als die
  Person, die gefragt hat, mit deren normalen Rechten (Recht „Aufträge“ je Gruppe, Texter nur Text-Aufträge), höchstens 15 je Stunde, nur im Konzept-Gespräch,
  nicht in archivierten Projekten, ohne Steuer- oder unsichtbare Zeichen. Erfundene Gruppen verwirft die Werkstatt einzeln. Das Konzept hängt am
  Auftragstext. Klappt das Anlegen nicht (Rechte, Grenze, Gruppe inzwischen geändert), bleibt die Karte mit „Aufträge anlegen“ stehen.
- **Stand im Chat:** Die Karte zeigt je Auftrag den Stand (In Arbeit, Rückfrage, Bereit zur Freigabe …). **Freigeben** und **Zusammenführen** bleiben Klicks
  des Admins – direkt auf der Karte, mit derselben Rückfrage wie in der Zentrale (`web/src/Auftragsknoepfe.jsx`).
- Außerhalb des Konzepts gilt weiter: höchstens ein Auftrag je Antwort, angelegt erst per Klick.
