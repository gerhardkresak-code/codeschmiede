-- Codeschmiede · Datenbank v35: Fehler-Meldungen aus den Apps (Entwurf 1.0, freigegeben von Gerhard 2026-10-24 16:22)
-- Antworten 16:20: Sammelstelle Codeschmiede · nur Technik, alles andere gefiltert · Liste + „Als Auftrag“ · 30 Tage.
-- Apps melden mit einem Melde-Schlüssel (kann nur melden, nichts lesen) über die Funktion ws_fehler_melden (auch ohne Anmeldung).
-- Die Datenbank bereinigt jede Meldung noch einmal (E-Mails, Kennungen, Zahlenfolgen, Schlüssel, Adressen-Parameter) und fasst
-- gleiche Fehler zusammen. Höchstens 300 Meldungen je App und Stunde. Löschung nach 30 Tagen. Mehrfach ausführbar. 0001 → … → 0035.
begin;

create table if not exists public.ws_fehler_schluessel (
  projekt_id text primary key references public.ws_projekte(id) on delete cascade,
  schluessel text not null unique check (schluessel ~ '^csf_[0-9a-f]{32}$'),
  aktiv boolean not null default true,
  erstellt timestamptz not null default now(),
  erste_meldung timestamptz,
  letzte_meldung timestamptz
);
alter table public.ws_fehler_schluessel enable row level security;
revoke all on public.ws_fehler_schluessel from anon, authenticated;
grant select on public.ws_fehler_schluessel to authenticated;
drop policy if exists ws_fehler_schluessel_lesen on public.ws_fehler_schluessel;
create policy ws_fehler_schluessel_lesen on public.ws_fehler_schluessel for select to authenticated using (public.ws_ist_admin());

create table if not exists public.ws_fehler (
  id bigint generated always as identity primary key,
  projekt_id text not null references public.ws_projekte(id) on delete cascade,
  fingerabdruck text not null check (fingerabdruck ~ '^[0-9a-f]{32}$'),
  nachricht text not null check (char_length(nachricht) <= 500),
  stelle text check (char_length(stelle) <= 300),
  seite text check (char_length(seite) <= 200),
  ablauf text check (char_length(ablauf) <= 4000),
  version text check (char_length(version) <= 40),
  umgebung text not null default 'live' check (umgebung in ('live','test')),
  geraete jsonb not null default '{}'::jsonb,
  browser text check (char_length(browser) <= 60),
  anzahl int not null default 1 check (anzahl >= 0),
  erstmals timestamptz not null default now(),
  zuletzt timestamptz not null default now(),
  stand text not null default 'offen' check (stand in ('offen','auftrag','erledigt','ignoriert')),
  neu boolean not null default true,
  auftrag_id bigint references public.ws_auftraege(id) on delete set null,
  unique (projekt_id, fingerabdruck)
);
create index if not exists ws_fehler_projekt on public.ws_fehler (projekt_id, stand, zuletzt desc);
alter table public.ws_fehler enable row level security;
revoke all on public.ws_fehler from anon, authenticated;
grant select on public.ws_fehler to authenticated;
drop policy if exists ws_fehler_lesen on public.ws_fehler;
create policy ws_fehler_lesen on public.ws_fehler for select to authenticated using (public.ws_sieht_projekt(projekt_id));
do $$ begin alter publication supabase_realtime add table public.ws_fehler; exception when others then null; end $$;

create table if not exists public.ws_fehler_grenze (
  projekt_id text not null references public.ws_projekte(id) on delete cascade,
  stunde timestamptz not null,
  anzahl int not null default 0,
  primary key (projekt_id, stunde)
);
alter table public.ws_fehler_grenze enable row level security;
revoke all on public.ws_fehler_grenze from anon, authenticated;

