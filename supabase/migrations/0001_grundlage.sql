-- Codeschmiede · Datenbank v1 (Grundlage, unabhängig geprüft 2026-10-22, im Supabase-Testprojekt von Trainer to go eingespielt)
-- Zweig feature/auftrags-zentrale · Konzept docs/PROGRAMMIERUMGEBUNG.md
-- Nur Entwicklungsprojekt. Enthält keine Vereins- oder Kinderdaten: nur Aufträge, Features und Mitglieder der Programmierumgebung.
-- Alle Tabellen beginnen mit ws_ (Werkstatt) und sind nur für eingeladene Mitglieder sichtbar (RLS).
-- Mehrfach ausführbar (if not exists / create or replace).

begin;

-- ---------- Tabellen ----------
create table if not exists public.ws_benutzer (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  rolle text not null check (rolle in ('admin','entwickler','texter','leser')),
  claude_konto text,                       -- 'max', 'pro', 'nicht noetig', 'ausstehend'
  aktiv boolean not null default true,
  eingeladen_von uuid references auth.users(id),
  erstellt timestamptz not null default now()
);

create table if not exists public.ws_einladungen (
  id bigserial primary key,
  email text not null,
  rolle text not null check (rolle in ('entwickler','texter','leser')),
  eingeladen_von uuid not null references auth.users(id),
  erstellt timestamptz not null default now(),
  angenommen timestamptz
);

create unique index if not exists ws_einladungen_email_ci on public.ws_einladungen (lower(email));

create table if not exists public.ws_bereiche (
  id text primary key,
  name text not null,
  reihenfolge int not null default 0
);

create table if not exists public.ws_gruppen (
  id text primary key,
  bereich_id text not null references public.ws_bereiche(id),
  name text not null,
  symbol text not null default 'layers',     -- Lucide-Symbolname
  reihenfolge int not null default 0,
  erstellt_von uuid references auth.users(id),
  erstellt timestamptz not null default now()
);

create table if not exists public.ws_features (
  id text primary key,                        -- F-Nummer aus dem Funktionsverzeichnis oder N-<zeit> bei neu angelegten
  gruppe_id text not null references public.ws_gruppen(id),
  name text not null,
  beschreibung text,
  stand text not null default 'geplant' check (stand in ('live','arbeit','entwurf','geplant','altlast')),
  quelle text not null default 'manuell' check (quelle in ('registry','manuell')),
  ausgeblendet boolean not null default false,
  ausgebaut boolean not null default false,          -- nur durch einen Ausbau-Auftrag
  fehlt_im_verzeichnis boolean not null default false, -- vom Import gesetzt, wenn die F-Nummer im Funktionsverzeichnis fehlt
  neu_bis timestamptz,
  erstellt_von uuid references auth.users(id),
  geaendert timestamptz not null default now()
);

alter table public.ws_features add column if not exists fehlt_im_verzeichnis boolean not null default false;

create table if not exists public.ws_rechte (
  benutzer_id uuid not null references public.ws_benutzer(id) on delete cascade,
  bereich_id text not null references public.ws_bereiche(id),
  auftraege boolean not null default false,
  freigeben boolean not null default false,
  loeschen boolean not null default false,
  primary key (benutzer_id, bereich_id)
);

create table if not exists public.ws_auftraege (
  id bigserial primary key,
  gruppe_id text not null references public.ws_gruppen(id),
  feature_id text references public.ws_features(id),
  titel text not null,
  art text not null default 'aendern' check (art in ('aendern','neu','ausbauen','text')),
  stand text not null default 'wartet' check (stand in ('wartet','laeuft','frage','freigabe','zusammen','sicherheit','wissen','abgebrochen')),
  baustein jsonb,                             -- aus „Zeigen & kommentieren“: name, datei, ansicht
  werkstatt_pc uuid,
  zweig text,
  pr_nummer int,
  version text,
  erstellt_von uuid not null references auth.users(id),
  erstellt timestamptz not null default now(),
  geaendert timestamptz not null default now()
);
create index if not exists ws_auftraege_gruppe on public.ws_auftraege (gruppe_id, stand);

