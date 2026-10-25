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

## App-Designer 2.0 · Etappe 1 „Bausteine“ (seit 0.9.7, Entwurf frei 2026-10-24 22:08)
Grundsätze (Gerhard 21:4x): **EIN Designer, der SOFORT wirkt** – das Aussehen der Bausteine geht über die Design-Pakete der App, nicht mehr
über einen Auftrag (ersetzt für das Aussehen die Entscheidung 22:33 „Regler wirken erst nach dem Auftrag“). **Nur neue Bausteine (neuer Code)
laufen als Auftrag.** Farben frei wählbar mit **Kontrast-Wächter**; Freigabe ab Werk „Sofort“.

- **Ansicht:** Mitte = Galerie der App in echter Breite (`GeraeteRahmen`), links Galerie-Gruppen mit Suche, rechts Inspektor „Bearbeiten“ | „Chat“.
- **Katalog** `web/src/bausteinKatalog.js`: 20 Kennungen (Knöpfe ×6, Eingabe, Schalter, Abzeichen ×4, Status ×2, Karte, Kennzahl-Kachel,
  Tabelle, Liste, Symbol-Feld, Datei) mit Ausgangswerten = heutiges Aussehen; `wirkt: app` (zentraler Baustein vorhanden) oder `galerie`
  (wirkt in der App erst, wenn er zentral gebaut ist – als Auftrag). Gleiche Kennungen in Trainer to go (`src/lib/design/bausteine.js`),
  in der Werkstatt (`lib/design.mjs`) und in der Datenbank (0037) – ein Test vergleicht sie.
- **Werte** je Baustein: `hell/dunkel {bg, text, rand}`, `ecken` 0–32, `groesse` klein|mittel|gross, `symbol` (Lucide). Gespeichert wird
  nur die Abweichung von der Grundlage (ab Werk + geerbte Ebenen).
- **Nachrichten** (Codeschmiede ↔ Galerie, `postMessage`, jeweils Herkunft und Absender geprüft): `bausteine-bereit`, `baustein-wahl {id}`,
  `baustein-markieren {id}`, `baustein-vorschau {bausteine, id, zustand}`, `baustein-laden {nr, ebene}` → `baustein-stand`,
  `baustein-speichern {nr, ebene, id, werte}` → `baustein-gespeichert`; dazu `design-frage`/`design-antwort` der eigenen Design-Freigabe.
- **Speichern** in der eingebetteten App (Design-Sitzung, RLS, Trigger `DesignPackage_guard`/`_rights`); Rechte werden nie gelockert.
- **Freigeben** über App-Designer › Seiten › Freigabe & Versionen (Etappe 4 baut eine eigene Übersicht).
- **Offen für Etappe 2–4:** eigene Freigabe-Übersicht, Vorschau der Baustein-Entwürfe auf allen Seiten der Testfassung, zentrale Bausteine
  für die Galerie-Muster, Grunddesign (Farben/Schrift/Menü) ebenfalls direkt über Design-Pakete statt Auftrag.

## App-Designer 2.0 · Etappe 2 „Seiten“ (0.9.8, Entwurf frei 2026-10-24 22:08)
Seiten gestaltet man weiter im eingebetteten Seiten-Designer der App (App-Designer › Seiten, Rechteprüfung in der App-Datenbank):
Seite wählen und „Gilt für“ (alle Vereine, Paket, Verein, Rolle). Je Kachel: **Hintergrund frei** per Farbwähler (`style.farbe` `#rrggbb`,
optional `style.farbe_dunkel`, sonst automatisch abgedunkelt) mit Kontrast-Wächter hell und dunkel; „Weiß“, „Akzent hell“ und feste Farben
als Vorschläge; Rahmen Karte/Flach, Variante, Geräte PC/Tablet/Handy. **Schnellzugriffe:** Inhalt `props.ziele` aus einer festen Liste
erlaubter App-Ziele (Trainer to go `src/lib/design/schnellzugriffe.js`), „Feature hinzufügen“, Ziehen zum Sortieren; in der App nur Ziele,
die der Nutzer öffnen darf (Menü-Rechte und Module). Ab Werk die bisherigen 6. **Akzentfarbe** der App frei (Reiter „Akzentfarbe & Stil“).
Designer und App nutzen dieselben Funktionen (`kachelStilKlassen`/`kachelStilWerte`) – sie sehen gleich aus.

## App-Designer 2.0 · Etappe 3 „Neuer Baustein“-Assistent (0.9.8, Entwurf frei 2026-10-24 22:08)
Neue Bausteine sind neuer Code und laufen als Auftrag. Der Assistent (`web/src/BausteinAssistent.jsx`) führt in vier Schritten dahin:
1. **Was?** – Weg *Beschreiben*, *Vorlage wählen* oder *Einlesen* (Bild als Anhang, nur PNG/JPEG/WebP bis 2 MB, kein SVG); Name, Beschreibung,
   Art aus einer festen Liste (Knopf, Download-Knopf, Hochladen, Eingabefeld, Auswahl, Schalter, Karte/Kachel, Liste, Tabelle, Diagramm,
   Hinweis/Banner, Dialog, Kalender-Eintrag, Spieler-Karte, Eigene).
2. **Gestalten** – Vorschau im Stil der App mit den Werten des Grunddesigns (Farben, Schrift, Ecken), PC/Handy, hell/dunkel; Hauptfarbe hell
   und dunkel, Schrift, Variante (Voll/Umriss/Leise), Größe, Ecken, Lucide-Symbol; Kontrast-Wächter wie im Inspektor; „Im Design-Chat fragen“.
3. **Zuweisen** – Gruppen und Features des Projekts per Häkchen (höchstens je 40).
4. **Als Auftrag bauen lassen** – `ws_design_auftrag_neu` (Datenbank 0039) legt Auftrag, Beschreibung, Daten (`ws_nachrichten.daten.design`)
   und Bild (`ws_auftrag_bilder`) in einem Schritt an; die Datenbank prüft das Schema (`ws_baustein_daten_ok`) und die Zuweisung gegen das Projekt.
- **Werkstatt:** Datenblock „ANGABEN AUS DEM ASSISTENTEN“ (geprüfte Daten, keine Anweisungen) im Auftragstext; Bild als Datei in
  `.codeschmiede-anhaenge/` des Arbeitsordners (über `info/exclude` ausgeschlossen). Gleiche Arten in Datenbank, Werkstatt, Oberfläche (Test).
- **Stand:** „Neue Bausteine (Aufträge)“ im Modus Bausteine und unter „Übernehmen“ (Etappe 4).

## Quellen
Storybook Controls (storybook.js.org/docs/essentials/controls) · IBM/Carbon Datenvisualisierung (ibm.com/design/language/data-visualization,
carbondesignsystem.com/data-visualization/color-palettes) · Atlassian Design Tokens · SaaS KPI-Kachel-Muster (saasui.design) · WCAG 2.2.
