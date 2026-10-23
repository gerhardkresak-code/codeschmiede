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
alter table public.ws_ki_kopplung add column if not exists schritt_zeit timestamptz;   -- wann der letzte Schritt gemeldet wurde (Anzeige „hängt“)

-- Ändert der Admin einen eigenen Anbieter, verfallen offene „Hinzufügen“-Aufträge dafür (Prüfung R1; die Zulassung verfällt schon über 0018)
create or replace function public.ws_ki_anbieter_geaendert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.fp is distinct from old.fp or new.programm is distinct from old.programm then
    update public.ws_ki_kopplung set aktion = null, schritt = case when schritt is null or schritt = 'fertig' then schritt else 'fehler' end,
           einricht_code = null, hinweis = case when schritt is null or schritt = 'fertig' then hinweis else 'Der Anbieter wurde geändert – bitte nochmal „Hinzufügen“.' end
     where anbieter = new.id and (aktion is not null or schritt in ('wartet','installieren','anmelden','bestaetigen','pruefen'));
  end if;
  return new;
end $$;
drop trigger if exists ws_ki_anbieter_geaendert on public.ws_ki_anbieter;
create trigger ws_ki_anbieter_geaendert after update on public.ws_ki_anbieter for each row execute function public.ws_ki_anbieter_geaendert();
revoke execute on function public.ws_ki_anbieter_geaendert() from public, anon, authenticated;

commit;