create table if not exists public.ws_nachrichten (
  id bigserial primary key,
  auftrag_id bigint not null references public.ws_auftraege(id) on delete cascade,
  von uuid references auth.users(id),         -- null = Werkstatt
  art text not null default 'text' check (art in ('text','frage','ergebnis','system')),
  text text not null,
  daten jsonb,
  erstellt timestamptz not null default now()
);
create index if not exists ws_nachrichten_auftrag on public.ws_nachrichten (auftrag_id, id);

create table if not exists public.ws_live_log (
  id bigserial primary key,
  auftrag_id bigint not null references public.ws_auftraege(id) on delete cascade,
  art text not null check (art in ('lesen','aendern','neu','test','info','erlaubnis','fehler')),
  text text not null,
  ausschnitt text,
  erstellt timestamptz not null default now()
);
create index if not exists ws_live_log_auftrag on public.ws_live_log (auftrag_id, id);

create table if not exists public.ws_erlaubnisse (
  id bigserial primary key,
  auftrag_id bigint not null references public.ws_auftraege(id) on delete cascade,
  werkzeug text not null,
  eingabe text not null,
  grund text,
  status text not null default 'offen' check (status in ('offen','einmal','immer','abgelehnt')),
  entschieden_von uuid references auth.users(id),
  entschieden timestamptz,
  erstellt timestamptz not null default now()
);

create table if not exists public.ws_werkstatt_pcs (
  id uuid primary key default gen_random_uuid(),
  benutzer_id uuid not null references public.ws_benutzer(id) on delete cascade,
  name text not null,
  an boolean not null default false,
  admin_pc boolean not null default false,
  zuletzt timestamptz not null default now()
);

create table if not exists public.ws_protokoll (
  id bigserial primary key,
  wer uuid references auth.users(id),
  was text not null,
  details jsonb,
  wann timestamptz not null default now()
);

-- ---------- Hilfsfunktionen (Rechte) ----------
create or replace function public.ws_rolle() returns text
language sql stable security definer set search_path = public as $$
  select rolle from public.ws_benutzer where id = auth.uid() and aktiv
$$;

create or replace function public.ws_ist_mitglied() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ws_benutzer where id = auth.uid() and aktiv)
$$;

create or replace function public.ws_ist_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.ws_rolle() = 'admin', false)
$$;

create or replace function public.ws_darf(p_bereich text, p_recht text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ws_ist_admin() or exists (
    select 1 from public.ws_rechte r join public.ws_benutzer b on b.id = r.benutzer_id
    where r.benutzer_id = auth.uid() and b.aktiv and r.bereich_id = p_bereich
      and case p_recht
            when 'auftraege' then r.auftraege and b.rolle in ('entwickler','texter')
            when 'freigeben' then r.freigeben and b.rolle = 'entwickler'
            when 'loeschen'  then r.loeschen  and b.rolle = 'entwickler'
            else false end)
$$;

create or replace function public.ws_bereich_von_gruppe(p_gruppe text) returns text
language sql stable security definer set search_path = public as $$
  select bereich_id from public.ws_gruppen where id = p_gruppe
$$;

-- Werkstatt-Rechner (Entwickler/Admin mit eingeschaltetem PC) schreiben Log, Nachrichten und Stand
create or replace function public.ws_ist_werkstatt() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.ws_rolle() in ('admin','entwickler'), false)
$$;

