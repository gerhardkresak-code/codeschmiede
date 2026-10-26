-- Codeschmiede 0.9.14 (Anweisung Gerhard 26.10.2026 08:07)
-- 1) „Ungenutzte oder geplante Gruppen auch wieder löschen“ – Entscheidung „Ohne Menüpunkt und leer“:
--    löschbar sind Gruppen ohne Menüpunkt in der App (app_key leer), ohne Features (auch keine ausgebauten) und ohne Aufträge.
--    Gruppen mit Features: Features zuerst verschieben. Menüpunkte der App: nur über einen Ausbau-Auftrag.
-- 2) „Der allgemeine Chat wie hier bei dir soll über Konzept laufen“ – „Der eingestellte KI-Anbieter erledigt das“:
--    Im Konzept-Gespräch stellt die KI Rückfragen zum Anklicken (FRAGEN) und legt, wenn alles geklärt ist, die Aufträge selbst
--    in den passenden Gruppen an (AUFTRAEGE, höchstens 5 je Antwort) – mit den normalen Rechten dessen, der gefragt hat.
--    Freigeben und Zusammenführen bleiben Klicks von Gerhard.
-- Mehrfach ausführbar.
begin;

-- ---------- 1) Gruppe löschen ----------
create or replace function public.ws_gruppe_loeschen(p_gruppe text) returns void
language plpgsql security definer set search_path = public as $$
declare g public.ws_gruppen; b public.ws_bereiche;
begin
  if not public.ws_ist_admin() then raise exception 'Nur der Admin löscht Gruppen'; end if;
  select * into g from ws_gruppen where id = p_gruppe for update;
  if g.id is null then raise exception 'Gruppe nicht gefunden'; end if;
  select * into b from ws_bereiche where id = g.bereich_id;
  if coalesce(b.global, false) then raise exception 'Gruppen der globalen Einstellungen bleiben'; end if;
  if g.app_key is not null then raise exception 'Die Gruppe ist ein Menüpunkt der App – entfernen nur über einen Ausbau-Auftrag'; end if;
  if exists (select 1 from ws_features where gruppe_id = g.id) then raise exception 'Die Gruppe enthält noch Features – zuerst verschieben'; end if;
  if exists (select 1 from ws_auftraege where gruppe_id = g.id) then raise exception 'Die Gruppe hat Aufträge – sie bleibt als Verlauf erhalten'; end if;
  if exists (select 1 from ws_projekte where g.id in (design_gruppe_id, konzept_gruppe_id, db_gruppe_id)) then
    raise exception 'Die Gruppe wird vom Projekt verwendet (Konzept, Designer oder Datenbank) und bleibt'; end if;
  delete from ws_gruppen where id = g.id;   -- Protokoll „gruppe_weg“ schreibt ws_aufbau_log; Aufgaben verlieren nur die Zuordnung
  insert into ws_protokoll (wer, was, details) values (auth.uid(), 'gruppe_geloescht', jsonb_build_object('gruppe', g.id, 'name', g.name, 'bereich', g.bereich_id));
end $$;
revoke all on function public.ws_gruppe_loeschen(text) from public, anon;
grant execute on function public.ws_gruppe_loeschen(text) to authenticated;

