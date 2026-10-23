-- Codeschmiede · Datenbank v27: Symbole und Grundbausteine umdesignen (Entwurf 1.0, freigegeben von Gerhard 2026-10-23 22:38)
-- Rechtsklick in der Galerie der Testseite öffnet einen Entwurf: Symbol (anderes Lucide-Symbol oder eigenes im Lucide-Stil) bzw.
-- Grundbaustein (feste Einstellungen + Beschreibung). Die Zuweisungen (Stellen) sind vorausgefüllt und per Häkchen wählbar.
-- „Als Auftrag senden“ legt einen Auftrag in der Design-Gruppe an – Weg wie jeder Auftrag (Freigabe, Prüfungen, Test, Live).
-- Nur feste Werte (keine freien SVG-/CSS-Texte). Mehrfach ausführbar. Reihenfolge 0001 → … → 0027.
begin;

create or replace function public.ws_umdesign_werte_ok(p_art text, w jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare k text; v jsonb; e jsonb;
begin
  if w is null or jsonb_typeof(w) <> 'object' or pg_column_size(w) > 12000 then return false; end if;
  for k, v in select * from jsonb_each(w) loop
    if k = 'beschreibung' then
      if jsonb_typeof(v) <> 'string' or char_length(v #>> '{}') > 2000 then return false; end if;
    elsif k = 'neu' and p_art = 'symbol' then
      if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^[A-Z][A-Za-z0-9]{1,40}$' then return false; end if;
    elsif k = 'eigen' and p_art = 'symbol' then
      -- eigenes Symbol im Lucide-Stil: 24 × 24, nur Striche (Pfade, Kreise), Farbe = Textfarbe
      if jsonb_typeof(v) <> 'object' or exists (select 1 from jsonb_object_keys(v) x where x not in ('pfade','kreise','name')) then return false; end if;
      if v ? 'name' and (jsonb_typeof(v -> 'name') <> 'string' or (v ->> 'name') !~ '^[A-Z][A-Za-z0-9]{1,40}$') then return false; end if;
      if jsonb_typeof(coalesce(v -> 'pfade', '[]')) <> 'array' or jsonb_array_length(coalesce(v -> 'pfade', '[]')) > 20 then return false; end if;
      for e in select * from jsonb_array_elements(coalesce(v -> 'pfade', '[]')) loop
        if jsonb_typeof(e) <> 'string' or char_length(e #>> '{}') not between 1 and 1200 or (e #>> '{}') !~ '^[MmLlHhVvCcSsQqTtAaZz0-9 .,-]+$' then return false; end if;
      end loop;
      if jsonb_typeof(coalesce(v -> 'kreise', '[]')) <> 'array' or jsonb_array_length(coalesce(v -> 'kreise', '[]')) > 10 then return false; end if;
      for e in select * from jsonb_array_elements(coalesce(v -> 'kreise', '[]')) loop
        if jsonb_typeof(e) <> 'object' or exists (select 1 from jsonb_object_keys(e) x where x not in ('cx','cy','r'))
           or not public.ws_marke_zahl_ok(e -> 'cx', 0, 24) or not public.ws_marke_zahl_ok(e -> 'cy', 0, 24) or not public.ws_marke_zahl_ok(e -> 'r', 0, 12) then return false; end if;
      end loop;
      if jsonb_array_length(coalesce(v -> 'pfade', '[]')) + jsonb_array_length(coalesce(v -> 'kreise', '[]')) = 0 then return false; end if;
    elsif k = 'einstellungen' and p_art = 'baustein' then
      if jsonb_typeof(v) <> 'object' then return false; end if;
      if exists (select 1 from jsonb_each(v) x where not (
           (x.key in ('hintergrund','rand','text') and jsonb_typeof(x.value) = 'string' and (x.value #>> '{}') ~ '^#[0-9a-fA-F]{6}$')
        or (x.key = 'ecken' and (x.value #>> '{}') in ('rund','eckig','pille') and jsonb_typeof(x.value) = 'string')
        or (x.key = 'schrift' and (x.value #>> '{}') in ('normal','fett') and jsonb_typeof(x.value) = 'string')
        or (x.key = 'symbol' and jsonb_typeof(x.value) = 'string' and ((x.value #>> '{}') ~ '^[A-Z][A-Za-z0-9]{1,40}$' or (x.value #>> '{}') = 'keins'))
        or (x.key = 'variante' and jsonb_typeof(x.value) = 'string' and (x.value #>> '{}') ~ '^[a-z0-9-]{1,30}$'))) then return false; end if;
    else return false;
    end if;
  end loop;
  return true;
end $$;
create or replace function public.ws_umdesign_stellen_ok(s text[]) returns boolean
language sql immutable set search_path = public as $$
  select cardinality(s) between 1 and 800 and not exists (select 1 from unnest(s) x where x !~ '^src/[A-Za-z0-9_./ -]{1,200}\.(jsx|js|tsx|ts)$' or x ~ '\.\.')
$$;
revoke execute on function public.ws_umdesign_werte_ok(text, jsonb), public.ws_umdesign_stellen_ok(text[]) from public, anon;
grant execute on function public.ws_umdesign_werte_ok(text, jsonb), public.ws_umdesign_stellen_ok(text[]) to authenticated;

create table if not exists public.ws_umdesign (
  id bigserial primary key,
  projekt_id text not null references public.ws_projekte(id) on delete cascade,
  art text not null check (art in ('symbol','baustein')),
  ziel text not null check (ziel ~ '^[A-Za-z0-9-]{1,60}$'),            -- Symbolname (Lucide) bzw. Baustein-Kennung aus dem Verzeichnis
  werte jsonb not null default '{}' check (public.ws_umdesign_werte_ok(art, werte)),
  stellen text[] not null check (public.ws_umdesign_stellen_ok(stellen)),
  alle_stellen int not null default 0 check (alle_stellen between 0 and 5000),
  stand text not null default 'entwurf' check (stand in ('entwurf','gesendet','verworfen')),
  auftrag_id bigint references public.ws_auftraege(id) on delete set null,
  von uuid not null default auth.uid() references auth.users(id),
  erstellt timestamptz not null default now(),
  geaendert timestamptz not null default now()
);
create index if not exists ws_umdesign_projekt on public.ws_umdesign (projekt_id, ziel, id desc);
alter table public.ws_umdesign enable row level security;
drop policy if exists ws_umdesign_lesen on public.ws_umdesign;
create policy ws_umdesign_lesen on public.ws_umdesign for select to authenticated using (public.ws_darf_design(projekt_id));
revoke insert, update, delete on public.ws_umdesign from anon, authenticated;
grant select on public.ws_umdesign to authenticated;

-- Speichern (neu oder bestehenden Entwurf ändern) – wer gestalten darf
create or replace function public.ws_umdesign_speichern(p_id bigint, p_projekt text, p_art text, p_ziel text, p_werte jsonb, p_stellen text[], p_alle int) returns bigint
language plpgsql security definer set search_path = public as $$
declare neu bigint;
begin
  if not public.ws_darf_design(p_projekt) then raise exception 'Umdesignen dürfen Admin und Entwickler des Projekts'; end if;
  if not public.ws_umdesign_werte_ok(p_art, p_werte) then raise exception 'Ungültige Werte'; end if;
  if not public.ws_umdesign_stellen_ok(p_stellen) then raise exception 'Bitte mindestens eine Stelle anhaken (nur Dateien unter src/)'; end if;
  if p_id is null then
    if (select count(*) from public.ws_umdesign where projekt_id = p_projekt and stand = 'entwurf') >= 200 then raise exception 'Zu viele offene Entwürfe – bitte zuerst senden oder verwerfen'; end if;
    insert into public.ws_umdesign (projekt_id, art, ziel, werte, stellen, alle_stellen) values (p_projekt, p_art, p_ziel, p_werte, p_stellen, coalesce(p_alle, 0)) returning id into neu;
  else
    update public.ws_umdesign set werte = p_werte, stellen = p_stellen, alle_stellen = coalesce(p_alle, alle_stellen), geaendert = now()
     where id = p_id and projekt_id = p_projekt and art = p_art and ziel = p_ziel and stand = 'entwurf' returning id into neu;
    if neu is null then raise exception 'Entwurf nicht gefunden oder schon gesendet'; end if;
  end if;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'umdesign_gespeichert', jsonb_build_object('projekt', p_projekt, 'art', p_art, 'ziel', p_ziel, 'id', neu));
  return neu;
end $$;

-- Als Auftrag senden: Auftrag in der Design-Gruppe; der Text kommt aus der Oberfläche (sichtbar, änderbar), die Werte stehen geprüft daneben
create or replace function public.ws_umdesign_senden(p_id bigint, p_text text) returns bigint
language plpgsql security definer set search_path = public as $$
declare u public.ws_umdesign; g text; neu bigint;
begin
  select * into u from public.ws_umdesign where id = p_id for update;
  if u.id is null or u.stand <> 'entwurf' then raise exception 'Entwurf nicht gefunden oder schon gesendet'; end if;
  if not public.ws_darf_design(u.projekt_id) then raise exception 'Umdesignen dürfen Admin und Entwickler des Projekts'; end if;
  select design_gruppe_id into g from public.ws_projekte where id = u.projekt_id;
  if g is null then raise exception 'Das Projekt hat noch keine Design-Gruppe'; end if;
  if p_text is null or char_length(p_text) not between 10 and 7000 then raise exception 'Auftragstext fehlt oder ist zu lang'; end if;
  insert into public.ws_auftraege (gruppe_id, titel, art, erstellt_von)
    values (g, left(case u.art when 'symbol' then 'Symbol ' else 'Grundbaustein ' end || u.ziel || ' umdesignen (' || cardinality(u.stellen) || ' Stellen)', 80), 'aendern', auth.uid())
    returning id into neu;
  insert into public.ws_nachrichten (auftrag_id, von, art, text, kanal)
    values (neu, auth.uid(), 'text', p_text || chr(10) || chr(10) || 'Werte (JSON, geprüft): ' || u.werte::text || chr(10) || 'Stellen (' || cardinality(u.stellen) || ' von ' || u.alle_stellen || '):' || chr(10) || array_to_string(u.stellen, chr(10)), 'codeschmiede');
  update public.ws_umdesign set stand = 'gesendet', auftrag_id = neu, geaendert = now() where id = p_id;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'umdesign_gesendet', jsonb_build_object('id', p_id, 'auftrag', neu));
  return neu;
end $$;

create or replace function public.ws_umdesign_verwerfen(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.ws_umdesign set stand = 'verworfen', geaendert = now() where id = p_id and stand = 'entwurf' and public.ws_darf_design(projekt_id);
  if not found then raise exception 'Entwurf nicht gefunden oder schon gesendet'; end if;
end $$;

revoke execute on function public.ws_umdesign_speichern(bigint, text, text, text, jsonb, text[], int), public.ws_umdesign_senden(bigint, text), public.ws_umdesign_verwerfen(bigint) from public, anon;
grant execute on function public.ws_umdesign_speichern(bigint, text, text, text, jsonb, text[], int), public.ws_umdesign_senden(bigint, text), public.ws_umdesign_verwerfen(bigint) to authenticated;

commit;
