-- Codeschmiede · Datenbank v18: beliebige KI-Anbieter (Gerhard 2026-10-23 16:22 „beliebige KI-Anbieter dahinter schalten,
-- auch neue einfügen – z. B. Copilot“). Eingebaut bleiben Claude, ChatGPT (Codex) und Gemini; weitere legt der Admin an.
-- Sicherheit: Ein eigener Anbieter ist nur ein Programmname + feste Argumente (kein Pfad, keine Shell). Er läuft auf einem PC erst,
-- wenn die Person ihn dort selbst zulässt (ws_ki_kopplung.zugelassen) – der Admin kann auf fremden PCs nichts starten.
-- Bauen bleibt fest Claude. Mehrfach ausführbar. Reihenfolge 0001 → … → 0018.
begin;

create table if not exists public.ws_ki_anbieter (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{1,30}$' and id not in ('claude','chatgpt','gemini')),
  name text not null check (char_length(name) between 2 and 40),
  programm text not null check (programm ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,40}$'),       -- nur ein Programmname, kein Pfad
  argumente jsonb not null default '[]',                                                 -- feste Argumente; {prompt}/{modell} werden ersetzt
  modelle jsonb not null default '[]',
  installieren text check (char_length(installieren) <= 200),                            -- nur Hinweis zum Kopieren, wird nie ausgeführt
  anmelden text check (char_length(anmelden) <= 200),
  hinweis text check (char_length(hinweis) <= 500),
  erstellt_von uuid default auth.uid() references auth.users(id),
  erstellt timestamptz not null default now()
);
create or replace function public.ws_ki_argumente_ok(a jsonb) returns boolean
language sql immutable set search_path = public as $$
  select jsonb_typeof(a) = 'array' and jsonb_array_length(a) <= 12
    and not exists (select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) <> 'string' or char_length(x #>> '{}') not between 1 and 80
                    or (x #>> '{}') ~ '[;&|`$<>\\\n\r]' and (x #>> '{}') not in ('{prompt}'))
$$;
alter table public.ws_ki_anbieter drop constraint if exists ws_ki_anbieter_argumente_check;
alter table public.ws_ki_anbieter add constraint ws_ki_anbieter_argumente_check check (public.ws_ki_argumente_ok(argumente));
alter table public.ws_ki_anbieter drop constraint if exists ws_ki_anbieter_modelle_check;
create or replace function public.ws_ki_modelle_ok(a jsonb) returns boolean
language sql immutable set search_path = public as $$
  select jsonb_typeof(a) = 'array' and jsonb_array_length(a) <= 12
    and not exists (select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) <> 'string' or (x #>> '{}') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,59}$')
$$;
alter table public.ws_ki_anbieter add constraint ws_ki_anbieter_modelle_check check (public.ws_ki_modelle_ok(modelle));
revoke all on public.ws_ki_anbieter from anon, authenticated;
grant select on public.ws_ki_anbieter to authenticated;
alter table public.ws_ki_anbieter enable row level security;
drop policy if exists ws_ki_anbieter_lesen on public.ws_ki_anbieter;
create policy ws_ki_anbieter_lesen on public.ws_ki_anbieter for select to authenticated using (public.ws_ist_mitglied());

create or replace function public.ws_ki_anbieter_speichern(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'KI-Anbieter legt nur der Admin an'; end if;
  insert into public.ws_ki_anbieter (id, name, programm, argumente, modelle, installieren, anmelden, hinweis)
    values (p->>'id', p->>'name', p->>'programm', coalesce(p->'argumente','[]'), coalesce(p->'modelle','[]'), p->>'installieren', p->>'anmelden', p->>'hinweis')
  on conflict (id) do update set name = excluded.name, programm = excluded.programm, argumente = excluded.argumente, modelle = excluded.modelle,
    installieren = excluded.installieren, anmelden = excluded.anmelden, hinweis = excluded.hinweis;
  -- Geänderter Anbieter muss auf jedem PC neu zugelassen werden
  update public.ws_ki_kopplung set zugelassen = false where anbieter = p->>'id';
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'ki_anbieter', jsonb_build_object('id', p->>'id', 'programm', p->>'programm'));
end $$;
create or replace function public.ws_ki_anbieter_loeschen(p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'KI-Anbieter löscht nur der Admin'; end if;
  delete from public.ws_ki_kopplung where anbieter = p_id;
  update public.ws_ki_zustaendigkeit set reihe = coalesce((select jsonb_agg(x) from jsonb_array_elements(reihe) x where x->>'anbieter' <> p_id), '[{"anbieter":"claude"}]'::jsonb);
  delete from public.ws_ki_anbieter where id = p_id;
end $$;
revoke execute on function public.ws_ki_anbieter_speichern(jsonb), public.ws_ki_anbieter_loeschen(text) from public, anon;
grant execute on function public.ws_ki_anbieter_speichern(jsonb), public.ws_ki_anbieter_loeschen(text) to authenticated;

-- Kopplung: beliebige Anbieter-Kennung; „zugelassen“ setzt nur die Person selbst (eigene Zeile)
alter table public.ws_ki_kopplung drop constraint if exists ws_ki_kopplung_anbieter_check;
alter table public.ws_ki_kopplung add constraint ws_ki_kopplung_anbieter_check check (anbieter ~ '^[a-z][a-z0-9-]{1,30}$');
alter table public.ws_ki_kopplung add column if not exists zugelassen boolean not null default false;

-- Protokoll-Kennung „anbieter/modell“ für beliebige Anbieter
alter table public.ws_claude_chat drop constraint if exists ws_claude_chat_ki_check;
alter table public.ws_claude_chat add constraint ws_claude_chat_ki_check check (ki is null or ki ~ '^[a-z][a-z0-9-]{1,30}(/[A-Za-z0-9][A-Za-z0-9._:-]{0,59})?$');
alter table public.ws_design_chat drop constraint if exists ws_design_chat_ki_check;
alter table public.ws_design_chat add constraint ws_design_chat_ki_check check (ki is null or ki ~ '^[a-z][a-z0-9-]{1,30}(/[A-Za-z0-9][A-Za-z0-9._:-]{0,59})?$');
create or replace function public.ws_ki_vermerken(p_art text, p_antwort bigint, p_ki text) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid; alt text;
begin
  if p_ki is null or p_ki !~ '^[a-z][a-z0-9-]{1,30}(/[A-Za-z0-9][A-Za-z0-9._:-]{0,59})?$' then raise exception 'Ungültige Angabe'; end if;
  if p_art = 'chat' then
    select f.von, a.ki into v, alt from public.ws_claude_chat a join public.ws_claude_chat f on f.id = a.frage_id where a.id = p_antwort and a.von is null;
  elsif p_art = 'design' then
    select f.von, a.ki into v, alt from public.ws_design_chat a join public.ws_design_chat f on f.id = a.frage_id where a.id = p_antwort and a.von is null;
  else raise exception 'Ungültige Art'; end if;
  if v is distinct from auth.uid() then raise exception 'Nur die eigene Werkstatt vermerkt eigene Antworten'; end if;
  if alt is not null then raise exception 'Schon vermerkt'; end if;
  if p_art = 'chat' then update public.ws_claude_chat set ki = p_ki where id = p_antwort;
  else update public.ws_design_chat set ki = p_ki where id = p_antwort; end if;
end $$;

-- Zuständigkeiten: Anbieter = eingebaut oder angelegt (geprüft beim Speichern; die Tabellen-Prüfung kennt nur die Form)
create or replace function public.ws_ki_reihe_ok(p_aufgabe text, r jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare e jsonb;
begin
  if p_aufgabe not in ('chat','konzept','design','pruefung','doku','texte','bilder','bauen') then return false; end if;
  if r is null or jsonb_typeof(r) <> 'array' or jsonb_array_length(r) not between 1 and 8 then return false; end if;
  for e in select * from jsonb_array_elements(r) loop
    if jsonb_typeof(e) <> 'object' or exists (select 1 from jsonb_object_keys(e) k where k not in ('anbieter','modell')) then return false; end if;
    if (e->>'anbieter') is null or (e->>'anbieter') !~ '^[a-z][a-z0-9-]{1,30}$' then return false; end if;
    if e ? 'modell' and (jsonb_typeof(e->'modell') <> 'string' or (e->>'modell') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,59}$') then return false; end if;
  end loop;
  if (select count(distinct x->>'anbieter') from jsonb_array_elements(r) x) <> jsonb_array_length(r) then return false; end if;
  if p_aufgabe = 'bauen' and (jsonb_array_length(r) <> 1 or r->0->>'anbieter' <> 'claude') then return false; end if;
  if p_aufgabe = 'pruefung' and not exists (select 1 from jsonb_array_elements(r) x where x->>'anbieter' = 'claude') then return false; end if;
  return true;
end $$;
create or replace function public.ws_ki_zustaendigkeit_setzen(p_projekt text, p_aufgabe text, p_reihe jsonb, p_ab int default 90)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'Zuständigkeiten stellt nur der Admin ein'; end if;
  if not exists (select 1 from public.ws_projekte where id = p_projekt) then raise exception 'Unbekanntes Projekt'; end if;
  if not public.ws_ki_reihe_ok(p_aufgabe, p_reihe) then raise exception 'Ungültige Zuständigkeit (Bauen nur Claude; Prüfungen mit Claude als Rückfall)'; end if;
  if exists (select 1 from jsonb_array_elements(p_reihe) x where x->>'anbieter' not in ('claude','chatgpt','gemini')
             and not exists (select 1 from public.ws_ki_anbieter a where a.id = x->>'anbieter')) then raise exception 'Unbekannter KI-Anbieter'; end if;
  insert into public.ws_ki_zustaendigkeit (projekt_id, aufgabe, reihe, weitergeben_ab, geaendert, geaendert_von)
    values (p_projekt, p_aufgabe, p_reihe, coalesce(p_ab, 90), now(), auth.uid())
  on conflict (projekt_id, aufgabe) do update set reihe = excluded.reihe, weitergeben_ab = excluded.weitergeben_ab, geaendert = now(), geaendert_von = auth.uid();
end $$;
revoke execute on function public.ws_ki_reihe_ok(text, jsonb), public.ws_ki_argumente_ok(jsonb), public.ws_ki_modelle_ok(jsonb) from public, anon;

do $$ begin
  begin alter publication supabase_realtime add table public.ws_ki_anbieter; exception when duplicate_object then null; end;
end $$;
commit;
