-- Codeschmiede · Datenbank v32: Härtung Code-Editor nach der unabhängigen Prüfung (2026-10-24)
-- H1 Pfade ohne „.“-Abschnitte, doppelte oder abschließende Schrägstriche, Doppelpunkt · H2 Recht nach der Rolle IM PROJEKT ·
-- M1 eigene Hand-Änderung nicht selbst freigeben (außer Admin) · M2 mehr Dateien nur für den Admin, unabhängig von Groß-/Kleinschreibung,
-- weitere geheime Dateien · M3 Anfragen begrenzen, Inhalte nach 5 Minuten leeren · M4 keine Realtime-Veröffentlichung ·
-- M5 gespeicherte Inhalte nach dem Pull Request löschen. Mehrfach ausführbar. Reihenfolge 0001 → … → 0032.
begin;

-- Pfad-Regel (gemeinsam für Anfragen und Änderungen)
create or replace function public.ws_code_pfad_ok(p text) returns boolean
language sql immutable set search_path = public as $$
  select p is not null and char_length(p) between 1 and 400
     and p !~ '(^|/)\.\.?(/|$)'          -- keine „.“- oder „..“-Abschnitte
     and p !~ '^/' and p !~ '/$' and p !~ '//'
     and p !~ '[\x00-\x1f\\:]'           -- keine Steuerzeichen, kein Backslash, kein Doppelpunkt
     and p !~ '(^|/)\.git(/|$)' and p !~ '^-' and p !~ '[ .]$'
$$;
revoke execute on function public.ws_code_pfad_ok(text) from public, anon;
grant execute on function public.ws_code_pfad_ok(text) to authenticated;

-- Geheime Dateien (wie im Werkstatt-Dienst lib/code.mjs)
create or replace function public.ws_code_geheim(p text) returns boolean
language sql immutable set search_path = public as $$
  select lower(p) ~ '(^|/)\.env|\.(pem|key|p12|pfx|jks|keystore)$|(^|/)credentials|(^|/)id_(rsa|ed25519|ecdsa)|(^|/)\.dev\.vars$|(^|/)\.npmrc$|(^|/)\.netrc$|(^|/)serviceaccount[^/]*\.json$|(^|/)secrets?\.[^/]*$'
$$;
revoke execute on function public.ws_code_geheim(text) from public, anon;
grant execute on function public.ws_code_geheim(text) to authenticated;

alter table public.ws_code_anfragen drop constraint if exists ws_code_anfragen_pfad_check;
alter table public.ws_code_anfragen add constraint ws_code_anfragen_pfad_check check (pfad is null or public.ws_code_pfad_ok(pfad));
alter table public.ws_code_aenderungen drop constraint if exists ws_code_aenderungen_pfad_check;
alter table public.ws_code_aenderungen add constraint ws_code_aenderungen_pfad_check check (public.ws_code_pfad_ok(pfad));
create index if not exists ws_code_anfragen_von on public.ws_code_anfragen (von, erstellt);
do $$ begin alter publication supabase_realtime drop table public.ws_code_anfragen; exception when others then null; end $$;

