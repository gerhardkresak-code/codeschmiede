-- Codeschmiede · Datenbank v11: Projekt-Abgleich (Anweisung Gerhard 2026-10-23 14:11 „Mache einfach alles fertig“)
-- Die Werkstatt (Admin oder Entwickler, eigener eingeschalteter PC) schreibt den Stand des Projekt-Repositorys:
--   ws_zweige     – alle Zweige mit letztem Stand und Abstand zu main (für „Zweige & Versionen“)
--   ws_dokumente  – Dokumentation aus main (docs/*.md, AGENTS.md, README.md) für Wissensdatenbank, Änderungsprotokoll, Dokumentation
-- Nur Technik-Daten und Projekttexte aus GitHub, keine Personendaten von Vereinsmitgliedern. Mehrfach ausführbar. Reihenfolge 0001 → … → 0011.

begin;

create table if not exists public.ws_zweige (
  projekt_id text not null references public.ws_projekte(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 255),
  sha text not null check (sha ~ '^[0-9a-f]{7,40}$'),
  datum timestamptz,
  betreff text check (char_length(betreff) <= 300),
  vor int check (vor >= 0),        -- Commits, die main nicht hat
  hinter int check (hinter >= 0),  -- Commits von main, die dem Zweig fehlen
  aktualisiert timestamptz not null default now(),
  primary key (projekt_id, name)
);
create table if not exists public.ws_dokumente (
  projekt_id text not null references public.ws_projekte(id) on delete cascade,
  pfad text not null check (pfad ~ '^(docs/[A-Za-z0-9._/-]+\.md|AGENTS\.md|README\.md)$' and pfad !~ '\.\.'),
  inhalt text not null check (octet_length(inhalt) <= 1048576),
  sha text not null check (sha ~ '^[0-9a-f]{7,40}$'),
  aktualisiert timestamptz not null default now(),
  primary key (projekt_id, pfad)
);
create table if not exists public.ws_abgleich (
  projekt_id text primary key references public.ws_projekte(id) on delete cascade,
  main_sha text, zeit timestamptz not null default now(), von uuid references auth.users(id)
);

revoke all on public.ws_zweige, public.ws_dokumente, public.ws_abgleich from anon, authenticated;
grant select on public.ws_zweige, public.ws_dokumente, public.ws_abgleich to authenticated;
alter table public.ws_zweige enable row level security;
alter table public.ws_dokumente enable row level security;
alter table public.ws_abgleich enable row level security;
drop policy if exists ws_zweige_lesen on public.ws_zweige;
create policy ws_zweige_lesen on public.ws_zweige for select to authenticated using (public.ws_sieht_projekt(projekt_id));
drop policy if exists ws_dokumente_lesen on public.ws_dokumente;
create policy ws_dokumente_lesen on public.ws_dokumente for select to authenticated using (public.ws_sieht_projekt(projekt_id));
drop policy if exists ws_abgleich_lesen on public.ws_abgleich;
create policy ws_abgleich_lesen on public.ws_abgleich for select to authenticated using (public.ws_sieht_projekt(projekt_id));

-- Schreiben nur über diese Funktion: eigener, eingeschalteter Werkstatt-PC; Admin oder Entwickler im Projekt.
-- Ersetzt den kompletten Stand des Projekts (was nicht mehr da ist, wird entfernt).
create or replace function public.ws_abgleich_schreiben(p_pc uuid, p_projekt text, p_main text, p_zweige jsonb, p_dokumente jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.ws_werkstatt_pcs where id = p_pc and benutzer_id = auth.uid() and an) then
    raise exception 'Unbekannter Werkstatt-PC'; end if;
  if coalesce(public.ws_rolle_im_projekt(p_projekt), '') not in ('admin','entwickler') then
    raise exception 'Kein Recht für den Abgleich in diesem Projekt'; end if;
  if jsonb_typeof(p_zweige) <> 'array' or jsonb_array_length(p_zweige) > 2000
     or jsonb_typeof(p_dokumente) <> 'array' or jsonb_array_length(p_dokumente) > 500 then
    raise exception 'Ungültiger Abgleich'; end if;
  if p_main is null or p_main !~ '^[0-9a-f]{7,40}$' then raise exception 'Ungültiger Stand von main'; end if;

  delete from public.ws_zweige where projekt_id = p_projekt
    and name not in (select z->>'name' from jsonb_array_elements(p_zweige) z);
  insert into public.ws_zweige (projekt_id, name, sha, datum, betreff, vor, hinter, aktualisiert)
    select p_projekt, z->>'name', z->>'sha', (z->>'datum')::timestamptz, left(z->>'betreff', 300),
           nullif(z->>'vor','')::int, nullif(z->>'hinter','')::int, now()
    from jsonb_array_elements(p_zweige) z
  on conflict (projekt_id, name) do update set sha = excluded.sha, datum = excluded.datum, betreff = excluded.betreff,
    vor = excluded.vor, hinter = excluded.hinter, aktualisiert = now();

  delete from public.ws_dokumente where projekt_id = p_projekt
    and pfad not in (select x->>'pfad' from jsonb_array_elements(p_dokumente) x);
  insert into public.ws_dokumente (projekt_id, pfad, inhalt, sha, aktualisiert)
    select p_projekt, x->>'pfad', x->>'inhalt', x->>'sha', now() from jsonb_array_elements(p_dokumente) x
  on conflict (projekt_id, pfad) do update set inhalt = excluded.inhalt, sha = excluded.sha, aktualisiert = now()
    where public.ws_dokumente.sha is distinct from excluded.sha;

  insert into public.ws_abgleich (projekt_id, main_sha, zeit, von) values (p_projekt, p_main, now(), auth.uid())
  on conflict (projekt_id) do update set main_sha = excluded.main_sha, zeit = now(), von = auth.uid();
end $$;
revoke execute on function public.ws_abgleich_schreiben(uuid, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.ws_abgleich_schreiben(uuid, text, text, jsonb, jsonb) to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.ws_abgleich; exception when duplicate_object then null; end;
end $$;

commit;

select (select count(*) from public.ws_zweige) as zweige, (select count(*) from public.ws_dokumente) as dokumente;
