# Konzept · Features aus dem Gespräch anlegen und Bezüge zwischen Features

Stand 2026-10-22 22:50 · Entscheidungen Gerhard 22:31 · **Entwurf, noch nicht freigegeben**

## Beispiel (Gerhard)
1. Gerhard legt die Gruppe „Turnier & Liga“ an, und wir chatten.
2. Gerhard schreibt: „Es soll möglich sein, Turniere anzulegen.“ Claude fragt: „Feature ‚Turniere‘ anlegen? Ja/Nein“.
3. Gerhard schreibt: „Liga brauche ich auch.“ Claude fragt: „Feature ‚Liga‘ anlegen? Ja/Nein“.
4. Gerhard schreibt bei Turniere: „So wie es im Feature Liga gemacht wurde.“ Claude nimmt Liga als Referenz, prüft es und sagt vorher, was er übernimmt.

## Stand heute (ehrlich)
- **Vorhanden:** Claude ordnet einen Auftrag einem *bestehenden* Feature zu (`FEATURE: F-12`). Er liest den ganzen Code des Projekts.
- **Fehlt:** Claude erkennt neue Features im Gespräch nicht, fragt nicht nach dem Anlegen und kann keinen festen Bezug „wie Liga“ herstellen. Wird Liga später geändert, folgt daraus nichts.

## Entscheidungen
| Frage | Entscheidung |
|---|---|
| Wer legt Features an? | **Beide.** Gerhard legt sie selbst an. Claude legt sie aus dem Gespräch heraus an, aber nur nach einer Ja/Nein-Frage und nur bei Ja. Beide Arten lassen sich wieder löschen |
| Wie wird verwiesen? | **@Liga** setzt einen festen Bezug. Schreibt man nur „wie bei Liga“, fragt Claude: „Meinst du F-14 Liga als Referenz?“ |
| Wenn sich die Referenz ändert | Claude stellt am abhängigen Feature (Turniere) die Rückfrage: „Liga wurde geändert – nachziehen?“ |
| Projektübergreifend? | **Nein.** Bezüge nur innerhalb desselben Projekts |

## Ablauf (Entwurf)
1. **Erkennen:**
   - Die Werkstatt schreibt im Ergebnis eine Zeile `FEATURE-NEU: <Name> | <Kurzbeschreibung>`.
   - Daraus entsteht im Chat eine Karte „Feature ‚Turniere‘ in Gruppe ‚Turnier & Liga‘ anlegen?“ mit Ja und Nein.
   - Bei Ja wird das Feature in der Datenbank angelegt, mit Herkunft „aus Gespräch“, und als Auftrag ins Funktionsverzeichnis (`FEATURE-REGISTRY.md`) übernommen.
2. **Bezug setzen:**
   - `@` öffnet eine Auswahl der Features im selben Projekt.
   - Die Werkstatt schreibt `REFERENZ-FRAGE: F-14`, und daraus entsteht eine Ja/Nein-Karte.
   - Ein bestätigter Bezug wird gespeichert (Tabelle `ws_feature_bezuege`: von, zu, Art „Vorlage“, wer, wann).
3. **Mit Referenz bauen:**
   - Die Werkstatt bekommt gezielt mit: Code-Stellen, Entscheidungen, beantwortete Rückfragen und den letzten Live-Stand des Referenz-Features.
   - Vor dem Bauen meldet Claude: „Übernehme aus Liga: … · Anders bei Turniere: … · Passt das?“
4. **Nachziehen:**
   - Geht eine Änderung an Liga live, stellt Claude an Turniere die Rückfrage „Liga wurde geändert (Auftrag #…): nachziehen?“.
   - Bei Ja entsteht ein Auftrag für Turniere.
5. **Löschen:**
   - Ein Feature ohne laufende Aufträge lässt sich löschen.
   - Hat es Aufträge oder ist es live, wird es nur ausgeblendet; endgültig löscht nur der Admin.
   - Bezüge darauf werden aufgelöst, mit Hinweis am abhängigen Feature.

## Sicherheit und Rechte
- Nur Personen mit dem Recht „Aufträge“ in der Gruppe dürfen Features anlegen bzw. mit Ja bestätigen.
- Die Werkstatt schlägt nur vor; anlegen kann sie nie selbst.
- Bezüge nur im selben Projekt; die Datenbank prüft das.

## Darstellung
- Am Feature steht „Referenz: Liga“ als Chip. Bei Liga steht „Vorlage für: Turniere“.
- Die Kurzinfo zeigt beide Richtungen.
