-- Codeschmiede · Datenbank v26: Bestehendes Logo einlesen (Entwurf „Logo, KI-Wahl und Einrichtung“ 1.0, freigegeben von Gerhard 2026-10-23 21:57)
-- 1) Bild hochladen (PNG/JPG/WebP/SVG, bis 2 MB) – die eigene Werkstatt lässt Claude das Logo als bearbeitbares Vektor-Logo nachbauen
--    (nur feste Formen: Rechteck, Kreis, Ellipse, Pfad, Text; Farben #rrggbb) – kein freies SVG, nichts Ausführbares.
-- 2) Marke kennt das Zeichen „eigen“ mit diesem Vektor; ändert sich das Logo, geht es mit dem Design-Auftrag überall in die App.
-- 3) „Programmieren“ darf als Ersatz ChatGPT (Codex) haben, wenn Claudes Limit voll ist (Entscheidung Gerhard: „Nur als Ersatz“).
-- Mehrfach ausführbar. Reihenfolge 0001 → … → 0026.
begin;

-- ---------- Vektor-Logo prüfen ----------
create or replace function public.ws_marke_zahl_ok(v jsonb, lo numeric, hi numeric) returns boolean
language sql immutable set search_path = public as $$
  select jsonb_typeof(v) = 'number' and (v)::numeric between lo and hi
