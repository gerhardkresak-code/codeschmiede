-- Codeschmiede 0.9.12 · Aufbau – Nachbesserung nach der unabhängigen Prüfung (GELB, 26.10.2026). Mehrfach ausführbar.
--  1  Gruppen nur innerhalb desselben Teils verschieben (App ↔ App, ERP ↔ ERP) – nie nach Website/Sonstiges/Konzept
--  6  Umsortieren schreibt EINEN Protokolleintrag statt einen je Nachbarzeile
--  7  Beschreibung, Stand, „ausgebaut“ und Reihenfolge von Features werden ebenfalls als Änderung erkannt
-- 10  Obergruppen-Kennung nie leer · 11 „Start“ nicht umbenennbar · 13 Reihenfolge/Umbenennen nur für App- und ERP-Obergruppen
-- 12  Übergeben nur der Änderungen, die im Auftragstext stehen (bis einschließlich p_bis)
begin;

alter table public.ws_aufbau_aenderungen drop constraint if exists ws_aufbau_aenderungen_art_check;
alter table public.ws_aufbau_aenderungen add constraint ws_aufbau_aenderungen_art_check check (art in ('bereich_neu','bereich_name','bereich_reihe','bereich_weg',
  'gruppe_neu','gruppe_name','gruppe_bereich','gruppe_reihe','gruppe_weg','feature_neu','feature_gruppe','feature_name','feature_daten','feature_weg'));

-- Trigger: zusätzlich Feature-Daten; still, wenn eine RPC selbst protokolliert
create or replace function public.ws_aufbau_feature_daten() returns trigger
language plpgsql security definer set search_path = public as $$
declare p text;
begin
  if coalesce(current_setting('cs.aufbau_still', true), '') = 'an' then return new; end if;
  if new.gruppe_id is distinct from old.gruppe_id or new.name is distinct from old.name then return new; end if; -- macht ws_aufbau_log
  if (new.beschreibung, new.stand, new.ausgebaut, new.reihenfolge) is not distinct from (old.beschreibung, old.stand, old.ausgebaut, old.reihenfolge) then return new; end if;
  p := (select b.projekt_id from ws_gruppen g join ws_bereiche b on b.id = g.bereich_id where g.id = new.gruppe_id);
  if p is null or (select aufbau_datei from ws_projekte where id = p) is null then return new; end if;
  insert into ws_aufbau_aenderungen (projekt_id, art, text, details) values (p, 'feature_daten',
    'Feature ' || new.id || ' „' || new.name || '“: ' || concat_ws(', ',
      case when new.beschreibung is distinct from old.beschreibung then 'Beschreibung' end,
      case when new.stand is distinct from old.stand then 'Stand ' || new.stand end,
      case when new.ausgebaut is distinct from old.ausgebaut then (case when new.ausgebaut then 'ausgebaut' else 'wieder da' end) end,
      case when new.reihenfolge is distinct from old.reihenfolge then 'Reihenfolge' end),
    jsonb_build_object('feature', new.id));
  return new;
end $$;
drop trigger if exists ws_aufbau_feature_daten on public.ws_features;
create trigger ws_aufbau_feature_daten after update of beschreibung, stand, ausgebaut, reihenfolge on public.ws_features for each row execute function public.ws_aufbau_feature_daten();

create or replace function public.ws_gruppe_einordnen(p_gruppe text, p_bereich text, p_vor text default null) returns void
language plpgsql security definer set search_path = public as $$
declare g ws_gruppen; bz ws_bereiche; bq ws_bereiche; r int := 0; x record; p text;
begin
  if not public.ws_ist_admin() then raise exception 'Nur der Admin ordnet Gruppen'; end if;
  select * into g from ws_gruppen where id = p_gruppe for update;
  if g.id is null then raise exception 'Gruppe nicht gefunden'; end if;
  select * into bq from ws_bereiche where id = g.bereich_id; select * into bz from ws_bereiche where id = p_bereich;
  if bz.id is null or bz.projekt_id is distinct from bq.projekt_id then raise exception 'Nur innerhalb desselben Projekts'; end if;
  if bz.global or bq.global then raise exception 'Globale Einstellungen werden nicht verschoben'; end if;
  if bz.app_teil is distinct from bq.app_teil or bz.app_teil not in ('app', 'erp') then
    raise exception 'Gruppen nur innerhalb des Menüs der App bzw. des ERP verschieben (Menüpunkt bleibt im selben Teil)';
  end if;
  p := bz.projekt_id;
  perform set_config('cs.aufbau_still', 'an', true);
  if g.bereich_id <> p_bereich then update ws_gruppen set bereich_id = p_bereich where id = p_gruppe; end if;
  for x in select id from ws_gruppen where bereich_id = p_bereich and id <> p_gruppe order by reihenfolge, name loop
    if x.id = p_vor then r := r + 1; update ws_gruppen set reihenfolge = r where id = p_gruppe; end if;
    r := r + 1; update ws_gruppen set reihenfolge = r where id = x.id and reihenfolge is distinct from r;
  end loop;
  if p_vor is null or not exists (select 1 from ws_gruppen where id = p_vor and bereich_id = p_bereich) then update ws_gruppen set reihenfolge = r + 1 where id = p_gruppe; end if;
  perform set_config('cs.aufbau_still', '', true);
  if (select aufbau_datei from ws_projekte where id = p) is not null then
    insert into ws_aufbau_aenderungen (projekt_id, art, text, details) values (p,
      case when g.bereich_id <> p_bereich then 'gruppe_bereich' else 'gruppe_reihe' end,
      case when g.bereich_id <> p_bereich then 'Gruppe „' || g.name || '“ von „' || bq.name || '“ nach „' || bz.name || '“'
           else 'Reihenfolge in „' || bz.name || '“: „' || g.name || '“ ' || coalesce('vor „' || (select name from ws_gruppen where id = p_vor) || '“', 'ans Ende') end,
      jsonb_build_object('gruppe', g.id, 'app_key', g.app_key, 'von', bq.id, 'nach', bz.id, 'vor', p_vor));
  end if;
  insert into ws_protokoll (wer, was, details) values (auth.uid(), 'gruppe_einordnen', jsonb_build_object('gruppe', p_gruppe, 'bereich', p_bereich, 'vor', p_vor));
