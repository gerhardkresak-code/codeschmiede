-- Codeschmiede · Datenbank v20: Konzept zuerst (Entwurf 1.0, freigegeben von Gerhard 2026-10-23 18:06).
-- „Lege bei neuen Projekten in der Gruppe App als erstes ‚Konzept‘ an. Hier wird das Grundkonzept besprochen, bevor die App
-- überhaupt gebaut wird … und geht dann ins Wissen über.“ Antworten 17:55: neue UND bestehende Projekte; Ergebnis → Wissensdatenbank;
-- die Chat-Spalte rechts entfällt, ihre Aufgaben (Projektfragen, Konzept-Karte, Vorschläge) laufen im Konzept-Chat.
--   ws_projekte.konzept_gruppe_id   Gruppe „Konzept“, erste Gruppe im Bereich „App“ (fehlt der Bereich, wird er als erster angelegt)
--   ws_wissen                       Konzept-Entscheidungen je Projekt (Kapitel + Text) – sehen alle Mitglieder, jeder Auftrag kennt sie
--   Vorschlag {"wissen":{kapitel,text}} im Chat → „Ins Wissen übernehmen“ (Ja/Nein, nur wer gefragt hat)
-- Keine Personendaten (nur Arbeit an der App). Mehrfach ausführbar. Reihenfolge 0001 → … → 0020.
begin;

alter table public.ws_projekte add column if not exists konzept_gruppe_id text references public.ws_gruppen(id) on delete set null;   -- Projekt löschen (0013) räumt Gruppen ab

-- Konzept-Gruppe eines Projekts sicherstellen (intern, ohne Rechteprüfung)
create or replace function public.ws_konzept_gruppe_sicher(p_projekt text) returns text
language plpgsql security definer set search_path = public as $$
declare g text; b text; wer uuid; erste int;
begin
  select konzept_gruppe_id, coalesce(auth.uid(), erstellt_von) into g, wer from public.ws_projekte where id = p_projekt;
  if not found then raise exception 'Projekt nicht gefunden'; end if;
  if g is not null and public.ws_projekt_von_gruppe(g) = p_projekt then return g; end if;
  g := p_projekt || '-konzept';
  -- Kennung schon von einem anderen Projekt belegt? Dann mit Zusatz (Prüfung N1 – nie abbrechen, nie fremd zeigen)
  while exists (select 1 from public.ws_gruppen where id = g) and public.ws_projekt_von_gruppe(g) is distinct from p_projekt loop
    g := p_projekt || '-konzept-' || substr(md5(random()::text), 1, 4);
  end loop;
  if not exists (select 1 from public.ws_gruppen where id = g) then
    -- Bereich „App“: <projekt>-app, sonst ein Bereich namens „App“, sonst neu als erster Bereich
    select id into b from public.ws_bereiche where projekt_id = p_projekt and not global and (id = p_projekt || '-app' or name = 'App')
      order by (id = p_projekt || '-app') desc limit 1;
    if b is null then
      b := p_projekt || '-app';
      while exists (select 1 from public.ws_bereiche where id = b) loop b := p_projekt || '-app-' || substr(md5(random()::text), 1, 4); end loop;
      insert into public.ws_bereiche (id, projekt_id, name, reihenfolge)
        values (b, p_projekt, 'App', coalesce((select min(reihenfolge) from public.ws_bereiche where projekt_id = p_projekt), 1) - 1);
    end if;
    select coalesce(min(reihenfolge), 1) - 1 into erste from public.ws_gruppen where bereich_id = b;
    insert into public.ws_gruppen (id, bereich_id, name, symbol, reihenfolge, erstellt_von) values (g, b, 'Konzept', 'lightbulb', erste, wer);
  end if;
  update public.ws_projekte set konzept_gruppe_id = g where id = p_projekt;
  return g;
end $$;
revoke execute on function public.ws_konzept_gruppe_sicher(text) from public, anon, authenticated;

