-- Codeschmiede · Datenbank v15: Features aus dem Gespräch und Bezüge zwischen Features (KONZEPT-FEATURE-BEZUEGE.md,
-- Entscheidungen Gerhard 2026-10-22 22:31, „fertig machen“ 2026-10-23 15:53).
--   • Claude schlägt im Chat ein neues Feature vor → Karte „anlegen? Ja/Nein“ → nur bei Ja legt die Person es an (Herkunft „gespraech“).
--   • Bezug „Vorlage“: Feature A nutzt Feature B als Referenz (@Liga). Nur im selben Projekt, nur mit Auftragsrecht in der Gruppe von A.
--   • Geht eine Änderung an B live, bekommt A einen Hinweis „B wurde geändert – nachziehen?“.
-- Mehrfach ausführbar. Reihenfolge 0001 → … → 0015.
begin;

-- Herkunft „aus Gespräch“ erlauben
alter table public.ws_features drop constraint if exists ws_features_quelle_check;
alter table public.ws_features add constraint ws_features_quelle_check check (quelle in ('registry','manuell','gespraech'));
drop policy if exists ws_features_neu on public.ws_features;
create policy ws_features_neu on public.ws_features for insert to authenticated
  with check (public.ws_darf(public.ws_bereich_von_gruppe(gruppe_id), 'auftraege') and quelle in ('manuell','gespraech') and id like 'N-%'
              and not ausgeblendet and not ausgebaut and not fehlt_im_verzeichnis and erstellt_von = auth.uid());

create table if not exists public.ws_feature_bezuege (
  id bigserial primary key,
  von_feature text not null references public.ws_features(id) on delete cascade,   -- nutzt die Vorlage (z. B. Turniere)
  zu_feature text not null references public.ws_features(id) on delete cascade,    -- Vorlage/Referenz (z. B. Liga)
  art text not null default 'vorlage' check (art in ('vorlage')),
  erstellt_von uuid not null default auth.uid() references auth.users(id),
  erstellt timestamptz not null default now(),
  unique (von_feature, zu_feature),
  check (von_feature <> zu_feature)
);
revoke all on public.ws_feature_bezuege from anon, authenticated;
grant select on public.ws_feature_bezuege to authenticated;
alter table public.ws_feature_bezuege enable row level security;
drop policy if exists ws_feature_bezuege_lesen on public.ws_feature_bezuege;
create policy ws_feature_bezuege_lesen on public.ws_feature_bezuege for select to authenticated
  using (public.ws_sieht_projekt(public.ws_projekt_von_gruppe((select gruppe_id from public.ws_features f where f.id = von_feature))));

create table if not exists public.ws_feature_hinweise (
  id bigserial primary key,
  feature_id text not null references public.ws_features(id) on delete cascade,
  vorlage_feature text references public.ws_features(id) on delete cascade,
  auftrag_id bigint references public.ws_auftraege(id) on delete set null,       -- die live gegangene Änderung an der Vorlage
  text text not null check (char_length(text) <= 500),
  stand text not null default 'offen' check (stand in ('offen','nachgezogen','nicht_noetig')),
  erstellt timestamptz not null default now(),
  erledigt_von uuid references auth.users(id)
);
revoke all on public.ws_feature_hinweise from anon, authenticated;
grant select on public.ws_feature_hinweise to authenticated;
alter table public.ws_feature_hinweise enable row level security;
drop policy if exists ws_feature_hinweise_lesen on public.ws_feature_hinweise;
create policy ws_feature_hinweise_lesen on public.ws_feature_hinweise for select to authenticated
  using (public.ws_sieht_projekt(public.ws_projekt_von_gruppe((select gruppe_id from public.ws_features f where f.id = feature_id))));

-- Bezug setzen/entfernen: Auftragsrecht in der Gruppe des nutzenden Features, beide im selben Projekt
create or replace function public.ws_bezug_setzen(p_von text, p_zu text) returns bigint
language plpgsql security definer set search_path = public as $$
declare gv text; gz text; i bigint;
begin
  select gruppe_id into gv from public.ws_features where id = p_von and not ausgebaut;
  select gruppe_id into gz from public.ws_features where id = p_zu and not ausgebaut;
  if gv is null or gz is null then raise exception 'Feature nicht gefunden'; end if;
  if p_von = p_zu then raise exception 'Ein Feature kann nicht seine eigene Vorlage sein'; end if;
  if public.ws_projekt_von_gruppe(gv) is distinct from public.ws_projekt_von_gruppe(gz) then raise exception 'Bezüge nur innerhalb desselben Projekts'; end if;
  if not public.ws_darf(public.ws_bereich_von_gruppe(gv), 'auftraege') then raise exception 'Kein Auftragsrecht in dieser Gruppe'; end if;
  if (select count(*) from public.ws_feature_bezuege where von_feature = p_von) >= 10 then raise exception 'Höchstens 10 Vorlagen je Feature'; end if;
  insert into public.ws_feature_bezuege (von_feature, zu_feature) values (p_von, p_zu) on conflict (von_feature, zu_feature) do nothing returning id into i;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'bezug_setzen', jsonb_build_object('von', p_von, 'zu', p_zu));
  return i;
end $$;
create or replace function public.ws_bezug_loeschen(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare b public.ws_feature_bezuege; gv text;
begin
  select * into b from public.ws_feature_bezuege where id = p_id;
  if b.id is null then raise exception 'Bezug nicht gefunden'; end if;
  select gruppe_id into gv from public.ws_features where id = b.von_feature;
  if not public.ws_darf(public.ws_bereich_von_gruppe(gv), 'auftraege') then raise exception 'Kein Auftragsrecht in dieser Gruppe'; end if;
  delete from public.ws_feature_bezuege where id = p_id;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'bezug_loeschen', jsonb_build_object('von', b.von_feature, 'zu', b.zu_feature));
