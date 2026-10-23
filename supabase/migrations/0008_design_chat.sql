-- Codeschmiede · Datenbank v8: App-Designer, Etappe 2 – Chat mit Claude (Entscheidungen Gerhard 2026-10-23 09:46)
-- Claude antwortet auf der Werkstatt dessen, der fragt (eigenes Abo), OHNE Werkzeuge – bekommt nur die Design-Werte.
-- Claude erklärt und schlägt Werte vor; übernommen wird nur per Klick in den Entwurf (dann wie gewohnt speichern/senden).
-- Keine Personendaten, nur Gestaltung. Mehrfach ausführbar. Reihenfolge 0001 → … → 0008.

begin;

create table if not exists public.ws_design_chat (
  id bigserial primary key,
  projekt_id text not null references public.ws_projekte(id),
  entwurf_id bigint references public.ws_design_entwuerfe(id) on delete set null,
  frage_id bigint references public.ws_design_chat(id) on delete cascade,   -- gesetzt = Antwort von Claude auf diese Frage
  von uuid default auth.uid() references auth.users(id),                     -- null = Claude (Werkstatt)
  text text not null check (char_length(text) between 1 and 8000),
  werte jsonb,                                                               -- Frage: Werte im Editor · Antwort: Vorschlag (Teilwerte)
  stand text not null default 'offen' check (stand in ('offen','laeuft','beantwortet','fehler')),
  entscheidung text check (entscheidung in ('uebernommen','abgelehnt')),
  werkstatt_pc uuid references public.ws_werkstatt_pcs(id) on delete set null,
  erstellt timestamptz not null default now(),
  geaendert timestamptz not null default now()
);
alter table public.ws_design_chat drop constraint if exists ws_design_chat_werte_check;
alter table public.ws_design_chat add constraint ws_design_chat_werte_check
  check (werte is null or (pg_column_size(werte) < 65536 and public.ws_design_werte_ok(werte)));
create index if not exists ws_design_chat_projekt on public.ws_design_chat (projekt_id, id);
create index if not exists ws_design_chat_offen on public.ws_design_chat (von, stand) where frage_id is null;

revoke all on public.ws_design_chat from anon, authenticated;
grant select on public.ws_design_chat to authenticated;
grant insert (projekt_id, entwurf_id, text, werte) on public.ws_design_chat to authenticated;
grant usage on sequence public.ws_design_chat_id_seq to authenticated;
alter table public.ws_design_chat enable row level security;

drop policy if exists ws_design_chat_lesen on public.ws_design_chat;
create policy ws_design_chat_lesen on public.ws_design_chat for select to authenticated using (public.ws_sieht_projekt(projekt_id));
-- Fragen stellt, wer gestalten darf; der Entwurf (falls angegeben) gehört zum selben Projekt
drop policy if exists ws_design_chat_frage on public.ws_design_chat;
create policy ws_design_chat_frage on public.ws_design_chat for insert to authenticated
  with check (public.ws_darf_design(projekt_id) and von = auth.uid() and frage_id is null and stand = 'offen'
              and (entwurf_id is null or exists (select 1 from public.ws_design_entwuerfe e where e.id = entwurf_id and e.projekt_id = ws_design_chat.projekt_id)));

-- Mengenbegrenzung: höchstens 5 offene Fragen je Person
create or replace function public.ws_design_chat_neu() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.frage_id is null and (select count(*) from public.ws_design_chat where von = new.von and frage_id is null and stand in ('offen','laeuft')) >= 5 then
    raise exception 'Es warten schon 5 Fragen auf Claude – bitte kurz warten'; end if;
  return new;
end $$;
drop trigger if exists ws_design_chat_neu on public.ws_design_chat;
create trigger ws_design_chat_neu before insert on public.ws_design_chat for each row execute function public.ws_design_chat_neu();
revoke execute on function public.ws_design_chat_neu() from public, anon, authenticated;