-- Werkstatt für eine bestimmte Gruppe: Admin, oder Entwickler mit Auftragsrecht im Bereich und eingeschaltetem Werkstatt-PC
create or replace function public.ws_ist_werkstatt_fuer(p_gruppe text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ws_ist_admin() or (coalesce(public.ws_rolle() = 'entwickler', false)
     and public.ws_darf(public.ws_bereich_von_gruppe(p_gruppe), 'auftraege')
     and exists (select 1 from public.ws_werkstatt_pcs where benutzer_id = auth.uid() and an))
$$;

-- Schutz: Zuordnung und Herkunft eines Auftrags ändert nur der Admin
create or replace function public.ws_auftraege_schutz() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and not public.ws_ist_admin() and
     (new.gruppe_id, new.feature_id, new.erstellt_von, new.erstellt, new.art, new.baustein)
       is distinct from (old.gruppe_id, old.feature_id, old.erstellt_von, old.erstellt, old.art, old.baustein)
  then raise exception 'Dieses Feld ist nicht änderbar'; end if;
  if current_user = 'authenticated' and not public.ws_ist_admin() and
     (old.stand in ('zusammen','sicherheit','wissen') or new.stand in ('sicherheit','wissen'))
  then raise exception 'Dieser Stand wird nur auf dem Admin-PC gesetzt'; end if;
  if new.stand = 'freigabe' and new.stand is distinct from old.stand and (new.pr_nummer is null or new.zweig is null)
  then raise exception 'Zur Freigabe braucht es einen Pull Request'; end if;
  return new;
end $$;
drop trigger if exists ws_auftraege_schutz on public.ws_auftraege;
create trigger ws_auftraege_schutz before update on public.ws_auftraege for each row execute function public.ws_auftraege_schutz();

-- Schutz: Mitglieder ändern an ihrer eigenen Zeile nur den Namen
create or replace function public.ws_benutzer_schutz() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and not public.ws_ist_admin() and
     (new.id, new.rolle, new.aktiv, new.eingeladen_von, new.claude_konto, new.erstellt)
       is distinct from (old.id, old.rolle, old.aktiv, old.eingeladen_von, old.claude_konto, old.erstellt)
  then raise exception 'Nur der Name ist änderbar'; end if;
  return new;
end $$;
drop trigger if exists ws_benutzer_schutz on public.ws_benutzer;
create trigger ws_benutzer_schutz before update on public.ws_benutzer for each row execute function public.ws_benutzer_schutz();

-- Feature in eine andere Gruppe verschieben: nur Admin
create or replace function public.ws_feature_verschieben(p_feature text, p_gruppe text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'Nur der Admin verschiebt Features'; end if;
  update public.ws_features set gruppe_id = p_gruppe, geaendert = now() where id = p_feature;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'verschieben', jsonb_build_object('feature', p_feature, 'gruppe', p_gruppe));
end $$;

-- ---------- Aktionen mit Prüfung (nur über diese Funktionen) ----------
-- Freigeben & zusammenführen: nur Admin oder Recht „freigeben“ im Bereich, nur aus Stand „freigabe“
create or replace function public.ws_freigeben(p_auftrag bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ws_auftraege;
begin
  select * into a from public.ws_auftraege where id = p_auftrag for update;
  if a.id is null then raise exception 'Auftrag nicht gefunden'; end if;
  if not public.ws_darf(public.ws_bereich_von_gruppe(a.gruppe_id), 'freigeben') then
    raise exception 'Keine Berechtigung zum Freigeben in diesem Bereich';
  end if;
  if a.stand <> 'freigabe' then raise exception 'Auftrag ist nicht zur Freigabe bereit'; end if;
  if a.pr_nummer is null or a.zweig is null then raise exception 'Kein Pull Request hinterlegt'; end if;
  update public.ws_auftraege set stand = 'zusammen', geaendert = now() where id = p_auftrag;
  insert into public.ws_nachrichten (auftrag_id, von, art, text) values (p_auftrag, auth.uid(), 'system', 'Freigegeben – Zusammenführen gestartet');
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'freigeben', jsonb_build_object('auftrag', p_auftrag, 'zweig', a.zweig));
end $$;

-- Erlaubnis-Anfrage beantworten: nur Admin oder Recht „freigeben“ im Bereich
create or replace function public.ws_erlaubnis_entscheiden(p_id bigint, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare e public.ws_erlaubnisse; g text;
begin
  if p_status not in ('einmal','immer','abgelehnt') then raise exception 'Ungültige Entscheidung'; end if;
  select * into e from public.ws_erlaubnisse where id = p_id for update;
  if e.id is null or e.status <> 'offen' then raise exception 'Anfrage nicht offen'; end if;
  select gruppe_id into g from public.ws_auftraege where id = e.auftrag_id;
  if not public.ws_darf(public.ws_bereich_von_gruppe(g), 'freigeben') then
    raise exception 'Keine Berechtigung zum Erlauben in diesem Bereich';
  end if;
  update public.ws_erlaubnisse set status = p_status, entschieden_von = auth.uid(), entschieden = now() where id = p_id;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'erlaubnis', jsonb_build_object('id', p_id, 'status', p_status, 'eingabe', e.eingabe));
end $$;

-- Feature ausblenden / wieder einblenden: Admin oder Recht „loeschen“
create or replace function public.ws_feature_ausblenden(p_feature text, p_aus boolean) returns void
language plpgsql security definer set search_path = public as $$
declare f public.ws_features;
begin
  select * into f from public.ws_features where id = p_feature for update;
  if f.id is null then raise exception 'Feature nicht gefunden'; end if;
  if not public.ws_darf(public.ws_bereich_von_gruppe(f.gruppe_id), 'loeschen') then
    raise exception 'Keine Berechtigung zum Löschen in diesem Bereich';
  end if;
  update public.ws_features set ausgeblendet = p_aus, geaendert = now() where id = p_feature;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), case when p_aus then 'ausblenden' else 'einblenden' end, jsonb_build_object('feature', p_feature));