-- Bereinigung: alles, was auf Personen oder Zugänge zeigen kann, fliegt raus
create or replace function public.ws_fehler_bereinigen(t text, n int) returns text
language sql immutable set search_path = public as $$
  select left(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    coalesce(t, ''),
    -- Inhalte in Anführungszeichen (Werte, Namen); kurze technische Bezeichner wie 'map' bleiben
    $q$(["“„«`])[^"“”„«»`\n]{0,250}(["”“»`])$q$, '"…"', 'g'),
    $q$'(?![a-z_$][A-Za-z0-9_$.]{0,40}')[^'\n]{0,250}'$q$, '''…''', 'g'),
    -- Postgres-Details mit Datenwerten
    '(Failing row contains|DETAIL:|Key \([^)]*\)=)[^\n]*', '\1 …', 'g'),
    -- Vor- und Nachname (zwei großgeschriebene Wörter hintereinander)
    '\m[A-ZÄÖÜ][a-zäöüß]+[ -][A-ZÄÖÜ][a-zäöüß]+\M', '[name]', 'g'),
    '(für|bei|von) [A-ZÄÖÜ][^\s:,.]{1,40}', '\1 [name]', 'g'),
    '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', 'g'),
    '-----BEGIN[^-]*-----.*?-----END[^-]*-----', '[schlüssel]', 'g'),
    'eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}', '[token]', 'g'),
    '(sk-ant-|sk-|gh[pousr]_|github_pat_|sbp_|sb_secret_|xox[bpas]-|AIza|AKIA)[A-Za-z0-9_-]{6,}', '[schlüssel]', 'g'),
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[e-mail]', 'g'),
    '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', '[id]', 'g'),
    '\?[^\s"''<>)]*', '?…', 'g'),
    '\+?[0-9][0-9 /().-]{6,}[0-9]', '[zahl]', 'g'),
    '\m[A-Za-z0-9_-]{24,}\M', '[id]', 'g'), n)
$$;
revoke execute on function public.ws_fehler_bereinigen(text, int) from public, anon;
grant execute on function public.ws_fehler_bereinigen(text, int) to authenticated;

-- Seite ohne Kennungen: /kader/8f3…/spieler/12 → /kader/:id/spieler/:id
create or replace function public.ws_fehler_seite(t text) returns text
language sql immutable set search_path = public as $$
  select left(regexp_replace(regexp_replace(split_part(split_part(coalesce(t, ''), '?', 1), '#', 1),
    '/[^/]*[0-9][^/]*', '/:id', 'g'), '[^A-Za-z0-9/_:.-]', '', 'g'), 200)
$$;
revoke execute on function public.ws_fehler_seite(text) from public, anon;
grant execute on function public.ws_fehler_seite(text) to authenticated;

