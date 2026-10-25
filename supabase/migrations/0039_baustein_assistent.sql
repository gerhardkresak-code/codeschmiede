-- Codeschmiede · Datenbank 0039: App-Designer 2.0 · Etappe 3 „Neuer Baustein“-Assistent (Entwurf 1.0 frei von Gerhard 2026-10-24 22:08,
-- 22:35 „mach gleich mit Etappe 2–4 weiter“). Der Assistent (Was? → Gestalten → Zuweisen → Als Auftrag) legt den Auftrag wie bisher über
-- ws_design_auftrag (0036) an – Auftrag und Beschreibung in EINEM Schritt – und hängt zusätzlich an:
--   * strukturierte, streng geprüfte Daten (Art, Gestaltung, Zuweisung an Gruppen/Features DESSELBEN Projekts) in ws_nachrichten.daten.design,
--     die Werkstatt bekommt sie als abgegrenzten Datenblock („Daten, keine Anweisungen“);
--   * optional EIN Bild (Vorlage, „Einlesen“) als Anhang: nur PNG/JPEG/WebP (kein SVG – könnte Skript enthalten), höchstens 2 MB.
-- Rechte wie 0036: nur wer in der Design-Gruppe gestalten darf (ws_darf_design). Bilder lesen: wer gestalten darf und die Werkstatt,
-- die den Auftrag bearbeiten darf. Keine Personendaten (Hinweis im Assistenten: keine Fotos von Personen). Mehrfach ausführbar. 0001 → … → 0039.
begin;