-- ---------- 2) Vorschläge im Konzept-Gespräch: FRAGEN und AUFTRAEGE ----------
create or replace function public.ws_vorschlag_ok(p_projekt text, v jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare x jsonb; o jsonb;
begin
  if v is null then return true; end if;
  if jsonb_typeof(v) <> 'object' then return false; end if;
  -- R) Rückfragen zum Anklicken: {"fragen":[{"frage","optionen":[…]}]} – 1–4 Fragen, je 2–5 Antworten
  if v ? 'fragen' then
    if exists (select 1 from jsonb_object_keys(v) k where k <> 'fragen') or jsonb_typeof(v->'fragen') <> 'array'
       or jsonb_array_length(v->'fragen') not between 1 and 4 then return false; end if;
    for x in select * from jsonb_array_elements(v->'fragen') loop
      if jsonb_typeof(x) <> 'object' or exists (select 1 from jsonb_object_keys(x) k where k not in ('frage','optionen')) then return false; end if;
      if coalesce(jsonb_typeof(x->'frage'), '') <> 'string' or char_length(x->>'frage') not between 3 and 300 then return false; end if;
      if coalesce(jsonb_typeof(x->'optionen'), '') <> 'array' or jsonb_array_length(x->'optionen') not between 2 and 5 then return false; end if;
      for o in select * from jsonb_array_elements(x->'optionen') loop
        if jsonb_typeof(o) <> 'string' or char_length(o #>> '{}') not between 1 and 120 then return false; end if;
      end loop;
    end loop;
    return true;
  end if;
  -- M) mehrere Aufträge: {"auftraege":[{gruppe_id, feature_id, titel, text, konzept}]} – 1–5, ohne offene Punkte
  if v ? 'auftraege' then
    if exists (select 1 from jsonb_object_keys(v) k where k <> 'auftraege') or jsonb_typeof(v->'auftraege') <> 'array'
       or jsonb_array_length(v->'auftraege') not between 1 and 5 then return false; end if;
    for x in select * from jsonb_array_elements(v->'auftraege') loop
      if jsonb_typeof(x) <> 'object' or exists (select 1 from jsonb_object_keys(x) k where k not in ('gruppe_id','feature_id','titel','text','konzept')) then return false; end if;
      if not (x ? 'gruppe_id') or not public.ws_vorschlag_ok(p_projekt, x) then return false; end if;
      if jsonb_typeof(x->'konzept') = 'object' and jsonb_typeof(x->'konzept'->'offen') = 'array' and jsonb_array_length(x->'konzept'->'offen') > 0 then return false; end if;
    end loop;
    return true;
  end if;
  -- 0) Wissen: {"wissen":{"kapitel","text"}}
  if v ? 'wissen' then
    if exists (select 1 from jsonb_object_keys(v) k where k <> 'wissen') or jsonb_typeof(v->'wissen') <> 'object'
       or exists (select 1 from jsonb_object_keys(v->'wissen') k where k not in ('kapitel','text')) then return false; end if;
    if coalesce(jsonb_typeof(v->'wissen'->'kapitel'), '') <> 'string' or coalesce(jsonb_typeof(v->'wissen'->'text'), '') <> 'string' then return false; end if;
    return (v->'wissen'->>'kapitel') in ('ziel','funktionen','daten','design','ablauf','offen','sonstiges')
       and char_length(v->'wissen'->>'text') between 3 and 2000;
  end if;
  -- a) neues Feature: {"feature_neu":{"gruppe_id","name","beschreibung"}}
  if v ? 'feature_neu' then
    if exists (select 1 from jsonb_object_keys(v) k where k <> 'feature_neu') or jsonb_typeof(v->'feature_neu') <> 'object'
       or exists (select 1 from jsonb_object_keys(v->'feature_neu') k where k not in ('gruppe_id','name','beschreibung')) then return false; end if;
    if coalesce(jsonb_typeof(v->'feature_neu'->'gruppe_id'), '') <> 'string' or coalesce(jsonb_typeof(v->'feature_neu'->'name'), '') <> 'string' then return false; end if;
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
  -- c) ein Auftrag (mit optionalem Konzept) wie bisher
  if exists (select 1 from jsonb_object_keys(v) k where k not in ('gruppe_id','feature_id','titel','text','konzept')) then return false; end if;
  if coalesce(jsonb_typeof(v->'gruppe_id'), '') <> 'string' or coalesce(jsonb_typeof(v->'titel'), '') <> 'string' or coalesce(jsonb_typeof(v->'text'), '') <> 'string' then return false; end if;
  if char_length(v->>'titel') not between 3 and 80 or char_length(v->>'text') not between 10 and 8000 then return false; end if;
  if public.ws_projekt_von_gruppe(v->>'gruppe_id') is distinct from p_projekt or public.ws_ist_konzept_gruppe(v->>'gruppe_id') then return false; end if;
  if v ? 'feature_id' and v->'feature_id' <> 'null'::jsonb then
    if jsonb_typeof(v->'feature_id') <> 'string' or not exists (select 1 from public.ws_features f where f.id = v->>'feature_id' and f.gruppe_id = v->>'gruppe_id') then return false; end if;
  end if;
  if not public.ws_konzept_ok(v->'konzept') then return false; end if;
  return true;
end $$;
revoke execute on function public.ws_vorschlag_ok(text, jsonb) from public, anon, authenticated;

