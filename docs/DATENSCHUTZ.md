# Datenschutz – Codeschmiede

| Verarbeitung | Daten | Rechtsgrundlage | Empfänger | Löschfrist |
|---|---|---|---|---|
| Mitglieder | Name, E-Mail (Anmeldung), Rolle je Projekt, Rechte | Art. 6 (1) b/f DSGVO | Supabase (EU, AVV) | sofort nach Entfernen |
| Aufträge, Nachrichten, Live-Log, Erlaubnisse | Text, Absender, Zeit, Programmcode-Ausschnitte | Art. 6 (1) f DSGVO | Supabase (EU, AVV) | 3 Jahre nach Abschluss |
| Werkstatt | Auftragstext, Programmcode | Art. 6 (1) f DSGVO | Anthropic (Claude Code mit dem Abo der Person; es gelten deren Abo-Bedingungen und Datenschutzeinstellungen), GitHub | bei Anthropic laut Abo-Bedingungen der Person |
| Abo-Limits | Prozent 5 Std./Woche, Rücksetzzeit je Mitglied | Art. 6 (1) f DSGVO | Supabase | bis Entfernen des Mitglieds |
| Verbrauch | rechnerischer Wert, Token, Modell je Lauf | Art. 6 (1) f DSGVO | Supabase | 3 Jahre |
| Protokoll | wer hat freigegeben, erlaubt, Rechte geändert | Art. 6 (1) f DSGVO | Supabase | 3 Jahre |
| Werkstatt-PCs · Dieser PC (seit 0.9.8, Datenbank 0040) | PC-Name, Person, an/aus, letztes Lebenszeichen; dazu feste Fähigkeitswerte (Plattform, Windows-/Betriebssystem-Sandbox ja/nein, Dienst-Version) – keine Pfade, keine Hardware-Kennungen. Stand der Design-Freigabe dieses PCs nur lokal im Programm (localStorage) | Art. 6 (1) f DSGVO | Supabase (EU, AVV); sichtbar für Mitglieder gemeinsamer Projekte | bis der Admin den PC entfernt (Protokoll `pc_entfernt` 3 Jahre) |
| App-Designer 2.0 · Neuer Baustein (seit 0.9.8, Datenbank 0039) | Name, Beschreibung, Gestaltungswerte, Zuweisung (Kennungen von Gruppen/Features) als Auftrag; optional EIN Bild (PNG/JPEG/WebP bis 2 MB) als Vorlage – Hinweis im Assistenten: keine Fotos von Personen, keine echten Namen | Art. 6 (1) f DSGVO | Supabase (EU, AVV); die Werkstatt legt das Bild nur im Arbeitsordner des Auftrags ab (nie eingecheckt) und gibt es Claude (Abo der Person) | Bild: in der Datenbank mit Abschluss des Auftrags (live, erledigt, abgebrochen), auf dem Werkstatt-PC direkt nach dem Lauf; Auftrag wie Aufträge |
| App-Designer 2.0 · Bausteine (seit 0.9.7) | Gestaltungswerte (Farben, Ecken, Größe, Symbolname) – gespeichert NICHT in der Codeschmiede, sondern im Design-Paket der App; in der Codeschmiede nur Fragen/Antworten des Design-Chats mit diesen Werten. Für „Gilt für“ zeigt der Inspektor Paket- und Vereinsnamen aus der eingebetteten App nur flüchtig an (nicht gespeichert, nie im Chat oder Log) | Art. 6 (1) f DSGVO | – (bleibt im Programmfenster) | mit dem Schließen des Fensters |

Keine Daten von Vereinsmitgliedern, Kunden oder Kindern. Keine Claude-Zugangsdaten in der Codeschmiede. Hinweis: Im Abo kann die Person in claude.ai einstellen, ob ihre Daten zum Training verwendet werden – für Programmcode empfohlen: aus.
