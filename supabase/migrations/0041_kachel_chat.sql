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
--   * ws_design_auftrag (Stand 0036) mit Mengengrenze: höchstens 10 Design-Aufträge je Person und Stunde – für ALLE Design-Aufträge zusammen (Kachel, Baustein, Assistent; alle bisherigen Prüfungen
--     unverändert; gilt auch für ws_design_auftrag_neu aus 0039, die diese Funktion aufruft). Befund M1 der Sicherheitsprüfung.
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

-- Mengengrenze für Design-Aufträge (Befund M1): Zählung über das vorhandene Protokoll „design_auftrag“
create index if not exists ws_protokoll_wer_was_wann on public.ws_protokoll (wer, was, wann);
create or replace function public.ws_design_auftrag(p_projekt text, p_art text, p_titel text, p_text text) returns bigint
language plpgsql security definer set search_path = public as $$
declare g text; a bigint; t text; x text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if p_art is null or p_art not in ('baustein','kachel') then raise exception 'Unbekannte Auftragsart'; end if;
  if not public.ws_darf_design(p_projekt) then raise exception 'Keine Berechtigung für das Design dieses Projekts'; end if;
  -- Mengengrenze (Sicherheitsprüfung Chat zur Kachel, 0041): höchstens 10 Design-Aufträge je Person und Stunde
  -- gleichzeitige Aufrufe derselben Person nacheinander zählen (sonst ließe sich die Grenze mit parallelen Aufrufen überlaufen)
  perform pg_advisory_xact_lock(hashtext('design_auftrag:' || auth.uid()::text));
  if (select count(*) from public.ws_protokoll where wer = auth.uid() and was = 'design_auftrag' and wann > now() - interval '1 hour') >= 10 then
    raise exception 'Höchstens 10 Design-Aufträge je Stunde – bitte später noch einmal'; end if;
  t := btrim(coalesce(p_titel, '')); x := btrim(coalesce(p_text, ''));
  if char_length(t) not between 2 and 80 then raise exception 'Name fehlt oder ist zu lang (höchstens 80 Zeichen)'; end if;
  if char_length(x) not between 10 and 8000 then raise exception 'Beschreibung fehlt oder ist zu lang (10 bis 8000 Zeichen)'; end if;
  -- Steuerzeichen (außer Zeilenumbruch und Tabulator) haben im Titel und Text nichts verloren
  -- dazu C1-Steuerzeichen, Richtungs- und unsichtbare Zeichen (Verschleierung, Prüfung 2026-10-24)
  if t ~ '[[:cntrl:]\u200b-\u200f\u202a-\u202e\u2028\u2029\u2066-\u2069\ufeff]'
     or x ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u200b-\u200f\u202a-\u202e\u2028\u2029\u2066-\u2069\ufeff]' then raise exception 'Ungültige Zeichen'; end if;
  select design_gruppe_id into g from public.ws_projekte where id = p_projekt and not coalesce(archiviert, false);
  if not found then raise exception 'Projekt nicht gefunden oder archiviert'; end if;
  if g is null then raise exception 'Der App-Designer ist für dieses Projekt noch nicht eingerichtet'; end if;
  t := left(case p_art when 'baustein' then 'Neuer Baustein: ' else 'Neue Kachel für den Seiten-Designer: ' end || t, 80);
  insert into public.ws_auftraege (gruppe_id, titel, art, erstellt_von) values (g, t, 'neu', auth.uid()) returning id into a;
  insert into public.ws_nachrichten (auftrag_id, von, art, text, kanal) values (a, auth.uid(), 'text', x, 'codeschmiede');
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'design_auftrag', jsonb_build_object('projekt', p_projekt, 'art', p_art, 'auftrag', a));
  return a;
end $$;

revoke execute on function public.ws_design_auftrag(text, text, text, text) from public, anon;
grant execute on function public.ws_design_auftrag(text, text, text, text) to authenticated;

commit;
