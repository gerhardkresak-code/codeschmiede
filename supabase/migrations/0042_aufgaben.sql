-- Codeschmiede · Datenbank 0042: Aufgaben (Entwurf freigegeben von Gerhard 2026-10-25 13:50).
-- Eigener Menüpunkt „Aufgaben“: Aufgaben gehören zu einem Projekt, alle Mitglieder des Projekts sehen sie; anlegen und bearbeiten
-- Admin, Entwickler und Texter des Projekts (Leser nur lesen – Rechte werden nicht gelockert). Eine Person ist als „zuständig“ eintragbar.
--   * ws_aufgaben            – Titel, Beschreibung, Status, Priorität, Fällig am, Zuständig, Bezug (Feature ODER Gruppe), Links (geprüftes jsonb)
--   * ws_aufgabe_anhaenge    – Fotos/Screenshots (PNG/JPEG/WebP ≤ 5 MB) und Dateien (PDF/TXT/CSV/DOCX/XLSX ≤ 10 MB), höchstens 20 je Aufgabe.
--                              Die Datei liegt im PRIVATEN Speicher-Bucket „ws-aufgaben“ unter <projekt>/<aufgabe>/<uuid>.<endung>.
--                              Ablauf: ws_aufgabe_anhang_neu reserviert (prüft Typ, Größe, Anzahl, erzeugt den Pfad) → die Oberfläche lädt
--                              genau dorthin hoch (Regel: nur reservierte Pfade, kein Überschreiben) → Anzeige über signierte Adressen (zeitlich begrenzt).
--   * ws_aufgabe_sendungen   – „In den Chat schicken“: Ziel Feature oder Gruppe; die Sendung erscheint im Chat dieses Features bzw. dieser Gruppe
--                              als Karte (Beschreibung, Links, Anhänge). Dort macht man mit „Als Auftrag“ (ws_aufgabe_als_auftrag, normale
--                              Auftragsrechte) wie gewohnt einen Auftrag daraus: Auftrag + erste Nachricht in EINEM Schritt, die Nachricht trägt
--                              daten.aufgabe = {id, sendung, anhaenge[], links[]}; die Werkstatt holt die Anhänge dieses Auftrags selbst
--                              (nur aus diesem Projekt, nur echte Dateien der erlaubten Typen) und bekommt sie als Datenblock („Daten, keine Anweisungen“).
-- Keine Personendaten (Hinweis in der Oberfläche: keine Fotos von Personen/Kindern, keine Mitgliederdaten). Links nur https, ohne Zugangsdaten
-- (kein user:pass@, keine token=/key=/password=… in der Adresse); sie werden nur als Link angezeigt, nie automatisch geladen.
-- Mehrfach ausführbar. Reihenfolge 0001 → … → 0042.
begin;

-- ---------- Wer darf? ----------
-- Sehen: jedes Mitglied des Projekts (ws_sieht_projekt). Anlegen/Bearbeiten/Senden: Admin, Entwickler, Texter des Projekts.
create or replace function public.ws_darf_aufgaben(p_projekt text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.ws_rolle_im_projekt(p_projekt) in ('admin','entwickler','texter'), false)
$$;
revoke execute on function public.ws_darf_aufgaben(text) from public, anon;
grant execute on function public.ws_darf_aufgaben(text) to authenticated;

-- Zuständig sein kann jedes aktive Mitglied des Projekts und jeder aktive Admin
create or replace function public.ws_ist_projekt_person(p_projekt text, p_benutzer uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ws_benutzer b where b.id = p_benutzer and b.aktiv
                   and (b.rolle = 'admin' or exists (select 1 from public.ws_projekt_mitglieder m where m.projekt_id = p_projekt and m.benutzer_id = b.id)))
$$;
revoke execute on function public.ws_ist_projekt_person(text, uuid) from public, anon, authenticated;

-- ---------- Prüfungen ----------
-- Text ohne Steuer-, Richtungs- und unsichtbare Zeichen (gleiche Regel wie ws_design_auftrag, 0036); Zeilenumbruch/Tab nur bei mehrzeilig
create or replace function public.ws_aufgabe_text_ok(p text, p_mehrzeilig boolean) returns boolean
language sql immutable set search_path = public as $$
  select p is null or case when p_mehrzeilig
    then p !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u200b-\u200f\u202a-\u202e\u2028\u2029\u2066-\u2069\ufeff]'
    else p !~ '[[:cntrl:]\u200b-\u200f\u202a-\u202e\u2028\u2029\u2066-\u2069\ufeff]' end