end $$;

-- Rechte setzen: nur Admin
create or replace function public.ws_rechte_setzen(p_benutzer uuid, p_bereich text, p_auftraege boolean, p_freigeben boolean, p_loeschen boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'Nur der Admin vergibt Rechte'; end if;
  insert into public.ws_rechte (benutzer_id, bereich_id, auftraege, freigeben, loeschen)
  values (p_benutzer, p_bereich, p_auftraege, p_freigeben, p_loeschen)
  on conflict (benutzer_id, bereich_id) do update set auftraege = excluded.auftraege, freigeben = excluded.freigeben, loeschen = excluded.loeschen;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'rechte', jsonb_build_object('benutzer', p_benutzer, 'bereich', p_bereich, 'auftraege', p_auftraege, 'freigeben', p_freigeben, 'loeschen', p_loeschen));
end $$;

-- Einladung annehmen: beim ersten Login wird aus der Einladung ein Mitglied
create or replace function public.ws_einladung_annehmen(p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare i public.ws_einladungen; m text;
begin
  select email into m from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if m is null then raise exception 'E-Mail-Adresse ist noch nicht bestätigt'; end if;
  select * into i from public.ws_einladungen where lower(email) = lower(m) and angenommen is null;
  if i.id is null then raise exception 'Keine offene Einladung für dieses Konto'; end if;
  insert into public.ws_benutzer (id, name, rolle, claude_konto, eingeladen_von)
  values (auth.uid(), p_name, i.rolle, case when i.rolle = 'entwickler' then 'ausstehend' else 'nicht noetig' end, i.eingeladen_von)
  on conflict (id) do nothing;
  update public.ws_einladungen set angenommen = now() where id = i.id;
end $$;

-- ---------- RLS ----------
alter table public.ws_benutzer      enable row level security;
alter table public.ws_einladungen   enable row level security;
alter table public.ws_bereiche      enable row level security;
alter table public.ws_gruppen       enable row level security;
alter table public.ws_features      enable row level security;
alter table public.ws_rechte        enable row level security;
alter table public.ws_auftraege     enable row level security;
alter table public.ws_nachrichten   enable row level security;
alter table public.ws_live_log      enable row level security;
alter table public.ws_erlaubnisse   enable row level security;
alter table public.ws_werkstatt_pcs enable row level security;
alter table public.ws_protokoll     enable row level security;

do $$ declare t text; begin
  foreach t in array array['ws_benutzer','ws_bereiche','ws_gruppen','ws_features','ws_rechte','ws_auftraege','ws_nachrichten','ws_live_log','ws_erlaubnisse','ws_werkstatt_pcs','ws_protokoll'] loop
    execute format('drop policy if exists %I on public.%I', t||'_lesen', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.ws_ist_mitglied())', t||'_lesen', t);
  end loop;
end $$;

-- Benutzer: Admin verwaltet; jeder darf den eigenen Namen ändern
drop policy if exists ws_benutzer_admin on public.ws_benutzer;
create policy ws_benutzer_admin on public.ws_benutzer for all to authenticated using (public.ws_ist_admin()) with check (public.ws_ist_admin());
drop policy if exists ws_benutzer_selbst on public.ws_benutzer;
create policy ws_benutzer_selbst on public.ws_benutzer for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and rolle = public.ws_rolle());

