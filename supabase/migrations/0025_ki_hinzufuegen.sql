-- Codeschmiede · Datenbank v25: KI-Anbieter per Klick hinzufügen (Entwurf 1.0, freigegeben von Gerhard 2026-10-23 „Entwurf 1.0 frei“)
-- „Hinzufügen“ setzt aktion = 'einrichten' auf der eigenen Kopplungszeile; die eigene Werkstatt installiert (fester Katalog im Programm,
-- nie ein Befehl aus der Datenbank), startet die offizielle Anmeldung und meldet den Fortschritt in schritt/hinweis/einricht_code.
-- 'bestaetigt' = die Person hat sich im Fenster angemeldet (Anbieter, deren Anmeldung sich nicht von außen prüfen lässt).
-- Mehrfach ausführbar. Reihenfolge 0001 → … → 0025.
begin;

alter table public.ws_ki_kopplung drop constraint if exists ws_ki_kopplung_aktion_check;
alter table public.ws_ki_kopplung add constraint ws_ki_kopplung_aktion_check check (aktion in ('pruefen','anmelden','einrichten','bestaetigt'));
alter table public.ws_ki_kopplung add column if not exists schritt text
  check (schritt in ('wartet','installieren','anmelden','bestaetigen','pruefen','fertig','fehler'));
alter table public.ws_ki_kopplung add column if not exists einricht_code text check (einricht_code is null or einricht_code ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$');
alter table public.ws_ki_kopplung add column if not exists eingerichtet timestamptz;

commit;