end $$;

create or replace function public.ws_bereich_anlegen(p_projekt text, p_name text, p_teil text default 'app') returns text
language plpgsql security definer set search_path = public as $$
declare i text; n text := btrim(coalesce(p_name, '')); r int; s text;
begin
  if not public.ws_ist_admin() then raise exception 'Nur der Admin legt Obergruppen an'; end if;
  if length(n) < 2 or length(n) > 40 then raise exception 'Name 2–40 Zeichen'; end if;
  if p_teil not in ('app', 'erp') then raise exception 'Obergruppe gehört zur App oder zum ERP'; end if;
  s := btrim(left(regexp_replace(translate(lower(n), 'äöüß', 'aous'), '[^a-z0-9]+', '-', 'g'), 30), '-');
  if length(s) < 2 then s := 'obergruppe'; end if;
  i := (case when p_teil = 'erp' then 'erp-' else '' end) || s;
  while exists (select 1 from ws_bereiche where id = i) loop i := i || '-2'; end loop;
  select coalesce(max(reihenfolge), case when p_teil = 'erp' then 20 else 0 end) + 1 into r from ws_bereiche where projekt_id = p_projekt and app_teil = p_teil;
  insert into ws_bereiche (id, name, reihenfolge, projekt_id, global, app_teil) values (i, n, r, p_projekt, false, p_teil);
  return i;
end $$;

create or replace function public.ws_bereich_aendern(p_bereich text, p_name text default null, p_reihe int default null) returns void
language plpgsql security definer set search_path = public as $$
declare b ws_bereiche; x record; r int := 0; basis int; ziel int;
begin
  if not public.ws_ist_admin() then raise exception 'Nur der Admin ändert Obergruppen'; end if;
  select * into b from ws_bereiche where id = p_bereich for update;
  if b.id is null or b.global or b.app_teil is null or b.app_teil not in ('app', 'erp') then raise exception 'Nur Obergruppen des App- bzw. ERP-Menüs sind änderbar'; end if;
  if p_name is not null then
    if b.id = 'start' then raise exception 'Der Startbereich hat im Menü keine Überschrift und wird nicht umbenannt'; end if;
    if length(btrim(p_name)) < 2 or length(btrim(p_name)) > 40 then raise exception 'Name 2–40 Zeichen'; end if;
    update ws_bereiche set name = btrim(p_name) where id = p_bereich;
  end if;
  if p_reihe is not null then
    basis := case when b.app_teil = 'erp' then 20 else 0 end;
    ziel := greatest(1, p_reihe);
    perform set_config('cs.aufbau_still', 'an', true);
    for x in select id from ws_bereiche where projekt_id = b.projekt_id and app_teil = b.app_teil and id <> b.id order by reihenfolge, name loop
      r := r + 1; if r = ziel then r := r + 1; end if;
      update ws_bereiche set reihenfolge = basis + r where id = x.id and reihenfolge is distinct from basis + r;
    end loop;
    update ws_bereiche set reihenfolge = basis + least(ziel, r + 1) where id = p_bereich;
    perform set_config('cs.aufbau_still', '', true);
    if (select aufbau_datei from ws_projekte where id = b.projekt_id) is not null then
      insert into ws_aufbau_aenderungen (projekt_id, art, text, details) values (b.projekt_id, 'bereich_reihe', 'Obergruppe „' || b.name || '“ an Position ' || least(ziel, r + 1), jsonb_build_object('bereich', b.id));
    end if;
  end if;
end $$;

drop function if exists public.ws_aufbau_uebergeben(text, bigint);
create or replace function public.ws_aufbau_uebergeben(p_projekt text, p_auftrag bigint, p_bis bigint) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.ws_ist_admin() then raise exception 'Nur der Admin übernimmt den Aufbau'; end if;
  if (select b.projekt_id from ws_auftraege a join ws_gruppen g on g.id = a.gruppe_id join ws_bereiche b on b.id = g.bereich_id where a.id = p_auftrag) is distinct from p_projekt then raise exception 'Auftrag gehört nicht zum Projekt'; end if;
  update ws_aufbau_aenderungen set auftrag_id = p_auftrag where projekt_id = p_projekt and auftrag_id is null and id <= p_bis;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.ws_aufbau_uebergeben(text, bigint, bigint), public.ws_aufbau_feature_daten() from public, anon;
grant execute on function public.ws_aufbau_uebergeben(text, bigint, bigint) to authenticated;

commit;
