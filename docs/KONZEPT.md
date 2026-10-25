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
| 13:14 | ~~Claude über API-Schlüssel~~ (ersetzt 14:22); beide Admin-Konten (office@ und Gmail) bleiben |
| 13:16 | **Ein Programm mit Projektwechsel** für alle Apps; eigenes Repository; Name **Codeschmiede** |
| 13:18 | Nutzungslimits immer sichtbar und live; Modellwahl nach Aufwand und Komplexität |
| 13:19 | Eigene Datenbank in Frankfurt – **vorerst** im Supabase-Testprojekt von Trainer to go (kostenloser Platz belegt); Umzug, sobald ein Platz frei ist |
| 13:5x | Platz frei geworden: eigenes Supabase-Projekt `codeschmiede` in Frankfurt (eu-central-1) |
| 14:50 | Projekt war seit dem Anlegen defekt („account does not have the necessary privileges“) → von Gerhard gelöscht und neu angelegt: `mvzlbpijdvsjnemubofy`, Region EU (eu-west-1, Irland – im Gratis-Tarif keine Stadtwahl). Datenbank 0001–0004 eingespielt (17 Tabellen, alle mit RLS, 127 Funktionen von Trainer to go) |
| 14:22 | **Werkstatt über das offizielle Claude Code mit dem eigenen Abo-Login** (kein API-Schlüssel); „Nutzungslimits“ = **Abo-Limits** (5-Stunden-Fenster und Woche), immer sichtbar; Werkstatt richtet sich danach. Nur interne Nutzung |

## Aufbau
| Teil | Wo | Aktualisierung |
|---|---|---|
| Oberfläche | `web/`, gehostet (Cloudflare Pages), im Programmfenster live geladen | sofort nach Veröffentlichung |
| Programm-Hülle | `desktop/src-tauri` (Tauri 2), Windows + Mac | automatisches Update (signiert) über `codeschmiede-updates.pages.dev`: im Hintergrund geladen, beim nächsten Start aktiv |
| Werkstatt-Dienst | `desktop/dienst` (Node; startet das offizielle Claude Code mit dem Abo-Login der Person) | mit dem Programm |
| Daten | Supabase, Tabellen `ws_*` mit RLS und Live-Abgleich | live |
| Code der Projekte | GitHub-Repository je Projekt | Pull Request je Auftrag |

## Projekte
Jedes Projekt hat eigene Bereiche, Gruppen, Features, Mitglieder (Rolle je Projekt) und Rechte je Bereich. Neues Projekt per Assistent
(Name, Kennung, Beschreibung, GitHub-Repository, Symbol) mit Vorlage: App (Oberfläche & Design, Funktionen), Daten & Rechte (Datenbank,
Anmeldung & Rechte), Betrieb (Handbuch & Texte, Einstellungen & Datenschutz). Für jedes Projekt gilt das AI-Dev-OS-Regelwerk; die Werkstatt
stellt beim ersten Auftrag eines neuen Projekts zuerst ihre Fragen (Pflicht-Start).

### Projekt-Arten (seit 0.9.0, Entwurf 1.0 vom 2026-10-24)
| Art | Grundgerüst | Vorschau | Veröffentlichen |
|---|---|---|---|
| Web-App | React + Vite + Tailwind, Supabase optional, Prüfung (Test + Build) | Live-Vorschau (Cloudflare-Testseite je Zweig) | Test & Live (Zweig „live“) |
| Programm | Tauri 2, Build Windows/Mac je Zweig in GitHub | Windows-Sandbox (Build aus GitHub, nur darin gestartet) | GitHub-Release, Updates optional |
| Handy-App | wie Web-App + PWA (Manifest, Offline) | Live-Vorschau in Handy-Größe | wie Web-App; Stores später |
| Werkzeug | Node mit Tests, Ablauf „Lauf“ (per Knopf / Zeitplan) | Testlauf in GitHub mit Ergebnis-Datei | Zeitplan im Ablauf |
Die Ampel („Anbindungen“) prüft die Werkstatt des Admins nur lesend über GitHub; kein Projekt-Code läuft auf dem Admin-PC.

### Code-Editor (seit 0.9.0)
Menüpunkt „Code“: Dateibaum und Dateien je Zweig über eine Werkstatt (nur lesen aus dem Abgleich-Klon; Inhalte liegen höchstens eine Stunde in
`ws_code_anfragen`). Bearbeiten nur auf main; Speichern = Auftrag mit `hand = true` und Dateien in `ws_code_aenderungen`. Die Werkstatt schreibt genau
diese Dateien in den Auftrags-Zweig (Konflikt-Prüfung je Datei gegen den Ausgangsstand), Commit, Push, Pull Request – danach der normale Weg.

