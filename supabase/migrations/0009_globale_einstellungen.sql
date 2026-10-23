-- Codeschmiede · Datenbank v9: Globale Einstellungen (Neue Anweisung Gerhard 2026-10-23 10:20)
-- Je Projekt ein Bereich „Global“ mit der Gruppe „Globale Einstellungen“. Aufgebaut wie alle Gruppen (Features, Chat, Live-Vorschau),
-- erscheint in der App aber nicht als eigener Bereich: die Features dort gelten für die ganze App und alle Nutzer
-- (z. B. Anmeldung: erstmalige Anmeldung, danach sofort eingeloggt). Rechte wie jeder Bereich (Entscheidung 10:22).
-- Mehrfach ausführbar. Reihenfolge 0001 → … → 0009.

begin;

alter table public.ws_bereiche add column if not exists global boolean not null default false;
-- höchstens ein globaler Bereich je Projekt
create unique index if not exists ws_bereiche_ein_global on public.ws_bereiche (projekt_id) where global;

create or replace function public.ws_global_anlegen(p_projekt text) returns void
language plpgsql security definer set search_path = public as $$
declare b text := case when p_projekt = 'trainer-to-go' then 'global' else p_projekt || '-global' end;
begin
  if exists (select 1 from public.ws_bereiche where projekt_id = p_projekt and global) then return; end if;
  insert into public.ws_bereiche (id, projekt_id, name, reihenfolge, global) values (b, p_projekt, 'Global', 99, true)
    on conflict (id) do update set global = true;
  insert into public.ws_gruppen (id, bereich_id, name, symbol, reihenfolge)
    values (b || '-einstellungen', b, 'Globale Einstellungen', 'globe', 1) on conflict (id) do nothing;
end $$;
revoke execute on function public.ws_global_anlegen(text) from public, anon, authenticated;

-- Bestehende Projekte
select public.ws_global_anlegen(id) from public.ws_projekte;

-- Neue Projekte bekommen den Bereich automatisch
create or replace function public.ws_projekt_global() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform public.ws_global_anlegen(new.id); return new; end $$;
revoke execute on function public.ws_projekt_global() from public, anon, authenticated;
drop trigger if exists ws_projekt_global on public.ws_projekte;
create trigger ws_projekt_global after insert on public.ws_projekte for each row execute function public.ws_projekt_global();

-- Der globale Bereich ist fest: nicht umbenennbar in einen normalen Bereich, Gruppe bleibt darin
create or replace function public.ws_bereich_global_schutz() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and old.global is distinct from new.global then raise exception 'Der globale Bereich ist fest'; end if;
  return new;
end $$;
drop trigger if exists ws_bereich_global_schutz on public.ws_bereiche;
create trigger ws_bereich_global_schutz before update on public.ws_bereiche for each row execute function public.ws_bereich_global_schutz();

-- Features selbst zuordnen und verschieben (Anweisung Gerhard 2026-10-23 10:26): nur Admin, nur innerhalb desselben Projekts.
-- Die Aufträge bleiben am Feature (Verlauf wandert mit, die Oberfläche zeigt Aufträge je Feature).
create or replace function public.ws_feature_verschieben(p_feature text, p_gruppe text) returns void
language plpgsql security definer set search_path = public as $$
declare alt text;
begin
  if not public.ws_ist_admin() then raise exception 'Nur der Admin verschiebt Features'; end if;
  select gruppe_id into alt from public.ws_features where id = p_feature for update;
  if alt is null then raise exception 'Feature nicht gefunden'; end if;
  if not exists (select 1 from public.ws_gruppen where id = p_gruppe) then raise exception 'Gruppe nicht gefunden'; end if;
  if public.ws_projekt_von_gruppe(alt) is distinct from public.ws_projekt_von_gruppe(p_gruppe) then
    raise exception 'Features lassen sich nur innerhalb desselben Projekts verschieben'; end if;
  if alt = p_gruppe then return; end if;
  update public.ws_features set gruppe_id = p_gruppe, geaendert = now() where id = p_feature;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'verschieben', jsonb_build_object('feature', p_feature, 'von', alt, 'nach', p_gruppe));
end $$;
revoke execute on function public.ws_feature_verschieben(text, text) from public, anon;
grant execute on function public.ws_feature_verschieben(text, text) to authenticated;

commit;

select b.projekt_id, b.id as bereich, g.id as gruppe, g.name from public.ws_bereiche b join public.ws_gruppen g on g.bereich_id = b.id where b.global;
