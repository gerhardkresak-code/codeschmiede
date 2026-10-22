# Codeschmiede – Konzept

**Stand:** 2026-10-22 · Wer: Gerhard Kresak (Anweisungen und Freigaben 2026-10-22 12:06–13:39), Claude (Konzept, Umsetzung)
**Herkunft:** entstanden als „Trainer-to-go Programmierumgebung“ im Repo `trainer-to-go` (Zweig `feature/auftrags-zentrale`, Entwurf 0.4 freigegeben 12:37);
seit 13:16 eigenes Programm für alle Projekte. Entwurf: `docs/entwurf-0.4.html`.

## Entscheidungen (Gerhard)
| Zeit | Entscheidung |
|---|---|
| 12:09 | Auftrags-Zentrale: Bereich › Gruppe › Feature, Auftrags-Chat je Gruppe/Feature, Rückfragen und Ergebnis auf der Seite, Push nur bei Rückfragen/Freigabe, ein Auftrag je Gruppe, Warteschlange |
| 12:14 | „Freigeben & zusammenführen“ am Ergebnis; neue Features kommen automatisch dazu (7 Tage „Neu“) |
| 12:18 | Markierung „Hier wird gerade gearbeitet“; Weg eines Auftrags bis Sicherheitsprüfung und Wissen |
| 12:23 | Lokal arbeitende Werkstatt-PCs; muss einwandfrei laufen; Features löschen; alles synchronisiert; mehrere Benutzer (Programmieren/Texte); Freigeben nur Admin oder mit Recht |
| 12:27 | Rollen Admin/Entwickler/Texter/Leser; Löschen = Ausblenden oder Ausbauen; Einladung per E-Mail; Live-Vorschau (eigenes Fenster) mit „Zeigen & kommentieren“ |
| 12:29/12:31 | Neue Features und Gruppen anlegen; live mitsehen; Erlaubnis-Anfragen im Programm bestätigen |
| 12:37 | Entwurf 0.4 freigegeben („lege los“) |
| 13:14 | Claude über **API-Schlüssel** (nicht Abo-Anmeldung); beide Admin-Konten (office@ und Gmail) bleiben |
| 13:16 | **Ein Programm mit Projektwechsel** für alle Apps; eigenes Repository; Name **Codeschmiede** |
| 13:18 | Nutzungslimits immer sichtbar und live; Modellwahl nach Aufwand und Komplexität |
| 13:19 | Eigene Datenbank in Frankfurt – **vorerst** im Supabase-Testprojekt von Trainer to go (kostenloser Platz belegt); Umzug, sobald ein Platz frei ist |

## Aufbau
| Teil | Wo | Aktualisierung |
|---|---|---|
| Oberfläche | `web/`, gehostet (Cloudflare Pages), im Programmfenster live geladen | sofort nach Veröffentlichung |
| Programm-Hülle | `desktop/src-tauri` (Tauri 2), Windows + Mac | Selbst-Update beim Start |
| Werkstatt-Dienst | `desktop/dienst` (Node, Claude Agent SDK, API-Schlüssel aus dem Tresor) | mit dem Programm |
| Daten | Supabase, Tabellen `ws_*` mit RLS und Live-Abgleich | live |
| Code der Projekte | GitHub-Repository je Projekt | Pull Request je Auftrag |

## Projekte
Jedes Projekt hat eigene Bereiche, Gruppen, Features, Mitglieder (Rolle je Projekt) und Rechte je Bereich. Neues Projekt per Assistent
(Name, Kennung, Beschreibung, GitHub-Repository, Symbol) mit Vorlage: App (Oberfläche & Design, Funktionen), Daten & Rechte (Datenbank,
Anmeldung & Rechte), Betrieb (Handbuch & Texte, Einstellungen & Datenschutz). Für jedes Projekt gilt das AI-Dev-OS-Regelwerk; die Werkstatt
stellt beim ersten Auftrag eines neuen Projekts zuerst ihre Fragen (Pflicht-Start).

## Rollen und Rechte
| Rolle | Aufträge | Freigeben / Erlauben | Löschen | Claude | GitHub |
|---|---|---|---|---|---|
| Admin (Gerhard) | alle | alle | alle | API-Schlüssel auf seinem PC | ja |
| Entwickler (je Projekt) | je Bereich | nur wenn vergeben | nur wenn vergeben | eigener API-Schlüssel auf seinem PC | ja |
| Texter (je Projekt) | nur Text-Aufträge | nie | nie | nein | nein |
| Leser (je Projekt) | nein | nein | nein | nein | nein |
Neue Projekte, Gruppen, Mitglieder, Limits: nur Admin.

## Weg eines Auftrags
Auftrag (Zentrale) → In Arbeit (Werkstatt-PC, eigener Zweig) → Freigabe (PR mit grüner Prüfung; Admin oder Recht) → Zusammenführen →
Sicherheitsprüfung → Wissen & veröffentlicht (die letzten drei auf dem Admin-PC).

## Werkstatt (Schritt 2)
- Läuft im Programm, wenn „Werkstatt an“; holt den nächsten wartenden Auftrag aus Gruppen, in denen der Benutzer Auftragsrecht hat.
- Arbeitet mit dem Claude Agent SDK und dem API-Schlüssel aus dem Tresor; im Arbeitsordner `<Daten>/projekte/<projekt>/auftrag-<nr>` (git worktree)
  auf Zweig `feature/cs-<nr>-<kurz>`; Regeln aus dem Projekt (AGENTS.md/CLAUDE.md) gelten.
- **Modellwahl:** Text-Auftrag oder kleine Änderung → kleines Modell; normale Funktion → mittleres; Datenbank, Rechte, Login, Migration,
  Ausbau oder Risiko HOCH → großes Modell; Fehlschlag → eine Stufe höher. Gewähltes Modell steht am Auftrag.
- **Limits:** Vor jedem Auftrag Abgleich mit Monatslimit; ab Warnschwelle Hinweis, am Limit keine neuen Aufträge (wenn „Stopp am Limit“).
  Kosten jedes Laufs → `ws_verbrauch`; Anzeige je Projekt und gesamt, live.
- Live-Log (Lesen, Ändern mit Ausschnitt, Befehle, Tests) ohne Geheimnisse; Erlaubnis-Anfragen für Befehle außerhalb der freigegebenen Liste;
  Rückfrage beendet den Lauf mit `RÜCKFRAGE:` und setzt beim Antworten fort; Ergebnis: Pull Request → Stand „Freigabe“.

## Schritte
| Schritt | Inhalt | Stand |
|---|---|---|
| 1 | Datenbank v1, Zentrale, Benutzer & Rechte (in Trainer to go gebaut und getestet) | erledigt 2026-10-22 |
| 1b | Umzug ins Repository `codeschmiede`, Datenbank v2 (Projekte, Verbrauch, Limits), Oberfläche mit Projektwechsel und Verbrauchsanzeige | in Arbeit |
| 2 | Programm (Tauri) + Werkstatt-Dienst | in Arbeit |
| 3 | Live-Vorschau mit „Zeigen & kommentieren“ | offen |
| 4 | Zusammenführen / Sicherheitsprüfung / Wissen auf dem Admin-PC; Woche Parallelbetrieb | offen |