-- Neue Projekte: entsteht beim Anlegen die Gruppe „<projekt>-oberflaeche“, kommt „Konzept“ als erste Gruppe dazu
create or replace function public.ws_gruppe_design_auto() returns trigger
language plpgsql security definer set search_path = public as $$
declare p text;
begin
  select projekt_id into p from public.ws_bereiche where id = new.bereich_id;
  if p is not null and new.id = p || '-oberflaeche' then
    update public.ws_projekte set design_gruppe_id = new.id where id = p and design_gruppe_id is null;
    if exists (select 1 from public.ws_projekte where id = p and konzept_gruppe_id is null) then perform public.ws_konzept_gruppe_sicher(p); end if;
  end if;
  return new;
end $$;

-- Bestehende Projekte nachziehen (Antwort 17:55: neue und bestehende)
do $$ declare r record; begin
  for r in select id from public.ws_projekte where konzept_gruppe_id is null and not coalesce(archiviert, false) loop
    perform public.ws_konzept_gruppe_sicher(r.id);
  end loop;
end $$;

-- Konzept-Wissen
create table if not exists public.ws_wissen (
  id bigserial primary key,
  projekt_id text not null references public.ws_projekte(id) on delete cascade,
  kapitel text not null check (kapitel in ('ziel','funktionen','daten','design','ablauf','offen','sonstiges')),
  text text not null check (char_length(text) between 3 and 2000),
  quelle_chat bigint references public.ws_claude_chat(id) on delete set null,
  erstellt_von uuid not null default auth.uid() references auth.users(id),
  erstellt timestamptz not null default now()
);
create index if not exists ws_wissen_projekt on public.ws_wissen (projekt_id, kapitel, id);
revoke all on public.ws_wissen from anon, authenticated;
grant select on public.ws_wissen to authenticated;
alter table public.ws_wissen enable row level security;
drop policy if exists ws_wissen_lesen on public.ws_wissen;
create policy ws_wissen_lesen on public.ws_wissen for select to authenticated using (public.ws_sieht_projekt(projekt_id));

-- Schreiben: Admin oder Entwickler des Projekts (Texter/Leser lesen nur)
create or replace function public.ws_wissen_darf(p_projekt text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.ws_rolle_im_projekt(p_projekt), '') in ('admin','entwickler')
     and exists (select 1 from public.ws_projekte where id = p_projekt and not coalesce(archiviert, false))
$$;
revoke execute on function public.ws_wissen_darf(text) from public, anon;
grant execute on function public.ws_wissen_darf(text) to authenticated;

