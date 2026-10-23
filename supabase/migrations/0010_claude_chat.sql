-- Codeschmiede · Datenbank v10: Chat mit Claude überall (Neue Anweisung Gerhard 2026-10-23 10:45, Entscheidungen 10:50)
-- Fest eingeblendete Spalte auf jeder Seite. Persönliches Gespräch (sieht nur, wer fragt). Claude antwortet über die EIGENE
-- Werkstatt (Abo) und darf das Projekt nur LESEN (keine Befehle, keine Änderungen – auch auf dem Admin-PC zulässig).
-- Soll etwas gebaut werden, schlägt Claude einen Auftrag vor; angelegt wird er erst per Klick (normale Rechte).
-- Keine Personendaten, nur Arbeit an der App. Mehrfach ausführbar. Reihenfolge 0001 → … → 0010.

begin;

create table if not exists public.ws_claude_chat (
  id bigserial primary key,
  projekt_id text not null references public.ws_projekte(id),
  ort text not null check (ort ~ '^[a-z0-9:_.-]{1,80}$'),            -- z. B. zentrale, global, bausteine, marke, gruppe:training, feature:F-001
  frage_id bigint references public.ws_claude_chat(id) on delete cascade,
  von uuid default auth.uid() references auth.users(id),            -- null = Claude
  text text not null check (char_length(text) between 1 and 8000),
  kontext text check (kontext is null or char_length(kontext) <= 6000),   -- was auf der Seite gerade zu sehen ist
  vorschlag jsonb,                                                   -- Antwort: Auftragsvorschlag {gruppe_id, feature_id, titel, text}
  stand text not null default 'offen' check (stand in ('offen','laeuft','beantwortet','fehler')),
  entscheidung text check (entscheidung in ('uebernommen','abgelehnt')),
  auftrag_id bigint references public.ws_auftraege(id),
  werkstatt_pc uuid references public.ws_werkstatt_pcs(id) on delete set null,
  erstellt timestamptz not null default now(),
  geaendert timestamptz not null default now()
);
create index if not exists ws_claude_chat_von on public.ws_claude_chat (von, projekt_id, id);
create index if not exists ws_claude_chat_frage on public.ws_claude_chat (frage_id);

-- Wer fragen darf: Mitglied des Projekts als Admin, Entwickler oder Texter
create or replace function public.ws_darf_fragen(p_projekt text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.ws_rolle_im_projekt(p_projekt) in ('admin','entwickler','texter'), false)
$$;
revoke execute on function public.ws_darf_fragen(text) from public, anon;
grant execute on function public.ws_darf_fragen(text) to authenticated;

