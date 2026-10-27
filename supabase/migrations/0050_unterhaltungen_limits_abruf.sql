-- Codeschmiede · Datenbank 0050: Oberfläche 2.0 & Chat (Entwurf 1.1, freigegeben von Gerhard 2026-10-27 08:27)
-- 1) Unterhaltungen wie bei Claude: mehrere persönliche Chats je Projekt (angeheftet, umbenennen, löschen).
--    Ohne Unterhaltung (null) = der bisherige Konzept-Chat (bleibt die erste, angeheftete Unterhaltung).
-- 2) Anhänge im Chat (Bilder, PDF, Text) im privaten Speicher „ws-chat“ – nur die eigene Person sieht sie, die eigene Werkstatt liest sie.
-- 3) Limits per Knopf: „Jetzt aktualisieren“ setzt eine Anforderung, die eigene Werkstatt fragt die Werte ab (kostenloser Abruf,
--    ersatzweise Mini-Anfrage) und meldet Stand und Hinweis zurück.
-- Keine Personendaten Dritter. Mehrfach ausführbar. Reihenfolge 0001 → … → 0050.
begin;

-- ---------- 1) Unterhaltungen ----------
create table if not exists public.ws_unterhaltungen (
  id bigserial primary key,
  projekt_id text not null references public.ws_projekte(id) on delete cascade,
  besitzer uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titel text not null default 'Neuer Chat' check (char_length(titel) between 1 and 120),
  angeheftet boolean not null default false,
  erstellt timestamptz not null default now(),
  geaendert timestamptz not null default now()
);
create index if not exists ws_unterhaltungen_besitzer on public.ws_unterhaltungen (besitzer, projekt_id, geaendert desc);

alter table public.ws_unterhaltungen enable row level security;
revoke all on public.ws_unterhaltungen from anon, authenticated;
grant select, delete on public.ws_unterhaltungen to authenticated;
grant insert (projekt_id, titel, angeheftet), update (titel, angeheftet) on public.ws_unterhaltungen to authenticated;
grant usage on sequence public.ws_unterhaltungen_id_seq to authenticated;

drop policy if exists ws_unterhaltungen_lesen on public.ws_unterhaltungen;
create policy ws_unterhaltungen_lesen on public.ws_unterhaltungen for select to authenticated using (besitzer = auth.uid());
drop policy if exists ws_unterhaltungen_neu on public.ws_unterhaltungen;
create policy ws_unterhaltungen_neu on public.ws_unterhaltungen for insert to authenticated
  with check (besitzer = auth.uid() and public.ws_darf_fragen(projekt_id));
drop policy if exists ws_unterhaltungen_aendern on public.ws_unterhaltungen;
create policy ws_unterhaltungen_aendern on public.ws_unterhaltungen for update to authenticated
  using (besitzer = auth.uid()) with check (besitzer = auth.uid());
drop policy if exists ws_unterhaltungen_loeschen on public.ws_unterhaltungen;
create policy ws_unterhaltungen_loeschen on public.ws_unterhaltungen for delete to authenticated using (besitzer = auth.uid());

-- Grenzen: höchstens 500 Unterhaltungen je Person und Projekt; Titel ohne Steuerzeichen
create or replace function public.ws_unterhaltung_neu() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.titel := btrim(regexp_replace(new.titel, '[[:cntrl:]]', ' ', 'g'));
  if new.titel = '' then new.titel := 'Neuer Chat'; end if;
  if tg_op = 'INSERT' and (select count(*) from public.ws_unterhaltungen where besitzer = new.besitzer and projekt_id = new.projekt_id) >= 500 then
    raise exception 'Höchstens 500 Unterhaltungen je Projekt – bitte alte löschen'; end if;
  if tg_op = 'UPDATE' then new.geaendert := now(); end if;
  return new;
end $$;
drop trigger if exists ws_unterhaltung_neu on public.ws_unterhaltungen;
create trigger ws_unterhaltung_neu before insert or update on public.ws_unterhaltungen for each row execute function public.ws_unterhaltung_neu();
revoke execute on function public.ws_unterhaltung_neu() from public, anon, authenticated;

