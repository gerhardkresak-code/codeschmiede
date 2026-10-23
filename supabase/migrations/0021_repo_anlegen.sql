-- Codeschmiede · Datenbank v21: GitHub-Repository beim Anlegen eines Projekts (Gerhard 2026-10-23 18:38, Antworten 18:40):
-- Konto gerhardkresak-code · öffentlich, per Klick auf privat umstellbar · Grundgerüst nach dem Regelwerk (ai-dev-os/project-template)
-- · bei der Anlage (Häkchen), später jederzeit möglich. Ohne Repository funktionieren Konzept, App-Designer und Chat; Bau-Aufträge warten.
-- Angelegt wird NUR von der Werkstatt des Admins (seine GitHub-Anmeldung) – die Codeschmiede speichert keine GitHub-Zugänge.
-- Mehrfach ausführbar. Reihenfolge 0001 → … → 0021.
begin;

alter table public.ws_projekte add column if not exists repo_aktion text check (repo_aktion in ('anlegen','sichtbarkeit'));
alter table public.ws_projekte add column if not exists repo_privat boolean;   -- tatsächliche Sichtbarkeit; null = noch unbekannt
alter table public.ws_projekte add column if not exists repo_wunsch_privat boolean;   -- gewünschte Sichtbarkeit des laufenden Auftrags (Prüfung N2)
alter table public.ws_projekte add column if not exists repo_stand text check (repo_stand in ('angefragt','laeuft','fertig','fehler'));
alter table public.ws_projekte add column if not exists repo_hinweis text check (char_length(repo_hinweis) <= 500);
alter table public.ws_projekte add column if not exists repo_pc uuid references public.ws_werkstatt_pcs(id) on delete set null;
alter table public.ws_projekte add column if not exists repo_geaendert timestamptz;

-- Repository-Kennung: Konto/Name wie bei GitHub
create or replace function public.ws_repo_ok(p text) returns boolean
language sql immutable set search_path = public as $$
  select p ~ '^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})/[A-Za-z0-9._-]{1,100}$' and p !~ '/\.\.?$'
$$;

-- Admin: Repository anlegen lassen (nur wenn noch keins hinterlegt ist)
create or replace function public.ws_repo_anfordern(p_projekt text, p_privat boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'GitHub-Repositorys legt nur der Admin an'; end if;
  update public.ws_projekte set repo_aktion = 'anlegen', repo_wunsch_privat = coalesce(p_privat, false), repo_stand = 'angefragt',
         repo_hinweis = 'Wartet auf die Werkstatt des Admins', repo_pc = null, repo_geaendert = now()
   where id = p_projekt and repo is null and not coalesce(archiviert, false)
     and (coalesce(repo_stand, '') not in ('angefragt','laeuft') or repo_geaendert < now() - interval '15 minutes');   -- Prüfung N1
  if not found then raise exception 'Projekt nicht gefunden, archiviert, hat schon ein Repository oder es läuft gerade ein GitHub-Auftrag'; end if;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'repo_angefragt', jsonb_build_object('projekt', p_projekt, 'privat', coalesce(p_privat, false)));
end $$;

-- Admin: Sichtbarkeit umstellen (öffentlich ↔ privat)
create or replace function public.ws_repo_sichtbarkeit(p_projekt text, p_privat boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'Die Sichtbarkeit stellt nur der Admin um'; end if;
  update public.ws_projekte set repo_aktion = 'sichtbarkeit', repo_wunsch_privat = p_privat, repo_stand = 'angefragt',
         repo_hinweis = 'Wartet auf die Werkstatt des Admins', repo_pc = null, repo_geaendert = now()
   where id = p_projekt and repo is not null
     and (coalesce(repo_stand, '') not in ('angefragt','laeuft') or repo_geaendert < now() - interval '15 minutes');
  if not found then raise exception 'Projekt hat noch kein Repository oder es läuft gerade ein GitHub-Auftrag'; end if;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'repo_sichtbarkeit', jsonb_build_object('projekt', p_projekt, 'privat', p_privat));
end $$;