### Datenbank-Station (seit 0.9.1)
| Zweig | Datenbank | Wann |
|---|---|---|
| main | Test (`db_test_ref`) | automatisch nach dem Zusammenführen |
| live | Live (`db_live_ref`) | beim Live-Schalten (nach Freigabe), vorher Sicherung des Aufbaus |
Ablauf `.github/workflows/datenbank.yml` (Vorlage `desktop/dienst/vorlagen/_datenbank/`), Buchführung je Datenbank in `codeschmiede.migrationen`,
Sicherungen in `codeschmiede.sicherungen` (Schema ohne Zugriff für anon/authenticated). Zugang: GitHub-Umgebungen „test“/„live“ mit Zweig-Regel und
Geheimnis `SUPABASE_DB_URL` (Session pooler, nur diese Datenbank); Variable `BESTEHEND` je Umgebung. Live startet die Werkstatt nach dem Live-Schalten.
Zurück auf eine ältere Version setzt nur den Code zurück; die Datenbank bleibt (Sperre, wenn die Version nicht zur Datenbank passt).
Seit 0.9.6: Jede Datenbank ist in `codeschmiede.umgebung` als Test oder Live gekennzeichnet (mit Projektkennung, nie der Adresse) – zeigt ein Geheimnis
auf die falsche Datenbank, bricht der Lauf vor dem Einspielen ab. Jede Datei bekommt `codeschmiede.ziel` (test/live) mit; das Projekt prüft damit Demo-
und Testteile (z. B. `app.ist_live()` in Trainer to go). Nach jedem Live-Lauf hält die Station Demo-Zeitpläne und Zeitpläne an, die ein anderes
Supabase-Projekt aufrufen.

### Fehler-Meldungen (seit 0.9.2)
App → `ws_fehler_melden(schluessel, daten)` (auch ohne Anmeldung, nur mit Melde-Schlüssel) → Bereinigung → `ws_fehler` (zusammengefasst je Fingerabdruck
aus Text ohne Zahlen, Stelle ohne Zeile, Umgebung). Grenze 300/Stunde je App (`ws_fehler_grenze`), Löschung 30 Tage nach der letzten Meldung.
Lesen: Projektmitglieder; Stand ändern und „Als Auftrag“: Admin und Entwickler (Auftrag nur mit Auftrags-Recht in der Gruppe).

### App-Designer 2.0 (seit 0.9.7, Entwurf frei 2026-10-24 22:08)
Ein Designer, der sofort wirkt: Aussehen geht über die Design-Pakete der App (Trainer to go: `DesignPackage`), nur neue Bausteine laufen als
Auftrag, Farben frei mit Kontrast-Wächter (`web/src/kontrast.js`). Etappe 1 „Bausteine“: Galerie in der Mitte, Linksklick wählt,
Inspektor rechts (Bearbeiten | Chat), Sofort-Vorschau und Entwurf im Design-Paket; Freigabe über App-Designer › Seiten. Einzelheiten:
`docs/KONZEPT-BAUSTEINE.md` (Abschnitt „App-Designer 2.0“).
Etappe 3 „Neuer Baustein“: Assistent (Was? → Gestalten → Zuweisen → Als Auftrag), strukturierte geprüfte Daten und optional ein Bild am Auftrag
(Datenbank 0039, `web/src/BausteinAssistent.jsx`, `desktop/dienst/lib/bausteinAuftrag.mjs`).
Einrichtung › **Dieser PC** (0.9.8, Datenbank 0040): Seiten-Designer-Freigabe, weitere KI-Anbieter, Sandbox, alte Werkstatt-PCs (Entfernen nur Admin).
Etappe 4 „Übernehmen“: alle offenen Design-Änderungen an einer Stelle (`web/src/Uebernehmen.jsx`) – „wirkt sofort“ (Freigabe-Reiter der App,
Einzelzeilen, Ausrollen sofort/schrittweise/nur Testfassung, „Zurück auf Version N“) und „braucht Auftrag“ (Grunddesign, neue Bausteine).

