-- Codeschmiede · Datenbank v17: Baustein-Bibliothek (Etappe 4) und Marke (Etappe 5) im App-Designer
-- (KONZEPT-BAUSTEINE.md, Entscheidungen 2026-10-22 22:33 und 2026-10-23 10:34, „fertig machen“ Gerhard 2026-10-23 15:53)
-- Neue Schlüssel in den Design-Werten (festes Schema, kein freier Text in CSS/SVG):
--   tabellen: standard + vier Varianten (dichte, streifen, rahmen, kopf, handy, suche) + zuweisung {storageKey: Variante}
--   icons:    strich (1.25–2.5), ecken (rund/eckig)
--   marke:    zeichen, farbe, farbe2, kuerzel, name, gewicht, sperrung, form – das Logo wird aus diesen Werten gezeichnet
-- Projektlogo: ws_projekte.logo (gleiche Marke-Werte), nur Admin. Mehrfach ausführbar. Reihenfolge 0001 → … → 0017.
begin;

create or replace function public.ws_marke_ok(v jsonb) returns boolean
language sql immutable set search_path = public as $$
  select jsonb_typeof(v) = 'object' and not exists (select 1 from jsonb_each(v) e where not (
       (e.key = 'zeichen' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('bild','schild','ball','monogramm','pfeil','glut'))
    or (e.key in ('farbe','farbe2') and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') ~ '^#[0-9a-fA-F]{6}$')
    or (e.key = 'kuerzel' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') ~ '^[A-Za-z0-9ÄÖÜäöü]{1,3}$')
    or (e.key = 'name' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') ~ '^[A-Za-z0-9ÄÖÜäöüß .&-]{1,40}$')
    or (e.key = 'gewicht' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric in (600, 700, 800))
    or (e.key = 'sperrung' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric between -2 and 8)
    or (e.key = 'form' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('rund','eckig'))))
$$;

create or replace function public.ws_tabelle_ok(v jsonb) returns boolean
language sql immutable set search_path = public as $$
  select jsonb_typeof(v) = 'object' and not exists (select 1 from jsonb_each(v) e where not (
       (e.key = 'dichte' and (e.value #>> '{}') in ('kompakt','normal','luftig') and jsonb_typeof(e.value) = 'string')
    or (e.key in ('streifen','suche') and jsonb_typeof(e.value) = 'boolean')
    or (e.key = 'rahmen' and (e.value #>> '{}') in ('karte','linien','keine') and jsonb_typeof(e.value) = 'string')
    or (e.key = 'kopf' and (e.value #>> '{}') in ('leise','akzent') and jsonb_typeof(e.value) = 'string')
    or (e.key = 'handy' and (e.value #>> '{}') in ('liste','tabelle') and jsonb_typeof(e.value) = 'string')))
$$;

create or replace function public.ws_design_werte_ok(p jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare k text; v jsonb; m text; f jsonb;
  farben constant text[] := array['primaer','primaer_text','hintergrund','flaeche','text','text_leise','rand','menue','menue_text','erfolg','warnung','fehler'];
  varianten constant text[] := array['klar','kompakt','streifen','luftig'];
begin
  if p is null or jsonb_typeof(p) <> 'object' then return false; end if;
  for k, v in select * from jsonb_each(p) loop
    if jsonb_typeof(v) <> 'object' then return false; end if;
    if k = 'farben' then
      for m, f in select * from jsonb_each(v) loop
        if m not in ('hell','dunkel') or jsonb_typeof(f) <> 'object' then return false; end if;
        if exists (select 1 from jsonb_each(f) e where not (e.key = any(farben)) or jsonb_typeof(e.value) <> 'string' or (e.value #>> '{}') !~ '^#[0-9a-fA-F]{6}$') then return false; end if;
      end loop;
    elsif k = 'schrift' then
      if exists (select 1 from jsonb_each(v) e where not (
           (e.key in ('ueberschrift','text') and (e.value #>> '{}') in ('Barlow Semi Condensed','Barlow','system-ui') and jsonb_typeof(e.value) = 'string')
        or (e.key = 'basis' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric between 12 and 20)
        or (e.key = 'gewicht' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric in (600, 700)))) then return false; end if;
    elsif k = 'form' then
      if exists (select 1 from jsonb_each(v) e where not (
           (e.key = 'radius' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric between 0 and 24)
        or (e.key = 'radius_karte' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric between 0 and 32)
        or (e.key = 'abstand' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric between 4 and 32)
        or (e.key = 'schatten' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('kein','leicht','deutlich')))) then return false; end if;
    elsif k = 'menue' then
      if exists (select 1 from jsonb_each(v) e where not (
           (e.key = 'position' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('links','oben'))
        or (e.key = 'aufklappbar' and jsonb_typeof(e.value) = 'boolean')
        or (e.key = 'breite' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric between 160 and 360)
        or (e.key = 'tablet' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('eingeklappt','offen','oben'))
        or (e.key = 'handy' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('unten','burger')))) then return false; end if;
    elsif k = 'logo' then
      if exists (select 1 from jsonb_each(v) e where not (
           (e.key = 'platz' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('menue-oben','kopf-links','kopf-mitte'))
        or (e.key = 'groesse' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric between 16 and 64))) then return false; end if;
    elsif k = 'tabellen' then
      for m, f in select * from jsonb_each(v) loop
        if m = 'standard' then
          if jsonb_typeof(f) <> 'string' or not ((f #>> '{}') = any(varianten)) then return false; end if;
        elsif m = 'zuweisung' then
          if jsonb_typeof(f) <> 'object' or (select count(*) from jsonb_object_keys(f)) > 200
             or exists (select 1 from jsonb_each(f) e where e.key !~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,60}$' or jsonb_typeof(e.value) <> 'string' or not ((e.value #>> '{}') = any(varianten))) then return false; end if;
        elsif m = any(varianten) then
          if not public.ws_tabelle_ok(f) then return false; end if;
        else return false; end if;
      end loop;
    elsif k = 'icons' then
      if exists (select 1 from jsonb_each(v) e where not (
           (e.key = 'strich' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric between 1.25 and 2.5)
        or (e.key = 'ecken' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('rund','eckig')))) then return false; end if;
    elsif k = 'marke' then
      if not public.ws_marke_ok(v) then return false; end if;
    else
      return false;
    end if;
  end loop;
  return true;
end $$;

-- Projektlogo (Projektliste der Codeschmiede): gleiche Marke-Werte, nur Admin
alter table public.ws_projekte add column if not exists logo jsonb;
alter table public.ws_projekte drop constraint if exists ws_projekte_logo_check;
alter table public.ws_projekte add constraint ws_projekte_logo_check check (logo is null or (pg_column_size(logo) < 4096 and public.ws_marke_ok(logo)));
create or replace function public.ws_projekt_logo(p_projekt text, p_logo jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'Projektlogos setzt nur der Admin'; end if;
  if p_logo is not null and not public.ws_marke_ok(p_logo) then raise exception 'Ungültiges Logo'; end if;
  update public.ws_projekte set logo = p_logo where id = p_projekt;
  if not found then raise exception 'Projekt nicht gefunden'; end if;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'projekt_logo', jsonb_build_object('projekt', p_projekt));
end $$;
revoke execute on function public.ws_projekt_logo(text, jsonb) from public, anon;
grant execute on function public.ws_projekt_logo(text, jsonb) to authenticated;

commit;
