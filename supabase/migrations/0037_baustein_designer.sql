-- Codeschmiede · Datenbank 0037: App-Designer 2.0, Etappe 1 „Bausteine“ (Entwurf 1.0, freigegeben von Gerhard 2026-10-24 22:08).
-- Das Aussehen der Bausteine liegt im Design-Paket der App (Trainer to go: DesignPackage) – die Codeschmiede speichert es NICHT.
-- Hier nur: Der Design-Chat darf zum gewählten Baustein dessen Werte als Kontext mitschicken und die KI darf NUR diese Werte
-- vorschlagen. Schema streng (gleich wie web/src/bausteinKatalog.js, desktop/dienst/lib/design.mjs, Trainer to go src/lib/design/bausteine.js):
--   bausteine: { "<id>": { hell: {bg,text,rand}, dunkel: {bg,text,rand}, ecken 0–32, groesse klein|mittel|gross, symbol Lucide-Name } }
-- Keine Personendaten, keine neuen Rechte. Mehrfach ausführbar. Reihenfolge 0001 → … → 0037.

begin;

create or replace function public.ws_bausteine_ok(p jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare id text; w jsonb; k text; x jsonb; m text; f jsonb;
  ids constant text[] := array['knopf-haupt','knopf-neben','knopf-umriss','knopf-leise','knopf-gefahr','knopf-symbol','eingabe','schalter','abzeichen-haupt','abzeichen-neben','abzeichen-umriss','abzeichen-gefahr','status-zugesagt','status-offen','karte','kachel-kennzahl','tabelle','liste','symbol-kachel','datei'];
begin
  if p is null or jsonb_typeof(p) <> 'object' or (select count(*) from jsonb_object_keys(p)) > 30 then return false; end if;
  for id, w in select * from jsonb_each(p) loop
    if not (id = any(ids)) or jsonb_typeof(w) <> 'object' then return false; end if;
    for k, x in select * from jsonb_each(w) loop
      if k in ('hell', 'dunkel') then
        if jsonb_typeof(x) <> 'object' then return false; end if;
        if exists (select 1 from jsonb_each(x) e where e.key not in ('bg', 'text', 'rand') or jsonb_typeof(e.value) <> 'string'
                     or (e.value #>> '{}') !~ '^#[0-9a-fA-F]{6}$') then return false; end if;
      elsif k = 'ecken' then
        if jsonb_typeof(x) <> 'number' or (x)::numeric not between 0 and 32 then return false; end if;
      elsif k = 'groesse' then
        if jsonb_typeof(x) <> 'string' or (x #>> '{}') not in ('klein', 'mittel', 'gross') then return false; end if;
      elsif k = 'symbol' then
        if jsonb_typeof(x) <> 'string' or (x #>> '{}') !~ '^[A-Z][A-Za-z0-9]{1,40}$' then return false; end if;
      else
        return false;
      end if;
    end loop;
  end loop;
  return true;
end $$;
revoke execute on function public.ws_bausteine_ok(jsonb) from public, anon;
grant execute on function public.ws_bausteine_ok(jsonb) to authenticated;

-- Werte-Prüfung (Stand 0022) um den Schlüssel „bausteine“ ergänzt – sonst unverändert
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
    else
      return false;
    end if;
  end loop;
  return true;
end $$;

commit;