-- Einladungen: nur Admin
drop policy if exists ws_einladungen_admin on public.ws_einladungen;
create policy ws_einladungen_admin on public.ws_einladungen for all to authenticated using (public.ws_ist_admin()) with check (public.ws_ist_admin() and eingeladen_von = auth.uid());

-- Bereiche und Gruppen: nur Admin legt an/ändert
drop policy if exists ws_bereiche_admin on public.ws_bereiche;
create policy ws_bereiche_admin on public.ws_bereiche for all to authenticated using (public.ws_ist_admin()) with check (public.ws_ist_admin());
drop policy if exists ws_gruppen_admin on public.ws_gruppen;
create policy ws_gruppen_admin on public.ws_gruppen for all to authenticated using (public.ws_ist_admin()) with check (public.ws_ist_admin());

-- Features: neu anlegen mit Recht „auftraege“; ändern (Stand, Text) Admin oder Werkstatt; ausblenden nur über ws_feature_ausblenden
drop policy if exists ws_features_neu on public.ws_features;
create policy ws_features_neu on public.ws_features for insert to authenticated
  with check (public.ws_darf(public.ws_bereich_von_gruppe(gruppe_id), 'auftraege') and quelle = 'manuell' and id like 'N-%'
              and not ausgeblendet and not ausgebaut and not fehlt_im_verzeichnis and erstellt_von = auth.uid());
drop policy if exists ws_features_aendern on public.ws_features;
create policy ws_features_aendern on public.ws_features for update to authenticated
  using (public.ws_ist_werkstatt_fuer(gruppe_id)) with check (public.ws_ist_werkstatt_fuer(gruppe_id));

-- Rechte: nur über ws_rechte_setzen (Admin); keine direkte Schreib-Policy

-- Aufträge: anlegen mit Recht „auftraege“ (Texter nur Art „text“); Stand ändern nur Werkstatt; „zusammen“ nur über ws_freigeben
drop policy if exists ws_auftraege_neu on public.ws_auftraege;
create policy ws_auftraege_neu on public.ws_auftraege for insert to authenticated
  with check (public.ws_darf(public.ws_bereich_von_gruppe(gruppe_id), 'auftraege') and erstellt_von = auth.uid()
              and stand = 'wartet' and (public.ws_rolle() <> 'texter' or art = 'text')
              and zweig is null and pr_nummer is null and version is null and werkstatt_pc is null);
drop policy if exists ws_auftraege_werkstatt on public.ws_auftraege;
create policy ws_auftraege_werkstatt on public.ws_auftraege for update to authenticated
  using (public.ws_ist_werkstatt_fuer(gruppe_id))
  with check (public.ws_ist_werkstatt_fuer(gruppe_id) and stand in ('wartet','laeuft','frage','freigabe','sicherheit','wissen','abgebrochen'));