-- Anfragen: Baum höchstens 6 je Minute, Dateien 60 je Minute
create or replace function public.ws_code_anfragen(p_projekt text, p_zweig text, p_art text, p_pfad text default null, p_pc uuid default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare n bigint; grenze int := 60;
begin
  if p_art = 'baum' then grenze := 6; end if;
  if not public.ws_sieht_projekt(p_projekt) then raise exception 'Kein Zugriff auf dieses Projekt'; end if;
  if not exists (select 1 from public.ws_projekte where id = p_projekt and repo is not null and not coalesce(archiviert, false)) then
    raise exception 'Das Projekt hat noch kein Repository';
  end if;
  if p_art = 'datei' and (not public.ws_code_pfad_ok(p_pfad) or public.ws_code_geheim(p_pfad)) then raise exception 'Diese Datei kann nicht geöffnet werden'; end if;
  if p_pc is not null and not exists (select 1 from public.ws_werkstatt_pcs w where w.id = p_pc and w.benutzer_id = auth.uid()) then
    raise exception 'Unbekannter Werkstatt-PC';
  end if;
  if (select count(*) from public.ws_code_anfragen where von = auth.uid() and erstellt > now() - interval '1 minute' and art = p_art) >= grenze then
    raise exception 'Zu viele Anfragen – bitte kurz warten';
  end if;
  insert into public.ws_code_anfragen (projekt_id, zweig, art, pfad, ziel_pc) values (p_projekt, p_zweig, p_art, case when p_art = 'datei' then p_pfad end, p_pc)
  returning id into n;
  return n;
end $$;

-- Aufräumen: Inhalte nach 5 Minuten leeren, Zeilen nach einer Stunde löschen
create or replace function public.ws_code_aufraeumen() returns void
language sql security definer set search_path = public as $$
  update public.ws_code_anfragen set inhalt = null, baum = null where erstellt < now() - interval '5 minutes' and (inhalt is not null or baum is not null);
  delete from public.ws_code_anfragen where erstellt < now() - interval '1 hour';
$$;

-- Hand-Auftrag: Rolle im Projekt, mehr Admin-Dateien, geheime Dateien nie
create or replace function public.ws_code_hand_auftrag(p_gruppe text, p_titel text, p_text text, p_basis_sha text, p_dateien jsonb, p_feature text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare n bigint; d jsonb; anzahl int; b text; pf text;
begin
  b := public.ws_bereich_von_gruppe(p_gruppe);
  if b is null then raise exception 'Gruppe nicht gefunden'; end if;
  if not (public.ws_ist_admin() or (public.ws_rolle_im_projekt(public.ws_projekt_von_bereich(b)) = 'entwickler' and public.ws_darf(b, 'auftraege'))) then
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
    pf := d ->> 'pfad';
    if not public.ws_code_pfad_ok(pf) then raise exception 'Ungültiger Pfad: %', pf; end if;
    if public.ws_code_geheim(pf) then raise exception 'Geheime Dateien werden nicht im Code-Editor geändert: %', pf; end if;
    if not public.ws_ist_admin() and (lower(pf) ~ '^(\.github|\.claude|\.husky|\.devcontainer|\.vscode|supabase/migrations|supabase/functions)/'
        or lower(pf) ~ '(^|/)(agents\.md|claude\.md|package\.json|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|\.yarnrc\.yml|cargo\.lock|cargo\.toml|\.gitattributes|\.gitmodules|wrangler\.toml|wrangler\.jsonc?|tauri\.conf\.json)$') then
      raise exception 'Diese Datei ändert nur der Admin: %', pf;
    end if;
    insert into public.ws_code_aenderungen (auftrag_id, pfad, inhalt, basis_blob) values (n, pf, d ->> 'inhalt', nullif(d ->> 'basis_blob', ''));
  end loop;
  insert into public.ws_nachrichten (auftrag_id, von, art, text, daten) values (n, auth.uid(), 'text',
    left(coalesce(nullif(trim(p_text), ''), 'Hand-Änderung im Code-Editor') || E'\n\nGeänderte Dateien: ' ||
      (select string_agg(x ->> 'pfad', ', ') from jsonb_array_elements(p_dateien) x), 4000),
    jsonb_build_object('hand', true, 'basis', p_basis_sha));
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'hand_aenderung', jsonb_build_object('auftrag', n, 'gruppe', p_gruppe, 'dateien', anzahl));
  return n;
end $$;

-- Werkstatt: gespeicherte Inhalte nach dem Pull Request löschen (stehen dann im Zweig)
create or replace function public.ws_code_aenderungen_erledigt(p_auftrag bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.ws_auftraege a where a.id = p_auftrag and a.hand and public.ws_ist_werkstatt_fuer(a.gruppe_id)) then
    raise exception 'Nur die Werkstatt dieses Auftrags';
  end if;
  delete from public.ws_code_aenderungen where auftrag_id = p_auftrag;
end $$;
revoke execute on function public.ws_code_aenderungen_erledigt(bigint) from public, anon;
grant execute on function public.ws_code_aenderungen_erledigt(bigint) to authenticated;

-- Freigeben: eigene Hand-Änderung nicht selbst (Vier-Augen-Prinzip), außer Admin
create or replace function public.ws_freigeben(p_auftrag bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ws_auftraege;
begin
  select * into a from public.ws_auftraege where id = p_auftrag for update;
  if a.id is null then raise exception 'Auftrag nicht gefunden'; end if;
  if not public.ws_darf(public.ws_bereich_von_gruppe(a.gruppe_id), 'freigeben') then
    raise exception 'Keine Berechtigung zum Freigeben in diesem Bereich';
  end if;
  if coalesce(a.hand, false) and a.erstellt_von = auth.uid() and not public.ws_ist_admin() then
    raise exception 'Die eigene Hand-Änderung gibt eine andere Person frei';
  end if;
  if a.stand <> 'freigabe' then raise exception 'Auftrag ist nicht zur Freigabe bereit'; end if;
  if a.pr_nummer is null or a.zweig is null then raise exception 'Kein Pull Request hinterlegt'; end if;
  update public.ws_auftraege set stand = 'sicherheit', pruefung = pruefung - 'sicherheit' - 'feature', geaendert = now() where id = p_auftrag;
  insert into public.ws_nachrichten (auftrag_id, von, art, text) values (p_auftrag, auth.uid(), 'system', 'Freigegeben – Sicherheitsprüfung startet');
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'freigeben', jsonb_build_object('auftrag', p_auftrag, 'zweig', a.zweig, 'pr', a.pr_nummer));
end $$;

commit;
