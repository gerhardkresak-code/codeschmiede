-- Codeschmiede · Datenbank v28: Live-Vorschau öffnet die Seite des Features (Gerhard 2026-10-23 23:23, „Automatisch + merken“)
-- Je Feature eine Seite der App (Pfad, optional mit ?tab=…). Vorbelegt für Trainer to go; korrigierbar per „Diese Seite merken“.
-- Mehrfach ausführbar. Reihenfolge 0001 → … → 0028.
begin;

alter table public.ws_features add column if not exists vorschau_pfad text;
alter table public.ws_features drop constraint if exists ws_features_vorschau_pfad_check;
alter table public.ws_features add constraint ws_features_vorschau_pfad_check
  check (vorschau_pfad is null or (vorschau_pfad ~ '^/[A-Za-z0-9/_.~-]{0,150}(\?[A-Za-z0-9_=&.~%-]{0,150})?$' and vorschau_pfad !~ '(^|/)\.\.(/|$|\?)' and vorschau_pfad !~ '^//'));

-- Setzen: Admin oder wer im Bereich des Features Aufträge anlegen darf; leer = Startseite des Projekts
create or replace function public.ws_feature_vorschau_setzen(p_feature text, p_pfad text) returns void
language plpgsql security definer set search_path = public as $$
declare g text;
begin
  select gruppe_id into g from public.ws_features where id = p_feature;
  if g is null then raise exception 'Feature nicht gefunden'; end if;
  if not public.ws_darf(public.ws_bereich_von_gruppe(g), 'auftraege') then raise exception 'Keine Berechtigung für dieses Feature'; end if;
  update public.ws_features set vorschau_pfad = nullif(trim(p_pfad), ''), geaendert = now() where id = p_feature;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'vorschau_seite', jsonb_build_object('feature', p_feature, 'pfad', nullif(trim(p_pfad), '')));
end $$;
revoke execute on function public.ws_feature_vorschau_setzen(text, text) from public, anon;
grant execute on function public.ws_feature_vorschau_setzen(text, text) to authenticated;

-- Vorbelegung Trainer to go (nur wo noch nichts gemerkt ist)
update public.ws_features f set vorschau_pfad = v.pfad
  from (values
  ('F-001', '/login'),
  ('F-002', '/onboarding'),
  ('F-006', '/einladung'),
  ('F-007', '/trainerprofil'),
  ('F-009', '/home'),
  ('F-010', '/home'),
  ('F-011', '/players'),
  ('F-012', '/trainings'),
  ('F-013', '/pricing'),
  ('F-180', '/datenschutz'),
  ('F-005', '/home'),
  ('F-150', '/desktop'),
  ('F-151', '/platform-admin?m=cockpit'),
  ('F-152', '/platform-admin?m=pipeline'),
  ('F-153', '/platform-admin?m=vereine'),
  ('F-154', '/platform-admin?m=preise'),
  ('F-155', '/platform-admin?m=eingangsrechnungen'),
  ('F-156', '/platform-admin?m=liquiditaet'),
  ('F-157', '/platform-admin?m=uebungen'),
  ('F-158', '/platform-admin?m=team'),
  ('F-159', '/platform-admin?m=vereine'),
  ('F-160', '/platform-admin'),
  ('F-100', '/fee-overview'),
  ('F-101', '/kassa?tab=journal'),
  ('F-102', '/kassa?tab=journal'),
  ('F-103', '/kassa?tab=count'),
  ('F-104', '/kassa?tab=budget'),
  ('F-105', '/kassa?tab=donations'),
  ('F-106', '/kassa?tab=closing'),
  ('F-107', '/kassa?tab=closing'),
  ('F-108', '/kassa'),
  ('F-140', '/pdf-layout'),
  ('F-145', '/platform-admin?m=design'),
  ('F-141', '/pdf-layout'),
  ('F-142', '/guide'),
  ('F-143', '/hilfe'),
  ('F-144', '/guide'),
  ('F-030', '/roster'),
  ('F-031', '/roster'),
  ('F-032', '/players'),
  ('F-033', '/roster'),
  ('F-034', '/players'),
  ('F-035', '/roster'),
  ('F-036', '/players'),
  ('F-037', '/players'),
  ('F-038', '/reports'),
  ('F-020', '/home'),
  ('F-021', '/home'),
  ('F-022', '/home'),
  ('F-023', '/home'),
  ('F-080', '/calendar'),
  ('F-081', '/calendar'),
  ('F-110', '/canteen?tab=days'),
  ('F-111', '/canteen?tab=articles'),
  ('F-112', '/canteen?tab=stock'),
  ('F-113', '/canteen?tab=preorders'),
  ('F-114', '/canteen?tab=closing'),
  ('F-115', '/canteen'),
  ('F-082', '/trainings'),
  ('F-083', '/polls'),
  ('F-084', '/chat'),
  ('F-085', '/chat'),
  ('F-086', '/tasks'),
  ('F-087', '/tickets'),
  ('F-120', '/users'),
  ('F-122', '/users'),
  ('F-123', '/vorstand'),
  ('F-126', '/nachwuchs'),
  ('F-128', '/nachwuchs?tab=tests'),
  ('F-129', '/nachwuchs?tab=jahrgang'),
  ('F-132', '/nachwuchs?tab=trainer'),
  ('F-133', '/nachwuchs?tab=trainer'),
  ('F-121', '/rights'),
  ('F-124', '/versammlungen'),
  ('F-125', '/versammlungen'),
  ('F-060', '/tournaments'),
  ('F-061', '/tournaments'),
  ('F-062', '/tournaments'),
  ('F-063', '/tournaments'),
  ('F-064', '/tournaments'),
  ('F-065', '/tournaments'),
  ('F-066', '/tournaments'),
  ('F-067', '/tournaments'),
  ('F-068', '/tournaments'),
  ('F-069', '/tournaments'),
  ('F-070', '/tournaments'),
  ('F-130', '/sportleitung?tab=ueberblick'),
  ('F-131', '/sportleitung?tab=scouting'),
  ('F-075', '/tactics'),
  ('F-076', '/tactics?tab=plans'),
  ('F-077', '/tactics?tab=standards'),
  ('F-040', '/trainings'),
  ('F-041', '/trainings?tab=units'),
  ('F-042', '/trainings'),
  ('F-043', '/trainings?tab=week'),
  ('F-044', '/trainings?tab=load'),
  ('F-045', '/trainings?tab=curriculum'),
  ('F-046', '/trainings?tab=individual'),
  ('F-047', '/trainings?tab=season'),
  ('F-048', '/trainings?tab=report'),
  ('F-049', '/trainings?tab=equipment'),
  ('F-050', '/trainings?tab=features'),
  ('F-051', '/trainings'),
  ('F-052', '/exercise-library'),
  ('F-053', '/users'),
  ('F-054', '/leistungstests'),
  ('F-055', '/trainings'),
  ('F-056', '/trainings'),
  ('F-127', '/nachwuchs?tab=coaching'),
  ('F-134', '/trainings?tab=pitches'),
  ('F-090', '/equipment'),
  ('F-091', '/equipment?tab=inventory'),
  ('F-092', '/jerseys'),
  ('F-093', '/equipment')
  ) as v(id, pfad)
 where f.id = v.id and f.vorschau_pfad is null and public.ws_projekt_von_gruppe(f.gruppe_id) = 'trainer-to-go';

commit;