-- Nachrichten: Mitglieder mit Auftragsrecht schreiben als sich selbst; Werkstatt schreibt ohne Absender
drop policy if exists ws_nachrichten_neu on public.ws_nachrichten;
create policy ws_nachrichten_neu on public.ws_nachrichten for insert to authenticated
  with check ((von = auth.uid() and art = 'text' and exists (select 1 from public.ws_auftraege a where a.id = auftrag_id and public.ws_darf(public.ws_bereich_von_gruppe(a.gruppe_id), 'auftraege')))
              or (von is null and art <> 'system' and exists (select 1 from public.ws_auftraege a where a.id = auftrag_id and public.ws_ist_werkstatt_fuer(a.gruppe_id))));

-- Live-Log und Erlaubnis-Anfragen schreibt nur die Werkstatt; Entscheidungen nur über ws_erlaubnis_entscheiden
drop policy if exists ws_live_log_neu on public.ws_live_log;
create policy ws_live_log_neu on public.ws_live_log for insert to authenticated
  with check (exists (select 1 from public.ws_auftraege a where a.id = auftrag_id and public.ws_ist_werkstatt_fuer(a.gruppe_id)));
drop policy if exists ws_erlaubnisse_neu on public.ws_erlaubnisse;
create policy ws_erlaubnisse_neu on public.ws_erlaubnisse for insert to authenticated
  with check (status = 'offen' and entschieden_von is null and exists (select 1 from public.ws_auftraege a where a.id = auftrag_id and public.ws_ist_werkstatt_fuer(a.gruppe_id)));

-- Werkstatt-PCs: jeder verwaltet nur die eigenen; Admin-PC kann nur ein Admin sein
drop policy if exists ws_pcs_eigene on public.ws_werkstatt_pcs;
create policy ws_pcs_eigene on public.ws_werkstatt_pcs for all to authenticated
  using (benutzer_id = auth.uid() and public.ws_ist_mitglied())
  with check (benutzer_id = auth.uid() and public.ws_ist_werkstatt() and (not admin_pc or public.ws_ist_admin()));

-- Protokoll: nur über die Funktionen oben (security definer); niemand schreibt direkt

-- ---------- Rechte auf Tabellen und Funktionen ----------
revoke all on public.ws_benutzer, public.ws_einladungen, public.ws_bereiche, public.ws_gruppen, public.ws_features, public.ws_rechte,
  public.ws_auftraege, public.ws_nachrichten, public.ws_live_log, public.ws_erlaubnisse, public.ws_werkstatt_pcs, public.ws_protokoll from anon;
grant select, insert, update, delete on public.ws_benutzer, public.ws_einladungen, public.ws_bereiche, public.ws_gruppen, public.ws_features,
  public.ws_auftraege, public.ws_nachrichten, public.ws_live_log, public.ws_erlaubnisse, public.ws_werkstatt_pcs to authenticated;
grant select on public.ws_rechte, public.ws_protokoll to authenticated;
revoke delete on public.ws_features, public.ws_auftraege, public.ws_nachrichten, public.ws_live_log, public.ws_erlaubnisse from authenticated;
revoke update on public.ws_features from authenticated;
grant update (name, beschreibung, stand, geaendert) on public.ws_features to authenticated;
revoke update, delete on public.ws_nachrichten, public.ws_live_log, public.ws_erlaubnisse from authenticated;
grant usage on sequence public.ws_einladungen_id_seq, public.ws_auftraege_id_seq, public.ws_nachrichten_id_seq,
  public.ws_live_log_id_seq, public.ws_erlaubnisse_id_seq to authenticated;
revoke execute on function public.ws_rolle(), public.ws_ist_mitglied(), public.ws_ist_admin(), public.ws_darf(text,text),
  public.ws_bereich_von_gruppe(text), public.ws_ist_werkstatt(), public.ws_ist_werkstatt_fuer(text) from public, anon;
