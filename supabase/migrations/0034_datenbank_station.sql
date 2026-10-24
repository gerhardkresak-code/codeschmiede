-- Codeschmiede · Datenbank v34: Datenbank-Station (Gerhard 2026-10-24 14:36 „Test automatisch, Live nach Freigabe“, 15:49 „mach weiter“)
-- Je Projekt eine Test- und eine Live-Datenbank (Supabase-Projektkennung, keine Zugangsdaten). Der Ablauf „Datenbank“ im Projekt-Repository
-- spielt neue Datenbank-Dateien ein: main → Test (automatisch), live → Live (erst wenn die Codeschmiede nach Freigabe live schaltet),
-- vorher Sicherung des Aufbaus. Die Werkstatt des Admins richtet ihn ein (Variablen + Auftrag für die Ablauf-Datei) und meldet,
-- welche Datenbank-Dateien noch nicht live sind (Anzeige beim Live-Weg). Mehrfach ausführbar. Reihenfolge 0001 → … → 0034.
begin;

alter table public.ws_projekte add column if not exists db_test_ref text;
alter table public.ws_projekte add column if not exists db_live_ref text;
alter table public.ws_projekte add column if not exists db_test_bestehend boolean not null default true;
alter table public.ws_projekte add column if not exists db_live_bestehend boolean not null default false;
alter table public.ws_projekte add column if not exists db_gruppe_id text references public.ws_gruppen(id) on delete set null;
alter table public.ws_projekte add column if not exists db_offen jsonb not null default '[]'::jsonb;
alter table public.ws_projekte add column if not exists db_offen_zeit timestamptz;
alter table public.ws_projekte add column if not exists db_ablaeufe_geaendert boolean not null default false;   -- .github/workflows zwischen live und main geändert
alter table public.ws_projekte drop constraint if exists ws_projekte_db_ref_check;
alter table public.ws_projekte add constraint ws_projekte_db_ref_check check ((db_test_ref is null or db_test_ref ~ '^[a-z]{20}$') and (db_live_ref is null or db_live_ref ~ '^[a-z]{20}$')
  and (db_test_ref is null or db_live_ref is null or db_test_ref <> db_live_ref));

-- Offene Datenbank-Dateien: [{ datei, sql }] – höchstens 50, Datei-Name wie im Repository, SQL gekürzt auf 20 000 Zeichen
create or replace function public.ws_db_offen_ok(w jsonb) returns boolean
language sql immutable set search_path = public as $$
  select jsonb_typeof(w) = 'array' and jsonb_array_length(w) <= 50 and not exists (
    select 1 from jsonb_array_elements(w) e
     where jsonb_typeof(e) <> 'object'
        or exists (select 1 from jsonb_object_keys(e) k where k not in ('datei','sql'))
        or jsonb_typeof(e -> 'datei') is distinct from 'string' or (e ->> 'datei') !~ '^[A-Za-z0-9._-]{1,120}\.sql$'
        or jsonb_typeof(e -> 'sql') is distinct from 'string' or char_length(e ->> 'sql') > 20000)
$$;
revoke execute on function public.ws_db_offen_ok(jsonb) from public, anon;
grant execute on function public.ws_db_offen_ok(jsonb) to authenticated;
alter table public.ws_projekte drop constraint if exists ws_projekte_db_offen_check;
alter table public.ws_projekte add constraint ws_projekte_db_offen_check check (public.ws_db_offen_ok(db_offen));

-- Ampel: neuer Schlüssel „datenbank_live“
create or replace function public.ws_anbindungen_ok(w jsonb) returns boolean
language sql immutable set search_path = public as $$
  select jsonb_typeof(w) = 'object' and not exists (
    select 1 from jsonb_each(w) e
     where e.key not in ('github','pruefung','testseite','build','signatur','sandbox','datenbank','datenbank_live','testlauf','fehler')
        or jsonb_typeof(e.value) <> 'object'
        or exists (select 1 from jsonb_object_keys(e.value) k where k not in ('stand','text'))
        or coalesce(e.value ->> 'stand', '') not in ('gruen','gelb','rot','grau')
        or jsonb_typeof(e.value -> 'text') is distinct from 'string'
        or char_length(e.value ->> 'text') > 200)
$$;

