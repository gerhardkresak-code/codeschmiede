-- Codeschmiede · Datenbank v30: Projekt-Arten und Anbindungen (Entwurf 1.0 „Neues Projekt“, freigegeben von Gerhard 2026-10-24 14:43)
-- Jedes Projekt hat eine Technik-Art (Web-App, Programm, Handy-App, Werkzeug) und eine Datenbank-Wahl (keine, Spielwiese, eigenes Projekt).
-- Die Werkstatt des Admins prüft die Anbindungen und meldet eine Ampel. Aktionen der Vorschau (Programm in der Windows-Sandbox starten,
-- Testlauf eines Werkzeugs) laufen als Wunsch über die Datenbank und werden nur von der Werkstatt des Admins ausgeführt.
-- Keine Zugangsdaten, keine Personendaten. Mehrfach ausführbar. Reihenfolge 0001 → … → 0030.
begin;

alter table public.ws_projekte add column if not exists technik_art text not null default 'web';
alter table public.ws_projekte drop constraint if exists ws_projekte_technik_art_check;
alter table public.ws_projekte add constraint ws_projekte_technik_art_check check (technik_art in ('web','programm','handy','werkzeug'));
alter table public.ws_projekte add column if not exists datenbank text not null default 'keine';
alter table public.ws_projekte drop constraint if exists ws_projekte_datenbank_check;
alter table public.ws_projekte add constraint ws_projekte_datenbank_check check (datenbank in ('keine','spielwiese','eigen'));
alter table public.ws_projekte add column if not exists anbindungen jsonb not null default '{}'::jsonb;
alter table public.ws_projekte add column if not exists anbindungen_zeit timestamptz;

-- Bestehende Projekte: Codeschmiede ist ein Programm, Trainer to go eine Web-App mit eigener Datenbank
update public.ws_projekte set technik_art = 'programm' where id = 'codeschmiede' and technik_art = 'web';
update public.ws_projekte set datenbank = 'eigen' where id in ('trainer-to-go', 'codeschmiede') and datenbank = 'keine';

-- Ampel: feste Schlüssel, je { stand: gruen|gelb|rot|grau, text: ≤ 200 Zeichen }
create or replace function public.ws_anbindungen_ok(w jsonb) returns boolean
language sql immutable set search_path = public as $$
  select jsonb_typeof(w) = 'object' and not exists (
    select 1 from jsonb_each(w) e
     where e.key not in ('github','pruefung','testseite','build','signatur','sandbox','datenbank','testlauf','fehler')
        or jsonb_typeof(e.value) <> 'object'
        or exists (select 1 from jsonb_object_keys(e.value) k where k not in ('stand','text'))
        or coalesce(e.value ->> 'stand', '') not in ('gruen','gelb','rot','grau')
        or jsonb_typeof(e.value -> 'text') is distinct from 'string'
        or char_length(e.value ->> 'text') > 200)
$$;
revoke execute on function public.ws_anbindungen_ok(jsonb) from public, anon;
grant execute on function public.ws_anbindungen_ok(jsonb) to authenticated;
alter table public.ws_projekte drop constraint if exists ws_projekte_anbindungen_check;
alter table public.ws_projekte add constraint ws_projekte_anbindungen_check check (public.ws_anbindungen_ok(anbindungen));

-- Admin: Art und Datenbank festlegen (beim Anlegen oder später)
create or replace function public.ws_projekt_technik(p_projekt text, p_art text, p_datenbank text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'Art und Datenbank legt nur der Admin fest'; end if;
  if p_art not in ('web','programm','handy','werkzeug') then raise exception 'Unbekannte Art'; end if;
  if p_datenbank not in ('keine','spielwiese','eigen') then raise exception 'Unbekannte Datenbank-Wahl'; end if;
  update public.ws_projekte set technik_art = p_art, datenbank = p_datenbank where id = p_projekt and not coalesce(archiviert, false);
  if not found then raise exception 'Projekt nicht gefunden'; end if;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'projekt_technik', jsonb_build_object('projekt', p_projekt, 'art', p_art, 'datenbank', p_datenbank));
end $$;
revoke execute on function public.ws_projekt_technik(text, text, text) from public, anon;
grant execute on function public.ws_projekt_technik(text, text, text) to authenticated;