-- Werkstatt des Admins: nächsten Repository-Auftrag nehmen
create or replace function public.ws_repo_nehmen(p_pc uuid)
returns table (projekt_id text, name text, beschreibung text, aktion text, privat boolean, repo text)
language plpgsql security definer set search_path = public as $$
declare p public.ws_projekte;
begin
  if not public.ws_ist_admin() then return; end if;
  if not exists (select 1 from public.ws_werkstatt_pcs w where w.id = p_pc and w.benutzer_id = auth.uid() and w.an) then raise exception 'Unbekannter Werkstatt-PC'; end if;
  select * into p from public.ws_projekte x
   where x.repo_aktion is not null and (x.repo_stand = 'angefragt' or (x.repo_stand = 'laeuft' and x.repo_geaendert < now() - interval '15 minutes'))
   order by x.repo_geaendert nulls first limit 1 for update skip locked;
  if p.id is null then return; end if;
  update public.ws_projekte set repo_stand = 'laeuft', repo_pc = p_pc, repo_geaendert = now(), repo_hinweis = 'Werkstatt arbeitet' where id = p.id;
  return query select p.id, p.name, p.beschreibung, p.repo_aktion, coalesce(p.repo_wunsch_privat, false), p.repo;
end $$;

-- Werkstatt des Admins: Ergebnis melden
create or replace function public.ws_repo_ergebnis(p_pc uuid, p_projekt text, p_repo text, p_fehler text default null) returns void
language plpgsql security definer set search_path = public as $$
declare p public.ws_projekte;
begin
  if not public.ws_ist_admin() then raise exception 'Nur die Werkstatt des Admins'; end if;
  select * into p from public.ws_projekte where id = p_projekt for update;
  if p.id is null or p.repo_pc is distinct from p_pc or p.repo_stand <> 'laeuft' then raise exception 'Kein laufender Repository-Auftrag dieser Werkstatt'; end if;
  if not exists (select 1 from public.ws_werkstatt_pcs w where w.id = p_pc and w.benutzer_id = auth.uid()) then raise exception 'Unbekannter Werkstatt-PC'; end if;
  if p_fehler is not null then
    update public.ws_projekte set repo_stand = 'fehler', repo_aktion = null, repo_hinweis = left(p_fehler, 500), repo_geaendert = now() where id = p_projekt;
  elsif p.repo_aktion = 'anlegen' then
    if p_repo is null or not public.ws_repo_ok(p_repo) then raise exception 'Ungültiges Repository'; end if;
    update public.ws_projekte set repo = coalesce(repo, p_repo), repo_privat = repo_wunsch_privat, repo_stand = 'fertig', repo_aktion = null,
           repo_hinweis = 'Angelegt', repo_geaendert = now() where id = p_projekt;
  else
    update public.ws_projekte set repo_privat = repo_wunsch_privat, repo_stand = 'fertig', repo_aktion = null,
           repo_hinweis = case when repo_wunsch_privat then 'Auf privat umgestellt' else 'Auf öffentlich umgestellt' end, repo_geaendert = now() where id = p_projekt;
  end if;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'repo_ergebnis', jsonb_build_object('projekt', p_projekt, 'repo', p_repo, 'fehler', p_fehler));
end $$;

-- Werkstatt des Admins meldet die tatsächliche Sichtbarkeit (Abgleich), damit die Oberfläche sie richtig anzeigt (Prüfung M4)
create or replace function public.ws_repo_sichtbarkeit_melden(p_projekt text, p_privat boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then return; end if;
  update public.ws_projekte set repo_privat = p_privat where id = p_projekt and repo is not null and repo_privat is distinct from p_privat
    and coalesce(repo_stand, '') not in ('angefragt','laeuft');
end $$;
revoke execute on function public.ws_repo_sichtbarkeit_melden(text, boolean) from public, anon;
grant execute on function public.ws_repo_sichtbarkeit_melden(text, boolean) to authenticated;

revoke execute on function public.ws_repo_anfordern(text, boolean), public.ws_repo_sichtbarkeit(text, boolean),
  public.ws_repo_nehmen(uuid), public.ws_repo_ergebnis(uuid, text, text, text) from public, anon;
grant execute on function public.ws_repo_anfordern(text, boolean), public.ws_repo_sichtbarkeit(text, boolean),
  public.ws_repo_nehmen(uuid), public.ws_repo_ergebnis(uuid, text, text, text) to authenticated;
revoke execute on function public.ws_repo_ok(text) from public, anon;

commit;
