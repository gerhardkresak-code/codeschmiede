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
- **2026-10-23 21:57 – Logo, KI-Wahl, Einrichtung (Entwurf 1.0 frei):** Bestehende Logos einlesen (KI baut als feste Formen nach) und überall ändern;
  überall den eingestellten KI-Anbieter anzeigen; Programmieren: Claude fest, ChatGPT (Codex) nur als Ersatz bei vollem Limit (Regel „nie ein anderer“ von Gerhard
  bewusst gelockert, Prüfungen bleiben Claude); Konten legt die Person selbst an – die Codeschmiede öffnet Registrierung und Anmeldung.
- **2026-10-23 – KI-Anbieter per Klick (Entwurf 1.0 frei):** „Hinzufügen“ installiert (fester Katalog im Programm, nie Befehle aus der
  Datenbank), öffnet die offizielle Anmeldung (Browser oder Fenster) und koppelt automatisch. Keine Zugangsdaten in der Codeschmiede.
- **2026-10-23 – Zu erledigen & Live (Entwurf 1.0 frei):** Zentrale Liste „Zu erledigen“ mit Knöpfen; erst Test (main), dann Live
  (Zweig `live`) per Knopf; Live schalten und Zurücksetzen nur der Admin, Zurück nur auf Versionen, die zur Datenbank passen;
  unabhängige Prüfung per Knopf für Feature, Gruppe oder ganze App (nur lesend, Werkstatt des Admins).
- **2026-10-23 18:56 – Designer nach App-Art (Entwurf 1.0 frei):** Vorschau-Muster und Designer-Einstellungen richten sich nach der App-Art
  des Projekts (Verwaltungs-App, Spiel, Webseite, Shop/Buchung); Beispieltexte kommen aus dem Konzept. Nie Trainer-to-go-Muster für andere Projekte.
- **2026-10-23 18:38 – GitHub-Repository beim Anlegen:** Neue Projekte bekommen auf Wunsch sofort ein Repository unter `gerhardkresak-code`
  (öffentlich, per Klick privat) mit Grundgerüst aus `gerhardkresak-code/ai-dev-os/project-template`; angelegt nur von der Werkstatt des Admins.
  Ohne Repository laufen Konzept, App-Designer und Chat; Bau-Aufträge warten.
- **2026-10-23 18:06 – Konzept zuerst (Entwurf 1.0 frei):** Jedes Projekt hat als erste Gruppe im Bereich App „Konzept“. Dort wird das
  Grundkonzept besprochen, bevor gebaut wird; bestätigte Entscheidungen stehen in `ws_wissen` (Wissensdatenbank) und gelten für alle
  Chats, den Design-Chat und jeden Bau-Auftrag. Es gibt keine Chat-Spalte rechts mehr; Chats: Konzept, Feature-Arbeitsplatz, Design-Chat.
- **2026-10-23 17:49 – Design zuerst:** Der App-Designer ist ab dem ersten Tag eines Projekts nutzbar – auch ohne Code, Features oder App-Adresse –
  und hat immer den Chat. Bei Projekten ohne Design führt Claude durch die Planung (erst Fragen, dann komplettes Grunddesign zur Übernahme).
- **2026-10-23 17:30 – Logo der Codeschmiede:** Ab jetzt immer das Zeichen „Glühendes C“ (Quellen `marke/zeichen.svg`, `marke/zeichen-klein.svg`,
  `marke/logo-hell.svg`, `marke/logo-dunkel.svg`; in der Oberfläche `web/src/Zeichen.jsx`). Der frühere Hammer wird nicht mehr als Logo verwendet.
  Programm-Symbol, Favicon, App-Symbole und Update-Seite kommen aus diesen Dateien; bei Änderungen alle zusammen erneuern.