-- Werkstatt des Admins: Ampel melden
create or replace function public.ws_anbindungen_melden(p_pc uuid, p_projekt text, p_werte jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'Nur die Werkstatt des Admins'; end if;
  if not exists (select 1 from public.ws_werkstatt_pcs w where w.id = p_pc and w.benutzer_id = auth.uid()) then raise exception 'Unbekannter Werkstatt-PC'; end if;
  if not public.ws_anbindungen_ok(p_werte) then raise exception 'Ungültige Ampel'; end if;
  update public.ws_projekte set anbindungen = p_werte, anbindungen_zeit = now()
   where id = p_projekt and anbindungen is distinct from p_werte;
  update public.ws_projekte set anbindungen_zeit = now() where id = p_projekt and anbindungen = p_werte;
end $$;
revoke execute on function public.ws_anbindungen_melden(uuid, text, jsonb) from public, anon;
grant execute on function public.ws_anbindungen_melden(uuid, text, jsonb) to authenticated;

-- Aktionen der Vorschau: Programm in der Windows-Sandbox starten, Testlauf eines Werkzeugs, Ampel sofort prüfen
create table if not exists public.ws_projekt_aktionen (
  id bigint generated always as identity primary key,
  projekt_id text not null references public.ws_projekte(id) on delete cascade,
  art text not null check (art in ('sandbox','testlauf','pruefen')),
  zweig text check (zweig is null or (zweig ~ '^[A-Za-z0-9._/-]{1,100}$' and zweig !~ '\.\.' and zweig !~ '^[/.-]')),
  ziel_pc uuid references public.ws_werkstatt_pcs(id) on delete cascade,   -- Sandbox: auf genau diesem PC
  netz boolean not null default false,   -- Sandbox: Netzwerk nur auf ausdrücklichen Wunsch
  stand text not null default 'angefragt' check (stand in ('angefragt','laeuft','fertig','fehler')),
  hinweis text check (char_length(hinweis) <= 500),
  link text check (link is null or link ~ '^https://github\.com/[A-Za-z0-9._/-]{1,200}$'),
  pc uuid references public.ws_werkstatt_pcs(id) on delete set null,
  von uuid references auth.users(id) on delete set null default auth.uid(),
  erstellt timestamptz not null default now(),
  geaendert timestamptz not null default now()
);
create index if not exists ws_projekt_aktionen_offen on public.ws_projekt_aktionen (stand, erstellt) where stand in ('angefragt','laeuft');
alter table public.ws_projekt_aktionen enable row level security;
revoke all on public.ws_projekt_aktionen from anon, authenticated;
grant select on public.ws_projekt_aktionen to authenticated;
drop policy if exists ws_projekt_aktionen_lesen on public.ws_projekt_aktionen;
create policy ws_projekt_aktionen_lesen on public.ws_projekt_aktionen for select to authenticated using (public.ws_ist_admin());
do $$ begin alter publication supabase_realtime add table public.ws_projekt_aktionen; exception when others then null; end $$;

create or replace function public.ws_projekt_aktion_anfordern(p_projekt text, p_art text, p_zweig text default null, p_pc uuid default null, p_netz boolean default false) returns bigint
language plpgsql security definer set search_path = public as $$
declare p public.ws_projekte; n bigint;
begin
  if not public.ws_ist_admin() then raise exception 'Nur der Admin'; end if;
  if p_art not in ('sandbox','testlauf','pruefen') then raise exception 'Unbekannte Aktion'; end if;
  select * into p from public.ws_projekte where id = p_projekt and not coalesce(archiviert, false);
  if p.id is null then raise exception 'Projekt nicht gefunden'; end if;
  if p_art = 'sandbox' and p.technik_art <> 'programm' then raise exception 'Die Sandbox gibt es nur für Programme'; end if;
  if p_art = 'testlauf' and p.technik_art <> 'werkzeug' then raise exception 'Testläufe gibt es nur für Werkzeuge'; end if;
  if p_art in ('sandbox','testlauf') and p.repo is null then raise exception 'Das Projekt hat noch kein Repository'; end if;
  if p_art = 'sandbox' and (p_pc is null or not exists (select 1 from public.ws_werkstatt_pcs w where w.id = p_pc and w.benutzer_id = auth.uid())) then
    raise exception 'Für die Sandbox braucht es deinen Werkstatt-PC';
  end if;
  if exists (select 1 from public.ws_projekt_aktionen a where a.projekt_id = p_projekt and a.art = p_art and a.stand in ('angefragt','laeuft')
              and a.geaendert > now() - interval '15 minutes') then raise exception 'Läuft schon – bitte kurz warten'; end if;
  insert into public.ws_projekt_aktionen (projekt_id, art, zweig, ziel_pc, netz) values (p_projekt, p_art, nullif(p_zweig, ''), case when p_art = 'sandbox' then p_pc end, p_art = 'sandbox' and coalesce(p_netz, false))
  returning id into n;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'projekt_aktion', jsonb_build_object('projekt', p_projekt, 'art', p_art, 'zweig', p_zweig, 'netz', coalesce(p_netz, false)));
  return n;
