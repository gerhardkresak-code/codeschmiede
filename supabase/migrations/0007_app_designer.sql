-- Codeschmiede · Datenbank v7: App-Designer, Etappe 1 (Entwurf 0.9 freigegeben von Gerhard 2026-10-22 22:40)
-- Ein Grunddesign je Projekt (nicht je Rolle). Entwürfe speichern, Versionen behalten, vergleichen;
-- „Als Auftrag senden“ legt einen normalen Auftrag in der Design-Gruppe des Projekts an (Weg: Freigabe → Prüfungen → live).
-- Geht der Auftrag live (Stand „wissen“), wird der Entwurf das gültige Grunddesign.
-- Keine Personendaten, nur Gestaltungswerte. Mehrfach ausführbar. Reihenfolge 0001 → … → 0007.

begin;

-- Design-Gruppe je Projekt (dorthin gehen die Design-Aufträge; Recht „Aufträge“ in deren Bereich = darf gestalten)
alter table public.ws_projekte add column if not exists design_gruppe_id text references public.ws_gruppen(id);
update public.ws_projekte set design_gruppe_id = 'design'
  where id = 'trainer-to-go' and design_gruppe_id is null and exists (select 1 from public.ws_gruppen where id = 'design');
grant update (design_gruppe_id) on public.ws_projekte to authenticated;   -- Policy ws_projekte_admin: nur Admin

create or replace function public.ws_darf_design(p_projekt text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.ws_darf(public.ws_bereich_von_gruppe(p.design_gruppe_id), 'auftraege')
                     and public.ws_projekt_von_gruppe(p.design_gruppe_id) = p.id
                   from public.ws_projekte p where p.id = p_projekt and p.design_gruppe_id is not null), false)
$$;
revoke execute on function public.ws_darf_design(text) from public, anon;
grant execute on function public.ws_darf_design(text) to authenticated;

-- ---------- Entwürfe ----------
create table if not exists public.ws_design_entwuerfe (
  id bigserial primary key,
  projekt_id text not null references public.ws_projekte(id),
  name text not null check (char_length(name) between 1 and 80),
  werte jsonb not null default '{}'::jsonb check (jsonb_typeof(werte) = 'object' and pg_column_size(werte) < 65536),
  notiz text check (notiz is null or char_length(notiz) <= 2000),
  stand text not null default 'entwurf' check (stand in ('entwurf','gesendet','live','ersetzt','verworfen')),
  auftrag_id bigint references public.ws_auftraege(id),
  version int not null default 1,
  erstellt_von uuid not null default auth.uid() references auth.users(id),
  erstellt timestamptz not null default now(),
  geaendert timestamptz not null default now()
);
create index if not exists ws_design_entwuerfe_projekt on public.ws_design_entwuerfe (projekt_id, stand);

-- Jede gespeicherte Fassung eines Entwurfs bleibt erhalten (zurückholen, vergleichen)
create table if not exists public.ws_design_versionen (
  id bigserial primary key,
  entwurf_id bigint not null references public.ws_design_entwuerfe(id) on delete cascade,
  nr int not null,
  werte jsonb not null,
  erstellt_von uuid not null references auth.users(id),
  erstellt timestamptz not null default now(),
  unique (entwurf_id, nr)
);

-- Rechte: lesen + anlegen; ändern/löschen nur über die Funktionen (Supabase vergibt sonst standardmäßig alles)
revoke all on public.ws_design_entwuerfe, public.ws_design_versionen from anon, authenticated;
grant select, insert on public.ws_design_entwuerfe to authenticated;
grant select on public.ws_design_versionen to authenticated;
grant usage on sequence public.ws_design_entwuerfe_id_seq to authenticated;

alter table public.ws_design_entwuerfe enable row level security;
alter table public.ws_design_versionen enable row level security;

drop policy if exists ws_design_lesen on public.ws_design_entwuerfe;
create policy ws_design_lesen on public.ws_design_entwuerfe for select to authenticated using (public.ws_sieht_projekt(projekt_id));
drop policy if exists ws_design_neu on public.ws_design_entwuerfe;
create policy ws_design_neu on public.ws_design_entwuerfe for insert to authenticated
  with check (public.ws_darf_design(projekt_id) and erstellt_von = auth.uid() and stand = 'entwurf' and auftrag_id is null and version = 1);
drop policy if exists ws_design_versionen_lesen on public.ws_design_versionen;
create policy ws_design_versionen_lesen on public.ws_design_versionen for select to authenticated
  using (exists (select 1 from public.ws_design_entwuerfe e where e.id = entwurf_id and public.ws_sieht_projekt(e.projekt_id)));
-- Ändern, Versionen und Senden nur über die Funktionen unten (kein direktes update/delete)

-- Speichern: neue Werte + neue Version (nur eigener Entwurf oder Admin, nur solange „entwurf“)
create or replace function public.ws_design_speichern(p_entwurf bigint, p_werte jsonb, p_name text default null, p_notiz text default null)
returns int language plpgsql security definer set search_path = public as $$
declare e public.ws_design_entwuerfe; n int;
begin
  select * into e from public.ws_design_entwuerfe where id = p_entwurf for update;
  if e.id is null then raise exception 'Entwurf nicht gefunden'; end if;
  if not public.ws_darf_design(e.projekt_id) then raise exception 'Keine Berechtigung für das Design dieses Projekts'; end if;
  if e.erstellt_von <> auth.uid() and not public.ws_ist_admin() then raise exception 'Nur der eigene Entwurf ist änderbar'; end if;
  if e.stand <> 'entwurf' then raise exception 'Gesendete Entwürfe sind fest – lege eine Kopie an'; end if;
  if jsonb_typeof(p_werte) <> 'object' or pg_column_size(p_werte) >= 65536 then raise exception 'Ungültige Design-Werte'; end if;
  n := e.version + 1;
  update public.ws_design_entwuerfe set werte = p_werte, version = n,
    name = coalesce(nullif(trim(p_name), ''), name), notiz = coalesce(p_notiz, notiz), geaendert = now() where id = p_entwurf;
  insert into public.ws_design_versionen (entwurf_id, nr, werte, erstellt_von) values (p_entwurf, n, p_werte, auth.uid());
  return n;