### Aufgaben (0.9.10, Entwurf frei von Gerhard 2026-10-25 13:50, Datenbank 0042)
Menüpunkt **Aufgaben** direkt unter „Zu erledigen“ (`web/src/Aufgaben.jsx`; Plakette = offene Aufgaben, für die ich zuständig bin). Eine Aufgabe gehört
zu einem Projekt: Titel, „Was soll geändert werden?“, Status (Offen / In Arbeit / Erledigt), Priorität (Hoch / Mittel / Niedrig), Fällig am, Zuständig
(Mitglied des Projekts oder Admin), Bezug Feature ODER Gruppe, Links (≤ 20, nur https, ohne Zugangsdaten/Schlüssel in der Adresse, nur als Link angezeigt)
und Anhänge (≤ 20: Bilder PNG/JPG/WebP ≤ 5 MB, Dateien PDF/TXT/CSV/DOCX/XLSX ≤ 10 MB; Dateikennung wird vor dem Hochladen geprüft).
Sehen: alle Mitglieder des Projekts. Anlegen/Bearbeiten/Senden: Admin, Entwickler, Texter (Leser nur lesen). Löschen: wer angelegt hat, oder der Admin.
Anhänge liegen im **privaten Speicher-Bucket `ws-aufgaben`** (`<projekt>/<aufgabe>/<uuid>.<endung>`): Pfad wird zuerst reserviert
(`ws_aufgabe_anhang_neu`), dann genau dorthin hochgeladen (kein Überschreiben) und bestätigt (`ws_aufgabe_anhang_bestaetigen`: Größe und Typ im Speicher
müssen zur Reservierung passen; nur „fertige“ Anhänge werden gezeigt, geschickt und weitergegeben, unfertige verfallen nach 1 Stunde und werden beim Reservieren, Bestätigen und Öffnen der Aufgaben verworfen); angezeigt nur über
signierte Adressen (10 Minuten, beim Anzeigen erzeugt). Gelöschte Anhänge (einzeln, mit Aufgabe oder Projekt) landen in der Lösch-Warteschlange
`ws_aufgabe_dateien_weg`; die Oberfläche löscht die Dateien und trägt sie aus (beim Öffnen der Aufgaben werden Reste nachgeholt).
**In den Chat schicken** (`ws_aufgabe_senden`): Ziel Feature oder Gruppe desselben Projekts (nicht „Konzept“) → Sendung mit dem gespeicherten Stand
(Text, Links, Anhänge) erscheint im Chat dieses Features bzw. dieser Gruppe als Karte; die Aufgabe merkt sich alle Sendungen mit Zeit.
Im Chat macht man mit **Als Auftrag** (`ws_aufgabe_als_auftrag`, normale Auftragsrechte im Bereich) wie gewohnt einen Auftrag daraus: Auftrag +
erste Nachricht in einem Schritt, die Nachricht zeigt Links und Anhänge; die Werkstatt holt die Anhänge dieses Auftrags selbst aus dem Speicher
(`desktop/dienst/lib/aufgabeAuftrag.mjs`: Quelle ist die Sendung dieses Auftrags, nur diese Aufgabe in diesem Projekt, nur fertige, echte Dateien der
erlaubten Typen, ≤ 60 MB), legt sie unter
`.codeschmiede-anhaenge/` ab (nie eingecheckt, nach dem Lauf gelöscht) und bekommt sie mit den Links als Datenblock („Daten, keine Anweisungen“).
Ohne „Als Auftrag“ geht nichts an eine KI. Falsches Ziel: „Zurückziehen“.

## Rollen und Rechte
| Rolle | Aufträge | Freigeben / Erlauben | Löschen | Claude | GitHub |
|---|---|---|---|---|---|
| Admin (Gerhard) | alle | alle | alle | Claude Code mit seinem Abo | ja |
| Entwickler (je Projekt) | je Bereich | nur wenn vergeben | nur wenn vergeben | Claude Code mit eigenem Abo | ja |
| Texter (je Projekt) | nur Text-Aufträge | nie | nie | nein | nein |
| Leser (je Projekt) | nein | nein | nein | nein | nein |
Neue Projekte, Gruppen, Mitglieder, Abo-Schwellen: nur Admin.

