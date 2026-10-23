-- Codeschmiede · Datenbank v29: Abo-Limits je KI (Gerhard 2026-10-23 23:38, „So bauen“)
-- Je Kopplung (PC + Anbieter): Limit-Fenster, die der Anbieter selbst meldet (heute nur ChatGPT/Codex; Claude steht weiter in ws_abo_limits),
-- und die Zahl der Anfragen der Werkstatt heute. Nur Zahlen und Zeiten – keine Texte. Mehrfach ausführbar. Reihenfolge 0001 → … → 0029.
begin;

create or replace function public.ws_ki_limits_ok(w jsonb) returns boolean
language sql immutable set search_path = public as $$
  select w is null or (jsonb_typeof(w) = 'array' and jsonb_array_length(w) <= 4 and not exists (
    select 1 from jsonb_array_elements(w) e
     where jsonb_typeof(e) <> 'object'
        or exists (select 1 from jsonb_object_keys(e) k where k not in ('art','prozent','reset'))
        or coalesce(e ->> 'art', '') not in ('5std','woche','tag','fenster')
        or jsonb_typeof(e -> 'prozent') <> 'number' or (e ->> 'prozent')::numeric not between 0 and 100
        or (e ? 'reset' and jsonb_typeof(e -> 'reset') not in ('string','null'))
        or (jsonb_typeof(e -> 'reset') = 'string' and (e ->> 'reset') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$')))
$$;
revoke execute on function public.ws_ki_limits_ok(jsonb) from public, anon;
grant execute on function public.ws_ki_limits_ok(jsonb) to authenticated;

alter table public.ws_ki_kopplung add column if not exists limits jsonb;
alter table public.ws_ki_kopplung add column if not exists limits_zeit timestamptz;
alter table public.ws_ki_kopplung add column if not exists anfragen_heute int;
alter table public.ws_ki_kopplung add column if not exists anfragen_tag date;
alter table public.ws_ki_kopplung drop constraint if exists ws_ki_kopplung_limits_check;
alter table public.ws_ki_kopplung add constraint ws_ki_kopplung_limits_check check (public.ws_ki_limits_ok(limits));
alter table public.ws_ki_kopplung drop constraint if exists ws_ki_kopplung_anfragen_check;
alter table public.ws_ki_kopplung add constraint ws_ki_kopplung_anfragen_check check (anfragen_heute is null or anfragen_heute between 0 and 100000);

grant insert (limits, limits_zeit, anfragen_heute, anfragen_tag), update (limits, limits_zeit, anfragen_heute, anfragen_tag) on public.ws_ki_kopplung to authenticated;

commit;
