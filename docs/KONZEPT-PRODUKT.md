# Konzept · Codeschmiede als Produkt + Einrichtungs-Assistent

Stand 2026-10-22 22:50 · Entscheidungen Gerhard 22:26–22:31 · **Entwurf, noch nicht freigegeben**

## 1. Ziel
Die Codeschmiede wird verkauft. Ein Käufer installiert sie auf seinem Windows-PC oder Mac
und kann danach eigene Apps damit bauen, so wie Gerhard mit Trainer to go.

## 2. Entscheidungen (Gerhard, 22.10.2026)
| Frage | Entscheidung |
|---|---|
| Für wen ist die Anleitung? | Für den Käufer, der die Codeschmiede kauft und installiert |
| Form | Assistent im Programm, der jeden Schritt selbst prüft (grün/rot) und den Knopf „Erneut prüfen“ hat |
| Wann | Beim ersten Start automatisch, danach jederzeit unter Einstellungen › „Einrichtung prüfen“ |
| Überwachung | Ja, als Ampel in der Statusleiste. Bei Rot springt ein Klick direkt zum passenden Schritt |
| Betrieb | **Der Käufer betreibt alles selbst**: eigene Codeschmiede-Datenbank, eigenes GitHub und eigenes Cloudflare. Gerhard hat keinen Zugriff |
| Claude-Anbindung | Wahl zwischen Abo und API-Schlüssel (siehe 4) |
| Rechner | Windows (auch ARM) und Mac |

## 3. Schritte des Assistenten (Entwurf)
Jeder Schritt hat dieselbe Form:
- Erklärung in zwei Sätzen
- ein Knopf, der die richtige Seite öffnet
- eine automatische Prüfung
- die Lösung bei Rot

Geheimnisse wie Passwörter oder Schlüssel tippt der Käufer nur auf der Seite des Anbieters oder in den sicheren Speicher des Betriebssystems, nie in einen Chat.

| # | Schritt | Automatische Prüfung |
|---|---|---|
| 1 | Willkommen: wofür die Codeschmiede da ist und was du brauchst (Konten, etwa 30 Minuten) | – |
| 2 | **Claude:** Abo oder API-Schlüssel wählen. Claude Code installieren und anmelden bzw. den Schlüssel in den sicheren Speicher legen | `claude --version`, angemeldet bzw. Testanfrage mit dem Schlüssel; Limits sichtbar |
| 3 | **GitHub:** Konto anlegen bzw. anmelden, GitHub CLI installieren, `gh auth login` | `gh auth status`, Recht zum Anlegen von Repositories |
| 4 | **Supabase (Codeschmiede-Datenbank):** Projekt in der EU anlegen. Der Assistent spielt die Datenbank ein, alternativ führt er Schritt für Schritt durch den SQL-Editor | Tabellen vorhanden, RLS an, Version der Datenbank stimmt |
| 5 | **Cloudflare:** Konto anlegen und Pages-Projekt für die Web-Oberfläche und die Updates einrichten | Seite erreichbar, `version.json` lesbar |
| 6 | **Erstes Konto und Admin:** Käufer meldet sich an und wird Admin seiner Codeschmiede | Rolle Admin gesetzt |
| 7 | **Werkstatt einschalten:** dieser PC wird Werkstatt (und Admin-PC) | Dienst läuft, Herzschlag in der Datenbank |
| 8 | **Erstes Projekt koppeln (optional):** Repository, Supabase der App und Cloudflare-Testseiten | Testseite eines Zweigs erreichbar, Vorschau-Helfer antwortet |
| 9 | **Probeauftrag:** kleiner Auftrag „Begrüßungstext ändern“ läuft einmal durch alle Stationen | Station „Live & Wissen“ erreicht |

**Ampel in der Statusleiste:** zeigt den Stand von Claude (inklusive Limits), GitHub, Datenbank, Cloudflare und Updates. Ein Klick auf eine rote Lampe öffnet den passenden Schritt.