-- Admin: Datenbanken eines Projekts eintragen
create or replace function public.ws_projekt_datenbank(p_projekt text, p_test text, p_live text, p_test_bestehend boolean, p_live_bestehend boolean, p_gruppe text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'Datenbanken trägt nur der Admin ein'; end if;
  if nullif(p_test, '') is null and nullif(p_live, '') is null then raise exception 'Mindestens eine Datenbank eintragen'; end if;
  if p_gruppe is not null and not exists (select 1 from public.ws_gruppen g join public.ws_bereiche b on b.id = g.bereich_id where g.id = p_gruppe and b.projekt_id = p_projekt) then
    raise exception 'Gruppe gehört nicht zu diesem Projekt';
  end if;
  update public.ws_projekte set db_test_ref = nullif(lower(trim(p_test)), ''), db_live_ref = nullif(lower(trim(p_live)), ''),
         db_test_bestehend = coalesce(p_test_bestehend, true), db_live_bestehend = coalesce(p_live_bestehend, false), db_gruppe_id = p_gruppe,
         datenbank = case when datenbank = 'keine' then 'eigen' else datenbank end
   where id = p_projekt and not coalesce(archiviert, false);
  if not found then raise exception 'Projekt nicht gefunden'; end if;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'projekt_datenbank',
    jsonb_build_object('projekt', p_projekt, 'test', p_test, 'live', p_live, 'test_bestehend', p_test_bestehend, 'live_bestehend', p_live_bestehend));
end $$;
revoke execute on function public.ws_projekt_datenbank(text, text, text, boolean, boolean, text) from public, anon;
grant execute on function public.ws_projekt_datenbank(text, text, text, boolean, boolean, text) to authenticated;

-- Werkstatt des Admins: offene (noch nicht live) Datenbank-Dateien melden
drop function if exists public.ws_db_offen_melden(uuid, text, jsonb);
create or replace function public.ws_db_offen_melden(p_pc uuid, p_projekt text, p_offen jsonb, p_ablaeufe boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'Nur die Werkstatt des Admins'; end if;
  if not exists (select 1 from public.ws_werkstatt_pcs w where w.id = p_pc and w.benutzer_id = auth.uid()) then raise exception 'Unbekannter Werkstatt-PC'; end if;
  if not public.ws_db_offen_ok(p_offen) then raise exception 'Ungültige Liste'; end if;
  update public.ws_projekte set db_offen = p_offen, db_offen_zeit = now(), db_ablaeufe_geaendert = coalesce(p_ablaeufe, false) where id = p_projekt;
  if not found then raise exception 'Projekt nicht gefunden'; end if;
end $$;
revoke execute on function public.ws_db_offen_melden(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.ws_db_offen_melden(uuid, text, jsonb, boolean) to authenticated;

-- Aktion „Datenbank-Station einrichten“
alter table public.ws_projekt_aktionen drop constraint if exists ws_projekt_aktionen_art_check;
alter table public.ws_projekt_aktionen add constraint ws_projekt_aktionen_art_check check (art in ('sandbox','testlauf','pruefen','db_einrichten'));

create or replace function public.ws_projekt_aktion_anfordern(p_projekt text, p_art text, p_zweig text default null, p_pc uuid default null, p_netz boolean default false) returns bigint
language plpgsql security definer set search_path = public as $$
declare p public.ws_projekte; n bigint;
begin
  if not public.ws_ist_admin() then raise exception 'Nur der Admin'; end if;
  if p_art not in ('sandbox','testlauf','pruefen','db_einrichten') then raise exception 'Unbekannte Aktion'; end if;
  select * into p from public.ws_projekte where id = p_projekt and not coalesce(archiviert, false);
  if p.id is null then raise exception 'Projekt nicht gefunden'; end if;
  if p_art = 'sandbox' and p.technik_art <> 'programm' then raise exception 'Die Sandbox gibt es nur für Programme'; end if;
  if p_art = 'testlauf' and p.technik_art <> 'werkzeug' then raise exception 'Testläufe gibt es nur für Werkzeuge'; end if;
  if p_art in ('sandbox','testlauf','db_einrichten') and p.repo is null then raise exception 'Das Projekt hat noch kein Repository'; end if;
  if p_art = 'db_einrichten' and p.db_test_ref is null and p.db_live_ref is null then raise exception 'Zuerst die Datenbanken eintragen'; end if;
  if p_art = 'sandbox' and (p_pc is null or not exists (select 1 from public.ws_werkstatt_pcs w where w.id = p_pc and w.benutzer_id = auth.uid())) then
    raise exception 'Für die Sandbox braucht es deinen Werkstatt-PC';
  end if;
  if exists (select 1 from public.ws_projekt_aktionen a where a.projekt_id = p_projekt and a.art = p_art and a.stand in ('angefragt','laeuft')
              and a.geaendert > now() - interval '15 minutes') then raise exception 'Läuft schon – bitte kurz warten'; end if;
  insert into public.ws_projekt_aktionen (projekt_id, art, zweig, ziel_pc, netz) values (p_projekt, p_art, nullif(p_zweig, ''), case when p_art = 'sandbox' then p_pc end, p_art = 'sandbox' and coalesce(p_netz, false))
  returning id into n;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'projekt_aktion', jsonb_build_object('projekt', p_projekt, 'art', p_art, 'zweig', p_zweig, 'netz', coalesce(p_netz, false)));
  return n;
end $$;

commit;