-- Auftragsvorschlag prüfen: Gruppe im Projekt, Feature (falls angegeben) in dieser Gruppe, Längen begrenzt
create or replace function public.ws_vorschlag_ok(p_projekt text, v jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if v is null then return true; end if;
  if jsonb_typeof(v) <> 'object' or exists (select 1 from jsonb_object_keys(v) k where k not in ('gruppe_id','feature_id','titel','text')) then return false; end if;
  if jsonb_typeof(v->'gruppe_id') <> 'string' or jsonb_typeof(v->'titel') <> 'string' or jsonb_typeof(v->'text') <> 'string' then return false; end if;
  if char_length(v->>'titel') not between 3 and 80 or char_length(v->>'text') not between 10 and 8000 then return false; end if;
  if public.ws_projekt_von_gruppe(v->>'gruppe_id') is distinct from p_projekt then return false; end if;
  if v ? 'feature_id' and v->'feature_id' <> 'null'::jsonb then
    if jsonb_typeof(v->'feature_id') <> 'string' or not exists (select 1 from public.ws_features f where f.id = v->>'feature_id' and f.gruppe_id = v->>'gruppe_id') then return false; end if;
  end if;
  return true;
end $$;
revoke execute on function public.ws_vorschlag_ok(text, jsonb) from public, anon;

revoke all on public.ws_claude_chat from anon, authenticated;
grant select on public.ws_claude_chat to authenticated;
grant insert (projekt_id, ort, text, kontext) on public.ws_claude_chat to authenticated;
grant usage on sequence public.ws_claude_chat_id_seq to authenticated;
alter table public.ws_claude_chat enable row level security;

-- Persönlich: eigene Fragen und die Antworten darauf (Hilfsfunktion statt Unterabfrage – sonst Rekursion in der Regel, Prüfung 2026-10-23)
-- (gibt nur zurück, ob die Frage der angemeldeten Person gehört – verrät nicht, wer gefragt hat)
create or replace function public.ws_claude_chat_meine(p_frage bigint) returns boolean
language sql stable security definer set search_path = public as $$ select exists (select 1 from public.ws_claude_chat where id = p_frage and von = auth.uid()) $$;
revoke execute on function public.ws_claude_chat_meine(bigint) from public, anon;
grant execute on function public.ws_claude_chat_meine(bigint) to authenticated;
drop policy if exists ws_claude_chat_lesen on public.ws_claude_chat;
create policy ws_claude_chat_lesen on public.ws_claude_chat for select to authenticated
  using (von = auth.uid() or (frage_id is not null and public.ws_claude_chat_meine(frage_id)));
drop function if exists public.ws_claude_chat_von(bigint);   -- frühere Fassung
drop policy if exists ws_claude_chat_frage on public.ws_claude_chat;
create policy ws_claude_chat_frage on public.ws_claude_chat for insert to authenticated
  with check (public.ws_darf_fragen(projekt_id) and von = auth.uid() and frage_id is null and stand = 'offen');

create or replace function public.ws_claude_chat_neu() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.frage_id is null then
    if (select count(*) from public.ws_claude_chat where von = new.von and frage_id is null and stand in ('offen','laeuft')) >= 5 then
      raise exception 'Es warten schon 5 Fragen auf Claude – bitte kurz warten'; end if;
    if (select count(*) from public.ws_claude_chat where von = new.von and frage_id is null and erstellt > now() - interval '1 day') >= 200 then
      raise exception 'Tagesgrenze erreicht (200 Fragen an Claude)'; end if;
  end if;
  return new;
end $$;
drop trigger if exists ws_claude_chat_neu on public.ws_claude_chat;
create trigger ws_claude_chat_neu before insert on public.ws_claude_chat for each row execute function public.ws_claude_chat_neu();
revoke execute on function public.ws_claude_chat_neu() from public, anon, authenticated;

-- Werkstatt holt die nächste EIGENE Frage (eigener, eingeschalteter PC; Recht noch vorhanden)
create or replace function public.ws_claude_chat_nehmen(p_pc uuid) returns setof public.ws_claude_chat
language plpgsql security definer set search_path = public as $$
declare f public.ws_claude_chat;
begin
  if not exists (select 1 from public.ws_werkstatt_pcs where id = p_pc and benutzer_id = auth.uid() and an) then raise exception 'Unbekannter Werkstatt-PC'; end if;
  select * into f from public.ws_claude_chat
    where von = auth.uid() and frage_id is null and public.ws_darf_fragen(projekt_id)
      and (stand = 'offen' or (stand = 'laeuft' and geaendert < now() - interval '10 minutes'))
    order by id limit 1 for update skip locked;
  if f.id is null then return; end if;
  update public.ws_claude_chat set stand = 'laeuft', werkstatt_pc = p_pc, geaendert = now() where id = f.id returning * into f;
  return next f;
end $$;

create or replace function public.ws_claude_chat_antwort(p_frage bigint, p_text text, p_vorschlag jsonb default null, p_fehler boolean default false)
returns bigint language plpgsql security definer set search_path = public as $$
declare f public.ws_claude_chat; a bigint;
begin
  select * into f from public.ws_claude_chat where id = p_frage and frage_id is null for update;
  if f.id is null then raise exception 'Frage nicht gefunden'; end if;
  if f.von is distinct from auth.uid() then raise exception 'Nur die eigene Werkstatt beantwortet eigene Fragen'; end if;
  if f.stand <> 'laeuft' then raise exception 'Frage ist nicht in Bearbeitung'; end if;
  if not public.ws_darf_fragen(f.projekt_id) then raise exception 'Kein Zugriff mehr auf dieses Projekt'; end if;
  if p_text is null or char_length(p_text) not between 1 and 8000 then raise exception 'Antwort fehlt oder ist zu lang'; end if;
  if p_fehler or pg_column_size(p_vorschlag) >= 16384 or not public.ws_vorschlag_ok(f.projekt_id, p_vorschlag) then p_vorschlag := null; end if;
  insert into public.ws_claude_chat (projekt_id, ort, frage_id, von, text, vorschlag, stand, werkstatt_pc)
    values (f.projekt_id, f.ort, f.id, null, p_text, p_vorschlag, 'beantwortet', f.werkstatt_pc) returning id into a;
  update public.ws_claude_chat set stand = case when p_fehler then 'fehler' else 'beantwortet' end, geaendert = now() where id = f.id;
  return a;
end $$;

-- Vorschlag annehmen (Auftrag wurde von der Person selbst mit ihren Rechten angelegt) oder ablehnen
create or replace function public.ws_claude_chat_entscheiden(p_antwort bigint, p_entscheidung text, p_auftrag bigint default null) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ws_claude_chat; f public.ws_claude_chat;
begin
  if p_entscheidung not in ('uebernommen','abgelehnt') then raise exception 'Ungültige Entscheidung'; end if;
  select * into a from public.ws_claude_chat where id = p_antwort and frage_id is not null for update;
  if a.id is null or a.vorschlag is null then raise exception 'Kein Vorschlag'; end if;
  select * into f from public.ws_claude_chat where id = a.frage_id;
  if f.von is distinct from auth.uid() then raise exception 'Nur wer gefragt hat, entscheidet'; end if;
  if p_auftrag is not null and not exists (select 1 from public.ws_auftraege x where x.id = p_auftrag and x.erstellt_von = auth.uid()) then
    raise exception 'Auftrag nicht gefunden'; end if;
  update public.ws_claude_chat set entscheidung = p_entscheidung, auftrag_id = p_auftrag, geaendert = now() where id = a.id;
end $$;

revoke execute on function public.ws_claude_chat_nehmen(uuid) from public, anon;
revoke execute on function public.ws_claude_chat_antwort(bigint, text, jsonb, boolean) from public, anon;
revoke execute on function public.ws_claude_chat_entscheiden(bigint, text, bigint) from public, anon;
grant execute on function public.ws_claude_chat_nehmen(uuid) to authenticated;
grant execute on function public.ws_claude_chat_antwort(bigint, text, jsonb, boolean) to authenticated;
grant execute on function public.ws_claude_chat_entscheiden(bigint, text, bigint) to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.ws_claude_chat; exception when duplicate_object then null; end;
end $$;

commit;

select count(*) as claude_chat_zeilen from public.ws_claude_chat;