$$;
create or replace function public.ws_marke_farbe_ok(v jsonb) returns boolean
language sql immutable set search_path = public as $$
  select jsonb_typeof(v) = 'string' and ((v #>> '{}') ~ '^#[0-9a-fA-F]{6}$' or (v #>> '{}') = 'none')
$$;
create or replace function public.ws_marke_vektor_ok(v jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare e jsonb; k text; w jsonb; t text;
begin
  if v is null or jsonb_typeof(v) <> 'object' or pg_column_size(v) > 14000 then return false; end if;
  if exists (select 1 from jsonb_object_keys(v) x where x <> 'elemente') then return false; end if;
  if jsonb_typeof(v -> 'elemente') <> 'array' or jsonb_array_length(v -> 'elemente') not between 1 and 40 then return false; end if;
  for e in select * from jsonb_array_elements(v -> 'elemente') loop
    if jsonb_typeof(e) <> 'object' then return false; end if;
    t := e ->> 't';
    if t is null or t not in ('rect','circle','ellipse','path','text') then return false; end if;
    for k, w in select * from jsonb_each(e) loop
      if k = 't' then continue;
      elsif k in ('fill','stroke') then if not public.ws_marke_farbe_ok(w) then return false; end if;
      elsif k = 'sw' then if not public.ws_marke_zahl_ok(w, 0, 16) then return false; end if;
      elsif k in ('x','y','cx','cy') and t in ('rect','circle','ellipse','text') then if not public.ws_marke_zahl_ok(w, -8, 72) then return false; end if;
      elsif k in ('w','h') and t = 'rect' then if not public.ws_marke_zahl_ok(w, 0, 80) then return false; end if;
      elsif k = 'rx' and t in ('rect','ellipse') then if not public.ws_marke_zahl_ok(w, 0, 40) then return false; end if;
      elsif k = 'ry' and t = 'ellipse' then if not public.ws_marke_zahl_ok(w, 0, 40) then return false; end if;
      elsif k = 'r' and t = 'circle' then if not public.ws_marke_zahl_ok(w, 0, 40) then return false; end if;
      elsif k = 'd' and t = 'path' then
        if jsonb_typeof(w) <> 'string' or char_length(w #>> '{}') not between 1 and 2000 or (w #>> '{}') !~ '^[MmLlHhVvCcSsQqTtAaZz0-9 .,-]+$' then return false; end if;
      elsif k = 'text' and t = 'text' then
        if jsonb_typeof(w) <> 'string' or (w #>> '{}') !~ '^[A-Za-z0-9ÄÖÜäöüß .&-]{1,16}$' then return false; end if;
      elsif k = 'size' and t = 'text' then if not public.ws_marke_zahl_ok(w, 4, 48) then return false; end if;
      elsif k = 'weight' and t = 'text' then if jsonb_typeof(w) <> 'number' or (w)::numeric not in (400, 500, 600, 700, 800, 900) then return false; end if;
      elsif k = 'anchor' and t = 'text' then if jsonb_typeof(w) <> 'string' or (w #>> '{}') not in ('start','middle','end') then return false; end if;
      else return false;
      end if;
    end loop;
  end loop;
  return true;
end $$;

-- Marke: zusätzlich Zeichen „eigen“ mit Vektor (sonst wie 0017)
create or replace function public.ws_marke_ok(v jsonb) returns boolean
language sql immutable set search_path = public as $$
  select jsonb_typeof(v) = 'object' and not exists (select 1 from jsonb_each(v) e where not (
       (e.key = 'zeichen' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('bild','schild','ball','monogramm','pfeil','glut','eigen'))
    or (e.key in ('farbe','farbe2') and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') ~ '^#[0-9a-fA-F]{6}$')
    or (e.key = 'kuerzel' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') ~ '^[A-Za-z0-9ÄÖÜäöü]{1,3}$')
    or (e.key = 'name' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') ~ '^[A-Za-z0-9ÄÖÜäöüß .&-]{1,40}$')
    or (e.key = 'gewicht' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric in (600, 700, 800))
    or (e.key = 'sperrung' and jsonb_typeof(e.value) = 'number' and (e.value)::numeric between -2 and 8)
    or (e.key = 'form' and jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') in ('rund','eckig'))
    or (e.key = 'vektor' and public.ws_marke_vektor_ok(e.value))))
$$;
-- Hilfsfunktionen laufen in CHECK-Bedingungen mit den Rechten des Aufrufers (Prüfung 0022)
grant execute on function public.ws_marke_zahl_ok(jsonb, numeric, numeric), public.ws_marke_farbe_ok(jsonb), public.ws_marke_vektor_ok(jsonb), public.ws_marke_ok(jsonb) to authenticated;

alter table public.ws_projekte drop constraint if exists ws_projekte_logo_check;
alter table public.ws_projekte add constraint ws_projekte_logo_check check (logo is null or (pg_column_size(logo) < 16384 and public.ws_marke_ok(logo)));

-- ---------- Eingelesene Logos ----------
create table if not exists public.ws_marke_vorlagen (
  id bigserial primary key,
  projekt_id text not null references public.ws_projekte(id) on delete cascade,
  von uuid not null default auth.uid() references auth.users(id),
  dateiname text check (char_length(dateiname) <= 120),
  bild text not null check (char_length(bild) <= 2900000 and bild ~ '^data:image/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$'),
  wunsch text check (char_length(wunsch) <= 500),                     -- z. B. „Schrift moderner“ beim erneuten Nachbauen
  stand text not null default 'wartet' check (stand in ('wartet','laeuft','fertig','fehler')),
  ergebnis jsonb check (ergebnis is null or public.ws_marke_vektor_ok(ergebnis)),
  hinweis text check (char_length(hinweis) <= 1000),
  ki text check (char_length(ki) <= 60),
  pc uuid references public.ws_werkstatt_pcs(id) on delete set null,
  erstellt timestamptz not null default now(),
  geaendert timestamptz not null default now()
);
create index if not exists ws_marke_vorlagen_projekt on public.ws_marke_vorlagen (projekt_id, id desc);
alter table public.ws_marke_vorlagen enable row level security;
drop policy if exists ws_marke_vorlagen_lesen on public.ws_marke_vorlagen;
create policy ws_marke_vorlagen_lesen on public.ws_marke_vorlagen for select to authenticated using (public.ws_darf_design(projekt_id));
revoke insert, update, delete on public.ws_marke_vorlagen from anon, authenticated;
grant select on public.ws_marke_vorlagen to authenticated;

-- Einlesen: wer gestalten darf (ws_darf_design: Admin/Entwickler); die eigene Werkstatt baut nach. Höchstens 20 je Person und Tag.
create or replace function public.ws_marke_einlesen(p_projekt text, p_bild text, p_dateiname text default null, p_wunsch text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare neu bigint;
begin
  if not public.ws_darf_design(p_projekt) then raise exception 'Logos einlesen dürfen Admin und Entwickler des Projekts'; end if;
  if (select count(*) from public.ws_marke_vorlagen where von = auth.uid() and erstellt > now() - interval '1 day') >= 20 then
    raise exception 'Heute schon 20 Logos eingelesen – morgen wieder';
  end if;
  insert into public.ws_marke_vorlagen (projekt_id, bild, dateiname, wunsch)
    values (p_projekt, p_bild, left(regexp_replace(coalesce(p_dateiname, ''), '[^A-Za-z0-9ÄÖÜäöüß ._-]', '', 'g'), 120), nullif(left(btrim(coalesce(p_wunsch, '')), 500), ''))
    returning id into neu;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'logo_eingelesen', jsonb_build_object('projekt', p_projekt, 'id', neu));
  return neu;
end $$;

-- Nochmal nachbauen (mit Wunsch) – nur wer eingelesen hat
create or replace function public.ws_marke_nochmal(p_id bigint, p_wunsch text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.ws_marke_vorlagen set stand = 'wartet', pc = null, hinweis = null, geaendert = now(),
         wunsch = nullif(left(btrim(coalesce(p_wunsch, '')), 500), '')
   where id = p_id and von = auth.uid() and stand in ('fertig','fehler') and public.ws_darf_design(projekt_id);
  if not found then raise exception 'Nicht gefunden, läuft gerade oder nicht von dir eingelesen'; end if;
end $$;

-- Eigene Werkstatt nimmt nur eigene Logos (wie der Design-Chat)
create or replace function public.ws_marke_nehmen(p_pc uuid)
returns table (id bigint, projekt_id text, bild text, dateiname text, wunsch text)
language plpgsql security definer set search_path = public as $$
declare m public.ws_marke_vorlagen;
begin
  if not exists (select 1 from public.ws_werkstatt_pcs w where w.id = p_pc and w.benutzer_id = auth.uid() and w.an) then return; end if;
  select * into m from public.ws_marke_vorlagen x
   where x.von = auth.uid() and (x.stand = 'wartet' or (x.stand = 'laeuft' and x.geaendert < now() - interval '20 minutes'))
   order by x.id limit 1 for update skip locked;
  if m.id is null then return; end if;
  if not public.ws_darf_design(m.projekt_id) then
    update public.ws_marke_vorlagen x set stand = 'fehler', hinweis = 'Kein Recht mehr zum Gestalten', geaendert = now() where x.id = m.id;
    return;
  end if;
  update public.ws_marke_vorlagen x set stand = 'laeuft', pc = p_pc, geaendert = now() where x.id = m.id;
  return query select m.id, m.projekt_id, m.bild, m.dateiname, m.wunsch;
end $$;

create or replace function public.ws_marke_ergebnis(p_pc uuid, p_id bigint, p_ergebnis jsonb, p_hinweis text, p_ki text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.ws_werkstatt_pcs w where w.id = p_pc and w.benutzer_id = auth.uid()) then raise exception 'Unbekannter Werkstatt-PC'; end if;
  if p_ergebnis is not null and not public.ws_marke_vektor_ok(p_ergebnis) then
    p_ergebnis := null; p_hinweis := 'Der Nachbau hielt die Regeln nicht ein – bitte nochmal nachbauen';
  end if;
  update public.ws_marke_vorlagen set stand = case when p_ergebnis is null then 'fehler' else 'fertig' end, ergebnis = p_ergebnis,
         hinweis = left(p_hinweis, 1000), ki = left(p_ki, 60), geaendert = now()
   where id = p_id and pc = p_pc and von = auth.uid() and stand = 'laeuft';
  if not found then raise exception 'Kein laufender Nachbau dieser Werkstatt'; end if;
end $$;

revoke execute on function public.ws_marke_einlesen(text, text, text, text), public.ws_marke_nochmal(bigint, text), public.ws_marke_nehmen(uuid),
  public.ws_marke_ergebnis(uuid, bigint, jsonb, text, text) from public, anon;
grant execute on function public.ws_marke_einlesen(text, text, text, text), public.ws_marke_nochmal(bigint, text), public.ws_marke_nehmen(uuid),
  public.ws_marke_ergebnis(uuid, bigint, jsonb, text, text) to authenticated;
do $$ begin
  begin alter publication supabase_realtime add table public.ws_marke_vorlagen; exception when others then null; end;
end $$;

-- ---------- Programmieren: ChatGPT (Codex) nur als Ersatz ----------
-- Bauen: zuerst immer Claude; als zweiter Eintrag darf nur ChatGPT stehen (übernimmt nur bei vollem Claude-Limit, Prüfungen bleiben Claude)
create or replace function public.ws_ki_reihe_ok(p_aufgabe text, r jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare e jsonb;
begin
  if p_aufgabe not in ('chat','konzept','design','pruefung','doku','texte','bilder','bauen') then return false; end if;
  if r is null or jsonb_typeof(r) <> 'array' or jsonb_array_length(r) not between 1 and 8 then return false; end if;
  for e in select * from jsonb_array_elements(r) loop
    if jsonb_typeof(e) <> 'object' or exists (select 1 from jsonb_object_keys(e) k where k not in ('anbieter','modell')) then return false; end if;
    if (e->>'anbieter') is null or (e->>'anbieter') !~ '^[a-z][a-z0-9-]{1,30}$' then return false; end if;
    if e ? 'modell' and (jsonb_typeof(e->'modell') <> 'string' or (e->>'modell') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,59}$') then return false; end if;
  end loop;
  if (select count(distinct x->>'anbieter') from jsonb_array_elements(r) x) <> jsonb_array_length(r) then return false; end if;
  if p_aufgabe = 'bauen' and not (r->0->>'anbieter' = 'claude' and (jsonb_array_length(r) = 1 or (jsonb_array_length(r) = 2 and r->1->>'anbieter' = 'chatgpt'))) then return false; end if;
  if p_aufgabe = 'pruefung' and not exists (select 1 from jsonb_array_elements(r) x where x->>'anbieter' = 'claude') then return false; end if;
  return true;
end $$;
revoke execute on function public.ws_ki_reihe_ok(text, jsonb) from public, anon;

commit;
