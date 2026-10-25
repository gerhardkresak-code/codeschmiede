-- Codeschmiede · Datenbank 0041: Seiten-Designer · „Chat zur Kachel“ (Entwurf freigegeben von Gerhard 2026-10-25 13:31).
-- Im Seiten-Designer der App (Trainer to go, /designer, eingebettet) bespricht man die gewählte Kachel mit der KI. Die App schickt
-- per postMessage NUR die Werte dieser Kachel; die Codeschmiede legt die Frage im bestehenden Design-Chat (ws_design_chat) an.
--   * ws_kachel_ok(p): strenges Schema für die Werte einer Kachel (gleich wie desktop/dienst/lib/kachelChat.mjs,
--     web/src/kachelChat.js und Trainer to go src/components/design/KachelChat.jsx):
--       { seite, geraet, block: kurze Kennungen · w/h 1–24 · variant kurz · auto boolean
--         · style: { flat, soft: boolean; farbe, farbe_dunkel: "#rrggbb" }
--         · props: { ziele: bis 24 Kennungen, anzahl 1–50, title ≤ 80, text ≤ 500 } } – sonst nichts.
--   * ws_design_werte_ok (Stand 0037) um den Schlüssel „kachel“ ergänzt – alle bisherigen Zweige unverändert.
--   * ws_design_chat.ki darf beim Fragen als WUNSCH mitgegeben werden (Format-Prüfung aus 0018). Die Werkstatt nutzt den Wunsch nur,
--     wenn der Anbieter in der Zuständigkeit „design“ des Projekts steht; sonst gilt die normale Reihe.
--   * ws_design_chat_nehmen liefert die ganze Zeile (setof ws_design_chat) – die Spalte ki ist damit schon dabei, keine Änderung nötig.
-- Keine Personendaten, keine neuen Rechte (Fragen weiter nur mit Design-Recht, Regel ws_design_chat_frage). Mehrfach ausführbar.
-- Reihenfolge 0001 → … → 0041.

begin;

create or replace function public.ws_kachel_ok(p jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare k text; x jsonb; n numeric;
begin
  if p is null or jsonb_typeof(p) <> 'object' or pg_column_size(p) > 8000 then return false; end if;
  for k, x in select * from jsonb_each(p) loop
    if k = 'seite' then
      if jsonb_typeof(x) <> 'string' or (x #>> '{}') !~ '^[a-z_]{2,30}$' then return false; end if;
    elsif k = 'geraet' then
      if jsonb_typeof(x) <> 'string' or (x #>> '{}') not in ('pc', 'tablet', 'handy') then return false; end if;
    elsif k = 'block' then
      if jsonb_typeof(x) <> 'string' or (x #>> '{}') !~ '^[a-z][a-z0-9_]{0,39}$' then return false; end if;
    elsif k in ('w', 'h') then
      if jsonb_typeof(x) <> 'number' then return false; end if;
      n := (x)::numeric;
      if n <> trunc(n) or n not between 1 and 24 then return false; end if;
    elsif k = 'variant' then
      if jsonb_typeof(x) <> 'string' or (x #>> '{}') !~ '^[a-z][a-z0-9_-]{0,29}$' then return false; end if;
    elsif k = 'auto' then
      if jsonb_typeof(x) <> 'boolean' then return false; end if;
    elsif k = 'style' then
      if jsonb_typeof(x) <> 'object' then return false; end if;
      if exists (select 1 from jsonb_each(x) s where not (
           (s.key in ('flat', 'soft') and jsonb_typeof(s.value) = 'boolean')
        or (s.key in ('farbe', 'farbe_dunkel') and jsonb_typeof(s.value) = 'string' and (s.value #>> '{}') ~ '^#[0-9a-fA-F]{6}$'))) then return false; end if;
    elsif k = 'props' then
      if jsonb_typeof(x) <> 'object' then return false; end if;
      if exists (select 1 from jsonb_object_keys(x) o where o not in ('ziele', 'anzahl', 'title', 'text')) then return false; end if;
      if x ? 'ziele' then
        if jsonb_typeof(x -> 'ziele') <> 'array' or jsonb_array_length(x -> 'ziele') > 24
           or exists (select 1 from jsonb_array_elements(x -> 'ziele') z where jsonb_typeof(z) <> 'string' or (z #>> '{}') !~ '^[a-z][a-z-]{1,30}$') then return false; end if;
      end if;
      if x ? 'anzahl' then
        if jsonb_typeof(x -> 'anzahl') <> 'number' then return false; end if;
        n := (x -> 'anzahl')::numeric;
        if n <> trunc(n) or n not between 1 and 50 then return false; end if;
      end if;
      if x ? 'title' and (jsonb_typeof(x -> 'title') <> 'string' or char_length(x ->> 'title') > 80) then return false; end if;
      if x ? 'text' and (jsonb_typeof(x -> 'text') <> 'string' or char_length(x ->> 'text') > 500) then return false; end if;
    else
      return false;
    end if;
  end loop;
  return true;
end $$;
revoke execute on function public.ws_kachel_ok(jsonb) from public, anon;
grant execute on function public.ws_kachel_ok(jsonb) to authenticated;

-- Werte-Prüfung (Stand 0037) um den Schlüssel „kachel“ ergänzt – sonst unverändert
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
    elsif k = 'bausteine' then
      -- App-Designer 2.0: Werte einzelner Bausteine (Kontext und Vorschlag im Baustein-Chat)
      if not public.ws_bausteine_ok(v) then return false; end if;
    elsif k = 'kachel' then
      -- Seiten-Designer · Chat zur Kachel (0041): Werte EINER Kachel (Kontext und Vorschlag), nur feste Felder
      if not public.ws_kachel_ok(v) then return false; end if;
    else
      return false;
    end if;
  end loop;
  return true;
end $$;

revoke execute on function public.ws_design_werte_ok(jsonb) from public, anon;
grant execute on function public.ws_design_werte_ok(jsonb) to authenticated;

-- KI-Wunsch beim Fragen (Format-Prüfung ws_design_chat_ki_check aus 0018 bleibt; Id, von, stand, frage_id weiter nicht vorgebbar)
grant insert (projekt_id, entwurf_id, text, werte, ki) on public.ws_design_chat to authenticated;

commit;