end $$;

-- Verwerfen (nicht löschen): nur eigener Entwurf/Admin, nur „entwurf“
create or replace function public.ws_design_verwerfen(p_entwurf bigint) returns void
language plpgsql security definer set search_path = public as $$
declare e public.ws_design_entwuerfe;
begin
  select * into e from public.ws_design_entwuerfe where id = p_entwurf for update;
  if e.id is null then raise exception 'Entwurf nicht gefunden'; end if;
  if (e.erstellt_von <> auth.uid() and not public.ws_ist_admin()) or not public.ws_darf_design(e.projekt_id) then raise exception 'Keine Berechtigung'; end if;
  if e.stand <> 'entwurf' then raise exception 'Nur offene Entwürfe können verworfen werden'; end if;
  update public.ws_design_entwuerfe set stand = 'verworfen', geaendert = now() where id = p_entwurf;
end $$;

-- Als Auftrag senden: Auftrag in der Design-Gruppe + erste Nachricht (Beschreibung + Werte) in einem Schritt
create or replace function public.ws_design_senden(p_entwurf bigint, p_text text) returns bigint
language plpgsql security definer set search_path = public as $$
declare e public.ws_design_entwuerfe; g text; a bigint;
begin
  select * into e from public.ws_design_entwuerfe where id = p_entwurf for update;
  if e.id is null then raise exception 'Entwurf nicht gefunden'; end if;
  if not public.ws_darf_design(e.projekt_id) then raise exception 'Keine Berechtigung für das Design dieses Projekts'; end if;
  if e.erstellt_von <> auth.uid() and not public.ws_ist_admin() then raise exception 'Nur der eigene Entwurf kann gesendet werden'; end if;
  if e.stand <> 'entwurf' then raise exception 'Entwurf wurde schon gesendet'; end if;
  if p_text is null or char_length(p_text) not between 10 and 20000 then raise exception 'Beschreibung fehlt oder ist zu lang'; end if;
  select design_gruppe_id into g from public.ws_projekte where id = e.projekt_id;
  insert into public.ws_auftraege (gruppe_id, titel, art, erstellt_von)
    values (g, left('Grunddesign: ' || e.name, 80), 'aendern', auth.uid()) returning id into a;
  insert into public.ws_nachrichten (auftrag_id, von, art, text, daten)
    values (a, auth.uid(), 'text', p_text, jsonb_build_object('design_entwurf', e.id, 'version', e.version, 'werte', e.werte));
  update public.ws_design_entwuerfe set stand = 'gesendet', auftrag_id = a, geaendert = now() where id = p_entwurf;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'design_senden', jsonb_build_object('entwurf', e.id, 'auftrag', a));
  return a;
end $$;

-- Ist der Auftrag live (wissen), wird der Entwurf das gültige Grunddesign; das bisherige wird „ersetzt“.
-- Abgebrochen → Entwurf wieder bearbeitbar.
create or replace function public.ws_design_nach_auftrag() returns trigger
language plpgsql security definer set search_path = public as $$
declare e public.ws_design_entwuerfe;
begin
  if new.stand is not distinct from old.stand then return new; end if;
  select * into e from public.ws_design_entwuerfe where auftrag_id = new.id;
  if e.id is null then return new; end if;
  if new.stand = 'wissen' then
    update public.ws_design_entwuerfe set stand = 'ersetzt', geaendert = now() where projekt_id = e.projekt_id and stand = 'live' and id <> e.id;
    update public.ws_design_entwuerfe set stand = 'live', geaendert = now() where id = e.id;
  elsif new.stand = 'abgebrochen' then
    update public.ws_design_entwuerfe set stand = 'entwurf', auftrag_id = null, geaendert = now() where id = e.id;
  end if;
  return new;
end $$;
drop trigger if exists ws_design_nach_auftrag on public.ws_auftraege;
create trigger ws_design_nach_auftrag after update of stand on public.ws_auftraege for each row execute function public.ws_design_nach_auftrag();

revoke execute on function public.ws_design_speichern(bigint, jsonb, text, text) from public, anon;
revoke execute on function public.ws_design_verwerfen(bigint) from public, anon;
revoke execute on function public.ws_design_senden(bigint, text) from public, anon;
revoke execute on function public.ws_design_nach_auftrag() from public, anon, authenticated;
grant execute on function public.ws_design_speichern(bigint, jsonb, text, text) to authenticated;
grant execute on function public.ws_design_verwerfen(bigint) to authenticated;
grant execute on function public.ws_design_senden(bigint, text) to authenticated;

-- Realtime
do $$ begin
  begin alter publication supabase_realtime add table public.ws_design_entwuerfe; exception when duplicate_object then null; end;
end $$;

commit;

select id, design_gruppe_id from public.ws_projekte;