-- Werkstatt holt die nächste EIGENE Frage (nur Fragen der angemeldeten Person, nur mit eigenem, eingeschaltetem PC).
-- Hängengebliebene Fragen (laeuft > 10 Min.) werden wieder aufgenommen.
create or replace function public.ws_design_chat_nehmen(p_pc uuid) returns setof public.ws_design_chat
language plpgsql security definer set search_path = public as $$
declare f public.ws_design_chat;
begin
  if not exists (select 1 from public.ws_werkstatt_pcs where id = p_pc and benutzer_id = auth.uid()) then
    raise exception 'Unbekannter Werkstatt-PC'; end if;
  select * into f from public.ws_design_chat
    where von = auth.uid() and frage_id is null
      and (stand = 'offen' or (stand = 'laeuft' and geaendert < now() - interval '10 minutes'))
    order by id limit 1 for update skip locked;
  if f.id is null then return; end if;
  update public.ws_design_chat set stand = 'laeuft', werkstatt_pc = p_pc, geaendert = now() where id = f.id returning * into f;
  return next f;
end $$;

-- Antwort der Werkstatt (nur auf eigene, laufende Frage). p_vorschlag = Teilwerte nach festem Schema oder null.
create or replace function public.ws_design_chat_antwort(p_frage bigint, p_text text, p_vorschlag jsonb default null, p_fehler boolean default false)
returns bigint language plpgsql security definer set search_path = public as $$
declare f public.ws_design_chat; a bigint;
begin
  select * into f from public.ws_design_chat where id = p_frage and frage_id is null for update;
  if f.id is null then raise exception 'Frage nicht gefunden'; end if;
  if f.von is distinct from auth.uid() then raise exception 'Nur die eigene Werkstatt beantwortet eigene Fragen'; end if;
  if f.stand <> 'laeuft' then raise exception 'Frage ist nicht in Bearbeitung'; end if;
  if p_text is null or char_length(p_text) not between 1 and 8000 then raise exception 'Antwort fehlt oder ist zu lang'; end if;
  if p_vorschlag is not null and (p_fehler or pg_column_size(p_vorschlag) >= 65536 or not public.ws_design_werte_ok(p_vorschlag) or p_vorschlag = '{}'::jsonb) then
    p_vorschlag := null; end if;   -- ungültiger Vorschlag wird verworfen, die Erklärung bleibt
  insert into public.ws_design_chat (projekt_id, entwurf_id, frage_id, von, text, werte, stand)
    values (f.projekt_id, f.entwurf_id, f.id, null, p_text, p_vorschlag, 'beantwortet') returning id into a;
  update public.ws_design_chat set stand = case when p_fehler then 'fehler' else 'beantwortet' end, geaendert = now() where id = f.id;
  return a;
end $$;

-- Vorschlag übernommen/abgelehnt (nur wer gefragt hat)
create or replace function public.ws_design_chat_entscheiden(p_antwort bigint, p_entscheidung text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ws_design_chat; f public.ws_design_chat;
begin
  if p_entscheidung not in ('uebernommen','abgelehnt') then raise exception 'Ungültige Entscheidung'; end if;
  select * into a from public.ws_design_chat where id = p_antwort and frage_id is not null for update;
  if a.id is null or a.werte is null then raise exception 'Kein Vorschlag'; end if;
  select * into f from public.ws_design_chat where id = a.frage_id;
  if f.von is distinct from auth.uid() then raise exception 'Nur wer gefragt hat, entscheidet'; end if;
  update public.ws_design_chat set entscheidung = p_entscheidung, geaendert = now() where id = a.id;
end $$;

revoke execute on function public.ws_design_chat_nehmen(uuid) from public, anon;
revoke execute on function public.ws_design_chat_antwort(bigint, text, jsonb, boolean) from public, anon;
revoke execute on function public.ws_design_chat_entscheiden(bigint, text) from public, anon;
grant execute on function public.ws_design_chat_nehmen(uuid) to authenticated;
grant execute on function public.ws_design_chat_antwort(bigint, text, jsonb, boolean) to authenticated;
grant execute on function public.ws_design_chat_entscheiden(bigint, text) to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.ws_design_chat; exception when duplicate_object then null; end;
end $$;

commit;

select count(*) as design_chat_zeilen from public.ws_design_chat;
