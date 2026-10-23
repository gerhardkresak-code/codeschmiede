-- Codeschmiede · Datenbank v12: KI-Anbieter (Entwurf 1.2, freigegeben von Gerhard 2026-10-23 15:00)
-- Beliebig viele Anbieter (Claude, ChatGPT, Gemini) mit dem eigenen Abo der Person. Je Aufgabe legt der Admin Anbieter + Modell
-- in einer Reihenfolge fest; der nächste übernimmt bei vollem Limit oder ohne Kopplung. „Bauen“ ist fest Claude (Entscheidung 14:27).
-- Im Chat sieht man nicht, wer antwortet – vermerkt wird es in der Spalte „ki“ (Protokoll).
-- Keine Zugangsdaten in der Datenbank: die Anmeldung bleibt im Anmeldespeicher des jeweiligen Programms auf dem PC.
-- Mehrfach ausführbar. Reihenfolge 0001 → … → 0012.

begin;

-- ---------- Zuständigkeiten (nur Admin) ----------
create or replace function public.ws_ki_reihe_ok(p_aufgabe text, r jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare e jsonb;
begin
  if p_aufgabe not in ('chat','konzept','design','pruefung','doku','texte','bilder','bauen') then return false; end if;
  if r is null or jsonb_typeof(r) <> 'array' or jsonb_array_length(r) not between 1 and 6 then return false; end if;
  for e in select * from jsonb_array_elements(r) loop
    if jsonb_typeof(e) <> 'object' or exists (select 1 from jsonb_object_keys(e) k where k not in ('anbieter','modell')) then return false; end if;
    if (e->>'anbieter') is null or (e->>'anbieter') not in ('claude','chatgpt','gemini') then return false; end if;
    if e ? 'modell' and (jsonb_typeof(e->'modell') <> 'string' or (e->>'modell') !~ '^[A-Za-z0-9._:-]{1,60}$') then return false; end if;
  end loop;
  if (select count(distinct x->>'anbieter') from jsonb_array_elements(r) x) <> jsonb_array_length(r) then return false; end if;
  -- Bauen nie durch einen anderen Anbieter (Gerhard 2026-10-23 14:27: „NEIN NIE“)
  if p_aufgabe = 'bauen' and (jsonb_array_length(r) <> 1 or r->0->>'anbieter' <> 'claude') then return false; end if;
  return true;
end $$;

create table if not exists public.ws_ki_zustaendigkeit (
  projekt_id text not null references public.ws_projekte(id) on delete cascade,
  aufgabe text not null,
  reihe jsonb not null,
  weitergeben_ab int not null default 90 check (weitergeben_ab between 50 and 100),
  geaendert timestamptz not null default now(),
  geaendert_von uuid references auth.users(id),
  primary key (projekt_id, aufgabe),
  check (public.ws_ki_reihe_ok(aufgabe, reihe))
);
revoke all on public.ws_ki_zustaendigkeit from anon, authenticated;
grant select on public.ws_ki_zustaendigkeit to authenticated;
alter table public.ws_ki_zustaendigkeit enable row level security;
drop policy if exists ws_ki_zust_lesen on public.ws_ki_zustaendigkeit;
create policy ws_ki_zust_lesen on public.ws_ki_zustaendigkeit for select to authenticated using (public.ws_sieht_projekt(projekt_id));

create or replace function public.ws_ki_zustaendigkeit_setzen(p_projekt text, p_aufgabe text, p_reihe jsonb, p_ab int default 90)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'Zuständigkeiten stellt nur der Admin ein'; end if;
  if not exists (select 1 from public.ws_projekte where id = p_projekt) then raise exception 'Unbekanntes Projekt'; end if;
  if not public.ws_ki_reihe_ok(p_aufgabe, p_reihe) then raise exception 'Ungültige Zuständigkeit (Bauen ist fest Claude)'; end if;
  insert into public.ws_ki_zustaendigkeit (projekt_id, aufgabe, reihe, weitergeben_ab, geaendert, geaendert_von)
    values (p_projekt, p_aufgabe, p_reihe, coalesce(p_ab, 90), now(), auth.uid())
  on conflict (projekt_id, aufgabe) do update set reihe = excluded.reihe, weitergeben_ab = excluded.weitergeben_ab, geaendert = now(), geaendert_von = auth.uid();
end $$;
revoke execute on function public.ws_ki_zustaendigkeit_setzen(text, text, jsonb, int) from public, anon;
grant execute on function public.ws_ki_zustaendigkeit_setzen(text, text, jsonb, int) to authenticated;

-- ---------- Kopplung je PC (nur eigene) ----------
create table if not exists public.ws_ki_kopplung (
  pc_id uuid not null references public.ws_werkstatt_pcs(id) on delete cascade,
  benutzer_id uuid not null default auth.uid() references auth.users(id),
  anbieter text not null check (anbieter in ('claude','chatgpt','gemini')),
  gekoppelt boolean not null default false,
  version text check (char_length(version) <= 80),
  hinweis text check (char_length(hinweis) <= 500),
  limit_bis timestamptz,                         -- Limit voll bis (nach Fehlermeldung des Anbieters)
  aktion text check (aktion in ('pruefen','anmelden')),
  geprueft timestamptz,
  primary key (pc_id, anbieter)
);
revoke all on public.ws_ki_kopplung from anon, authenticated;
grant select, insert, update on public.ws_ki_kopplung to authenticated;
alter table public.ws_ki_kopplung enable row level security;
drop policy if exists ws_ki_kopplung_lesen on public.ws_ki_kopplung;
create policy ws_ki_kopplung_lesen on public.ws_ki_kopplung for select to authenticated using (benutzer_id = auth.uid() or public.ws_ist_admin());
drop policy if exists ws_ki_kopplung_neu on public.ws_ki_kopplung;
create policy ws_ki_kopplung_neu on public.ws_ki_kopplung for insert to authenticated
  with check (benutzer_id = auth.uid() and exists (select 1 from public.ws_werkstatt_pcs p where p.id = pc_id and p.benutzer_id = auth.uid()));
drop policy if exists ws_ki_kopplung_aendern on public.ws_ki_kopplung;
create policy ws_ki_kopplung_aendern on public.ws_ki_kopplung for update to authenticated
  using (benutzer_id = auth.uid())
  with check (benutzer_id = auth.uid() and exists (select 1 from public.ws_werkstatt_pcs p where p.id = pc_id and p.benutzer_id = auth.uid()));
do $$ begin
  begin alter publication supabase_realtime add table public.ws_ki_kopplung; exception when duplicate_object then null; end;
end $$;

-- ---------- Protokoll: wer hat geantwortet ----------
alter table public.ws_claude_chat add column if not exists ki text check (ki is null or ki ~ '^(claude|chatgpt|gemini)(/[A-Za-z0-9._:-]{1,60})?$');
alter table public.ws_design_chat add column if not exists ki text check (ki is null or ki ~ '^(claude|chatgpt|gemini)(/[A-Za-z0-9._:-]{1,60})?$');

create or replace function public.ws_ki_vermerken(p_art text, p_antwort bigint, p_ki text) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid; alt text;
begin
  if p_ki is null or p_ki !~ '^(claude|chatgpt|gemini)(/[A-Za-z0-9._:-]{1,60})?$' then raise exception 'Ungültige Angabe'; end if;
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
revoke execute on function public.ws_ki_vermerken(text, bigint, text) from public, anon;
grant execute on function public.ws_ki_vermerken(text, bigint, text) to authenticated;

-- ---------- Konzept-Karte im Chat-Vorschlag ----------
-- Vorschlag darf zusätzlich „konzept“ enthalten: {ziel, umfang, datenschutz: Text; entscheidungen, offen, abnahme: Listen von Texten}
create or replace function public.ws_konzept_ok(k jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare key text;
begin
  if k is null then return true; end if;
  if jsonb_typeof(k) <> 'object' then return false; end if;
  for key in select jsonb_object_keys(k) loop
    if key in ('ziel','umfang','datenschutz') then
      if jsonb_typeof(k->key) <> 'string' or char_length(k->>key) > 2000 then return false; end if;
    elsif key in ('entscheidungen','offen','abnahme') then
      if jsonb_typeof(k->key) <> 'array' or jsonb_array_length(k->key) > 20
         or exists (select 1 from jsonb_array_elements(k->key) x where jsonb_typeof(x) <> 'string' or char_length(x #>> '{}') > 500) then return false; end if;
    else return false; end if;
  end loop;
  return true;
end $$;

create or replace function public.ws_vorschlag_ok(p_projekt text, v jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if v is null then return true; end if;
  if jsonb_typeof(v) <> 'object' or exists (select 1 from jsonb_object_keys(v) k where k not in ('gruppe_id','feature_id','titel','text','konzept')) then return false; end if;
  if jsonb_typeof(v->'gruppe_id') <> 'string' or jsonb_typeof(v->'titel') <> 'string' or jsonb_typeof(v->'text') <> 'string' then return false; end if;
  if char_length(v->>'titel') not between 3 and 80 or char_length(v->>'text') not between 10 and 8000 then return false; end if;
  if public.ws_projekt_von_gruppe(v->>'gruppe_id') is distinct from p_projekt then return false; end if;
  if v ? 'feature_id' and v->'feature_id' <> 'null'::jsonb then
    if jsonb_typeof(v->'feature_id') <> 'string' or not exists (select 1 from public.ws_features f where f.id = v->>'feature_id' and f.gruppe_id = v->>'gruppe_id') then return false; end if;
  end if;
  if not public.ws_konzept_ok(v->'konzept') then return false; end if;
  return true;
end $$;
revoke execute on function public.ws_vorschlag_ok(text, jsonb) from public, anon;

commit;

select (select count(*) from public.ws_ki_zustaendigkeit) as zustaendigkeiten;
