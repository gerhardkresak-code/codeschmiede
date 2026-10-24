-- Codeschmiede · Datenbank v31: Code ansehen und von Hand ändern (Entwurf „Code-Editor“ 1.0, freigegeben von Gerhard 2026-10-24 14:57)
-- Ansehen: Mitglieder des Projekts fragen Dateibaum/Datei an, eine Werkstatt liest sie nur (git ls-tree / cat-file) und legt sie
-- kurz hier ab (wird nach einer Stunde gelöscht). Geheime Dateien (.env, Schlüssel) liefert die Werkstatt nie aus.
-- Ändern: Admin und Entwickler mit Auftrags-Recht im Bereich speichern als Auftrag („Hand-Änderung“) – eigener Zweig,
-- Pull Request, Prüfungen und Freigabe wie jeder Auftrag. Nie direkt in main. Mehrfach ausführbar. Reihenfolge 0001 → … → 0031.
begin;

-- ---------- Ansehen ----------
create table if not exists public.ws_code_anfragen (
  id bigint generated always as identity primary key,
  projekt_id text not null references public.ws_projekte(id) on delete cascade,
  zweig text not null check (zweig ~ '^[A-Za-z0-9._/-]{1,100}$' and zweig !~ '\.\.' and zweig !~ '^[/.-]'),
  art text not null check (art in ('baum','datei')),
  pfad text check (pfad is null or (char_length(pfad) <= 400 and pfad !~ '(^|/)\.\.(/|$)' and pfad !~ '^/' and pfad !~ '[\x00-\x1f\\]')),
  von uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ziel_pc uuid references public.ws_werkstatt_pcs(id) on delete cascade,   -- null = Werkstatt des Admins
  stand text not null default 'angefragt' check (stand in ('angefragt','laeuft','fertig','fehler')),
  pc uuid references public.ws_werkstatt_pcs(id) on delete set null,
  stand_sha text check (stand_sha is null or stand_sha ~ '^[0-9a-f]{40}$'),
  baum jsonb check (baum is null or (jsonb_typeof(baum) = 'array' and jsonb_array_length(baum) <= 20000)),
  inhalt text check (inhalt is null or octet_length(inhalt) <= 524288),
  blob_sha text check (blob_sha is null or blob_sha ~ '^[0-9a-f]{40}$'),
  hinweis text check (char_length(hinweis) <= 300),
  nur_lesen boolean not null default false,
  erstellt timestamptz not null default now(),
  geaendert timestamptz not null default now(),
  check (art = 'baum' or pfad is not null)
);
create index if not exists ws_code_anfragen_offen on public.ws_code_anfragen (stand, erstellt) where stand in ('angefragt','laeuft');
alter table public.ws_code_anfragen enable row level security;
revoke all on public.ws_code_anfragen from anon, authenticated;
grant select on public.ws_code_anfragen to authenticated;
drop policy if exists ws_code_anfragen_lesen on public.ws_code_anfragen;
create policy ws_code_anfragen_lesen on public.ws_code_anfragen for select to authenticated
  using (von = auth.uid() and public.ws_sieht_projekt(projekt_id));
do $$ begin alter publication supabase_realtime add table public.ws_code_anfragen; exception when others then null; end $$;