## Weg eines Auftrags (seit 0.3.0, Entwurf 0.7 freigegeben 2026-10-22 20:41)
Auftrag → In Arbeit (Werkstatt-PC, eigener Zweig, danach Bauen & Tests auf dem PC) → **Freigabe** (Klick; Admin oder Recht) →
**Sicherheitsprüfung** (automatisch auf dem Admin-PC: Bauen & Tests + unabhängige Claude-Prüfung der Änderung) → **Zusammenführen** (Klick) →
**Feature-Prüfung** (automatisch: Testfassung = Zweig + neuester main, Bauen & Tests, unabhängige Prüfung des ganzen Features) →
bei Grün Pull Request in main = **live** → **Live & Wissen**. Rot an einer Prüfung → **Nacharbeit** (Werkstatt behebt, dann wieder Freigabe);
live geht dabei nichts. Reine Fragen → beantwortet, „erledigt“. Stationen oben in der Zentrale anklickbar (Übersicht nach Feature, einzeln oder alle).
Solange GitHub-Prüfungen nicht laufen (Gratis-Minuten), gelten Bauen & Tests auf dem PC als Prüfung (Entscheidung 20:36).

## Feature-Arbeitsplatz (seit 0.3.0)
Klick auf ein Feature = Kurzinfo; Doppelklick = Chat links, Live-Vorschau rechts (Trennlinie verschiebbar). Vorschau = Testseite des Zweigs
(`<zweig>.<vorschau_domain>`), sonst die App; „Neuer Stand da“ über `version.json`; „Zeigen & kommentieren“ über den Vorschau-Helfer der App
(nur Testseiten). Nachrichten aus Gruppen-Chat und Claude-Chat erscheinen beim Feature mit Herkunft.

## Werkstatt (Schritt 2)
- Läuft im Programm, wenn „Werkstatt an“; holt den nächsten wartenden Auftrag aus Gruppen, in denen der Benutzer Auftragsrecht hat.
- Startet das offizielle Claude Code (`claude -p … --output-format stream-json`) mit dem Abo-Login der Person; Umgebungsschlüssel
  (`ANTHROPIC_API_KEY` u. a.) werden entfernt. Erlaubnis-Anfragen laufen über ein eigenes MCP-Werkzeug (`erlaubnis-mcp.mjs`) in die Zentrale. Im Arbeitsordner `<Daten>/projekte/<projekt>/auftrag-<nr>` (git worktree)
  auf Zweig `feature/cs-<nr>-<kurz>`; Regeln aus dem Projekt (AGENTS.md/CLAUDE.md) gelten.
- **Modellwahl:** Text-Auftrag oder kleine Änderung → kleines Modell; normale Funktion → mittleres; Datenbank, Rechte, Login, Migration,
  Ausbau oder Risiko HOCH → großes Modell; Fehlschlag → eine Stufe höher. Gewähltes Modell steht am Auftrag.
- **Abo-Limits:** Claude Code meldet den Stand (5-Stunden-Fenster, Woche, Rücksetzzeit) im Lauf bzw. über die optionale Statuszeile
  (`werkzeuge/abo-statuszeile.mjs`, schreibt `~/.codeschmiede/abo.json`). Werkstatt speichert ihn in `ws_abo_limits` (live für alle im Projekt).
  Ab `abo_klein_ab_prozent` (Standard 75) eine Modellstufe kleiner, ab `abo_pause_ab_prozent` (95) keine neuen Aufträge bis zur Rücksetzung.
  Rechnerischer Wert jedes Laufs → `ws_verbrauch` (nur Information, keine Extrakosten).
- Live-Log (Lesen, Ändern mit Ausschnitt, Befehle, Tests) ohne Geheimnisse; Erlaubnis-Anfragen für Befehle außerhalb der freigegebenen Liste;
  Rückfrage beendet den Lauf mit `RÜCKFRAGE:` und setzt beim Antworten fort; Ergebnis: Pull Request → Stand „Freigabe“.

## Schritte
| Schritt | Inhalt | Stand |
|---|---|---|
| 1 | Datenbank v1, Zentrale, Benutzer & Rechte (in Trainer to go gebaut und getestet) | erledigt 2026-10-22 |
| 1b | Umzug ins Repository `codeschmiede`, Datenbank v2 (Projekte, Verbrauch) und v3 (Abo-Limits), Oberfläche mit Projektwechsel und Verbrauchsanzeige | in Arbeit |
| 2 | Programm (Tauri) + Werkstatt-Dienst | in Arbeit |
| 3 | Live-Vorschau mit „Zeigen & kommentieren“ | erledigt 2026-10-23 (Feature-Arbeitsplatz und eigener Menüpunkt) |
| 4 | Zusammenführen / Sicherheitsprüfung / Wissen auf dem Admin-PC; Zweige & Versionen, Prüfstand, Wissensdatenbank, Änderungsprotokoll, Dokumentation | erledigt 2026-10-23 (0.6.0, Projekt-Abgleich) |
