-- Codeschmiede · Datenbank v2: mehrere Projekte (Apps), Mitglieder je Projekt, Verbrauch und Limits
-- Baut auf 0001_grundlage.sql auf. Mehrfach ausführbar. Reihenfolge immer 0001 → 0002 (0001 danach nicht allein wiederholen). Keine Vereins- oder Kinderdaten.
-- Vorerst im Supabase-Testprojekt von Trainer to go (Entscheidung Gerhard 2026-10-22 13:3x), Umzug in eine eigene Datenbank später.

begin;

-- ---------- Projekte ----------
create table if not exists public.ws_projekte (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name text not null,
  beschreibung text,
  repo text check (repo is null or repo ~ '^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$'),   -- GitHub owner/repo
  symbol text not null default 'layers',
  archiviert boolean not null default false,
  erstellt_von uuid references auth.users(id),
  erstellt timestamptz not null default now()
);

insert into public.ws_projekte (id, name, beschreibung, repo, symbol)
values ('trainer-to-go', 'Trainer to go', 'Vereins- und Trainer-App für den Nachwuchsfußball', 'gerhardkresak-code/trainer-to-go', 'trophy')
on conflict (id) do nothing;

create table if not exists public.ws_projekt_mitglieder (
  projekt_id text not null references public.ws_projekte(id) on delete cascade,
  benutzer_id uuid not null references public.ws_benutzer(id) on delete cascade,
  rolle text not null check (rolle in ('entwickler','texter','leser')),
  primary key (projekt_id, benutzer_id)
);

-- Bereiche gehören zu einem Projekt (bestehende → Trainer to go)
alter table public.ws_bereiche add column if not exists projekt_id text references public.ws_projekte(id);
update public.ws_bereiche set projekt_id = 'trainer-to-go' where projekt_id is null;
alter table public.ws_bereiche alter column projekt_id set not null;
alter table public.ws_bereiche alter column projekt_id set default 'trainer-to-go'; -- nur damit 0001 (Grunddaten Trainer to go) wiederholbar bleibt

-- Einladungen gelten für ein Projekt
alter table public.ws_einladungen add column if not exists projekt_id text references public.ws_projekte(id);
update public.ws_einladungen set projekt_id = 'trainer-to-go' where projekt_id is null;
alter table public.ws_einladungen alter column projekt_id set not null;
alter table public.ws_einladungen alter column projekt_id set default 'trainer-to-go';
-- Eine Adresse kann für mehrere Projekte eingeladen werden; nur eine offene Einladung je Adresse
drop index if exists public.ws_einladungen_email_ci;
create unique index if not exists ws_einladungen_email_offen on public.ws_einladungen (lower(email)) where angenommen is null;

-- Bestehende Nicht-Admins werden Mitglied von Trainer to go mit ihrer bisherigen Rolle
insert into public.ws_projekt_mitglieder (projekt_id, benutzer_id, rolle)
select 'trainer-to-go', id, rolle from public.ws_benutzer where rolle in ('entwickler','texter','leser')
on conflict do nothing;

-- ---------- Verbrauch und Limits ----------
create table if not exists public.ws_einstellungen (
  id int primary key default 1 check (id = 1),
  monatslimit_usd numeric(10,2),             -- null = noch nicht festgelegt (Werkstatt arbeitet dann nicht)
  warnung_prozent int not null default 80 check (warnung_prozent between 10 and 100),
  stopp_am_limit boolean not null default true,
  geaendert timestamptz not null default now()
);
insert into public.ws_einstellungen (id) values (1) on conflict do nothing;

create table if not exists public.ws_verbrauch (
  id bigserial primary key,
  auftrag_id bigint references public.ws_auftraege(id) on delete set null,
  projekt_id text not null references public.ws_projekte(id),
  modell text not null,
  kosten_usd numeric(10,4) not null check (kosten_usd >= 0),
  tokens_ein bigint not null default 0,
  tokens_aus bigint not null default 0,
  werkstatt_pc uuid,
  erstellt timestamptz not null default now()
);
create index if not exists ws_verbrauch_monat on public.ws_verbrauch (erstellt, projekt_id);