## 4. Claude: Abo oder API-Schlüssel – rechtlicher Hinweis
- Anthropic hat im Februar 2026 klargestellt: Die Anmeldung mit Free-, Pro- oder Max-Abo ist nur in Claude Code und claude.ai erlaubt. **Fremde Produkte** müssen einen API-Schlüssel aus der Claude Console verwenden; das betrifft auch Programme, die auf dem Agent SDK aufbauen. Es ist Fremden nicht erlaubt, eine Anmeldung mit claude.ai anzubieten.
- Die Werkstatt startet das **offizielle Claude Code** des Käufers mit seiner eigenen Anmeldung. Für Gerhards eigene Nutzung ist das seine persönliche Nutzung von Claude Code.
- Beim **Verkauf** ist es eine Grauzone, ob ein gekauftes Programm, das Claude Code automatisch steuert, ein Abo nutzen darf. **Vorschlag:**
  - Der API-Schlüssel ist der Standard und wird empfohlen.
  - Das Abo bleibt als Wahl, mit Hinweis auf die Bedingungen von Anthropic.
  - Vor dem ersten Verkauf klären wir das mit Anthropic oder einer Rechtsberatung.
  - Ich bin kein Rechtsberater.
- Für den API-Schlüssel braucht es: sicheren Speicher (Windows-Anmeldeinformationen bzw. macOS-Schlüsselbund), Kostenanzeige statt Abo-Limits und Kostengrenzen pro Tag und Monat.

## 5. Was sich dadurch ändert (Folgearbeiten)
1. **Keine festen Adressen:**
   - Heute stehen `codeschmiede.pages.dev`, die Supabase-Adresse und der Update-Schlüssel fest im Programm.
   - Künftig kommen die Adressen aus der Einrichtung.
   - Die Updates des Programms kommen weiter von Gerhard: ein Update-Server für alle Käufer, signiert.
2. **Updates auch der Datenbank:** Eine neue Version bringt ihre Datenbank-Änderungen mit. Der Assistent spielt sie ein bzw. führt durch.
3. **Mac-Fassung:** Tauri baut für macOS. Für den Mac braucht es eine Apple-Signatur (Apple-Entwicklerkonto, kostenpflichtig, Gerhard).
4. **Lizenz:** Freischaltung per Lizenzschlüssel (Abo-Modell). Offen ist, ob die Prüfung online über einen Lizenzserver von Gerhard läuft oder offline.
5. **Ohne Gerhards Regeln:**
   - Gerhards Regelwerk `ai-dev-os` ist privat.
   - Käufer bekommen ein Grund-Regelwerk, das sie im Regelwerk-Editor anpassen.
6. **Datenschutz:** Da der Käufer alles selbst betreibt, verarbeitet Gerhard keine Daten des Käufers, und es braucht kein AVV. Die Datenschutz-Hinweise des Programms werden angepasst; die Lizenzprüfung ist datensparsam.
7. **Handbuch und PDF:** eine Einrichtungs-Anleitung zum Herunterladen, gleicher Inhalt wie der Assistent.

## 6. Offene Fragen (vor dem Entwurf des Assistenten)
- Preis- und Lizenzmodell: monatlich, jährlich, pro PC oder pro Benutzer?
- Lizenzprüfung online oder offline?
- Grund-Regelwerk für Käufer: welche von Gerhards Regeln sollen mit?
- Apple-Entwicklerkonto für die Mac-Signatur: ja oder nein?

Quellen:
- [Anthropic officially bans using subscription authentication for third-party Claude use (AlternativeTo, Feb. 2026)](https://alternativeto.net/news/2026/2/anthropic-officially-bans-using-subscription-authentication-for-third-party-claude-use)
- [Anthropic Bans Claude Subscription OAuth in Third-Party Apps (WinBuzzer)](https://winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn/)
