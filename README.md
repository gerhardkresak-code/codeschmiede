# Codeschmiede

Programmierumgebung für alle Apps von Gerhard Kresak – ein Programm für Windows und Mac.

- **Auftrags-Zentrale:** Projekte › Bereiche › Gruppen › Features; Aufträge geben, Rückfragen beantworten, live mitsehen, Erlaubnisse bestätigen.
- **Werkstatt:** arbeitet Aufträge mit Claude ab (API-Schlüssel, Modell nach Aufwand), immer auf eigenem Zweig mit Pull Request.
- **Weg eines Auftrags:** Auftrag → In Arbeit → Freigabe → Zusammenführen → Sicherheitsprüfung → Wissen & veröffentlicht.
- **Verbrauch:** Kosten je Projekt und gesamt, live gegen das Monatslimit.

| Ordner | Inhalt |
|---|---|
| `web/` | Oberfläche (React, Vite, Tailwind) – wird live ins Programm geladen |
| `desktop/` | Programm-Hülle (Tauri 2, Windows + Mac) und Werkstatt-Dienst (`desktop/dienst/`, Node + Claude Agent SDK) |
| `supabase/` | Datenbank (`migrations/`) und Rechte-Tests (`tests/`) |
| `tools/` | Hilfsskripte (z. B. Funktionsverzeichnis → Features) |
| `docs/` | Konzept, Änderungsprotokoll, Entscheidungen, Datenschutz |

Regeln für alle, die hier arbeiten: `AGENTS.md`.