end $$;
create or replace function public.ws_hinweis_erledigen(p_id bigint, p_stand text) returns void
language plpgsql security definer set search_path = public as $$
declare h public.ws_feature_hinweise; g text;
begin
  if p_stand not in ('nachgezogen','nicht_noetig') then raise exception 'Ungültig'; end if;
  select * into h from public.ws_feature_hinweise where id = p_id for update;
  if h.id is null then raise exception 'Hinweis nicht gefunden'; end if;
  select gruppe_id into g from public.ws_features where id = h.feature_id;
  if not public.ws_darf(public.ws_bereich_von_gruppe(g), 'auftraege') then raise exception 'Kein Auftragsrecht in dieser Gruppe'; end if;
  update public.ws_feature_hinweise set stand = p_stand, erledigt_von = auth.uid() where id = p_id;
end $$;
revoke execute on function public.ws_bezug_setzen(text, text), public.ws_bezug_loeschen(bigint), public.ws_hinweis_erledigen(bigint, text) from public, anon;
grant execute on function public.ws_bezug_setzen(text, text), public.ws_bezug_loeschen(bigint), public.ws_hinweis_erledigen(bigint, text) to authenticated;

-- Nachziehen: geht ein Auftrag einer Vorlage live (Stand „wissen“), bekommen alle nutzenden Features einen Hinweis
create or replace function public.ws_vorlage_geaendert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.stand = 'wissen' and old.stand is distinct from 'wissen' and new.feature_id is not null then
    insert into public.ws_feature_hinweise (feature_id, vorlage_feature, auftrag_id, text)
      select b.von_feature, new.feature_id, new.id,
             left(format('„%s“ wurde geändert (Auftrag #%s: %s) – nachziehen?', f.name, new.id, new.titel), 500)
      from public.ws_feature_bezuege b join public.ws_features f on f.id = new.feature_id
      where b.zu_feature = new.feature_id;
  end if;
  return new;
end $$;
revoke execute on function public.ws_vorlage_geaendert() from public, anon, authenticated;
drop trigger if exists ws_vorlage_geaendert on public.ws_auftraege;
create trigger ws_vorlage_geaendert after update of stand on public.ws_auftraege for each row execute function public.ws_vorlage_geaendert();

-- Chat-Vorschlag darf zusätzlich ein neues Feature oder einen Bezug vorschlagen (angelegt wird nur per Klick mit den eigenen Rechten)
create or replace function public.ws_vorschlag_ok(p_projekt text, v jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if v is null then return true; end if;
  if jsonb_typeof(v) <> 'object' then return false; end if;
  -- a) neues Feature: {"feature_neu":{"gruppe_id","name","beschreibung"}}
  if v ? 'feature_neu' then
    if exists (select 1 from jsonb_object_keys(v) k where k <> 'feature_neu') or jsonb_typeof(v->'feature_neu') <> 'object'
       or exists (select 1 from jsonb_object_keys(v->'feature_neu') k where k not in ('gruppe_id','name','beschreibung')) then return false; end if;
    if jsonb_typeof(v->'feature_neu'->'gruppe_id') <> 'string' or jsonb_typeof(v->'feature_neu'->'name') <> 'string' then return false; end if;
    if char_length(v->'feature_neu'->>'name') not between 2 and 80 or char_length(coalesce(v->'feature_neu'->>'beschreibung','')) > 1000 then return false; end if;
    return public.ws_projekt_von_gruppe(v->'feature_neu'->>'gruppe_id') is not distinct from p_projekt;
  end if;
  -- b) Bezug: {"bezug":{"von","zu"}}
  if v ? 'bezug' then
    if exists (select 1 from jsonb_object_keys(v) k where k <> 'bezug') or jsonb_typeof(v->'bezug') <> 'object'
       or exists (select 1 from jsonb_object_keys(v->'bezug') k where k not in ('von','zu')) then return false; end if;
    return exists (select 1 from public.ws_features a join public.ws_features b on b.id = v->'bezug'->>'zu'
                   where a.id = v->'bezug'->>'von' and a.id <> b.id
                     and public.ws_projekt_von_gruppe(a.gruppe_id) = p_projekt and public.ws_projekt_von_gruppe(b.gruppe_id) = p_projekt);
  end if;
  -- c) Auftrag (mit optionalem Konzept) wie bisher
  if exists (select 1 from jsonb_object_keys(v) k where k not in ('gruppe_id','feature_id','titel','text','konzept')) then return false; end if;
  if jsonb_typeof(v->'gruppe_id') <> 'string' or jsonb_typeof(v->'titel') <> 'string' or jsonb_typeof(v->'text') <> 'string' then return false; end if;
  if char_length(v->>'titel') not between 3 and 80 or char_length(v->>'text') not between 10 and 8000 then return false; end if;
  if public.ws_projekt_von_gruppe(v->>'gruppe_id') is distinct from p_projekt then return false; end if;
  if v ? 'feature_id' and v->'feature_id' <> 'null'::jsonb then
    if jsonb_typeof(v->'feature_id') <> 'string' or not exists (select 1 from public.ws_features f where f.id = v->>'feature_id' and f.gruppe_id = v->>'gruppe_id') then return false; end if;
  end if;
  if not public.ws_konzept_ok(v->'konzept') then return false; end if;
  return true;
end $$;
revoke execute on function public.ws_vorschlag_ok(text, jsonb) from public, anon, authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.ws_feature_bezuege; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.ws_feature_hinweise; exception when duplicate_object then null; end;
end $$;

commit;