$$;
revoke execute on function public.ws_aufgabe_text_ok(text, boolean) from public, anon;
grant execute on function public.ws_aufgabe_text_ok(text, boolean) to authenticated;

-- Ein Link: nur https, Rechnername ohne Zugangsdaten (kein „user:pass@“), keine Leer-/Anführungs-/Spitzklammer-Zeichen,
-- keine Zugangsschlüssel in der Adresse (token=, key=, password= …). Gleiche Regel in web/src/Aufgaben.jsx und in der Werkstatt.
create or replace function public.ws_aufgabe_link_ok(p_url text) returns boolean
language sql immutable set search_path = public as $$
  select p_url is not null and char_length(p_url) between 12 and 2000
    and p_url ~ '^https://[A-Za-z0-9]([A-Za-z0-9-]{0,62}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,62}[A-Za-z0-9])?)+(:[0-9]{1,5})?([/?#][!#$%&()*+,./0-9:;=?@A-Z\[\]_a-z~-]*)?$'
    and p_url !~* '[?&#;](access_token|id_token|refresh_token|token|api_?key|key|secret|client_secret|password|passwort|pass|pwd|sig|signature|auth|code|session|sid|jwt)='
$$;
revoke execute on function public.ws_aufgabe_link_ok(text) from public, anon;
grant execute on function public.ws_aufgabe_link_ok(text) to authenticated;

-- Links einer Aufgabe: Liste mit höchstens 20 Einträgen {titel, url}, sonst nichts
create or replace function public.ws_aufgabe_links_ok(p jsonb) returns boolean
language sql immutable set search_path = public as $$
  select p is not null and jsonb_typeof(p) = 'array' and jsonb_array_length(p) <= 20 and pg_column_size(p) <= 50000
    and not exists (select 1 from jsonb_array_elements(p) e where
          jsonb_typeof(e) <> 'object'
       or exists (select 1 from jsonb_object_keys(e) k where k not in ('titel','url'))
       or jsonb_typeof(e -> 'titel') is distinct from 'string' or jsonb_typeof(e -> 'url') is distinct from 'string'
       or char_length(btrim(e ->> 'titel')) not between 1 and 120
       or not public.ws_aufgabe_text_ok(e ->> 'titel', false)
       or not public.ws_aufgabe_link_ok(e ->> 'url'))
$$;
revoke execute on function public.ws_aufgabe_links_ok(jsonb) from public, anon;
grant execute on function public.ws_aufgabe_links_ok(jsonb) to authenticated;

-- ---------- Tabellen ----------
create table if not exists public.ws_aufgaben (
  id bigserial primary key,
  projekt_id text not null references public.ws_projekte(id) on delete cascade,
  titel text not null check (char_length(btrim(titel)) between 2 and 120 and public.ws_aufgabe_text_ok(titel, false)),
  beschreibung text not null default '' check (char_length(beschreibung) <= 8000 and public.ws_aufgabe_text_ok(beschreibung, true)),
  status text not null default 'offen' check (status in ('offen','arbeit','erledigt')),
  prioritaet text not null default 'mittel' check (prioritaet in ('hoch','mittel','niedrig')),
  faellig date check (faellig is null or faellig between date '2020-01-01' and date '2100-12-31'),
  zustaendig uuid references public.ws_benutzer(id) on delete set null,
  feature_id text references public.ws_features(id) on delete set null,
  gruppe_id text references public.ws_gruppen(id) on delete set null,
  links jsonb not null default '[]'::jsonb check (public.ws_aufgabe_links_ok(links)),
  erstellt_von uuid references auth.users(id) on delete set null,
  erstellt timestamptz not null default now(),
  geaendert_von uuid references auth.users(id) on delete set null,
  geaendert timestamptz not null default now(),
  erledigt_am timestamptz,
  constraint ws_aufgaben_ein_bezug check (feature_id is null or gruppe_id is null)
);
create index if not exists ws_aufgaben_projekt on public.ws_aufgaben (projekt_id, status, id);
create index if not exists ws_aufgaben_zustaendig on public.ws_aufgaben (zustaendig) where status <> 'erledigt';

