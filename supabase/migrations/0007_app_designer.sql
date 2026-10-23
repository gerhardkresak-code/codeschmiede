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
                     and public.ws_rolle_im_projekt(p.id) in ('admin','entwickler')   -- Texter geben nur Text-Aufträge (Prüfung 2026-10-23, R1)
                     and public.ws_projekt_von_gruppe(p.design_gruppe_id) = p.id
                   from public.ws_projekte p where p.id = p_projekt and p.design_gruppe_id is not null), false)
$$;
revoke execute on function public.ws_darf_design(text) from public, anon;
grant execute on function public.ws_darf_design(text) to authenticated;


-- Festes Schema der Design-Werte (Prüfung 2026-10-23, R2/O1/O2): nur bekannte Schlüssel, Farben #rrggbb,
-- Zahlen in Grenzen, feste Auswahlwerte. Fehlende Schlüssel sind erlaubt (dann gilt der Ausgangswert).
create or replace function public.ws_design_werte_ok(p jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare k text; v jsonb; m text; f jsonb;
  farben constant text[] := array['primaer','primaer_text','hintergrund','flaeche','text','text_leise','rand','menue','menue_text','erfolg','warnung','fehler'];
begin
  if p is null or jsonb_typeof(p) <> 'object' then return false; end if;
  for k, v in select * from jsonb_each(p) loop
    if jsonb_typeof(v) <> 'object' then return false; end if;
    if k = 'farben' then
      for m, f in select * from jsonb_each(v) loop
        if m not in ('hell','dunkel') or jsonb_typeof(f) <> 'object' then return false; end if;
        if exists (select 1 from jsonb_each(f) e where not (e.key = any(farben)) or jsonb_typeof(e.value) <> 'string' or (e.value #>> '{}') !~ '^#[0-9a-fA-F]{6}$') then return false; end if;
      end loop;
    elsif k = 'schrift' then
      if exists (select 1 from jsonb_each(v) e where not (
           (e.key in ('ueberschrift','text') and (e.value #>> '{}') in ('Barlow Semi Condensed','Barlow','system-ui') and jsonb_typeof(e.value) = 'string')
        or (e.key = 'basis' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric between 12 and 20)
        or (e.key = 'gewicht' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric in (600, 700)))) then return false; end if;
    elsif k = 'form' then
      if exists (select 1 from jsonb_each(v) e where not (
           (e.key = 'radius' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric between 0 and 24)
        or (e.key = 'radius_karte' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric between 0 and 32)
        or (e.key = 'abstand' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric between 4 and 32)
        or (e.key = 'schatten' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('kein','leicht','deutlich')))) then return false; end if;
    elsif k = 'menue' then
      if exists (select 1 from jsonb_each(v) e where not (
           (e.key = 'position' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('links','oben'))
        or (e.key = 'aufklappbar' and jsonb_typeof(e.value) = 'boolean')
        or (e.key = 'breite' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric between 160 and 360)
        or (e.key = 'tablet' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('eingeklappt','offen','oben'))
        or (e.key = 'handy' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('unten','burger')))) then return false; end if;
    elsif k = 'logo' then
      if exists (select 1 from jsonb_each(v) e where not (
           (e.key = 'platz' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('menue-oben','kopf-links','kopf-mitte'))
        or (e.key = 'groesse' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric between 16 and 64))) then return false; end if;
    else
      return false;
    end if;
  end loop;
  return true;
end $$;

-- ---------- Entwürfe ----------
create table if not exists public.ws_design_entwuerfe (
  id bigserial primary key,
  projekt_id text not null references public.ws_projekte(id),
  name text not null check (char_length(name) between 1 and 80),
  werte jsonb not null default '{}'::jsonb check (pg_column_size(werte) < 65536 and public.ws_design_werte_ok(werte)),
  notiz text check (notiz is null or char_length(notiz) <= 2000),
  stand text not null default 'entwurf' check (stand in ('entwurf','gesendet','live','ersetzt','verworfen')),
  auftrag_id bigint references public.ws_auftraege(id),
  version int not null default 1,
  erstellt_von uuid not null default auth.uid() references auth.users(id),
  erstellt timestamptz not null default now(),
  geaendert timestamptz not null default now()
);
-- Nachprüfung N2: Regel auch dann erneuern, wenn die Tabelle aus einem früheren Stand schon existiert
alter table public.ws_design_entwuerfe drop constraint if exists ws_design_entwuerfe_werte_check;
alter table public.ws_design_entwuerfe add constraint ws_design_entwuerfe_werte_check check (pg_column_size(werte) < 65536 and public.ws_design_werte_ok(werte));
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
grant select on public.ws_design_entwuerfe to authenticated;
grant insert (projekt_id, name, werte, notiz) on public.ws_design_entwuerfe to authenticated;   -- Prüfung O6: Id/Zeitstempel nicht vorgebbar
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
  if pg_column_size(p_werte) >= 65536 or not public.ws_design_werte_ok(p_werte) then raise exception 'Ungültige Design-Werte'; end if;
  n := e.version + 1;
  if n > 300 then raise exception 'Zu viele Versionen – lege eine Kopie an'; end if;
  update public.ws_design_entwuerfe set werte = p_werte, version = n,
    name = coalesce(nullif(trim(p_name), ''), name), notiz = coalesce(p_notiz, notiz), geaendert = now() where id = p_entwurf;
  insert into public.ws_design_versionen (entwurf_id, nr, werte, erstellt_von) values (p_entwurf, n, p_werte, auth.uid());
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'design_speichern', jsonb_build_object('entwurf', p_entwurf, 'version', n));
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
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'design_verwerfen', jsonb_build_object('entwurf', p_entwurf));
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
-- Abgebrochen/erledigt ohne Umsetzung → Entwurf wieder bearbeitbar.
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
  elsif new.stand in ('abgebrochen','erledigt') then   -- nicht umgesetzt → wieder bearbeitbar (Prüfung O4)
    update public.ws_design_entwuerfe set stand = 'entwurf', auftrag_id = null, geaendert = now() where id = e.id;
  end if;
  return new;
end $$;
drop trigger if exists ws_design_nach_auftrag on public.ws_auftraege;
create trigger ws_design_nach_auftrag after update of stand on public.ws_auftraege for each row execute function public.ws_design_nach_auftrag();


-- Beim Anlegen: Mengenbegrenzung (Prüfung O7/N3) und Version 1 sichern (Prüfung O5: jede Fassung bleibt)
create or replace function public.ws_design_neu() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and tg_when = 'BEFORE' then
    -- Nachprüfung N3: Grenze je Person (offene) und gesamt je Projekt (inkl. verworfene)
    if (select count(*) from public.ws_design_entwuerfe where projekt_id = new.projekt_id and erstellt_von = new.erstellt_von and stand = 'entwurf') >= 20 then
      raise exception 'Du hast schon 20 offene Entwürfe in diesem Projekt – verwirf alte'; end if;
    if (select count(*) from public.ws_design_entwuerfe where projekt_id = new.projekt_id) >= 1000 then
      raise exception 'Höchstzahl an Entwürfen für dieses Projekt erreicht – bitte den Admin aufräumen lassen'; end if;
    return new;
  end if;
  insert into public.ws_design_versionen (entwurf_id, nr, werte, erstellt_von) values (new.id, 1, new.werte, new.erstellt_von);
  insert into public.ws_protokoll (wer, was, details) values (new.erstellt_von, 'design_neu', jsonb_build_object('entwurf', new.id, 'projekt', new.projekt_id));
  return new;
end $$;
drop trigger if exists ws_design_neu_vor on public.ws_design_entwuerfe;
create trigger ws_design_neu_vor before insert on public.ws_design_entwuerfe for each row execute function public.ws_design_neu();
drop trigger if exists ws_design_neu_nach on public.ws_design_entwuerfe;
create trigger ws_design_neu_nach after insert on public.ws_design_entwuerfe for each row execute function public.ws_design_neu();
revoke execute on function public.ws_design_neu() from public, anon, authenticated;

-- Endstände sind fest (Prüfung O3/N1): Ein abgebrochener, erledigter oder live gegangener Auftrag läuft für Nicht-Admins nicht wieder an.
create or replace function public.ws_auftraege_endstand() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and not public.ws_ist_admin()
     and old.stand in ('abgebrochen','erledigt','wissen') and new.stand is distinct from old.stand   -- Nachprüfung N1: auch erledigt
  then raise exception 'Abgeschlossene Aufträge laufen nicht wieder an – neuen Auftrag anlegen'; end if;
  return new;
end $$;
drop trigger if exists ws_auftraege_endstand on public.ws_auftraege;
create trigger ws_auftraege_endstand before update of stand on public.ws_auftraege for each row execute function public.ws_auftraege_endstand();

revoke execute on function public.ws_design_speichern(bigint, jsonb, text, text) from public, anon;
revoke execute on function public.ws_design_verwerfen(bigint) from public, anon;
revoke execute on function public.ws_design_senden(bigint, text) from public, anon;
revoke execute on function public.ws_design_nach_auftrag() from public, anon, authenticated;
revoke execute on function public.ws_design_werte_ok(jsonb) from public, anon;
grant execute on function public.ws_design_werte_ok(jsonb) to authenticated;
grant execute on function public.ws_design_speichern(bigint, jsonb, text, text) to authenticated;
grant execute on function public.ws_design_verwerfen(bigint) to authenticated;
grant execute on function public.ws_design_senden(bigint, text) to authenticated;

-- Realtime
do $$ begin
  begin alter publication supabase_realtime add table public.ws_design_entwuerfe; exception when duplicate_object then null; end;
end $$;

commit;

select id, design_gruppe_id from public.ws_projekte;