-- Modell je Auftrag (von der Werkstatt gewählt, sichtbar im Verlauf)
alter table public.ws_auftraege add column if not exists modell text;

-- ---------- Hilfsfunktionen v2 ----------
create or replace function public.ws_projekt_von_bereich(p_bereich text) returns text
language sql stable security definer set search_path = public as $$
  select projekt_id from public.ws_bereiche where id = p_bereich
$$;

create or replace function public.ws_projekt_von_gruppe(p_gruppe text) returns text
language sql stable security definer set search_path = public as $$
  select b.projekt_id from public.ws_gruppen g join public.ws_bereiche b on b.id = g.bereich_id where g.id = p_gruppe
$$;

-- Rolle im Projekt: 'admin' für Codeschmiede-Admins, sonst die Projektrolle (null = kein Mitglied)
create or replace function public.ws_rolle_im_projekt(p_projekt text) returns text
language sql stable security definer set search_path = public as $$
  select case when public.ws_ist_admin() then 'admin'
              else (select m.rolle from public.ws_projekt_mitglieder m join public.ws_benutzer b on b.id = m.benutzer_id
                    where m.projekt_id = p_projekt and m.benutzer_id = auth.uid() and b.aktiv) end
$$;

create or replace function public.ws_sieht_projekt(p_projekt text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ws_rolle_im_projekt(p_projekt) is not null
$$;

-- ws_darf jetzt mit der Rolle im Projekt des Bereichs
create or replace function public.ws_darf(p_bereich text, p_recht text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ws_ist_admin() or exists (
    select 1 from public.ws_rechte r
    where r.benutzer_id = auth.uid() and r.bereich_id = p_bereich
      and case p_recht
            when 'auftraege' then r.auftraege and public.ws_rolle_im_projekt(public.ws_projekt_von_bereich(p_bereich)) in ('entwickler','texter')
            when 'freigeben' then r.freigeben and public.ws_rolle_im_projekt(public.ws_projekt_von_bereich(p_bereich)) = 'entwickler'
            when 'loeschen'  then r.loeschen  and public.ws_rolle_im_projekt(public.ws_projekt_von_bereich(p_bereich)) = 'entwickler'
            else false end)
$$;

create or replace function public.ws_ist_werkstatt_fuer(p_gruppe text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ws_ist_admin() or (public.ws_rolle_im_projekt(public.ws_projekt_von_gruppe(p_gruppe)) = 'entwickler'
     and public.ws_darf(public.ws_bereich_von_gruppe(p_gruppe), 'auftraege')
     and exists (select 1 from public.ws_werkstatt_pcs where benutzer_id = auth.uid() and an))
$$;

-- Texter-Regel jetzt mit der Rolle im Projekt
create or replace function public.ws_rolle_fuer_gruppe(p_gruppe text) returns text
language sql stable security definer set search_path = public as $$
  select public.ws_rolle_im_projekt(public.ws_projekt_von_gruppe(p_gruppe))
$$;

-- ---------- Aktionen v2 (nur Admin) ----------
-- Neues Projekt mit Vorlage für Bereiche und Gruppen
create or replace function public.ws_projekt_anlegen(p_id text, p_name text, p_beschreibung text, p_repo text, p_symbol text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'Nur der Admin legt Projekte an'; end if;
  insert into public.ws_projekte (id, name, beschreibung, repo, symbol, erstellt_von)
  values (p_id, p_name, nullif(p_beschreibung,''), nullif(p_repo,''), coalesce(nullif(p_symbol,''),'layers'), auth.uid());
  insert into public.ws_bereiche (id, projekt_id, name, reihenfolge) values
    (p_id||'-app', p_id, 'App', 1), (p_id||'-daten', p_id, 'Daten & Rechte', 2), (p_id||'-betrieb', p_id, 'Betrieb', 3);
  insert into public.ws_gruppen (id, bereich_id, name, symbol, reihenfolge, erstellt_von) values
    (p_id||'-oberflaeche', p_id||'-app', 'Oberfläche & Design', 'palette', 1, auth.uid()),
    (p_id||'-funktionen', p_id||'-app', 'Funktionen', 'layers', 2, auth.uid()),
    (p_id||'-datenbank', p_id||'-daten', 'Datenbank', 'archive', 1, auth.uid()),
    (p_id||'-rechte', p_id||'-daten', 'Anmeldung & Rechte', 'users', 2, auth.uid()),
    (p_id||'-handbuch', p_id||'-betrieb', 'Handbuch & Texte', 'file-text', 1, auth.uid()),
    (p_id||'-einstellungen', p_id||'-betrieb', 'Einstellungen & Datenschutz', 'settings', 2, auth.uid());
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'projekt_anlegen', jsonb_build_object('projekt', p_id, 'repo', p_repo));
end $$;

-- Mitglied eines Projekts setzen oder entfernen (p_rolle null = entfernen)
create or replace function public.ws_mitglied_setzen(p_projekt text, p_benutzer uuid, p_rolle text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'Nur der Admin verwaltet Mitglieder'; end if;
  if p_rolle is null then
    delete from public.ws_projekt_mitglieder where projekt_id = p_projekt and benutzer_id = p_benutzer;
    delete from public.ws_rechte r using public.ws_bereiche b where r.bereich_id = b.id and b.projekt_id = p_projekt and r.benutzer_id = p_benutzer;
  else
    insert into public.ws_projekt_mitglieder (projekt_id, benutzer_id, rolle) values (p_projekt, p_benutzer, p_rolle)
    on conflict (projekt_id, benutzer_id) do update set rolle = excluded.rolle;
  end if;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'mitglied', jsonb_build_object('projekt', p_projekt, 'benutzer', p_benutzer, 'rolle', p_rolle));
end $$;

-- Rechte setzen: nur für Bereiche, deren Projekt der Benutzer angehört
create or replace function public.ws_rechte_setzen(p_benutzer uuid, p_bereich text, p_auftraege boolean, p_freigeben boolean, p_loeschen boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'Nur der Admin vergibt Rechte'; end if;
  if not exists (select 1 from public.ws_projekt_mitglieder where benutzer_id = p_benutzer and projekt_id = public.ws_projekt_von_bereich(p_bereich)) then
    raise exception 'Benutzer ist nicht Mitglied dieses Projekts';
  end if;
  insert into public.ws_rechte (benutzer_id, bereich_id, auftraege, freigeben, loeschen)
  values (p_benutzer, p_bereich, p_auftraege, p_freigeben, p_loeschen)
  on conflict (benutzer_id, bereich_id) do update set auftraege = excluded.auftraege, freigeben = excluded.freigeben, loeschen = excluded.loeschen;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'rechte', jsonb_build_object('benutzer', p_benutzer, 'bereich', p_bereich, 'auftraege', p_auftraege, 'freigeben', p_freigeben, 'loeschen', p_loeschen));
end $$;

-- Einladung annehmen v2: Mitglied des eingeladenen Projekts mit der eingeladenen Rolle
create or replace function public.ws_einladung_annehmen(p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare i public.ws_einladungen; m text;
begin
  select email into m from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if m is null then raise exception 'E-Mail-Adresse ist noch nicht bestätigt'; end if;
  select * into i from public.ws_einladungen where lower(email) = lower(m) and angenommen is null;
  if i.id is null then raise exception 'Keine offene Einladung für dieses Konto'; end if;
  insert into public.ws_benutzer (id, name, rolle, claude_konto, eingeladen_von)
  values (auth.uid(), p_name, i.rolle, 'nicht noetig', i.eingeladen_von)
  on conflict (id) do nothing;
  insert into public.ws_projekt_mitglieder (projekt_id, benutzer_id, rolle) values (i.projekt_id, auth.uid(), i.rolle)
  on conflict (projekt_id, benutzer_id) do nothing;
  update public.ws_einladungen set angenommen = now() where id = i.id;
end $$;

-- Limits: nur Admin
create or replace function public.ws_limit_setzen(p_limit numeric, p_warnung int, p_stopp boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'Nur der Admin setzt das Limit'; end if;
  update public.ws_einstellungen set monatslimit_usd = p_limit, warnung_prozent = p_warnung, stopp_am_limit = p_stopp, geaendert = now() where id = 1;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'limit', jsonb_build_object('limit', p_limit, 'warnung', p_warnung, 'stopp', p_stopp));
end $$;

-- Verbrauch im laufenden Monat (gesamt und je Projekt) – für die Anzeige und die Werkstatt
create or replace function public.ws_verbrauch_monat() returns table (projekt_id text, kosten_usd numeric, auftraege bigint)
language sql stable security definer set search_path = public as $$
  select v.projekt_id, sum(v.kosten_usd), count(distinct v.auftrag_id)
  from public.ws_verbrauch v
  where v.erstellt >= date_trunc('month', now()) and public.ws_sieht_projekt(v.projekt_id)
  group by v.projekt_id
$$;

-- Gesamtverbrauch des Monats (über alle Projekte, für das gemeinsame Limit; ohne Projektdetails)
create or replace function public.ws_verbrauch_gesamt_monat() returns numeric
language sql stable security definer set search_path = public as $$
  select case when public.ws_ist_mitglied() then coalesce(sum(kosten_usd), 0) end
  from public.ws_verbrauch where erstellt >= date_trunc('month', now())
$$;

-- Mitglieder und Werkstatt-PCs nur sehen, wenn man ein Projekt teilt (unabhängige Prüfung R1)
create or replace function public.ws_teilt_projekt(p_benutzer uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ws_ist_admin() or p_benutzer = auth.uid() or exists (
    select 1 from public.ws_projekt_mitglieder m1 join public.ws_projekt_mitglieder m2 on m1.projekt_id = m2.projekt_id
    where m1.benutzer_id = auth.uid() and m2.benutzer_id = p_benutzer and public.ws_sieht_projekt(m1.projekt_id))
$$;

-- Werkstatt: Entwickler in mindestens einem Projekt (Rolle je Projekt statt Grundrolle; Prüfung O1)
create or replace function public.ws_ist_werkstatt() returns boolean
language sql stable security definer set search_path = public as $$
  select public.ws_ist_admin() or exists (select 1 from public.ws_projekt_mitglieder m join public.ws_benutzer b on b.id = m.benutzer_id
    where m.benutzer_id = auth.uid() and b.aktiv and m.rolle = 'entwickler')
$$;

-- Feature und Gruppe eines Auftrags müssen zum selben Projekt gehören (Prüfung O2)
create or replace function public.ws_projekt_von_feature(p_feature text) returns text
language sql stable security definer set search_path = public as $$
  select public.ws_projekt_von_gruppe(gruppe_id) from public.ws_features where id = p_feature
$$;

create or replace function public.ws_auftraege_schutz() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and not public.ws_ist_admin() and
     (new.gruppe_id, new.feature_id, new.erstellt_von, new.erstellt, new.art, new.baustein)
       is distinct from (old.gruppe_id, old.feature_id, old.erstellt_von, old.erstellt, old.art, old.baustein)
  then raise exception 'Dieses Feld ist nicht änderbar'; end if;
  if new.feature_id is not null and new.feature_id is distinct from old.feature_id
     and public.ws_projekt_von_feature(new.feature_id) is distinct from public.ws_projekt_von_gruppe(new.gruppe_id)
  then raise exception 'Feature gehört zu einem anderen Projekt'; end if;
  if current_user = 'authenticated' and not public.ws_ist_admin() and
     (old.stand in ('zusammen','sicherheit','wissen') or new.stand in ('sicherheit','wissen'))
  then raise exception 'Dieser Stand wird nur auf dem Admin-PC gesetzt'; end if;
  if new.stand = 'freigabe' and new.stand is distinct from old.stand and (new.pr_nummer is null or new.zweig is null)
  then raise exception 'Zur Freigabe braucht es einen Pull Request'; end if;
  return new;
end $$;

-- ---------- RLS v2 ----------
alter table public.ws_projekte          enable row level security;
alter table public.ws_projekt_mitglieder enable row level security;
alter table public.ws_einstellungen     enable row level security;
alter table public.ws_verbrauch         enable row level security;

drop policy if exists ws_benutzer_lesen on public.ws_benutzer;
create policy ws_benutzer_lesen on public.ws_benutzer for select to authenticated using (public.ws_ist_mitglied() and public.ws_teilt_projekt(id));
drop policy if exists ws_werkstatt_pcs_lesen on public.ws_werkstatt_pcs;
create policy ws_werkstatt_pcs_lesen on public.ws_werkstatt_pcs for select to authenticated using (public.ws_ist_mitglied() and public.ws_teilt_projekt(benutzer_id));

-- Lesen nur innerhalb der eigenen Projekte
drop policy if exists ws_projekte_lesen on public.ws_projekte;
create policy ws_projekte_lesen on public.ws_projekte for select to authenticated using (public.ws_sieht_projekt(id));
drop policy if exists ws_projekte_admin on public.ws_projekte;
create policy ws_projekte_admin on public.ws_projekte for update to authenticated using (public.ws_ist_admin()) with check (public.ws_ist_admin());

drop policy if exists ws_projekt_mitglieder_lesen on public.ws_projekt_mitglieder;
create policy ws_projekt_mitglieder_lesen on public.ws_projekt_mitglieder for select to authenticated using (public.ws_sieht_projekt(projekt_id));

drop policy if exists ws_einstellungen_lesen on public.ws_einstellungen;
create policy ws_einstellungen_lesen on public.ws_einstellungen for select to authenticated using (public.ws_ist_mitglied());

drop policy if exists ws_verbrauch_lesen on public.ws_verbrauch;
create policy ws_verbrauch_lesen on public.ws_verbrauch for select to authenticated using (public.ws_sieht_projekt(projekt_id));
drop policy if exists ws_verbrauch_neu on public.ws_verbrauch;
create policy ws_verbrauch_neu on public.ws_verbrauch for insert to authenticated
  with check (exists (select 1 from public.ws_auftraege a where a.id = auftrag_id and public.ws_ist_werkstatt_fuer(a.gruppe_id)
                      and public.ws_projekt_von_gruppe(a.gruppe_id) = projekt_id)
              and (werkstatt_pc is null or werkstatt_pc in (select id from public.ws_werkstatt_pcs where benutzer_id = auth.uid())));

-- Bestehende Lese-Policies auf Projekte einschränken
drop policy if exists ws_bereiche_lesen on public.ws_bereiche;
create policy ws_bereiche_lesen on public.ws_bereiche for select to authenticated using (public.ws_sieht_projekt(projekt_id));
drop policy if exists ws_gruppen_lesen on public.ws_gruppen;
create policy ws_gruppen_lesen on public.ws_gruppen for select to authenticated using (public.ws_sieht_projekt(public.ws_projekt_von_bereich(bereich_id)));
drop policy if exists ws_features_lesen on public.ws_features;
create policy ws_features_lesen on public.ws_features for select to authenticated using (public.ws_sieht_projekt(public.ws_projekt_von_gruppe(gruppe_id)));
drop policy if exists ws_auftraege_lesen on public.ws_auftraege;
create policy ws_auftraege_lesen on public.ws_auftraege for select to authenticated using (public.ws_sieht_projekt(public.ws_projekt_von_gruppe(gruppe_id)));
drop policy if exists ws_nachrichten_lesen on public.ws_nachrichten;
create policy ws_nachrichten_lesen on public.ws_nachrichten for select to authenticated
  using (exists (select 1 from public.ws_auftraege a where a.id = auftrag_id and public.ws_sieht_projekt(public.ws_projekt_von_gruppe(a.gruppe_id))));
drop policy if exists ws_live_log_lesen on public.ws_live_log;
create policy ws_live_log_lesen on public.ws_live_log for select to authenticated
  using (exists (select 1 from public.ws_auftraege a where a.id = auftrag_id and public.ws_sieht_projekt(public.ws_projekt_von_gruppe(a.gruppe_id))));
drop policy if exists ws_erlaubnisse_lesen on public.ws_erlaubnisse;
create policy ws_erlaubnisse_lesen on public.ws_erlaubnisse for select to authenticated
  using (exists (select 1 from public.ws_auftraege a where a.id = auftrag_id and public.ws_sieht_projekt(public.ws_projekt_von_gruppe(a.gruppe_id))));
drop policy if exists ws_rechte_lesen on public.ws_rechte;
create policy ws_rechte_lesen on public.ws_rechte for select to authenticated
  using (benutzer_id = auth.uid() or public.ws_ist_admin());
drop policy if exists ws_protokoll_lesen on public.ws_protokoll;
create policy ws_protokoll_lesen on public.ws_protokoll for select to authenticated using (public.ws_ist_admin());

-- Texter-Regel beim Anlegen von Aufträgen: Rolle im Projekt
drop policy if exists ws_auftraege_neu on public.ws_auftraege;
create policy ws_auftraege_neu on public.ws_auftraege for insert to authenticated
  with check (public.ws_darf(public.ws_bereich_von_gruppe(gruppe_id), 'auftraege') and erstellt_von = auth.uid()
              and stand = 'wartet' and (public.ws_rolle_fuer_gruppe(gruppe_id) <> 'texter' or art = 'text')
              and zweig is null and pr_nummer is null and version is null and werkstatt_pc is null and modell is null
              and (ws_auftraege.feature_id is null
                   or public.ws_projekt_von_feature(ws_auftraege.feature_id) = public.ws_projekt_von_gruppe(ws_auftraege.gruppe_id)));

-- Einladungen: Admin, nur mit Projekt
drop policy if exists ws_einladungen_admin on public.ws_einladungen;
create policy ws_einladungen_admin on public.ws_einladungen for all to authenticated
  using (public.ws_ist_admin()) with check (public.ws_ist_admin() and eingeladen_von = auth.uid() and projekt_id is not null);

-- Gruppen anlegen: Admin, Bereich muss existieren (Projekt kommt über den Bereich)
-- (Policy ws_gruppen_admin aus 0001 bleibt)

-- ---------- Rechte auf Tabellen und Funktionen ----------
revoke all on public.ws_projekte, public.ws_projekt_mitglieder, public.ws_einstellungen, public.ws_verbrauch from anon;
grant select on public.ws_projekte, public.ws_projekt_mitglieder, public.ws_einstellungen, public.ws_verbrauch to authenticated;
grant update (name, beschreibung, repo, symbol, archiviert) on public.ws_projekte to authenticated;
grant insert (auftrag_id, projekt_id, modell, kosten_usd, tokens_ein, tokens_aus, werkstatt_pc) on public.ws_verbrauch to authenticated;
grant usage on sequence public.ws_verbrauch_id_seq to authenticated;
-- Modell setzt die Werkstatt (Spaltenrecht über die bestehende Update-Policy der Werkstatt)
revoke execute on function public.ws_projekt_von_bereich(text), public.ws_projekt_von_gruppe(text), public.ws_rolle_im_projekt(text),
  public.ws_sieht_projekt(text), public.ws_rolle_fuer_gruppe(text), public.ws_projekt_anlegen(text,text,text,text,text),
  public.ws_mitglied_setzen(text,uuid,text), public.ws_limit_setzen(numeric,int,boolean), public.ws_verbrauch_monat(),
  public.ws_verbrauch_gesamt_monat(), public.ws_teilt_projekt(uuid), public.ws_projekt_von_feature(text) from public, anon;
grant execute on function public.ws_projekt_von_bereich(text), public.ws_projekt_von_gruppe(text), public.ws_rolle_im_projekt(text),
  public.ws_sieht_projekt(text), public.ws_rolle_fuer_gruppe(text), public.ws_projekt_anlegen(text,text,text,text,text),
  public.ws_mitglied_setzen(text,uuid,text), public.ws_limit_setzen(numeric,int,boolean), public.ws_verbrauch_monat(),
  public.ws_verbrauch_gesamt_monat(), public.ws_teilt_projekt(uuid), public.ws_projekt_von_feature(text) to authenticated;

-- ---------- Live-Abgleich ----------
do $$ declare t text; begin
  foreach t in array array['ws_projekte','ws_projekt_mitglieder','ws_einstellungen','ws_verbrauch'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;

select (select count(*) from public.ws_projekte) projekte, (select count(*) from public.ws_bereiche where projekt_id = 'trainer-to-go') bereiche_ttg,
       (select count(*) from public.ws_projekt_mitglieder) mitglieder;