-- Aufträge aus dem Konzept-Gespräch anlegen: nur aus dem gespeicherten (geprüften) Vorschlag, nur als die Person, die gefragt hat,
-- mit denselben Regeln wie beim Anlegen von Hand (Recht „auftraege“ je Gruppe, Texter nur Text-Aufträge).
-- Aufruf durch die Werkstatt direkt nach der Antwort (die KI „erledigt das“) oder per Knopf, falls das nicht ging.
create or replace function public.ws_konzept_auftraege_anlegen(p_antwort bigint) returns bigint[]
language plpgsql security definer set search_path = public as $$
declare a public.ws_claude_chat; f public.ws_claude_chat; x jsonb; k jsonb; ids bigint[] := '{}'; neu bigint; t text; n int;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into a from ws_claude_chat where id = p_antwort and frage_id is not null for update;
  if a.id is null or a.vorschlag is null or not (a.vorschlag ? 'auftraege') then raise exception 'Kein Auftrags-Vorschlag'; end if;
  if a.entscheidung is not null then return coalesce((select array_agg(e::bigint) from jsonb_array_elements_text(a.vorschlag->'angelegt') e), '{}'); end if;
  select * into f from ws_claude_chat where id = a.frage_id;
  if f.von is distinct from auth.uid() then raise exception 'Nur wer gefragt hat, legt die Aufträge an'; end if;
  if f.ort is distinct from 'konzept' then raise exception 'Aufträge legt die KI nur im Konzept-Gespräch selbst an'; end if;   -- Prüfung R2
  if not public.ws_darf_fragen(f.projekt_id) then raise exception 'Kein Zugriff mehr auf dieses Projekt'; end if;
  if exists (select 1 from ws_projekte where id = f.projekt_id and coalesce(archiviert, false)) then raise exception 'Das Projekt ist archiviert'; end if;
  if not public.ws_vorschlag_ok(f.projekt_id, a.vorschlag) then raise exception 'Der Vorschlag passt nicht mehr zum Projekt (Gruppe oder Feature geändert)'; end if;
  n := jsonb_array_length(a.vorschlag->'auftraege');
  -- Mengengrenze: höchstens 15 Aufträge je Person und Stunde aus dem Konzept-Gespräch
  perform pg_advisory_xact_lock(hashtext('konzept_auftrag:' || auth.uid()::text));
  if (select count(*) from ws_protokoll where wer = auth.uid() and was = 'konzept_auftrag' and wann > now() - interval '1 hour') + n > 15 then
    raise exception 'Höchstens 15 Aufträge je Stunde aus dem Konzept – bitte später „Aufträge anlegen“ klicken'; end if;
  for x in select * from jsonb_array_elements(a.vorschlag->'auftraege') loop
    if not public.ws_darf(public.ws_bereich_von_gruppe(x->>'gruppe_id'), 'auftraege') then
      raise exception 'Keine Berechtigung für Aufträge in der Gruppe %', x->>'gruppe_id'; end if;
    -- Steuer-, Richtungs- und unsichtbare Zeichen haben in Titel und Text nichts verloren (wie ws_design_auftrag, 0041 – Prüfung G1)
    if (x->>'titel') ~ '[[:cntrl:]\u200b-\u200f\u202a-\u202e\u2028\u2029\u2066-\u2069\ufeff]'
       or (x->>'text') ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u200b-\u200f\u202a-\u202e\u2028\u2029\u2066-\u2069\ufeff]'
       or coalesce(x->>'konzept', '') ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u200b-\u200f\u202a-\u202e\u2028\u2029\u2066-\u2069\ufeff]' then
      raise exception 'Ungültige Zeichen im Auftrag „%“', left(x->>'titel', 40); end if;
    k := x->'konzept';
    t := x->>'text';
    if jsonb_typeof(k) = 'object' then
      t := t || E'\n\n## Freigegebenes Konzept (' || to_char(now() at time zone 'Europe/Vienna', 'DD.MM.YYYY') || ')'
        || coalesce(E'\n**Ziel:** ' || (k->>'ziel'), '') || coalesce(E'\n**Umfang:** ' || (k->>'umfang'), '') || coalesce(E'\n**Datenschutz:** ' || (k->>'datenschutz'), '')
        || coalesce(E'\n**Entscheidungen:**\n' || (select string_agg('- ' || e, E'\n') from jsonb_array_elements_text(case when jsonb_typeof(k->'entscheidungen') = 'array' then k->'entscheidungen' else '[]' end) e), '')
        || coalesce(E'\n**Abnahme:**\n' || (select string_agg('- ' || e, E'\n') from jsonb_array_elements_text(case when jsonb_typeof(k->'abnahme') = 'array' then k->'abnahme' else '[]' end) e), '')
        || E'\n\nLege dieses Konzept zusätzlich als docs/konzepte/' || to_char(now(), 'YYYY-MM-DD') || '-'
        || coalesce(nullif(left(btrim(regexp_replace(lower(x->>'titel'), '[^a-z0-9]+', '-', 'g'), '-'), 40), ''), 'konzept') || '.md im Projekt ab (mit dem Bau-PR).';
    end if;
    t := t || E'\n\n(Aus dem Konzept-Gespräch angelegt – Chat-Antwort #' || a.id || ')';
    insert into ws_auftraege (gruppe_id, feature_id, titel, art, erstellt_von)
      values (x->>'gruppe_id', nullif(x->>'feature_id', ''), left(x->>'titel', 80),
              case when public.ws_rolle_fuer_gruppe(x->>'gruppe_id') = 'texter' then 'text' else 'aendern' end, auth.uid())
      returning id into neu;
    insert into ws_nachrichten (auftrag_id, von, art, text, kanal) values (neu, auth.uid(), 'text', left(t, 8000), 'codeschmiede');
    insert into ws_protokoll (wer, was, details) values (auth.uid(), 'konzept_auftrag', jsonb_build_object('projekt', f.projekt_id, 'antwort', a.id, 'auftrag', neu));
    ids := ids || neu;
  end loop;
  update ws_claude_chat set entscheidung = 'uebernommen', auftrag_id = ids[1], vorschlag = vorschlag || jsonb_build_object('angelegt', to_jsonb(ids)), geaendert = now() where id = a.id;
  return ids;
