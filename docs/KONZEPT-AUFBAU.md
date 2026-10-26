# Aufbau wie in der App (Codeschmiede 0.9.12)

**Anweisung Gerhard 25.10.2026 23:31/23:33:** „Mannschaft und Kader ist die Gruppe und alles darin ein Feature. Mit Verein, Sport usw. als Obergruppe.
Wenn man da was tauscht, per Drag & Drop, eine neue Obergruppe hinzufügt und etwas hineinschiebt, kommt das als Änderung in die App. Exakt gleicher
Stand. Die ERP muss auch rein.“ Freigabe: „Du hast jede Freigabe … mach alles fertig und schalte es auch gleich live.“

## Modell
| Codeschmiede | App (Trainer to go) |
|---|---|
| Obergruppe (`ws_bereiche`, `app_teil` = `app` / `erp`) | Menübereich (Sport, Verein … bzw. ERP: Übersicht, Vertrieb …) |
| Gruppe (`ws_gruppen`, `app_key`) | Menüpunkt (`src/lib/navigation.js` bzw. `src/pages/PlatformAdmin.jsx`) |
| Feature (`ws_features`, `reihenfolge`) | Inhalt des Menüpunkts (Reiter, Unterseiten, Funktionen) |

Quelle in der App: `src/lib/appStruktur.js` (Obergruppen, Menüpunkte, Bezeichnungen – daraus entstehen App-Menü und ERP-Menü) und
`src/lib/appStruktur.features.json` (Features je Menüpunkt). Prüfung `tools/struktur_pruefen.mjs` läuft im Cloud-Bau.
Außerdem: Obergruppe **Website** (öffentliche Website), **Sonstiges** (Altlasten, Programmierumgebung) und **Global** (App-weit,
App-Designer, Datenbank-Station). Gruppen ohne Menüpunkt in App/ERP sind als **geplant** markiert und gehen nicht in die App.

## Ändern
Nur der Admin, direkt in der Zentrale:
- **Feature** auf eine Gruppe ziehen → Feature wechselt den Menüpunkt (im Code umziehen).
- **Gruppe** auf eine Obergruppe ziehen (ans Ende) oder vor eine andere Gruppe (Reihenfolge).
- **Obergruppe** auf eine andere ziehen = Reihenfolge; Stift = umbenennen; Papierkorb = leere Obergruppe entfernen.
- **Neue Obergruppe** (App oder ERP) unten in der Liste; Gruppe umbenennen über den Stift im Kopf der Gruppe.
- **Gruppe löschen** (0.9.14, Anweisung Gerhard 26.10.2026 08:07, „Ohne Menüpunkt und leer“): Papierkorb im Kopf der Gruppe. Möglich nur bei
  geplanten/ungenutzten Gruppen **ohne Menüpunkt** in der App, **ohne Features** (auch ausgebaute) und **ohne Aufträge**; nicht bei globalen Gruppen und
  nicht bei Gruppen, die das Projekt verwendet (Konzept, Designer, Datenbank). Sonst ist der Knopf grau und nennt den Grund. Features zuerst verschieben;
  Menüpunkte der App entfernt nur ein Ausbau-Auftrag. Datenbank: `ws_gruppe_loeschen` (0048, nur Admin, protokolliert „gruppe_weg“).

Jede Änderung protokolliert die Datenbank (`ws_aufbau_aenderungen`, Trigger `ws_aufbau_log`). Oben erscheint **„Aufbau geändert“** mit der Liste;
**„In die App übernehmen“** legt einen Auftrag (Gruppe „App-weit“) mit der neuen Fassung beider Dateien und den Änderungen an und hängt die
Änderungen daran (`ws_aufbau_uebergeben`). Der Auftrag läuft wie jeder andere: Freigabe → Prüfungen → Zusammenführen (Testfassung) → Live.

## Datenbank 0044
`supabase/migrations/0044_aufbau_wie_app.sql`: Spalten `ws_bereiche.app_teil/symbol`, `ws_gruppen.app_key`, `ws_features.reihenfolge`,
`ws_projekte.aufbau_datei`; legt den exakten Stand an (App 8 Obergruppen/32 Menüpunkte, ERP 7/40, 276 Features, Nummern F-001… bleiben,
neue ab F-200; Aufträge bleiben an ihren Gruppen). Funktionen `ws_gruppe_einordnen`, `ws_bereich_anlegen/_aendern/_entfernen`,
`ws_gruppe_umbenennen`, `ws_aufbau_uebergeben` (alle nur Admin).