-- Aus einem Chat-Vorschlag übernehmen: nur wer gefragt hat; Text/Kapitel kommen aus dem gespeicherten Vorschlag, nicht vom Aufrufer
create or replace function public.ws_wissen_uebernehmen(p_antwort bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.ws_claude_chat; f public.ws_claude_chat; n bigint;
begin
  select * into a from public.ws_claude_chat where id = p_antwort and frage_id is not null for update;
  if a.id is null or a.vorschlag is null or not (a.vorschlag ? 'wissen') then raise exception 'Kein Vorschlag für das Wissen'; end if;
  if a.entscheidung is not null then raise exception 'Schon entschieden'; end if;
  select * into f from public.ws_claude_chat where id = a.frage_id;
  if f.von is distinct from auth.uid() then raise exception 'Nur wer gefragt hat, entscheidet'; end if;
  if not public.ws_wissen_darf(a.projekt_id) then raise exception 'Ins Wissen übernehmen dürfen Admin und Entwickler des Projekts'; end if;
  insert into public.ws_wissen (projekt_id, kapitel, text, quelle_chat)
    values (a.projekt_id, a.vorschlag->'wissen'->>'kapitel', a.vorschlag->'wissen'->>'text', a.id) returning id into n;
  update public.ws_claude_chat set entscheidung = 'uebernommen', geaendert = now() where id = a.id;
  return n;
end $$;

-- Von Hand eintragen, ändern, löschen (Konzept-Stand)
create or replace function public.ws_wissen_eintragen(p_projekt text, p_kapitel text, p_text text) returns bigint
language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  if not public.ws_wissen_darf(p_projekt) then raise exception 'Ins Wissen eintragen dürfen Admin und Entwickler des Projekts'; end if;
  insert into public.ws_wissen (projekt_id, kapitel, text) values (p_projekt, p_kapitel, trim(p_text)) returning id into n;
  return n;
end $$;
create or replace function public.ws_wissen_loeschen(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare w public.ws_wissen;
begin
  select * into w from public.ws_wissen where id = p_id;
  if w.id is null then raise exception 'Eintrag nicht gefunden'; end if;
  if not public.ws_wissen_darf(w.projekt_id) or (w.erstellt_von is distinct from auth.uid() and not public.ws_ist_admin()) then
    raise exception 'Löschen darf, wer den Eintrag angelegt hat, oder der Admin'; end if;
  delete from public.ws_wissen where id = p_id;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'wissen_geloescht', jsonb_build_object('projekt', w.projekt_id, 'kapitel', w.kapitel, 'text', left(w.text, 300)));
end $$;
revoke execute on function public.ws_wissen_uebernehmen(bigint), public.ws_wissen_eintragen(text, text, text), public.ws_wissen_loeschen(bigint) from public, anon;
grant execute on function public.ws_wissen_uebernehmen(bigint), public.ws_wissen_eintragen(text, text, text), public.ws_wissen_loeschen(bigint) to authenticated;

-- Konzept-Gruppe fehlt (z. B. wiederhergestelltes Projekt): Admin/Entwickler richten sie aus der Zentrale ein (Prüfung N2)
create or replace function public.ws_konzept_einrichten(p_projekt text) returns text
language plpgsql security definer set search_path = public as $$
declare g text;
begin
  if not public.ws_wissen_darf(p_projekt) then raise exception 'Die Konzept-Gruppe richtet der Admin oder ein Entwickler des Projekts ein'; end if;
  if exists (select 1 from public.ws_projekte where id = p_projekt and konzept_gruppe_id is not null) then
    return (select konzept_gruppe_id from public.ws_projekte where id = p_projekt); end if;
  g := public.ws_konzept_gruppe_sicher(p_projekt);
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'konzept_eingerichtet', jsonb_build_object('projekt', p_projekt, 'gruppe', g));
  return g;
end $$;
revoke execute on function public.ws_konzept_einrichten(text) from public, anon;
grant execute on function public.ws_konzept_einrichten(text) to authenticated;

-- In der Konzept-Gruppe gibt es keine Features und keine Bau-Aufträge – sie wären dort unsichtbar (Prüfung M3)
create or replace function public.ws_ist_konzept_gruppe(p_gruppe text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ws_projekte where konzept_gruppe_id = p_gruppe)
$$;
revoke execute on function public.ws_ist_konzept_gruppe(text) from public, anon, authenticated;
create or replace function public.ws_nicht_in_konzept() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.ws_ist_konzept_gruppe(new.gruppe_id) then raise exception 'In der Gruppe „Konzept“ gibt es keine Features und Aufträge – bitte eine andere Gruppe wählen'; end if;
  return new;
end $$;
revoke execute on function public.ws_nicht_in_konzept() from public, anon, authenticated;
drop trigger if exists ws_features_nicht_konzept on public.ws_features;
create trigger ws_features_nicht_konzept before insert or update of gruppe_id on public.ws_features for each row execute function public.ws_nicht_in_konzept();
drop trigger if exists ws_auftraege_nicht_konzept on public.ws_auftraege;
create trigger ws_auftraege_nicht_konzept before insert or update of gruppe_id on public.ws_auftraege for each row execute function public.ws_nicht_in_konzept();

-- Höchstens 300 Einträge je Projekt (Prompt-Länge, Prüfung M2)
create or replace function public.ws_wissen_grenze() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.ws_wissen where projekt_id = new.projekt_id) >= 300 then
    raise exception 'Das Konzept-Wissen ist voll (300 Einträge) – bitte zusammenfassen oder alte Einträge entfernen'; end if;
  return new;
end $$;
revoke execute on function public.ws_wissen_grenze() from public, anon, authenticated;
drop trigger if exists ws_wissen_grenze on public.ws_wissen;
create trigger ws_wissen_grenze before insert on public.ws_wissen for each row execute function public.ws_wissen_grenze();