-- Annahme (auch ohne Anmeldung): Schlüssel prüfen, Grenze, bereinigen, zusammenfassen
create or replace function public.ws_fehler_melden(p_schluessel text, p_daten jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  k public.ws_fehler_schluessel; st timestamptz := date_trunc('hour', now()); z int;
  v_n text; v_s text; v_seite text; v_a text; v_v text; v_u text; v_g text; v_b text; v_fp text;
begin
  if p_schluessel is null or p_schluessel !~ '^csf_[0-9a-f]{32}$' or jsonb_typeof(p_daten) is distinct from 'object' then return; end if;
  if octet_length(p_daten::text) > 12000 then return; end if;
  select * into k from public.ws_fehler_schluessel where schluessel = p_schluessel and aktiv;
  if k.projekt_id is null then return; end if;   -- unbekannt: still verwerfen
  insert into public.ws_fehler_grenze (projekt_id, stunde, anzahl) values (k.projekt_id, st, 1)
    on conflict (projekt_id, stunde) do update set anzahl = ws_fehler_grenze.anzahl + 1 returning anzahl into z;
  if z > 300 then return; end if;
  v_n := public.ws_fehler_bereinigen(p_daten ->> 'nachricht', 500);
  if coalesce(trim(v_n), '') = '' then return; end if;
  v_s := nullif(public.ws_fehler_bereinigen(p_daten ->> 'stelle', 300), '');
  v_seite := nullif(public.ws_fehler_seite(p_daten ->> 'seite'), '');
  v_a := nullif(public.ws_fehler_bereinigen(p_daten ->> 'ablauf', 2000), '');
  v_v := nullif(left(regexp_replace(coalesce(p_daten ->> 'version', ''), '[^A-Za-z0-9._+ -]', '', 'g'), 40), '');
  v_u := case when p_daten ->> 'umgebung' = 'test' then 'test' else 'live' end;
  v_g := case when p_daten ->> 'geraet' in ('handy','tablet','pc') then p_daten ->> 'geraet' else 'unbekannt' end;
  v_b := nullif(left(regexp_replace(coalesce(p_daten ->> 'browser', ''), '[^A-Za-z0-9._ /-]', '', 'g'), 60), '');
  -- Gleicher Fehler = gleicher Text (Zahlen weg) an gleicher Stelle in gleicher Umgebung
  v_fp := md5(regexp_replace(lower(v_n), '[0-9]+', '#', 'g') || '|' || coalesce(regexp_replace(v_s, ':[0-9]+(:[0-9]+)?$', ''), '') || '|' || v_u);
  -- Neue Fehlerarten begrenzen (Prüfung M1): höchstens 30 neue je Stunde und 500 offene je App – bekannte werden weiter gezählt
  if not exists (select 1 from public.ws_fehler where projekt_id = k.projekt_id and fingerabdruck = v_fp) and (
       (select count(*) from public.ws_fehler where projekt_id = k.projekt_id and erstmals > now() - interval '1 hour') >= 30
    or (select count(*) from public.ws_fehler where projekt_id = k.projekt_id and stand = 'offen') >= 500) then return; end if;
  insert into public.ws_fehler (projekt_id, fingerabdruck, nachricht, stelle, seite, ablauf, version, umgebung, geraete, browser)
  values (k.projekt_id, v_fp, v_n, v_s, v_seite, v_a, v_v, v_u, jsonb_build_object(v_g, 1), v_b)
  on conflict (projekt_id, fingerabdruck) do update set
    -- Stelle, Seite und Ablauf bleiben die der ersten Meldung (Prüfung S2: nicht von außen überschreibbar)
    anzahl = ws_fehler.anzahl + 1, zuletzt = now(),
    version = coalesce(excluded.version, ws_fehler.version), browser = coalesce(excluded.browser, ws_fehler.browser),
    geraete = ws_fehler.geraete || jsonb_build_object(v_g, coalesce((ws_fehler.geraete ->> v_g)::int, 0) + 1),
    -- Erledigt und taucht wieder auf: wieder offen
    stand = case when ws_fehler.stand = 'erledigt' or (ws_fehler.stand = 'auftrag' and not exists (select 1 from public.ws_auftraege a
                   where a.id = ws_fehler.auftrag_id and a.stand not in ('erledigt','wissen','abgebrochen'))) then 'offen' else ws_fehler.stand end,
    neu = case when ws_fehler.stand = 'erledigt' or (ws_fehler.stand = 'auftrag' and not exists (select 1 from public.ws_auftraege a
                   where a.id = ws_fehler.auftrag_id and a.stand not in ('erledigt','wissen','abgebrochen'))) then true else ws_fehler.neu end;
  update public.ws_fehler_schluessel set letzte_meldung = now(), erste_meldung = coalesce(erste_meldung, now()) where projekt_id = k.projekt_id;
end $$;

-- Aufräumen (Prüfung S3): läuft in der Werkstatt des Admins alle 10 Minuten – 30 Tage nach der letzten Meldung weg
create or replace function public.ws_fehler_aufraeumen() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.ws_ist_admin() then return; end if;
  delete from public.ws_fehler where zuletzt < now() - interval '30 days';
  delete from public.ws_fehler_grenze where stunde < now() - interval '2 days';
end $$;
revoke execute on function public.ws_fehler_aufraeumen() from public, anon;
grant execute on function public.ws_fehler_aufraeumen() to authenticated;
revoke execute on function public.ws_fehler_melden(text, jsonb) from public;
grant execute on function public.ws_fehler_melden(text, jsonb) to anon, authenticated;

-- Admin: Melde-Schlüssel erzeugen bzw. erneuern (der alte gilt danach nicht mehr)
create or replace function public.ws_fehler_schluessel_erzeugen(p_projekt text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare s text := 'csf_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not public.ws_ist_admin() then raise exception 'Melde-Schlüssel erzeugt nur der Admin'; end if;
  if not exists (select 1 from public.ws_projekte where id = p_projekt and not coalesce(archiviert, false)) then raise exception 'Projekt nicht gefunden'; end if;
  s := 'csf_' || left(md5(s || clock_timestamp()::text), 32);
  insert into public.ws_fehler_schluessel (projekt_id, schluessel) values (p_projekt, s)
    on conflict (projekt_id) do update set schluessel = excluded.schluessel, aktiv = true, erstellt = now();
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'fehler_schluessel', jsonb_build_object('projekt', p_projekt));
  return s;
end $$;
create or replace function public.ws_fehler_schluessel_aus(p_projekt text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.ws_ist_admin() then raise exception 'Nur der Admin'; end if;
  update public.ws_fehler_schluessel set aktiv = false where projekt_id = p_projekt;
end $$;

-- Stand ändern: Admin und Entwickler im Projekt
create or replace function public.ws_fehler_stand(p_id bigint, p_stand text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.ws_fehler;
begin
  select * into f from public.ws_fehler where id = p_id;
  if f.id is null then raise exception 'Fehler nicht gefunden'; end if;
  if not (public.ws_ist_admin() or public.ws_rolle_im_projekt(f.projekt_id) = 'entwickler') then raise exception 'Nur Admin und Entwickler'; end if;
  if p_stand not in ('offen','erledigt','ignoriert') then raise exception 'Unbekannter Stand'; end if;
  update public.ws_fehler set stand = p_stand, neu = false where id = p_id;
end $$;

-- Als Auftrag: in einer Gruppe, in der man Aufträge geben darf
create or replace function public.ws_fehler_als_auftrag(p_id bigint, p_gruppe text) returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.ws_fehler; b text; n bigint;
begin
  select * into f from public.ws_fehler where id = p_id for update;
  if f.id is null then raise exception 'Fehler nicht gefunden'; end if;
  b := public.ws_bereich_von_gruppe(p_gruppe);
  if b is null or public.ws_projekt_von_bereich(b) <> f.projekt_id then raise exception 'Gruppe gehört nicht zu diesem Projekt'; end if;
  if not (public.ws_ist_admin() or (public.ws_rolle_im_projekt(f.projekt_id) = 'entwickler' and public.ws_darf(b, 'auftraege'))) then
    raise exception 'Aufträge geben hier der Admin und Entwickler mit Auftrags-Recht';
  end if;
  if f.auftrag_id is not null and exists (select 1 from public.ws_auftraege a where a.id = f.auftrag_id and a.stand not in ('abgebrochen','erledigt','wissen')) then
    raise exception 'Zu diesem Fehler gibt es schon den offenen Auftrag #%', f.auftrag_id;
  end if;
  -- Prüfung S1: Fehlertexte kommen von außen (öffentlicher Melde-Schlüssel) – sie stehen NICHT im Titel und nicht in einer Nachricht des Teams.
  -- Die Werkstatt holt sie selbst und setzt sie als abgegrenzten, nicht vertrauenswürdigen Datenblock in den Auftrag.
  insert into public.ws_auftraege (gruppe_id, titel, art, erstellt_von) values (p_gruppe, format('Fehler beheben (Fehler #%s aus der App)', f.id), 'aendern', auth.uid()) returning id into n;
  insert into public.ws_nachrichten (auftrag_id, von, art, text, daten) values (n, auth.uid(), 'text',
    format('Bitte den Fehler #%s aus der App (%s, %s×) finden und beheben, mit Test. Die Fehlermeldung selbst bekommst du als Datenblock.', f.id, f.umgebung, f.anzahl),
    jsonb_build_object('fehler', f.id));
  update public.ws_fehler set stand = 'auftrag', auftrag_id = n, neu = false where id = p_id;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'fehler_auftrag', jsonb_build_object('fehler', p_id, 'auftrag', n));
  return n;
end $$;

revoke execute on function public.ws_fehler_schluessel_erzeugen(text), public.ws_fehler_schluessel_aus(text), public.ws_fehler_stand(bigint, text),
  public.ws_fehler_als_auftrag(bigint, text) from public, anon;
grant execute on function public.ws_fehler_schluessel_erzeugen(text), public.ws_fehler_schluessel_aus(text), public.ws_fehler_stand(bigint, text),
  public.ws_fehler_als_auftrag(bigint, text) to authenticated;

commit;
