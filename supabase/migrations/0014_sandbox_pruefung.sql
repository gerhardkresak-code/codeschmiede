-- Codeschmiede · Datenbank v14: Prüfungen durch fremde KI-Anbieter mit Sandbox (Gerhard 2026-10-23 15:53 „Punkt 1–6 fertig machen“)
-- Die Datenbank erlaubt wieder fremde Anbieter für „pruefung“ (Entscheidung 14:27). Ob sie wirklich prüfen, entscheidet die Werkstatt:
-- nur auf PCs mit Betriebssystem-Sandbox (macOS sandbox-exec, Linux bubblewrap); sonst prüft Claude. Bauen bleibt fest Claude.
-- Mehrfach ausführbar. Reihenfolge 0001 → … → 0014.
begin;
create or replace function public.ws_ki_reihe_ok(p_aufgabe text, r jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare e jsonb;
begin
  if p_aufgabe not in ('chat','konzept','design','pruefung','doku','texte','bilder','bauen') then return false; end if;
  if r is null or jsonb_typeof(r) <> 'array' or jsonb_array_length(r) not between 1 and 6 then return false; end if;
  for e in select * from jsonb_array_elements(r) loop
    if jsonb_typeof(e) <> 'object' or exists (select 1 from jsonb_object_keys(e) k where k not in ('anbieter','modell')) then return false; end if;
    if (e->>'anbieter') is null or (e->>'anbieter') not in ('claude','chatgpt','gemini') then return false; end if;
    if e ? 'modell' and (jsonb_typeof(e->'modell') <> 'string' or (e->>'modell') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,59}$') then return false; end if;
  end loop;
  if (select count(distinct x->>'anbieter') from jsonb_array_elements(r) x) <> jsonb_array_length(r) then return false; end if;
  -- Bauen nie durch einen anderen Anbieter (Gerhard 2026-10-23 14:27: „NEIN NIE“)
  if p_aufgabe = 'bauen' and (jsonb_array_length(r) <> 1 or r->0->>'anbieter' <> 'claude') then return false; end if;
  -- Prüfungen: Claude muss als Rückfall in der Reihe stehen (PCs ohne Sandbox prüfen immer mit Claude)
  if p_aufgabe = 'pruefung' and not exists (select 1 from jsonb_array_elements(r) x where x->>'anbieter' = 'claude') then return false; end if;
  return true;
end $$;
revoke execute on function public.ws_ki_reihe_ok(text, jsonb) from public, anon;
commit;