-- Vorschlag {"wissen":{"kapitel","text"}} zusätzlich erlauben (Rest wie 0015, ohne Konzept-Gruppe als Ziel)
create or replace function public.ws_vorschlag_ok(p_projekt text, v jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if v is null then return true; end if;
  if jsonb_typeof(v) <> 'object' then return false; end if;
  -- 0) Wissen: {"wissen":{"kapitel","text"}}
  if v ? 'wissen' then
    if exists (select 1 from jsonb_object_keys(v) k where k <> 'wissen') or jsonb_typeof(v->'wissen') <> 'object'
       or exists (select 1 from jsonb_object_keys(v->'wissen') k where k not in ('kapitel','text')) then return false; end if;
    if jsonb_typeof(v->'wissen'->'kapitel') <> 'string' or jsonb_typeof(v->'wissen'->'text') <> 'string' then return false; end if;
    return (v->'wissen'->>'kapitel') in ('ziel','funktionen','daten','design','ablauf','offen','sonstiges')
       and char_length(v->'wissen'->>'text') between 3 and 2000;
  end if;
  -- a) neues Feature: {"feature_neu":{"gruppe_id","name","beschreibung"}}
  if v ? 'feature_neu' then
    if exists (select 1 from jsonb_object_keys(v) k where k <> 'feature_neu') or jsonb_typeof(v->'feature_neu') <> 'object'
       or exists (select 1 from jsonb_object_keys(v->'feature_neu') k where k not in ('gruppe_id','name','beschreibung')) then return false; end if;
    if jsonb_typeof(v->'feature_neu'->'gruppe_id') <> 'string' or jsonb_typeof(v->'feature_neu'->'name') <> 'string' then return false; end if;
    if char_length(v->'feature_neu'->>'name') not between 2 and 80 or char_length(coalesce(v->'feature_neu'->>'beschreibung','')) > 1000 then return false; end if;
    return public.ws_projekt_von_gruppe(v->'feature_neu'->>'gruppe_id') is not distinct from p_projekt and not public.ws_ist_konzept_gruppe(v->'feature_neu'->>'gruppe_id');
  end if;
  -- b) Bezug: {"bezug":{"von","zu"}}
  if v ? 'bezug' then
    if exists (select 1 from jsonb_object_keys(v) k where k <> 'bezug') or jsonb_typeof(v->'bezug') <> 'object'
       or exists (select 1 from jsonb_object_keys(v->'bezug') k where k not in ('von','zu')) then return false; end if;
    return exists (select 1 from public.ws_features a join public.ws_features b on b.id = v->'bezug'->>'zu'
                   where a.id = v->'bezug'->>'von' and a.id <> b.id
                     and public.ws_projekt_von_gruppe(a.gruppe_id) = p_projekt and public.ws_projekt_von_gruppe(b.gruppe_id) = p_projekt);
  end if;
  -- c) Auftrag (mit optionalem Konzept) wie bisher
  if exists (select 1 from jsonb_object_keys(v) k where k not in ('gruppe_id','feature_id','titel','text','konzept')) then return false; end if;
  if jsonb_typeof(v->'gruppe_id') <> 'string' or jsonb_typeof(v->'titel') <> 'string' or jsonb_typeof(v->'text') <> 'string' then return false; end if;
  if char_length(v->>'titel') not between 3 and 80 or char_length(v->>'text') not between 10 and 8000 then return false; end if;
  if public.ws_projekt_von_gruppe(v->>'gruppe_id') is distinct from p_projekt or public.ws_ist_konzept_gruppe(v->>'gruppe_id') then return false; end if;
  if v ? 'feature_id' and v->'feature_id' <> 'null'::jsonb then
    if jsonb_typeof(v->'feature_id') <> 'string' or not exists (select 1 from public.ws_features f where f.id = v->>'feature_id' and f.gruppe_id = v->>'gruppe_id') then return false; end if;
  end if;
  if not public.ws_konzept_ok(v->'konzept') then return false; end if;
  return true;
end $$;
revoke execute on function public.ws_vorschlag_ok(text, jsonb) from public, anon, authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.ws_wissen; exception when duplicate_object then null; end;
end $$;

commit;