grant execute on function public.ws_rolle(), public.ws_ist_mitglied(), public.ws_ist_admin(), public.ws_darf(text,text),
  public.ws_bereich_von_gruppe(text), public.ws_ist_werkstatt(), public.ws_ist_werkstatt_fuer(text) to authenticated;
revoke execute on function public.ws_freigeben(bigint), public.ws_erlaubnis_entscheiden(bigint,text), public.ws_feature_ausblenden(text,boolean),
  public.ws_rechte_setzen(uuid,text,boolean,boolean,boolean), public.ws_einladung_annehmen(text), public.ws_feature_verschieben(text,text) from public, anon;
grant execute on function public.ws_freigeben(bigint), public.ws_erlaubnis_entscheiden(bigint,text), public.ws_feature_ausblenden(text,boolean),
  public.ws_rechte_setzen(uuid,text,boolean,boolean,boolean), public.ws_einladung_annehmen(text), public.ws_feature_verschieben(text,text) to authenticated;

-- ---------- Live-Abgleich (Realtime) ----------
do $$ declare t text; begin
  foreach t in array array['ws_gruppen','ws_features','ws_rechte','ws_benutzer','ws_auftraege','ws_nachrichten','ws_live_log','ws_erlaubnisse','ws_werkstatt_pcs'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- Grunddaten ----------
insert into public.ws_bereiche (id, name, reihenfolge) values
  ('sport','Sport',1),('verein','Verein',2),('leitung','Leitung',3),('plattform','Plattform',4)
on conflict (id) do update set name = excluded.name, reihenfolge = excluded.reihenfolge;

insert into public.ws_gruppen (id, bereich_id, name, symbol, reihenfolge) values
  ('kader','sport','Mannschaft & Kader','users',1),('training','sport','Training','cone',2),('spiele','sport','Spiele & Turniere','trophy',3),
  ('taktik','sport','Taktik','board',4),('ausbildung','sport','Ausbildungskonzept','book',5),
  ('kalender','verein','Kalender & Start','calendar',1),('komm','verein','Kommunikation','message-square',2),('mitglieder','verein','Mitglieder & Funktionen','home',3),
  ('kantine','verein','Kantine','cup-soda',4),('ausruestung','verein','Ausrüstung','shirt',5),
  ('vorstand','leitung','Vorstand','gavel',1),('schrift','leitung','Schriftführung','pen',2),('finanzen','leitung','Finanzen','euro',3),
  ('sponsoring','leitung','Sponsoring','handshake',4),('beirat','leitung','Beirat','users-round',5),('nachwuchs','leitung','Nachwuchsleitung','sprout',6),
  ('sportlich','leitung','Sportliche Leitung','target',7),
  ('erp','plattform','ERP & Vertrieb','chart-column',1),('design','plattform','Design-Studio','palette',2),('website','plattform','Website','globe',3),
  ('handbuch','plattform','Handbuch & PDF-Layouts','file-text',4),('einst','plattform','Konto, Einstellungen & Datenschutz','settings',5),
  ('altlast','plattform','Altlasten (zur Entscheidung)','archive',6),('werkstatt','plattform','Programmierumgebung','wrench',7)
on conflict (id) do update set bereich_id = excluded.bereich_id, name = excluded.name, symbol = excluded.symbol, reihenfolge = excluded.reihenfolge;

-- Erster Admin: Gerhard Kresak (Konto mit dieser E-Mail-Adresse im Entwicklungsprojekt)
insert into public.ws_benutzer (id, name, rolle, claude_konto)
select id, 'Gerhard Kresak', 'admin', 'max' from auth.users where lower(email) = 'gerhard.kresak@gmail.com' and email_confirmed_at is not null
on conflict (id) do update set rolle = 'admin', aktiv = true;

commit;

-- Prüfung
select 'bereiche' t, count(*) from public.ws_bereiche
union all select 'gruppen', count(*) from public.ws_gruppen
union all select 'admin', count(*) from public.ws_benutzer where rolle = 'admin';
