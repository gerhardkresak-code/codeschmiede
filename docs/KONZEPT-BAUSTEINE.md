# Konzept: Baustein-Bibliothek im App-Designer

**Stand:** 2026-10-22 22:30 · Wer: Claude (Konzept), Anweisung Gerhard 22:16 („Kacheln, Diagramme und sonstiges, alles was die App
oder du für die App erstellst, einbinden, ändern/umgestalten, mit Chat – erst Konzept, im Internet prüfen“) · **Status: umgesetzt in 0.8.0** (Tabellen-Varianten, Icon-Stil, Verzeichnis, Galerie, Neuer Baustein mit Chat; Datenbank 0017)

## Ziel
Alles, was eine App sichtbar zusammensetzt, ist im App-Designer der Codeschmiede als **Baustein** sichtbar, mit allen Varianten und
Zuständen, und kann dort geändert werden – per Regler, per Chat mit Claude oder per „Zeigen & kommentieren“. Eine Änderung gilt für
**jede Stelle**, an der der Baustein verwendet wird. Neue Bausteine, die die Werkstatt für ein Feature baut, erscheinen automatisch.

## Was es braucht (Recherche)
| Punkt | Woher | Umsetzung |
|---|---|---|
| Katalog aller Bausteine mit Varianten, live bedienbar | Storybook („Stories“, „Controls“) | Galerie-Seite in der App, nur auf Testseiten; Codeschmiede zeigt sie und stellt Regler bereit |
| Aufbau „Grundwerte → Grundbausteine → zusammengesetzte Bausteine → Vorlagen → Seiten“ | Atomic Design | Bausteine nutzen nur Grundwerte (Farben, Abstände …) aus dem Grunddesign |
| Benennung nach Zweck, nicht Aussehen | Atlassian Design Tokens | eigene Grundwerte je Baustein (z. B. `kachel.wert.farbe`) zeigen auf allgemeine Grundwerte |
| Kennzahl-Kachel: Bezeichnung, Wert, Veränderung, Vergleichszeitraum, kleine Kurve, Absprung zu Details; Zustände laden/leer/null/Fehler; Farbe nach „gut/schlecht“, nicht nach „hoch/runter“ | SaaS-KPI-Muster | Varianten der Kachel + Pflicht-Zustände |
| Diagramme: feste Farbreihen (kategorisch, abgestuft, Gegensätze, Signalfarben), Titel nennt die Aussage, Beschriftung direkt am Diagramm, Raster sparsam, nie nur Farbe, hell/dunkel | IBM/Carbon Datenvisualisierung | eigene Diagramm-Grundwerte + Regeln, eine Diagramm-Bibliothek (Trainer to go: Recharts) |
| Barrierefreiheit | WCAG 2.2 | Kontrast, Fokus, Zielgrößen je Baustein geprüft |

## Inhalt der Bibliothek (Beispiel Trainer to go: 51 Grundbausteine, ~465 Komponenten im Code)
1. **Grundbausteine:** Knopf, Symbolknopf, Eingabe, Auswahl, Schalter, Kontrollkästchen, Abzeichen, Symbol, Avatar, Trennlinie.
2. **Zusammengesetzt:** Karte, Kachel (Kennzahl, mit Trend, mit Kurve, Hinweis), Liste, Tabelle, Filterleiste, Reiter, Dialog, Detail-Panel,
   Meldung, Leerzustand, Lade-Platzhalter, Fehlerzustand, Seitenkopf.
3. **Diagramme:** Linie, Balken (gestapelt), Fläche, Donut (sparsam), Kurve in der Kachel, Fortschritt/Ring, Tabelle mit Balken.
4. **Fachbausteine (je App):** z. B. Spielerkarte, Trainingskarte, Kalendereintrag, Spielfeld/Taktiktafel, Belastungskurve, Anwesenheitsraster.
5. **App-E-Mails:** Einladung, Passwort, Benachrichtigungen, Zusammenfassungen – gleiche Grundwerte, im Designer mit Vorschau änderbar.
   (PDF-Layouts **nicht** hier: die stellt Gerhard in der App selbst ein – Entscheidung 22:33.)

## Steckbrief je Baustein (im Designer)
Aufbau (Teile benannt) · Varianten · Zustände (normal, Zeiger darüber, Fokus, gedrückt, deaktiviert, laden, leer, Fehler) · Größen ·
Regler (Eigenschaften) · Beispieldaten (nie echte Personendaten) · **Verwendet an N Stellen** (Liste der Seiten, Sprung in den Feature-Arbeitsplatz) ·
Prüfungen (Kontrast, Zielgröße, Fokus) · Versionen.

## Bedienung
- Links: Bibliothek nach Gruppen, Suche, Abzeichen „neu“ (von der Werkstatt angelegt, noch nicht durchgesehen).
- Mitte: alle Varianten und Zustände nebeneinander („Matrix“), wahlweise auf Handy/Tablet/PC, mit Beispieldaten; Reiter „Echte Galerie“ = Testseite.
- Rechts: Eigenschaften (Regler) und Chat mit Claude (Vorschläge zum Übernehmen), Bezug auf den gewählten Baustein/Variante.
- „Als Auftrag senden“ → Werkstatt ändert den Baustein zentral → Testseite mit Galerie und betroffenen Seiten → Freigabe → Prüfungen → live.

## Wie es technisch funktioniert
1. **Bestandsaufnahme:** Die Werkstatt liest den Code der App und erstellt das Baustein-Verzeichnis (`docs/BAUSTEINE.md` + maschinenlesbar),
   inkl. Fundstellen. Doppelte/ähnliche Bausteine werden als Zusammenlegungs-Vorschlag gemeldet.
2. **Galerie in der App:** Eine Seite `/bausteine`, nur auf Testseiten (*.pages.dev) erreichbar, zeigt jeden Baustein mit Varianten und Beispieldaten.
   Die Live-Vorschau der Codeschmiede lädt diese Seite **nach** dem Bau des Auftrags (keine Sofortwirkung der Regler – Entscheidung 22:33);
   im Designer zeigt die Matrix den Entwurf schematisch.
3. **Zentrale Bausteine:** Jeder Baustein existiert genau einmal im Code und nutzt nur Grundwerte. Regel für die Werkstatt: erst vorhandene
   Bausteine verwenden, neue nur über die Bibliothek; Feature-Prüfung meldet eigene Farben/Abstände oder Doppelbausteine als rot.
4. **Neue Bausteine:** Baut die Werkstatt (oder Claude im Chat) einen neuen Baustein, wird er automatisch ins Verzeichnis und in die Galerie
   aufgenommen und in der Bibliothek als „neu“ markiert.

## Entscheidungen Gerhard (22:33)
- PDF-Layouts bleiben in der App (selbst einstellen); App-E-Mails kommen in die Bibliothek.
- Regler wirken erst nach dem Auftrag (Testseite), nicht sofort.
- Bestand: Bestandsaufnahme + Aufräumen (Zusammenlegungs-Vorschläge, Gerhard entscheidet je Vorschlag).
- Bibliothek wird in Entwurf 0.9 des App-Designers eingebaut und zusammen freigegeben.

## Quellen
Storybook Controls (storybook.js.org/docs/essentials/controls) · IBM/Carbon Datenvisualisierung (ibm.com/design/language/data-visualization,
carbondesignsystem.com/data-visualization/color-palettes) · Atlassian Design Tokens · SaaS KPI-Kachel-Muster (saasui.design) · WCAG 2.2.