end $$;

create or replace function public.ws_projekt_aktion_nehmen(p_pc uuid)
returns table (id bigint, projekt_id text, art text, zweig text, repo text, technik_art text, netz boolean)
language plpgsql security definer set search_path = public as $$
declare a public.ws_projekt_aktionen;
begin
  if not public.ws_ist_admin() then return; end if;
  if not exists (select 1 from public.ws_werkstatt_pcs w where w.id = p_pc and w.benutzer_id = auth.uid() and w.an) then raise exception 'Unbekannter Werkstatt-PC'; end if;
  select * into a from public.ws_projekt_aktionen x
   where (x.stand = 'angefragt' or (x.stand = 'laeuft' and x.geaendert < now() - interval '15 minutes'))
     and (x.ziel_pc is null or x.ziel_pc = p_pc)
     and x.erstellt > now() - interval '1 day'
   order by x.erstellt limit 1 for update skip locked;
  if a.id is null then return; end if;
  update public.ws_projekt_aktionen set stand = 'laeuft', pc = p_pc, geaendert = now(), hinweis = 'Werkstatt arbeitet' where ws_projekt_aktionen.id = a.id;
  return query select a.id, a.projekt_id, a.art, a.zweig, p.repo, p.technik_art, a.netz from public.ws_projekte p where p.id = a.projekt_id;
end $$;

create or replace function public.ws_projekt_aktion_ergebnis(p_pc uuid, p_id bigint, p_hinweis text, p_link text default null, p_fehler boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'Nur die Werkstatt des Admins'; end if;
  update public.ws_projekt_aktionen set stand = case when p_fehler then 'fehler' else 'fertig' end, hinweis = left(p_hinweis, 500),
         link = case when p_link ~ '^https://github\.com/[A-Za-z0-9._/-]{1,200}$' then p_link end, geaendert = now()
   where id = p_id and pc = p_pc and stand = 'laeuft'
     and exists (select 1 from public.ws_werkstatt_pcs w where w.id = p_pc and w.benutzer_id = auth.uid());
  if not found then raise exception 'Keine laufende Aktion dieser Werkstatt'; end if;
end $$;

revoke execute on function public.ws_projekt_aktion_anfordern(text, text, text, uuid, boolean), public.ws_projekt_aktion_nehmen(uuid),
  public.ws_projekt_aktion_ergebnis(uuid, bigint, text, text, boolean) from public, anon;
grant execute on function public.ws_projekt_aktion_anfordern(text, text, text, uuid, boolean), public.ws_projekt_aktion_nehmen(uuid),
  public.ws_projekt_aktion_ergebnis(uuid, bigint, text, text, boolean) to authenticated;

-- Aufräumen: erledigte Aktionen nach 30 Tagen (läuft im Abgleich der Werkstatt mit)
create or replace function public.ws_projekt_aktionen_aufraeumen() returns void
language sql security definer set search_path = public as $$
  delete from public.ws_projekt_aktionen where public.ws_ist_admin() and stand in ('fertig','fehler') and geaendert < now() - interval '30 days'
$$;
revoke execute on function public.ws_projekt_aktionen_aufraeumen() from public, anon;
grant execute on function public.ws_projekt_aktionen_aufraeumen() to authenticated;

commit;
