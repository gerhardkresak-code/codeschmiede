# AGENTS.md – Codeschmiede

Gilt für jeden Claude-Chat, jede Werkstatt der Codeschmiede und jedes andere KI-Werkzeug (z. B. OpenCode) in diesem Repository.
Sprache mit Gerhard: **immer Deutsch**.

## Grundlage
Über dieser Datei steht Gerhards allgemeines Regelwerk **AI Development Operating System** (Hauptfassung `gerhardkresak-code/ai-dev-os`,
Datei `global/AGENTS.md`). Diese Datei ergänzt es für die Codeschmiede und schwächt es nie ab.
**Pflicht-Start:** `docs/KONZEPT.md` und `docs/CHANGELOG.md` lesen → Anfrage einordnen (Risikostufe KLEIN/NORMAL/HOCH/KRITISCH) → Bestand,
Widersprüche, Risiken, Empfehlung melden → Fragen stellen → ab NORMAL Freigabe → bauen.

## Was ist die Codeschmiede?
Gerhards Programmierumgebung für **alle** seine Apps (Projekte): ein Programm für Windows und Mac mit Projektwechsel, Auftrags-Zentrale,
Werkstatt (offizielles Claude Code mit eigenem Abo-Login), Live-Vorschau, Freigabe, Zusammenführen, Sicherheitsprüfung, Wissen. Konzept: `docs/KONZEPT.md`.

## Projektregeln (Anweisungen von Gerhard)
- Erst prüfen, ob eine Anweisung Sinn macht, alle Details erfragen, dann bauen. Sichtbare Neuerungen zuerst als klickbarer Entwurf.
- Ansprechend für die breite Masse, einheitlicher Stil: Smaragdgrün, Schrift Barlow, Symbole nur aus Lucide (gleiche Strichstärke), keine Emojis.
- Vollständige Dokumentation (was, wer, wann) in `docs/CHANGELOG.md` (neue Zeile oben). Jede Version gesichert (`version/v<x.y.z>`).
- **Neue Anweisung** von Gerhard → hier unter Projektregeln, in `docs/CHANGELOG.md`.
- Bei Einrichtungen in Web-Oberflächen Gerhard durchlotsen: Seiten selbst öffnen, Stellen zum Klicken markieren.
- Braucht Gerhard etwas zu bestätigen oder zu tun: Push-Nachricht aufs Handy.
- **Nutzungslimits** (Verbrauch der Claude-Schnittstelle) immer sichtbar und live; die Werkstatt achtet auf die Limits und wählt das Modell
  nach Aufwand und Komplexität (einfach → klein, normal → mittel, komplex/HOCH → groß; bei Fehlschlag eine Stufe höher).

## Weg in `main`
Nur über Pull Request mit grüner Prüfung („Prüfung“). Bei HOCH/KRITISCH zusätzlich unabhängiges Review durch einen eigenen Agenten.
Zusammengeführt wird nur auf Gerhards Wort (in der Codeschmiede: Knopf „Freigeben & zusammenführen“ durch Admin oder mit Recht).

## Datenschutz und Sicherheit
- Die Codeschmiede verarbeitet **keine** Daten von Vereinsmitgliedern, Kunden oder Kindern – nur Aufträge, Code und Mitglieder des Teams.
  In Aufträge, Live-Log und Nachrichten gehören keine Personendaten Dritter.
- Jede Tabelle mit Row-Level-Security; Rechte nur über geprüfte Datenbank-Funktionen mit Protokoll (`ws_protokoll`).
- **Keine Claude-Zugangsdaten** in der Codeschmiede: Die Werkstatt startet das offizielle Claude Code, das jede Person selbst mit ihrem Abo anmeldet
  (Entscheidung 2026-10-22 14:22). Nur für die interne Nutzung; Weitergabe des Programms an Dritte bräuchte API-Schlüssel.
- **Abo-Limits beachten:** vor jedem Auftrag Stand prüfen; ab Schwelle „klein“ eine Modellstufe kleiner, ab Schwelle „Pause“ keine neuen Aufträge bis zur Rücksetzung.
- Geheimnisse (GitHub-, Supabase-Token) nie in Datenbank, Code, Chat oder Log.
  Der Werkstatt-Dienst filtert Geheimnisse aus dem Live-Log.
- Keine Dritt-Server ohne Eintrag in `docs/DATENSCHUTZ.md`. Schriften und Bibliotheken selbst hosten.
- Werkstatt arbeitet nur im Arbeitsordner des Auftrags (eigener Zweig), nie direkt auf `main`; heikle Befehle brauchen Erlaubnis im Programm.

## Neue Anweisungen
- **2026-10-22 16:25 – Automatische Updates:** Jede neue Version des Programms wird automatisch eingespielt (im Hintergrund laden,
  beim nächsten Start aktiv, Knopf „Jetzt neu starten“, nie mitten in einem Auftrag). Jede Programmänderung in `main` erhöht die Version
  in `desktop/src-tauri/tauri.conf.json`, `Cargo.toml` und `desktop/dienst/package.json`; der Ablauf „Programm bauen“ veröffentlicht sie signiert.
- **2026-10-22 20:39 – Weg bis live:** Freigabe → Sicherheitsprüfung → Zusammenführen → Prüfung des ganzen Features in einer Testfassung → erst dann live.
  Rot an einer Prüfung = Nacharbeit, nichts geht live.
- **2026-10-22 16:45 – Alles landet beim Feature:** Was Gerhard im Gruppen-Chat oder im Claude-Chat zu einem Feature sagt, erscheint beim Feature
  in der Codeschmiede (Herkunft „aus Gruppe“ / „aus Claude-Chat“). Claude trägt Anweisungen aus dem Claude-Chat als Nachricht
  (`kanal = 'claude-chat'`) beim passenden Auftrag bzw. als neuen Auftrag ein und meldet dort, was gebaut wurde.
- **2026-10-22 22:26 – Codeschmiede als Produkt:** Die Codeschmiede wird verkauft. Ein Käufer betreibt alles selbst
  (eigene Datenbank, eigenes GitHub und Cloudflare; Windows und Mac). Ein Einrichtungs-Assistent mit Prüfung erscheint beim ersten Start
  und ist jederzeit erreichbar, dazu eine Ampel in der Statusleiste. Claude wahlweise mit Abo oder API-Schlüssel (Hinweis auf die Bedingungen
  von Anthropic). Konzept: `docs/KONZEPT-PRODUKT.md`.
- **2026-10-22 22:31 – Features aus dem Gespräch und Bezüge:** Features legt Gerhard selbst oder Claude aus dem Gespräch an, Claude
  immer erst nach Ja/Nein. Beide lassen sich löschen. `@Feature` (oder erkannt + Rückfrage) setzt eine Referenz im selben Projekt. Ändert
  sich die Referenz, fragt Claude, ob nachgezogen werden soll. Konzept: `docs/KONZEPT-FEATURE-BEZUEGE.md`.