- **2026-10-22 16:25 – Automatische Updates:** Jede neue Version des Programms wird automatisch eingespielt (im Hintergrund laden,
  beim nächsten Start aktiv, Knopf „Jetzt neu starten“, nie mitten in einem Auftrag). Jede Programmänderung in `main` erhöht die Version
  in `desktop/src-tauri/tauri.conf.json`, `Cargo.toml` und `desktop/dienst/package.json`; der Ablauf „Programm bauen“ veröffentlicht sie signiert.
- **2026-10-22 20:39 – Weg bis live:** Freigabe → Sicherheitsprüfung → Zusammenführen → Prüfung des ganzen Features in einer Testfassung → erst dann live.
  Rot an einer Prüfung = Nacharbeit, nichts geht live.
- **2026-10-22 16:45 – Alles landet beim Feature:** Was Gerhard im Gruppen-Chat oder im Claude-Chat zu einem Feature sagt, erscheint beim Feature
  in der Codeschmiede (Herkunft „aus Gruppe“ / „aus Claude-Chat“). Claude trägt Anweisungen aus dem Claude-Chat als Nachricht
  (`kanal = 'claude-chat'`) beim passenden Auftrag bzw. als neuen Auftrag ein und meldet dort, was gebaut wurde.
- **2026-10-22 22:38 – Nur für Gerhard selbst:** Die Codeschmiede wird vorerst nur von Gerhard genutzt. Verkauf, Mandanten, Lizenz und
  Käufer-Einrichtung werden **nicht** gebaut (Idee für später: `docs/KONZEPT-PRODUKT.md`).
- **2026-10-22 22:31 – Features aus dem Gespräch und Bezüge:** Features legt Gerhard selbst oder Claude aus dem Gespräch an, Claude
  immer erst nach Ja/Nein. Beide lassen sich löschen. `@Feature` (oder erkannt + Rückfrage) setzt eine Referenz im selben Projekt. Ändert
  sich die Referenz, fragt Claude, ob nachgezogen werden soll. Konzept: `docs/KONZEPT-FEATURE-BEZUEGE.md`.
- **2026-10-22 22:40 – Dauerhafte PR-Freigabe:** „Ich gebe alle PR somit frei“ gilt dauerhaft (Gerhard 22:40). Claude führt Pull Requests
  zusammen, sobald alle Prüfungen grün sind; rote Prüfungen, offene Befunde der unabhängigen Prüfung oder Datenbank-Änderungen, die Gerhard
  noch einspielen muss, halten den PR an. Entwürfe brauchen weiter Gerhards Freigabe vor dem Bau.
- **2026-10-23 10:20 – Globale Einstellungen, Werkstatt an, Chats am Ende:** Unter dem App-Designer gibt es „Globale Einstellungen“:
  je Projekt ein Bereich „Global“ (Gruppe „Globale Einstellungen“), aufgebaut wie alle Gruppen, in der App aber nie als eigener Bereich
  sichtbar – die Features dort gelten für die ganze App und alle Nutzer (z. B. Anmeldung). Rechte wie jeder Bereich. Die Werkstatt
  ist bei jedem Programmstart automatisch an (Ausschalten gilt bis zum nächsten Start). Chats starten immer beim letzten Eintrag.
- **2026-10-23 10:26 – Features selbst zuordnen:** Gerhard ordnet Features in der Codeschmiede selbst zu und verschiebt sie (Dialog oder
  Ziehen & Ablegen), auch in die Globalen Einstellungen. Aufträge und Verlauf bleiben beim Feature.
- **2026-10-23 10:34 – Erlaubnisse automatisch:** Harmlose Werkstatt-Befehle (lesen, Git am eigenen Zweig, Pull Request öffnen, Dateien im
  Arbeitsordner ändern) werden automatisch erlaubt; Gefährliches ist immer gesperrt (in main zusammenführen, Push auf main/fremde Zweige,
  Löschen/Erzwingen, Anmeldedaten, Releases, Code ausführen auf dem Admin-PC). Gefragt wird nur bei Unklarem. Regeln: `desktop/dienst/lib/einstufung.mjs`.