-- Gehört die Unterhaltung der angemeldeten Person und diesem Projekt?
create or replace function public.ws_unterhaltung_meine(p_id bigint, p_projekt text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_id is null or exists (select 1 from public.ws_unterhaltungen where id = p_id and besitzer = auth.uid() and projekt_id = p_projekt)
$$;
revoke execute on function public.ws_unterhaltung_meine(bigint, text) from public, anon;
grant execute on function public.ws_unterhaltung_meine(bigint, text) to authenticated;

alter table public.ws_claude_chat add column if not exists unterhaltung_id bigint references public.ws_unterhaltungen(id) on delete cascade;
create index if not exists ws_claude_chat_unterhaltung on public.ws_claude_chat (unterhaltung_id, id);

-- ---------- 2) Anhänge ----------
-- Pfad im Speicher: <benutzer>/<projekt>/<zufall>.<endung> – höchstens 5 je Nachricht
create or replace function public.ws_chat_anhaenge_ok(p_projekt text, a jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select a is null or (jsonb_typeof(a) = 'array' and jsonb_array_length(a) between 1 and 5 and not exists (
    select 1 from jsonb_array_elements(a) e
     where jsonb_typeof(e) <> 'object'
        or not (e ?& array['pfad','name','typ','groesse'])   -- alle Schlüssel Pflicht (Prüfung 0.10.0 Befund 6)
        or exists (select 1 from jsonb_object_keys(e) k where k not in ('pfad','name','typ','groesse'))
        or jsonb_typeof(e->'pfad') <> 'string' or jsonb_typeof(e->'name') <> 'string' or jsonb_typeof(e->'typ') <> 'string' or jsonb_typeof(e->'groesse') <> 'number'
        or (e->>'pfad') !~ '^[0-9a-f-]{36}/[a-z0-9_-]{1,60}/[a-f0-9-]{36}\.(png|jpg|webp|gif|pdf|txt|md|csv|json)$'
        or split_part(e->>'pfad', '/', 1) <> auth.uid()::text or split_part(e->>'pfad', '/', 2) <> p_projekt
        or char_length(e->>'name') not between 1 and 120 or (e->>'name') ~ '[[:cntrl:]/\\]'
        or (e->>'typ') not in ('image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain','text/markdown','text/csv','application/json')
        or (e->>'groesse')::numeric not between 1 and 10485760))
$$;
revoke execute on function public.ws_chat_anhaenge_ok(text, jsonb) from public, anon;
grant execute on function public.ws_chat_anhaenge_ok(text, jsonb) to authenticated;

alter table public.ws_claude_chat add column if not exists anhaenge jsonb;

grant insert (unterhaltung_id, anhaenge) on public.ws_claude_chat to authenticated;

-- Fragen: wie bisher, dazu nur eigene Unterhaltung im selben Projekt und geprüfte Anhänge
drop policy if exists ws_claude_chat_frage on public.ws_claude_chat;
create policy ws_claude_chat_frage on public.ws_claude_chat for insert to authenticated
  with check (public.ws_darf_fragen(projekt_id) and von = auth.uid() and frage_id is null and stand = 'offen'
              and public.ws_unterhaltung_meine(unterhaltung_id, projekt_id) and public.ws_chat_anhaenge_ok(projekt_id, anhaenge));

-- Neue Nachricht schiebt die Unterhaltung nach oben
create or replace function public.ws_claude_chat_unterhaltung() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.unterhaltung_id is not null then update public.ws_unterhaltungen set geaendert = now() where id = new.unterhaltung_id; end if;
  return new;
end $$;
drop trigger if exists ws_claude_chat_unterhaltung on public.ws_claude_chat;
create trigger ws_claude_chat_unterhaltung after insert on public.ws_claude_chat for each row execute function public.ws_claude_chat_unterhaltung();
revoke execute on function public.ws_claude_chat_unterhaltung() from public, anon, authenticated;

-- Antwort der Werkstatt (wie 0048) – übernimmt die Unterhaltung der Frage
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
  if p_vorschlag is not null and jsonb_typeof(p_vorschlag) = 'object' and (p_vorschlag ? 'fragen' or p_vorschlag ? 'auftraege') and f.ort is distinct from 'konzept' then p_vorschlag := null; end if;
  if p_fehler or pg_column_size(p_vorschlag) >= 16384 or not public.ws_vorschlag_ok(f.projekt_id, p_vorschlag) then p_vorschlag := null; end if;
  insert into public.ws_claude_chat (projekt_id, ort, frage_id, von, text, vorschlag, stand, werkstatt_pc, unterhaltung_id)
    values (f.projekt_id, f.ort, f.id, null, p_text, p_vorschlag, 'beantwortet', f.werkstatt_pc, f.unterhaltung_id) returning id into a;
  update public.ws_claude_chat set stand = case when p_fehler then 'fehler' else 'beantwortet' end, geaendert = now() where id = f.id;
  return a;
end $$;
revoke execute on function public.ws_claude_chat_antwort(bigint, text, jsonb, boolean) from public, anon;
grant execute on function public.ws_claude_chat_antwort(bigint, text, jsonb, boolean) to authenticated;

-- Privater Speicher für Chat-Anhänge
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ws-chat', 'ws-chat', false, 10485760, array['image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain','text/markdown','text/csv','application/json'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.ws_chat_datei_eigen(p_name text, p_hochladen boolean default false) returns boolean
language sql stable security definer set search_path = public as $$
  select split_part(p_name, '/', 1) = auth.uid()::text
     and p_name ~ '^[0-9a-f-]{36}/[a-z0-9_-]{1,60}/[a-f0-9-]{36}\.(png|jpg|webp|gif|pdf|txt|md|csv|json)$'
     and (not p_hochladen or public.ws_darf_fragen(split_part(p_name, '/', 2)))
$$;
revoke execute on function public.ws_chat_datei_eigen(text, boolean) from public, anon;
grant execute on function public.ws_chat_datei_eigen(text, boolean) to authenticated;

drop policy if exists ws_chat_dateien_lesen on storage.objects;
create policy ws_chat_dateien_lesen on storage.objects for select to authenticated
  using (bucket_id = 'ws-chat' and public.ws_chat_datei_eigen(name));
drop policy if exists ws_chat_dateien_hochladen on storage.objects;
create policy ws_chat_dateien_hochladen on storage.objects for insert to authenticated
  with check (bucket_id = 'ws-chat' and public.ws_chat_datei_eigen(name, true));
drop policy if exists ws_chat_dateien_loeschen on storage.objects;
create policy ws_chat_dateien_loeschen on storage.objects for delete to authenticated
  using (bucket_id = 'ws-chat' and public.ws_chat_datei_eigen(name));

-- Lösch-Warteschlange für Chat-Dateien (Prüfung 0.10.0 Befund 5, wie ws_aufgabe_dateien_weg in 0042):
-- Wird eine Nachricht mit Anhängen gelöscht (einzeln, mit der Unterhaltung, mit dem Projekt) oder werden ihre Anhänge entfernt,
-- kommen die Pfade hierher. Die Oberfläche (Chat) und die Werkstatt der Person löschen die Dateien und tragen sie aus.
create table if not exists public.ws_chat_dateien_weg (
  pfad text primary key,
  benutzer uuid not null,
  erstellt timestamptz not null default now()
);
alter table public.ws_chat_dateien_weg enable row level security;
revoke all on public.ws_chat_dateien_weg from anon, authenticated;
grant select on public.ws_chat_dateien_weg to authenticated;
drop policy if exists ws_chat_dateien_weg_lesen on public.ws_chat_dateien_weg;
create policy ws_chat_dateien_weg_lesen on public.ws_chat_dateien_weg for select to authenticated using (benutzer = auth.uid());

create or replace function public.ws_chat_dateien_merken() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.anhaenge is not null and jsonb_typeof(old.anhaenge) = 'array' and (tg_op = 'DELETE' or new.anhaenge is distinct from old.anhaenge) then
    insert into public.ws_chat_dateien_weg (pfad, benutzer)
      select e->>'pfad', split_part(e->>'pfad', '/', 1)::uuid from jsonb_array_elements(old.anhaenge) e
       where jsonb_typeof(e) = 'object' and (e->>'pfad') ~ '^[0-9a-f-]{36}/'
         and (tg_op = 'DELETE' or new.anhaenge is null or not (new.anhaenge @> jsonb_build_array(e)))
    on conflict (pfad) do nothing;
  end if;
  return null;
end $$;
drop trigger if exists ws_chat_dateien_merken on public.ws_claude_chat;
create trigger ws_chat_dateien_merken after delete or update of anhaenge on public.ws_claude_chat for each row execute function public.ws_chat_dateien_merken();
revoke execute on function public.ws_chat_dateien_merken() from public, anon, authenticated;

-- Eigene Anhänge einer Nachricht entfernen (z. B. im Konzept-Chat, der sich nicht löschen lässt)
create or replace function public.ws_chat_anhaenge_entfernen(p_nachricht bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.ws_claude_chat set anhaenge = null, geaendert = now() where id = p_nachricht and von = auth.uid() and frage_id is null and anhaenge is not null;
  if not found then raise exception 'Keine eigenen Anhänge an dieser Nachricht'; end if;
end $$;
revoke execute on function public.ws_chat_anhaenge_entfernen(bigint) from public, anon;
grant execute on function public.ws_chat_anhaenge_entfernen(bigint) to authenticated;

-- Austragen nur, wenn die Datei im Speicher wirklich weg ist
create or replace function public.ws_chat_dateien_erledigt(p_pfade text[]) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.ws_chat_dateien_weg w where w.benutzer = auth.uid() and w.pfad = any(coalesce(p_pfade, '{}'))
    and not exists (select 1 from storage.objects o where o.bucket_id = 'ws-chat' and o.name = w.pfad);
  get diagnostics n = row_count; return n;
end $$;
revoke execute on function public.ws_chat_dateien_erledigt(text[]) from public, anon;
grant execute on function public.ws_chat_dateien_erledigt(text[]) to authenticated;

-- ---------- 3) Limits per Knopf ----------
alter table public.ws_abo_limits add column if not exists abruf_angefordert timestamptz;
alter table public.ws_abo_limits add column if not exists abruf_erledigt timestamptz;
alter table public.ws_abo_limits add column if not exists abruf_art text;
alter table public.ws_abo_limits add column if not exists abruf_hinweis text;
alter table public.ws_abo_limits drop constraint if exists ws_abo_limits_abruf_art_check;
alter table public.ws_abo_limits add constraint ws_abo_limits_abruf_art_check check (abruf_art is null or abruf_art in ('abruf','mini','fehler'));
alter table public.ws_abo_limits drop constraint if exists ws_abo_limits_abruf_hinweis_check;
alter table public.ws_abo_limits add constraint ws_abo_limits_abruf_hinweis_check check (abruf_hinweis is null or char_length(abruf_hinweis) <= 300);
alter table public.ws_abo_limits drop constraint if exists ws_abo_limits_quelle_check;
alter table public.ws_abo_limits add constraint ws_abo_limits_quelle_check check (quelle in ('werkstatt','statuszeile','abruf','mini'));

-- Die Werkstatt meldet das Ergebnis (nur eigene Zeile, Regel aus 0003)
grant update (abruf_erledigt, abruf_art, abruf_hinweis) on public.ws_abo_limits to authenticated;
grant insert (abruf_erledigt, abruf_art, abruf_hinweis) on public.ws_abo_limits to authenticated;

-- Knopf „Jetzt aktualisieren“: höchstens alle 15 Sekunden
create or replace function public.ws_abo_abruf() returns void
language plpgsql security definer set search_path = public as $$
declare z timestamptz;
begin
  if not public.ws_ist_mitglied() then raise exception 'Kein Zugriff'; end if;
  select abruf_angefordert into z from public.ws_abo_limits where benutzer_id = auth.uid();
  if z is not null and z > now() - interval '15 seconds' then raise exception 'Gerade erst angefordert – bitte kurz warten'; end if;
  insert into public.ws_abo_limits (benutzer_id, abruf_angefordert, aktualisiert) values (auth.uid(), now(), now())
    on conflict (benutzer_id) do update set abruf_angefordert = now();
end $$;
revoke execute on function public.ws_abo_abruf() from public, anon;
grant execute on function public.ws_abo_abruf() to authenticated;

-- ---------- Live-Abgleich ----------
do $$ begin
  begin alter publication supabase_realtime add table public.ws_unterhaltungen; exception when duplicate_object then null; end;
end $$;

commit;

select count(*) as unterhaltungen from public.ws_unterhaltungen;