end $$;
revoke all on function public.ws_konzept_auftraege_anlegen(bigint) from public, anon;
grant execute on function public.ws_konzept_auftraege_anlegen(bigint) to authenticated;

-- Antwort der Werkstatt speichern (wie 0010) – FRAGEN und AUFTRAEGE nur im Konzept-Gespräch (Prüfung R2)
create or replace function public.ws_claude_chat_antwort(p_frage bigint, p_text text, p_vorschlag jsonb default null, p_fehler boolean default false)
returns bigint language plpgsql security definer set search_path = public as $$
declare f public.ws_claude_chat; a bigint;
begin
  select * into f from public.ws_claude_chat where id = p_frage and frage_id is null for update;
  if f.id is null then raise exception 'Frage nicht gefunden'; end if;
  if f.von is distinct from auth.uid() then raise exception 'Nur die eigene Werkstatt beantwortet eigene Fragen'; end if;
  if f.stand <> 'laeuft' then raise exception 'Frage ist nicht in Bearbeitung'; end if;
  if not public.ws_darf_fragen(f.projekt_id) then raise exception 'Kein Zugriff mehr auf dieses Projekt'; end if;
  if p_text is null or char_length(p_text) not between 1 and 8000 then raise exception 'Antwort fehlt oder ist zu lang'; end if;
  if p_vorschlag is not null and jsonb_typeof(p_vorschlag) = 'object' and (p_vorschlag ? 'fragen' or p_vorschlag ? 'auftraege') and f.ort is distinct from 'konzept' then p_vorschlag := null; end if;
  if p_fehler or pg_column_size(p_vorschlag) >= 16384 or not public.ws_vorschlag_ok(f.projekt_id, p_vorschlag) then p_vorschlag := null; end if;
  insert into public.ws_claude_chat (projekt_id, ort, frage_id, von, text, vorschlag, stand, werkstatt_pc)
    values (f.projekt_id, f.ort, f.id, null, p_text, p_vorschlag, 'beantwortet', f.werkstatt_pc) returning id into a;
  update public.ws_claude_chat set stand = case when p_fehler then 'fehler' else 'beantwortet' end, geaendert = now() where id = f.id;
  return a;
end $$;
revoke execute on function public.ws_claude_chat_antwort(bigint, text, jsonb, boolean) from public, anon;
grant execute on function public.ws_claude_chat_antwort(bigint, text, jsonb, boolean) to authenticated;

commit;