create table if not exists public.ws_aufgabe_anhaenge (
  id bigserial primary key,
  aufgabe_id bigint not null references public.ws_aufgaben(id) on delete cascade,
  projekt_id text not null references public.ws_projekte(id) on delete cascade,
  art text not null check (art in ('bild','datei')),
  dateiname text not null check (char_length(dateiname) between 1 and 120 and dateiname ~ '^[A-Za-z0-9ÄÖÜäöüß ()._-]+$' and dateiname !~ '^\.'),
  mime text not null check (mime in ('image/png','image/jpeg','image/webp','application/pdf','text/plain','text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
  groesse bigint not null check (groesse between 1 and 10485760),
  pfad text not null unique check (pfad ~ '^[a-z0-9][a-z0-9-]{1,39}/[1-9][0-9]{0,17}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|pdf|txt|csv|docx|xlsx)$'),
  von uuid references auth.users(id) on delete set null,
  erstellt timestamptz not null default now(),
  constraint ws_aufgabe_anhaenge_art_mime check ((art = 'bild') = (mime like 'image/%')),
  constraint ws_aufgabe_anhaenge_bild_groesse check (art <> 'bild' or groesse <= 5242880)
);
create index if not exists ws_aufgabe_anhaenge_aufgabe on public.ws_aufgabe_anhaenge (aufgabe_id, id);

create table if not exists public.ws_aufgabe_sendungen (
  id bigserial primary key,
  aufgabe_id bigint not null references public.ws_aufgaben(id) on delete cascade,
  projekt_id text not null references public.ws_projekte(id) on delete cascade,
  gruppe_id text not null references public.ws_gruppen(id) on delete cascade,   -- Chat der Gruppe (bei Feature: dessen Gruppe beim Senden)
  feature_id text references public.ws_features(id) on delete cascade,          -- gesetzt = Chat des Features
  titel text not null check (char_length(titel) between 2 and 120),
  text text not null check (char_length(text) between 1 and 9000),
  links jsonb not null default '[]'::jsonb check (public.ws_aufgabe_links_ok(links)),
  anhaenge jsonb not null default '[]'::jsonb check (jsonb_typeof(anhaenge) = 'array' and jsonb_array_length(anhaenge) <= 20),
  von uuid references auth.users(id) on delete set null,
  erstellt timestamptz not null default now(),
  auftrag_id bigint references public.ws_auftraege(id) on delete set null,
  als_auftrag_von uuid references auth.users(id) on delete set null,
  als_auftrag_am timestamptz,
  zurueckgezogen timestamptz
);
create index if not exists ws_aufgabe_sendungen_aufgabe on public.ws_aufgabe_sendungen (aufgabe_id, id);
create index if not exists ws_aufgabe_sendungen_offen on public.ws_aufgabe_sendungen (projekt_id, gruppe_id) where auftrag_id is null and zurueckgezogen is null;

-- ---------- Schutz beim Anlegen und Ändern einer Aufgabe ----------
create or replace function public.ws_aufgaben_pruefen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- (Funktion läuft als Eigentümer – Herkunft daher über auth.uid(), nicht current_user)
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.erstellt_von := auth.uid(); new.erstellt := now(); new.erledigt_am := null;
      if (select count(*) from public.ws_aufgaben where erstellt_von = auth.uid() and erstellt > now() - interval '1 day') >= 200 then
        raise exception 'Tagesgrenze erreicht (200 neue Aufgaben)'; end if;
      if (select count(*) from public.ws_aufgaben where projekt_id = new.projekt_id) >= 5000 then
        raise exception 'Dieses Projekt hat schon 5000 Aufgaben – bitte erledigte aufräumen'; end if;
    end if;
  else
    if (new.projekt_id, new.erstellt_von, new.erstellt) is distinct from (old.projekt_id, old.erstellt_von, old.erstellt) then
      raise exception 'Projekt und Herkunft einer Aufgabe sind nicht änderbar'; end if;
  end if;
  new.titel := btrim(new.titel);
  if auth.uid() is not null then new.geaendert_von := auth.uid(); end if;
  new.geaendert := now();
  if new.status = 'erledigt' and (tg_op = 'INSERT' or old.status <> 'erledigt') then new.erledigt_am := now();
  elsif new.status <> 'erledigt' then new.erledigt_am := null; end if;
  if new.zustaendig is not null and (tg_op = 'INSERT' or new.zustaendig is distinct from old.zustaendig)
     and not public.ws_ist_projekt_person(new.projekt_id, new.zustaendig) then
    raise exception 'Zuständig kann nur ein Mitglied dieses Projekts sein'; end if;
  if new.feature_id is not null and (tg_op = 'INSERT' or new.feature_id is distinct from old.feature_id)
     and public.ws_projekt_von_feature(new.feature_id) is distinct from new.projekt_id then
    raise exception 'Das Feature gehört zu einem anderen Projekt'; end if;
  if new.gruppe_id is not null and (tg_op = 'INSERT' or new.gruppe_id is distinct from old.gruppe_id)
     and (public.ws_projekt_von_gruppe(new.gruppe_id) is distinct from new.projekt_id or public.ws_ist_konzept_gruppe(new.gruppe_id)) then
    raise exception 'Die Gruppe gehört nicht zu diesem Projekt (oder ist das Konzept)'; end if;
  return new;
end $$;
revoke execute on function public.ws_aufgaben_pruefen() from public, anon, authenticated;
drop trigger if exists ws_aufgaben_pruefen on public.ws_aufgaben;
create trigger ws_aufgaben_pruefen before insert or update on public.ws_aufgaben for each row execute function public.ws_aufgaben_pruefen();

-- ---------- RLS und Rechte ----------
alter table public.ws_aufgaben enable row level security;
alter table public.ws_aufgabe_anhaenge enable row level security;
alter table public.ws_aufgabe_sendungen enable row level security;

drop policy if exists ws_aufgaben_lesen on public.ws_aufgaben;
create policy ws_aufgaben_lesen on public.ws_aufgaben for select to authenticated using (public.ws_sieht_projekt(projekt_id));
drop policy if exists ws_aufgaben_neu on public.ws_aufgaben;
create policy ws_aufgaben_neu on public.ws_aufgaben for insert to authenticated with check (public.ws_darf_aufgaben(projekt_id));
drop policy if exists ws_aufgaben_aendern on public.ws_aufgaben;
create policy ws_aufgaben_aendern on public.ws_aufgaben for update to authenticated
  using (public.ws_darf_aufgaben(projekt_id)) with check (public.ws_darf_aufgaben(projekt_id));

drop policy if exists ws_aufgabe_anhaenge_lesen on public.ws_aufgabe_anhaenge;
create policy ws_aufgabe_anhaenge_lesen on public.ws_aufgabe_anhaenge for select to authenticated using (public.ws_sieht_projekt(projekt_id));
drop policy if exists ws_aufgabe_sendungen_lesen on public.ws_aufgabe_sendungen;
create policy ws_aufgabe_sendungen_lesen on public.ws_aufgabe_sendungen for select to authenticated using (public.ws_sieht_projekt(projekt_id));

revoke all on public.ws_aufgaben, public.ws_aufgabe_anhaenge, public.ws_aufgabe_sendungen from anon, authenticated;
grant select on public.ws_aufgaben, public.ws_aufgabe_anhaenge, public.ws_aufgabe_sendungen to authenticated;
grant insert (projekt_id, titel, beschreibung, status, prioritaet, faellig, zustaendig, feature_id, gruppe_id, links) on public.ws_aufgaben to authenticated;
grant update (titel, beschreibung, status, prioritaet, faellig, zustaendig, feature_id, gruppe_id, links) on public.ws_aufgaben to authenticated;
grant usage on sequence public.ws_aufgaben_id_seq to authenticated;
-- Anhänge und Sendungen nur über die Funktionen unten; Löschen einer Aufgabe nur über ws_aufgabe_loeschen

-- ---------- Anhänge ----------
-- Reservieren: prüft Recht, Typ (Endung passt zum Typ), Größe (Bild ≤ 5 MB, Datei ≤ 10 MB), Anzahl (≤ 20 je Aufgabe, ≤ 100 am Tag je Person)
-- und erzeugt den Speicherpfad. Die Datei lädt die Oberfläche danach genau an diesen Pfad hoch (siehe Speicher-Regeln unten).
create or replace function public.ws_aufgabe_anhang_neu(p_aufgabe bigint, p_dateiname text, p_mime text, p_groesse bigint)
returns table (id bigint, pfad text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare a public.ws_aufgaben; e text; n text; r public.ws_aufgabe_anhaenge;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into a from public.ws_aufgaben x where x.id = p_aufgabe for update;
  if a.id is null or not public.ws_sieht_projekt(a.projekt_id) then raise exception 'Aufgabe nicht gefunden'; end if;
  if not public.ws_darf_aufgaben(a.projekt_id) then raise exception 'Keine Berechtigung für Aufgaben in diesem Projekt'; end if;
  e := case p_mime when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' when 'application/pdf' then 'pdf'
         when 'text/plain' then 'txt' when 'text/csv' then 'csv'
         when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then 'docx'
         when 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' then 'xlsx' end;
  if e is null then raise exception 'Erlaubt sind Bilder (PNG, JPG, WebP) und Dateien (PDF, TXT, CSV, DOCX, XLSX)'; end if;
  if p_groesse is null or p_groesse < 1 then raise exception 'Die Datei ist leer'; end if;
  if p_mime like 'image/%' and p_groesse > 5242880 then raise exception 'Bilder höchstens 5 MB'; end if;
  if p_groesse > 10485760 then raise exception 'Dateien höchstens 10 MB'; end if;
  -- Dateiname nur zur Anzeige: harmlose Zeichen, Endung passend zum Typ
  n := btrim(regexp_replace(regexp_replace(coalesce(p_dateiname, ''), '\.[A-Za-z0-9]{1,8}$', ''), '[^A-Za-z0-9ÄÖÜäöüß ()._-]', '_', 'g'), ' ._-');
  n := left(coalesce(nullif(n, ''), 'anhang'), 110) || '.' || e;
  if (select count(*) from public.ws_aufgabe_anhaenge x where x.aufgabe_id = a.id) >= 20 then raise exception 'Höchstens 20 Anhänge je Aufgabe'; end if;
  if (select count(*) from public.ws_aufgabe_anhaenge x where x.von = auth.uid() and x.erstellt > now() - interval '1 day') >= 100 then
    raise exception 'Heute schon 100 Anhänge hochgeladen – morgen wieder'; end if;
  insert into public.ws_aufgabe_anhaenge (aufgabe_id, projekt_id, art, dateiname, mime, groesse, pfad, von)
    values (a.id, a.projekt_id, case when p_mime like 'image/%' then 'bild' else 'datei' end, n, p_mime, p_groesse,
            a.projekt_id || '/' || a.id || '/' || gen_random_uuid() || '.' || e, auth.uid())
    returning * into r;
  update public.ws_aufgaben set geaendert = now() where ws_aufgaben.id = a.id;
  id := r.id; pfad := r.pfad; return next;
end $$;

-- Anhang entfernen: gibt den Pfad zurück; die Oberfläche löscht danach die Datei im Speicher (erlaubt nur für Pfade ohne Eintrag)
create or replace function public.ws_aufgabe_anhang_loeschen(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare r public.ws_aufgabe_anhaenge;
begin
  select * into r from public.ws_aufgabe_anhaenge where id = p_id for update;
  if r.id is null or not public.ws_sieht_projekt(r.projekt_id) then raise exception 'Anhang nicht gefunden'; end if;
  if not public.ws_darf_aufgaben(r.projekt_id) then raise exception 'Keine Berechtigung für Aufgaben in diesem Projekt'; end if;
  delete from public.ws_aufgabe_anhaenge where id = p_id;
  update public.ws_aufgaben set geaendert = now() where id = r.aufgabe_id;
  return r.pfad;
end $$;

-- Aufgabe löschen: nur wer sie angelegt hat (mit Bearbeitungsrecht) oder der Admin; gibt die Speicherpfade der Anhänge zurück
create or replace function public.ws_aufgabe_loeschen(p_aufgabe bigint) returns setof text
language plpgsql security definer set search_path = public as $$
declare a public.ws_aufgaben;
begin
  select * into a from public.ws_aufgaben where id = p_aufgabe for update;
  if a.id is null or not public.ws_sieht_projekt(a.projekt_id) then raise exception 'Aufgabe nicht gefunden'; end if;
  if not (public.ws_ist_admin() or (a.erstellt_von = auth.uid() and public.ws_darf_aufgaben(a.projekt_id))) then
    raise exception 'Löschen darf, wer die Aufgabe angelegt hat, oder der Admin'; end if;
  return query select x.pfad from public.ws_aufgabe_anhaenge x where x.aufgabe_id = a.id;
  delete from public.ws_aufgaben where id = a.id;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'aufgabe_loeschen', jsonb_build_object('projekt', a.projekt_id, 'aufgabe', a.id));
end $$;

-- ---------- In den Chat schicken ----------
-- Ziel: genau ein Feature ODER eine Gruppe DIESES Projekts (nicht das Konzept, kein ausgebautes Feature). Legt eine Sendung mit dem
-- Stand der Aufgabe an (Titel, Text, Links, Anhänge); die Aufgabe merkt sich so, wohin sie ging. Ein Auftrag entsteht erst mit „Als Auftrag“.
create or replace function public.ws_aufgabe_senden(p_aufgabe bigint, p_feature text default null, p_gruppe text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.ws_aufgaben; g text; s bigint; t text; prio text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if (p_feature is null) = (p_gruppe is null) then raise exception 'Bitte genau ein Ziel wählen: Feature oder Gruppe'; end if;
  select * into a from public.ws_aufgaben where id = p_aufgabe for update;
  if a.id is null or not public.ws_sieht_projekt(a.projekt_id) then raise exception 'Aufgabe nicht gefunden'; end if;
  if not public.ws_darf_aufgaben(a.projekt_id) then raise exception 'Keine Berechtigung für Aufgaben in diesem Projekt'; end if;
  if p_feature is not null then
    select f.gruppe_id into g from public.ws_features f where f.id = p_feature and not f.ausgebaut;
    if g is null or public.ws_projekt_von_gruppe(g) is distinct from a.projekt_id then raise exception 'Das Feature gehört nicht zu diesem Projekt'; end if;
  else
    g := p_gruppe;
    if public.ws_projekt_von_gruppe(g) is distinct from a.projekt_id then raise exception 'Die Gruppe gehört nicht zu diesem Projekt'; end if;
  end if;
  if public.ws_ist_konzept_gruppe(g) then raise exception 'In die Gruppe „Konzept“ gehen keine Aufgaben – bitte eine andere Gruppe wählen'; end if;
  if char_length(btrim(a.beschreibung)) < 10 then raise exception 'Bitte zuerst beschreiben, was geändert werden soll (mindestens 10 Zeichen)'; end if;
  if (select count(*) from public.ws_aufgabe_sendungen x where x.von = auth.uid() and x.erstellt > now() - interval '1 day') >= 100 then
    raise exception 'Heute schon 100 Aufgaben in Chats geschickt – morgen wieder'; end if;
  prio := case a.prioritaet when 'hoch' then 'Hoch' when 'niedrig' then 'Niedrig' else 'Mittel' end;
  t := format('Priorität: %s%s', prio, case when a.faellig is null then '' else ' · fällig am ' || to_char(a.faellig, 'DD.MM.YYYY') end)
       || E'\n\n' || btrim(a.beschreibung);
  insert into public.ws_aufgabe_sendungen (aufgabe_id, projekt_id, gruppe_id, feature_id, titel, text, links, anhaenge, von)
    values (a.id, a.projekt_id, g, p_feature, a.titel, t, a.links,
            coalesce((select jsonb_agg(x.id order by x.id) from public.ws_aufgabe_anhaenge x where x.aufgabe_id = a.id), '[]'::jsonb), auth.uid())
    returning id into s;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'aufgabe_senden',
    jsonb_build_object('projekt', a.projekt_id, 'aufgabe', a.id, 'sendung', s, 'gruppe', g, 'feature', p_feature));
  return s;
end $$;

-- Sendung zurückziehen (falsches Ziel): verschwindet aus dem Chat, bleibt in der Liste der Aufgabe als „zurückgezogen“
create or replace function public.ws_aufgabe_sendung_zurueckziehen(p_sendung bigint) returns void
language plpgsql security definer set search_path = public as $$
declare s public.ws_aufgabe_sendungen;
begin
  select * into s from public.ws_aufgabe_sendungen where id = p_sendung for update;
  if s.id is null or not public.ws_sieht_projekt(s.projekt_id) then raise exception 'Sendung nicht gefunden'; end if;
  if not public.ws_darf_aufgaben(s.projekt_id) then raise exception 'Keine Berechtigung für Aufgaben in diesem Projekt'; end if;
  if s.auftrag_id is not null then raise exception 'Daraus ist schon Auftrag #% geworden', s.auftrag_id; end if;
  update public.ws_aufgabe_sendungen set zurueckgezogen = coalesce(zurueckgezogen, now()) where id = s.id;
end $$;

-- „Als Auftrag“ im Chat: normale Auftragsrechte im Bereich der Gruppe (Texter → Art „text“). Auftrag + erste Nachricht in EINEM Schritt
-- (wie 0036), die Nachricht trägt daten.aufgabe für Anzeige und Werkstatt. Eine Sendung wird höchstens einmal zum Auftrag.
create or replace function public.ws_aufgabe_als_auftrag(p_sendung bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare s public.ws_aufgabe_sendungen; g text; f text; n bigint; ids jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into s from public.ws_aufgabe_sendungen where id = p_sendung for update;
  if s.id is null or not public.ws_sieht_projekt(s.projekt_id) then raise exception 'Sendung nicht gefunden'; end if;
  if s.auftrag_id is not null then raise exception 'Daraus ist schon Auftrag #% geworden', s.auftrag_id; end if;
  if s.zurueckgezogen is not null then raise exception 'Diese Sendung wurde zurückgezogen'; end if;
  g := s.gruppe_id; f := s.feature_id;
  if f is not null then   -- Feature inzwischen verschoben: Auftrag geht an seine jetzige Gruppe (Verlauf bleibt beim Feature)
    select x.gruppe_id into g from public.ws_features x where x.id = f and not x.ausgebaut;
    if g is null then raise exception 'Das Feature gibt es nicht mehr'; end if;
  end if;
  if public.ws_projekt_von_gruppe(g) is distinct from s.projekt_id then raise exception 'Ziel gehört nicht mehr zu diesem Projekt'; end if;
  if not public.ws_darf(public.ws_bereich_von_gruppe(g), 'auftraege') then raise exception 'Für diesen Bereich hast du kein Recht, Aufträge zu geben'; end if;
  -- nur Anhänge, die es noch gibt
  select coalesce(jsonb_agg(x.id order by x.id), '[]'::jsonb) into ids from public.ws_aufgabe_anhaenge x
    where x.aufgabe_id = s.aufgabe_id and x.projekt_id = s.projekt_id and to_jsonb(x.id) <@ s.anhaenge;
  insert into public.ws_auftraege (gruppe_id, feature_id, titel, art, erstellt_von)
    values (g, f, left('Aufgabe: ' || s.titel, 80), case when public.ws_rolle_fuer_gruppe(g) = 'texter' then 'text' else 'aendern' end, auth.uid())
    returning id into n;
  insert into public.ws_nachrichten (auftrag_id, von, art, text, kanal, daten)
    values (n, auth.uid(), 'text', left('**Aufgabe: ' || s.titel || E'**\n' || s.text, 8000), case when f is null then 'gruppe' else 'codeschmiede' end,
            jsonb_build_object('aufgabe', jsonb_build_object('id', s.aufgabe_id, 'sendung', s.id, 'anhaenge', ids, 'links', s.links)));
  update public.ws_aufgabe_sendungen set auftrag_id = n, als_auftrag_von = auth.uid(), als_auftrag_am = now() where id = s.id;
  update public.ws_aufgaben set status = case when status = 'offen' then 'arbeit' else status end where id = s.aufgabe_id;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'aufgabe_auftrag', jsonb_build_object('sendung', s.id, 'aufgabe', s.aufgabe_id, 'auftrag', n));
  return n;
end $$;

revoke execute on function public.ws_aufgabe_anhang_neu(bigint, text, text, bigint), public.ws_aufgabe_anhang_loeschen(bigint),
  public.ws_aufgabe_loeschen(bigint), public.ws_aufgabe_senden(bigint, text, text), public.ws_aufgabe_sendung_zurueckziehen(bigint),
  public.ws_aufgabe_als_auftrag(bigint) from public, anon;
grant execute on function public.ws_aufgabe_anhang_neu(bigint, text, text, bigint), public.ws_aufgabe_anhang_loeschen(bigint),
  public.ws_aufgabe_loeschen(bigint), public.ws_aufgabe_senden(bigint, text, text), public.ws_aufgabe_sendung_zurueckziehen(bigint),
  public.ws_aufgabe_als_auftrag(bigint) to authenticated;

-- ---------- Privater Speicher „ws-aufgaben“ ----------
-- Nicht öffentlich; Größe ≤ 10 MB und nur die erlaubten Typen (prüft der Speicher selbst). Regeln nach Projekt:
--   lesen      – Mitglieder des Projekts, nur Dateien mit Eintrag in ws_aufgabe_anhaenge (signierte Adressen erst beim Anzeigen)
--   hochladen  – nur an einen reservierten Pfad, mit Bearbeitungsrecht; kein Überschreiben (keine update-Regel)
--   löschen    – mit Bearbeitungsrecht, nur Dateien OHNE Eintrag (erst ws_aufgabe_anhang_loeschen, dann die Datei)
create or replace function public.ws_aufgabe_datei_lesbar(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ws_aufgabe_anhaenge x where x.pfad = p_name and public.ws_sieht_projekt(x.projekt_id))
$$;
create or replace function public.ws_aufgabe_datei_hochladbar(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ws_aufgabe_anhaenge x where x.pfad = p_name and x.von = auth.uid()
                   and x.erstellt > now() - interval '1 hour' and public.ws_darf_aufgaben(x.projekt_id))
$$;
create or replace function public.ws_aufgabe_datei_loeschbar(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_name ~ '^[a-z0-9][a-z0-9-]{1,39}/[1-9][0-9]{0,17}/[0-9a-f-]{36}\.[a-z]{3,4}$'
     and public.ws_darf_aufgaben(split_part(p_name, '/', 1))
     and not exists (select 1 from public.ws_aufgabe_anhaenge x where x.pfad = p_name)
$$;
revoke execute on function public.ws_aufgabe_datei_lesbar(text), public.ws_aufgabe_datei_hochladbar(text), public.ws_aufgabe_datei_loeschbar(text) from public, anon;
grant execute on function public.ws_aufgabe_datei_lesbar(text), public.ws_aufgabe_datei_hochladbar(text), public.ws_aufgabe_datei_loeschbar(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ws-aufgaben', 'ws-aufgaben', false, 10485760, array['image/png','image/jpeg','image/webp','application/pdf','text/plain','text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ws_aufgaben_dateien_lesen on storage.objects;
create policy ws_aufgaben_dateien_lesen on storage.objects for select to authenticated
  using (bucket_id = 'ws-aufgaben' and public.ws_aufgabe_datei_lesbar(name));
drop policy if exists ws_aufgaben_dateien_hochladen on storage.objects;
create policy ws_aufgaben_dateien_hochladen on storage.objects for insert to authenticated
  with check (bucket_id = 'ws-aufgaben' and public.ws_aufgabe_datei_hochladbar(name));
drop policy if exists ws_aufgaben_dateien_loeschen on storage.objects;
create policy ws_aufgaben_dateien_loeschen on storage.objects for delete to authenticated
  using (bucket_id = 'ws-aufgaben' and public.ws_aufgabe_datei_loeschbar(name));

-- ---------- Live-Abgleich ----------
do $$ declare t text; begin
  foreach t in array array['ws_aufgaben','ws_aufgabe_anhaenge','ws_aufgabe_sendungen'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t); exception when duplicate_object then null; end;
  end loop;
end $$;

commit;

select count(*) as aufgaben from public.ws_aufgaben;