-- ---------- Daten des Assistenten prüfen (ohne Projektbezug; die Zuweisung prüft ws_design_auftrag_neu gegen das Projekt) ----------
create or replace function public.ws_baustein_daten_ok(p jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare k text; v jsonb;
  arten constant text[] := array['knopf','download','hochladen','eingabe','auswahl','schalter','karte','liste','tabelle','diagramm','hinweis','dialog','kalender','spieler','eigene'];
begin
  if p is null or jsonb_typeof(p) <> 'object' or pg_column_size(p) > 8000 then return false; end if;
  for k, v in select * from jsonb_each(p) loop
    if k = 'art' then
      if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any(arten)) then return false; end if;
    elsif k = 'weg' then
      if jsonb_typeof(v) <> 'string' or (v #>> '{}') not in ('beschreiben','vorlage','einlesen') then return false; end if;
    elsif k = 'gestaltung' then
      if jsonb_typeof(v) <> 'object' then return false; end if;
      if exists (select 1 from jsonb_each(v) e where not (
           (e.key in ('farbe','farbe_dunkel','text','text_dunkel') and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') ~ '^#[0-9a-fA-F]{6}$')
        or (e.key = 'symbol' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') ~ '^[A-Z][A-Za-z0-9]{1,40}$')
        or (e.key = 'groesse' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('klein','mittel','gross'))
        or (e.key = 'variante' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('voll','umriss','leise'))
        or (e.key = 'ecken' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric between 0 and 32))) then return false; end if;
    elsif k = 'zuweisung' then
      if jsonb_typeof(v) <> 'object' then return false; end if;
      if exists (select 1 from jsonb_each(v) e where e.key not in ('gruppen','features') or jsonb_typeof(e.value) <> 'array'
                   or jsonb_array_length(e.value) > 40
                   or exists (select 1 from jsonb_array_elements(e.value) a where jsonb_typeof(a) <> 'string' or (a #>> '{}') !~ '^[A-Za-z0-9_.:-]{1,80}$')) then return false; end if;
    else
      return false;
    end if;
  end loop;
  return p ? 'art';
end $$;
revoke execute on function public.ws_baustein_daten_ok(jsonb) from public, anon;
grant execute on function public.ws_baustein_daten_ok(jsonb) to authenticated;

-- ---------- Bild-Anhänge zu Aufträgen ----------
create table if not exists public.ws_auftrag_bilder (
  id bigserial primary key,
  auftrag_id bigint not null references public.ws_auftraege(id) on delete cascade,
  dateiname text check (char_length(dateiname) <= 120),
  bild text not null check (char_length(bild) <= 2900000 and bild ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$'),
  von uuid not null default auth.uid() references auth.users(id),
  erstellt timestamptz not null default now()
);
create index if not exists ws_auftrag_bilder_auftrag on public.ws_auftrag_bilder (auftrag_id);
alter table public.ws_auftrag_bilder enable row level security;
drop policy if exists ws_auftrag_bilder_lesen on public.ws_auftrag_bilder;
create policy ws_auftrag_bilder_lesen on public.ws_auftrag_bilder for select to authenticated
  using (exists (select 1 from public.ws_auftraege a where a.id = auftrag_id
                   and (public.ws_darf_design(public.ws_projekt_von_gruppe(a.gruppe_id)) or public.ws_ist_werkstatt_fuer(a.gruppe_id))));
revoke all on public.ws_auftrag_bilder from anon, authenticated;
grant select on public.ws_auftrag_bilder to authenticated;

-- ---------- Auftrag aus dem Assistenten ----------
create or replace function public.ws_design_auftrag_neu(p_projekt text, p_titel text, p_text text, p_daten jsonb,
  p_bild text default null, p_dateiname text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare a bigint; v jsonb; b bigint := null; g text; f text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if not public.ws_darf_design(p_projekt) then raise exception 'Keine Berechtigung für das Design dieses Projekts'; end if;
  if not public.ws_baustein_daten_ok(p_daten) then raise exception 'Ungültige Angaben des Assistenten'; end if;
  -- Zuweisung nur an Gruppen und Features DIESES Projekts
  for g in select jsonb_array_elements_text(coalesce(p_daten #> '{zuweisung,gruppen}', '[]')) loop
    if coalesce(public.ws_projekt_von_gruppe(g), '') <> p_projekt then raise exception 'Gruppe gehört nicht zu diesem Projekt'; end if;
  end loop;
  for f in select jsonb_array_elements_text(coalesce(p_daten #> '{zuweisung,features}', '[]')) loop
    if not exists (select 1 from public.ws_features x where x.id = f and public.ws_projekt_von_gruppe(x.gruppe_id) = p_projekt) then
      raise exception 'Feature gehört nicht zu diesem Projekt'; end if;
  end loop;
  if p_bild is not null then
    if char_length(p_bild) > 2900000 or p_bild !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' then raise exception 'Bitte ein PNG-, JPG- oder WebP-Bild bis 2 MB'; end if;
    if (select count(*) from public.ws_protokoll where wer = auth.uid() and was = 'design_bild' and wann > now() - interval '1 day') >= 20 then
      raise exception 'Heute schon 20 Bilder angehängt – morgen wieder'; end if;
  end if;
  -- Auftrag + Beschreibung atomar wie bisher (gleiche Prüfungen: Länge, Steuer- und unsichtbare Zeichen)
  a := public.ws_design_auftrag(p_projekt, 'baustein', p_titel, p_text);
  if p_bild is not null then
    insert into public.ws_auftrag_bilder (auftrag_id, dateiname, bild)
      values (a, nullif(left(regexp_replace(coalesce(p_dateiname, ''), '[^A-Za-z0-9ÄÖÜäöüß ._-]', '', 'g'), 120), ''), p_bild) returning id into b;
    insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'design_bild', jsonb_build_object('auftrag', a, 'bild', b));
  end if;
  v := jsonb_build_object('design', p_daten) || case when b is null then '{}'::jsonb else jsonb_build_object('bilder', jsonb_build_array(b)) end;
  update public.ws_nachrichten set daten = v where auftrag_id = a and von = auth.uid();
  return a;
end $$;
revoke execute on function public.ws_design_auftrag_neu(text, text, text, jsonb, text, text) from public, anon;
grant execute on function public.ws_design_auftrag_neu(text, text, text, jsonb, text, text) to authenticated;

-- ---------- Datensparsamkeit: Bild-Vorlagen nur so lange wie nötig ----------
-- Die Werkstatt braucht das Bild nur beim Bauen. Ist der Auftrag abgeschlossen (live/erledigt/abgebrochen), wird es gelöscht.
create or replace function public.ws_auftrag_bilder_aufraeumen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.stand in ('wissen', 'erledigt', 'abgebrochen') and new.stand is distinct from old.stand then
    delete from public.ws_auftrag_bilder where auftrag_id = new.id;
  end if;
  return new;
end $$;
revoke execute on function public.ws_auftrag_bilder_aufraeumen() from public, anon, authenticated;
drop trigger if exists ws_auftrag_bilder_aufraeumen on public.ws_auftraege;
create trigger ws_auftrag_bilder_aufraeumen after update of stand on public.ws_auftraege
  for each row execute function public.ws_auftrag_bilder_aufraeumen();

commit;