- **2026-10-23 10:34 – Tabellen & Icons gestalten:** In der Baustein-Bibliothek mehrere Tabellen-Varianten (Aussehen, Spalten-Arten,
  Handy-Darstellung, Werkzeugleiste) und ein Icon-Stil für die ganze App. Die Standard-Variante übernimmt die Codeschmiede automatisch;
  Zuweisung je Tabelle über eine Liste im Designer. Beim Anlegen neuer Bausteine/Tabellen hilft Claude im Chat.
- **2026-10-23 10:45 – Überall Chat mit Claude:** In der ganzen Codeschmiede (Designer, Bausteine, Marke, Regelwerk, Einstellungen …)
  kann Gerhard jederzeit mit Claude sprechen.
- **2026-10-23 14:11 – Alles fertig machen:** Keine Platzhalter mehr in der Codeschmiede; offene Menüpunkte werden gebaut (0.6.0).
- **2026-10-23 14:14–15:00 – KI-Anbieter (Entwurf 1.2 freigegeben):** Beliebig viele KI-Anbieter (Claude, ChatGPT, Gemini …) mit dem
  eigenen Abo. Klären, Ausloten und Konzepte laufen über die eingestellten Anbieter (Vorschlag ChatGPT; **solange der Admin nichts
  speichert, nur Claude**). Unabhängige Prüfungen durch fremde Anbieter (Entscheidung 14:27) sind **vorerst gesperrt** und nur Claude,
  bis fremde Programme in einer Betriebssystem-Sandbox laufen (unabhängige Prüfung 2026-10-23: sonst Lesezugriff auf den PC).
  **Bauen und Programmieren macht nur Claude – nie ein anderer Anbieter** (14:27). Je Aufgabe Anbieter **und Modell** in Reihenfolge frei
  wählbar (14:49); der nächste übernimmt bei vollem Limit oder ohne Kopplung. Zuständigkeiten stellt **nur der Admin** ein (14:59).
  Im Chat sieht man nicht, wer antwortet; vermerkt wird es im Protokoll. Freigegebene Konzepte (Konzept-Karte) gehen als Auftrag an Claude
  und werden als `docs/konzepte/<datum>-<feature>.md` mit dem Bau-PR abgelegt. Andere Anbieter laufen in einem leeren Ordner mit
  minimaler Umgebung und bekommen Doku und Dateiliste als Text; **Restrisiko:** ihre eingebauten Werkzeuge könnten technisch Dateien des
  PCs lesen – Antworten mit verdächtigem Inhalt werden verworfen. Code: `desktop/dienst/lib/ki.mjs`, Datenbank 0012, Seite „KI-Anbieter“.
- **2026-10-23 15:34 – Projekte löschen:** Angelegte Projekte kann der Admin archivieren (umkehrbar) oder endgültig löschen (nur Daten in der
  Codeschmiede, Bestätigung mit dem Projektnamen; GitHub-Repository und App bleiben).
- **2026-10-23 15:53 – Alles fertig machen (Punkt 1–6):** Sandbox für fremde KI-Programme (Prüfen durch ChatGPT/Gemini nur mit Sandbox,
  Claude bleibt Rückfall), Einrichtungs-Assistent, Baustein-Bibliothek, Marke mit Projektlogos, Regelwerk-Editor, Feature-Bezüge.
  Regel für die Werkstatt: neue Bausteine nur über die Bibliothek (`docs/BAUSTEINE.md`, `node tools/bausteine.mjs`), nur Grundwerte nutzen.
- **2026-10-23 16:22 – Beliebige KI-Anbieter:** Weitere Anbieter (z. B. GitHub Copilot) legt der Admin an; sie stehen in den Zuständigkeiten
  zur Auswahl (nie Bauen, nicht Prüfen). Jede Person lässt sie auf ihrem PC selbst zu. Jeder PC erscheint nur einmal.
