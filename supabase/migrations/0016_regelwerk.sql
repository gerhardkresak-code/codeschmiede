-- Codeschmiede · Datenbank v16: Regelwerk-Editor (Entwurf „Regelwerk“ 2026-10-22, „fertig machen“ Gerhard 2026-10-23 15:53)
-- Der Abgleich nimmt zusätzlich CLAUDE.md auf, damit alle Regeldateien des Projekts im Regelwerk lesbar sind.
-- Geändert wird eine Regel nur über einen Auftrag (Freigabe → Prüfungen → live). Mehrfach ausführbar. Reihenfolge 0001 → … → 0016.
begin;
alter table public.ws_dokumente drop constraint if exists ws_dokumente_pfad_check;
alter table public.ws_dokumente add constraint ws_dokumente_pfad_check
  check (pfad ~ '^(docs/[A-Za-z0-9._/-]+\.md|AGENTS\.md|CLAUDE\.md|README\.md)$' and pfad !~ '\.\.');
commit;
