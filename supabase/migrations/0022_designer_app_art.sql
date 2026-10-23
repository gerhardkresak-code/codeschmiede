-- Codeschmiede · Datenbank v22: App-Designer nach App-Art (Entwurf 1.0, freigegeben von Gerhard 2026-10-23 18:56).
-- „Das Design sollte mit anderen Beispielen dargestellt werden … wenn Spiele programmiert werden, sind es andere Sachen für den Designer.
-- Jetzt werden auch bei neuen Projekten die Designerbeispiele von Trainer to go verwendet.“ Antworten 18:44: nach App-Art + aus dem Konzept,
-- alle vier Arten (Verwaltungs-App, Spiel, Webseite, Shop/Buchung), eigene Spiel-Bausteine.
--   ws_projekte.app_art     verwaltung | spiel | webseite | shop  (Trainer to go und bestehende Projekte: verwaltung)
--   Design-Werte            neue Schlüssel spiel / webseite / shop (feste Auswahlwerte) und beispiele (nur kurze Texte für die Vorschau)
--   Beispiele               kommen aus dem Design-Chat („aus dem Konzept anpassen“) und werden mit dem Entwurf gespeichert; nur Vorschau,
--                           gelangen nie in CSS (Text wird nur als Text angezeigt)
-- Mehrfach ausführbar. Reihenfolge 0001 → … → 0022.
begin;

alter table public.ws_projekte add column if not exists app_art text not null default 'verwaltung' check (app_art in ('verwaltung','spiel','webseite','shop'));

-- Kurze Beispieltexte: nur Zeichenketten ohne spitze/geschweifte Klammern und Zeilenumbrüche, begrenzte Anzahl und Länge
create or replace function public.ws_bsp_text_ok(v jsonb, n int) returns boolean
language sql immutable set search_path = public as $$
  select jsonb_typeof(v) = 'string' and char_length(v #>> '{}') between 1 and n and btrim(v #>> '{}') <> '' and (v #>> '{}') !~ '[<>{}\\`]' and (v #>> '{}') !~ E'[\\n\\r]'
$$;
create or replace function public.ws_bsp_liste_ok(v jsonb, anzahl int, n int) returns boolean
language sql immutable set search_path = public as $$
  select jsonb_typeof(v) = 'array' and jsonb_array_length(v) between 1 and anzahl
     and not exists (select 1 from jsonb_array_elements(v) x where not public.ws_bsp_text_ok(x, n))
$$;
create or replace function public.ws_bsp_zeilen_ok(v jsonb, anzahl int, spalten int, n int) returns boolean
language sql immutable set search_path = public as $$
  select jsonb_typeof(v) = 'array' and jsonb_array_length(v) between 1 and anzahl
     and not exists (select 1 from jsonb_array_elements(v) x where jsonb_typeof(x) <> 'array' or jsonb_array_length(x) not between 1 and spalten
                     or exists (select 1 from jsonb_array_elements(x) y where not public.ws_bsp_text_ok(y, n)))
$$;
create or replace function public.ws_beispiele_ok(v jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare k text; x jsonb;
begin
  if v is null or jsonb_typeof(v) <> 'object' or pg_column_size(v) > 8192 then return false; end if;
  for k, x in select * from jsonb_each(v) loop
    if k in ('titel','knopf','liste') then if not public.ws_bsp_text_ok(x, 40) then return false; end if;
    elsif k = 'menue' then if not public.ws_bsp_liste_ok(x, 7, 24) then return false; end if;
    elsif k = 'kacheln' then if not public.ws_bsp_zeilen_ok(x, 4, 2, 24) then return false; end if;
    elsif k = 'zeilen' then if not public.ws_bsp_zeilen_ok(x, 5, 4, 40) then return false; end if;
    elsif k = 'spiel' then
      if jsonb_typeof(x) <> 'object' or exists (select 1 from jsonb_each(x) e where not (
           (e.key in ('titel','punkte','leben') and public.ws_bsp_text_ok(e.value, 30)) or (e.key = 'knoepfe' and public.ws_bsp_liste_ok(e.value, 4, 14)))) then return false; end if;
    elsif k = 'webseite' then
      if jsonb_typeof(x) <> 'object' or exists (select 1 from jsonb_each(x) e where not (
           (e.key in ('name','held','cta') and public.ws_bsp_text_ok(e.value, 60)) or (e.key = 'text' and public.ws_bsp_text_ok(e.value, 200))
        or (e.key = 'teile' and public.ws_bsp_liste_ok(e.value, 4, 24)))) then return false; end if;
    elsif k = 'shop' then
      if jsonb_typeof(x) <> 'object' or exists (select 1 from jsonb_each(x) e where not (
           (e.key in ('produkte','korb') and public.ws_bsp_zeilen_ok(e.value, 6, 2, 30)) or (e.key = 'kasse' and public.ws_bsp_text_ok(e.value, 24)))) then return false; end if;
    else return false; end if;
  end loop;
  return true;
end $$;

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
    elsif k = 'spiel' then
      if exists (select 1 from jsonb_each(v) e where not (
           (e.key in ('feld','figur') and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') ~ '^#[0-9a-fA-F]{6}$')
        or (e.key = 'figur_form' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('rund','kantig','pixel'))
        or (e.key = 'punkte' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('oben','aus'))
        or (e.key = 'knoepfe' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('gross','klein')))) then return false; end if;
    elsif k = 'webseite' then
      if exists (select 1 from jsonb_each(v) e where not (
           (e.key = 'start' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('gross','schlicht'))
        or (e.key = 'abschnitte' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('spalten','untereinander'))
        or (e.key = 'fuss' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('dunkel','hell')))) then return false; end if;
    elsif k = 'shop' then
      if exists (select 1 from jsonb_each(v) e where not (
           (e.key = 'karten' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('bild','liste'))
        or (e.key = 'korb' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('rechts','unten')))) then return false; end if;
    elsif k = 'beispiele' then
      if not public.ws_beispiele_ok(v) then return false; end if;
    else
      return false;
    end if;
  end loop;
  return true;
end $$;

-- App-Art festlegen: wer gestalten darf (wie im Designer)
create or replace function public.ws_projekt_app_art(p_projekt text, p_art text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_darf_design(p_projekt) then raise exception 'Die App-Art legt fest, wer gestalten darf (Admin oder Entwickler mit Design-Recht)'; end if;
  if p_art not in ('verwaltung','spiel','webseite','shop') then raise exception 'Unbekannte App-Art'; end if;
  update public.ws_projekte set app_art = p_art where id = p_projekt;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'app_art', jsonb_build_object('projekt', p_projekt, 'art', p_art));
end $$;
revoke execute on function public.ws_projekt_app_art(text, text) from public, anon;
grant execute on function public.ws_projekt_app_art(text, text) to authenticated;
-- Prüffunktionen laufen in den CHECK-Regeln mit den Rechten des Aufrufers – angemeldete Nutzer brauchen sie (Prüfung R1)
revoke execute on function public.ws_beispiele_ok(jsonb), public.ws_bsp_text_ok(jsonb, int), public.ws_bsp_liste_ok(jsonb, int, int), public.ws_bsp_zeilen_ok(jsonb, int, int, int) from public, anon;
grant execute on function public.ws_beispiele_ok(jsonb), public.ws_bsp_text_ok(jsonb, int), public.ws_bsp_liste_ok(jsonb, int, int), public.ws_bsp_zeilen_ok(jsonb, int, int, int) to authenticated;

commit;