create or replace function public.ws_code_anfragen(p_projekt text, p_zweig text, p_art text, p_pfad text default null, p_pc uuid default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  if not public.ws_sieht_projekt(p_projekt) then raise exception 'Kein Zugriff auf dieses Projekt'; end if;
  if not exists (select 1 from public.ws_projekte where id = p_projekt and repo is not null and not coalesce(archiviert, false)) then
    raise exception 'Das Projekt hat noch kein Repository';
  end if;
  if p_pc is not null and not exists (select 1 from public.ws_werkstatt_pcs w where w.id = p_pc and w.benutzer_id = auth.uid()) then
    raise exception 'Unbekannter Werkstatt-PC';
  end if;
  if (select count(*) from public.ws_code_anfragen where von = auth.uid() and erstellt > now() - interval '1 minute') >= 60 then
    raise exception 'Zu viele Anfragen – bitte kurz warten';
  end if;
  insert into public.ws_code_anfragen (projekt_id, zweig, art, pfad, ziel_pc) values (p_projekt, p_zweig, p_art, case when p_art = 'datei' then p_pfad end, p_pc)
  returning id into n;
  return n;
end $$;

-- Werkstatt: nächste Anfrage. Eigene Anfragen (ziel_pc = dieser PC) oder – nur der Admin – Anfragen ohne Ziel-PC.
create or replace function public.ws_code_nehmen(p_pc uuid)
returns table (id bigint, projekt_id text, repo text, zweig text, art text, pfad text)
language plpgsql security definer set search_path = public as $$
declare a public.ws_code_anfragen;
begin
  if not exists (select 1 from public.ws_werkstatt_pcs w where w.id = p_pc and w.benutzer_id = auth.uid() and w.an) then return; end if;
  select * into a from public.ws_code_anfragen x
   where (x.stand = 'angefragt' or (x.stand = 'laeuft' and x.geaendert < now() - interval '2 minutes'))
     and x.erstellt > now() - interval '10 minutes'
     and (x.ziel_pc = p_pc or (x.ziel_pc is null and public.ws_ist_admin()))
   order by x.erstellt limit 1 for update skip locked;
  if a.id is null then return; end if;
  update public.ws_code_anfragen set stand = 'laeuft', pc = p_pc, geaendert = now() where ws_code_anfragen.id = a.id;
  return query select a.id, a.projekt_id, p.repo, a.zweig, a.art, a.pfad from public.ws_projekte p where p.id = a.projekt_id;
end $$;

create or replace function public.ws_code_antwort(p_pc uuid, p_id bigint, p_stand_sha text, p_baum jsonb, p_inhalt text, p_blob_sha text, p_hinweis text, p_nur_lesen boolean, p_fehler boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.ws_werkstatt_pcs w where w.id = p_pc and w.benutzer_id = auth.uid()) then raise exception 'Unbekannter Werkstatt-PC'; end if;
  update public.ws_code_anfragen set stand = case when p_fehler then 'fehler' else 'fertig' end, stand_sha = p_stand_sha, baum = p_baum,
         inhalt = p_inhalt, blob_sha = p_blob_sha, hinweis = left(p_hinweis, 300), nur_lesen = coalesce(p_nur_lesen, false), geaendert = now()
   where id = p_id and pc = p_pc and stand = 'laeuft';
  if not found then raise exception 'Keine laufende Anfrage dieser Werkstatt'; end if;
end $$;

-- Aufräumen (läuft in der Werkstatt mit): Inhalte nach einer Stunde weg
create or replace function public.ws_code_aufraeumen() returns void
language sql security definer set search_path = public as $$
  delete from public.ws_code_anfragen where erstellt < now() - interval '1 hour'
$$;

-- ---------- Ändern: Hand-Änderung als Auftrag ----------
alter table public.ws_auftraege add column if not exists hand boolean not null default false;

create or replace function public.ws_auftraege_hand_schutz() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and ((tg_op = 'INSERT' and new.hand) or (tg_op = 'UPDATE' and new.hand is distinct from old.hand)) then
    raise exception 'Hand-Änderungen entstehen nur über den Code-Editor';
  end if;
  return new;
end $$;
drop trigger if exists ws_auftraege_hand_schutz on public.ws_auftraege;
create trigger ws_auftraege_hand_schutz before insert or update on public.ws_auftraege for each row execute function public.ws_auftraege_hand_schutz();

create table if not exists public.ws_code_aenderungen (
  id bigint generated always as identity primary key,
  auftrag_id bigint not null references public.ws_auftraege(id) on delete cascade,
  pfad text not null check (char_length(pfad) between 1 and 400 and pfad !~ '(^|/)\.\.(/|$)' and pfad !~ '^/' and pfad !~ '[\x00-\x1f\\]' and pfad !~ '(^|/)\.git(/|$)'),
  inhalt text not null check (octet_length(inhalt) <= 524288),
  basis_blob text check (basis_blob is null or basis_blob ~ '^[0-9a-f]{40}$'),   -- null = neue Datei
  unique (auftrag_id, pfad)
);
alter table public.ws_code_aenderungen enable row level security;
revoke all on public.ws_code_aenderungen from anon, authenticated;
grant select on public.ws_code_aenderungen to authenticated;
drop policy if exists ws_code_aenderungen_lesen on public.ws_code_aenderungen;
create policy ws_code_aenderungen_lesen on public.ws_code_aenderungen for select to authenticated
  using (exists (select 1 from public.ws_auftraege a where a.id = auftrag_id and (a.erstellt_von = auth.uid() or public.ws_ist_werkstatt_fuer(a.gruppe_id))));

create or replace function public.ws_code_hand_auftrag(p_gruppe text, p_titel text, p_text text, p_basis_sha text, p_dateien jsonb, p_feature text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare n bigint; d jsonb; anzahl int; b text;
begin
  b := public.ws_bereich_von_gruppe(p_gruppe);
  if b is null then raise exception 'Gruppe nicht gefunden'; end if;
  if not (public.ws_ist_admin() or (public.ws_rolle() = 'entwickler' and public.ws_darf(b, 'auftraege'))) then
    raise exception 'Code ändern dürfen der Admin und Entwickler mit Auftrags-Recht in diesem Bereich';
  end if;
  if char_length(coalesce(trim(p_titel), '')) not between 3 and 120 then raise exception 'Bitte einen Titel (3–120 Zeichen)'; end if;
  if p_basis_sha is null or p_basis_sha !~ '^[0-9a-f]{40}$' then raise exception 'Ungültiger Ausgangsstand'; end if;
  if jsonb_typeof(p_dateien) <> 'array' then raise exception 'Keine Änderungen'; end if;
  anzahl := jsonb_array_length(p_dateien);
  if anzahl not between 1 and 50 then raise exception 'Zwischen 1 und 50 Dateien je Hand-Änderung'; end if;
  if p_feature is not null and not exists (select 1 from public.ws_features f where f.id = p_feature and f.gruppe_id = p_gruppe) then raise exception 'Feature gehört nicht zur Gruppe'; end if;
  insert into public.ws_auftraege (gruppe_id, feature_id, titel, art, erstellt_von, hand)
  values (p_gruppe, p_feature, left(trim(p_titel), 120), 'aendern', auth.uid(), true) returning id into n;
  for d in select * from jsonb_array_elements(p_dateien) loop
    if jsonb_typeof(d) <> 'object' or jsonb_typeof(d -> 'pfad') <> 'string' or jsonb_typeof(d -> 'inhalt') <> 'string' then raise exception 'Ungültige Datei-Angabe'; end if;
    -- Geheime Dateien nie; Abläufe, Regeln und Abhängigkeiten nur der Admin (wie beim Ersatz-Bau)
    if lower(d ->> 'pfad') ~ '(^|/)\.env|\.(pem|key|p12|pfx)$|(^|/)credentials|(^|/)id_(rsa|ed25519|ecdsa)' then
      raise exception 'Geheime Dateien werden nicht im Code-Editor geändert: %', d ->> 'pfad';
    end if;
    if not public.ws_ist_admin() and (d ->> 'pfad' ~ '^(\.github|\.claude|\.husky)/' or d ->> 'pfad' ~ '(^|/)(AGENTS\.md|CLAUDE\.md|package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock|\.npmrc)$') then
      raise exception 'Diese Datei ändert nur der Admin: %', d ->> 'pfad';
    end if;
    insert into public.ws_code_aenderungen (auftrag_id, pfad, inhalt, basis_blob) values (n, d ->> 'pfad', d ->> 'inhalt', nullif(d ->> 'basis_blob', ''));
  end loop;
  insert into public.ws_nachrichten (auftrag_id, von, art, text, daten) values (n, auth.uid(), 'text',
    left(coalesce(nullif(trim(p_text), ''), 'Hand-Änderung im Code-Editor') || E'\n\nGeänderte Dateien: ' ||
      (select string_agg(x ->> 'pfad', ', ') from jsonb_array_elements(p_dateien) x), 4000),
    jsonb_build_object('hand', true, 'basis', p_basis_sha));
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'hand_aenderung', jsonb_build_object('auftrag', n, 'gruppe', p_gruppe, 'dateien', anzahl));
  return n;
end $$;

revoke execute on function public.ws_code_anfragen(text, text, text, text, uuid), public.ws_code_nehmen(uuid),
  public.ws_code_antwort(uuid, bigint, text, jsonb, text, text, text, boolean, boolean), public.ws_code_aufraeumen(),
  public.ws_code_hand_auftrag(text, text, text, text, jsonb, text) from public, anon;
grant execute on function public.ws_code_anfragen(text, text, text, text, uuid), public.ws_code_nehmen(uuid),
  public.ws_code_antwort(uuid, bigint, text, jsonb, text, text, text, boolean, boolean), public.ws_code_aufraeumen(),
  public.ws_code_hand_auftrag(text, text, text, text, jsonb, text) to authenticated;

commit;
