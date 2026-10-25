-- Codeschmiede · Datenbank 0040: Einrichtung › „Dieser PC“ (App-Designer 2.0, Fertigstellung mit voller Erlaubnis von Gerhard 2026-10-24 22:35/22:45).
--   * ws_werkstatt_pcs.faehigkeiten: was die Werkstatt auf diesem PC kann – nur feste Schlüssel, keine Pfade, keine Namen:
--       { plattform: win32|darwin|linux, windows_sandbox: bool, os_sandbox: macos|linux|null, dienst: "x.y.z" }
--     Die Werkstatt schreibt sie beim Anmelden selbst (eigene Zeile, bestehende Regel ws_pcs_eigene).
--   * ws_werkstatt_pc_entfernen(p_pc): alte bzw. abgeschaltete Werkstatt-PCs entfernt NUR der Admin. Ein PC, der in den letzten
--     15 Minuten ein Lebenszeichen gegeben hat und eingeschaltet ist, bleibt (sonst meldet er sich sofort wieder an). Protokoll in ws_protokoll.
--     Abhängige Einträge folgen den bestehenden Fremdschlüsseln (Kopplungen/Sandbox-Aufträge dieses PCs fallen weg, Verweise werden leer).
-- Mehrfach ausführbar. Reihenfolge 0001 → … → 0040.
begin;

create or replace function public.ws_pc_faehigkeiten_ok(p jsonb) returns boolean
language sql immutable set search_path = public as $$
  select p is null or (
    jsonb_typeof(p) = 'object' and pg_column_size(p) <= 1000
    and not exists (select 1 from jsonb_object_keys(p) k where k not in ('plattform', 'windows_sandbox', 'os_sandbox', 'dienst'))
    and (not p ? 'plattform' or (jsonb_typeof(p -> 'plattform') = 'string' and p ->> 'plattform' in ('win32', 'darwin', 'linux')))
    and (not p ? 'windows_sandbox' or jsonb_typeof(p -> 'windows_sandbox') = 'boolean')
    and (not p ? 'os_sandbox' or jsonb_typeof(p -> 'os_sandbox') = 'null' or (jsonb_typeof(p -> 'os_sandbox') = 'string' and p ->> 'os_sandbox' in ('macos', 'linux')))
    and (not p ? 'dienst' or (jsonb_typeof(p -> 'dienst') = 'string' and p ->> 'dienst' ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$')))
$$;

alter table public.ws_werkstatt_pcs add column if not exists faehigkeiten jsonb;
alter table public.ws_werkstatt_pcs drop constraint if exists ws_werkstatt_pcs_faehigkeiten_ok;
alter table public.ws_werkstatt_pcs add constraint ws_werkstatt_pcs_faehigkeiten_ok check (public.ws_pc_faehigkeiten_ok(faehigkeiten));

create or replace function public.ws_werkstatt_pc_entfernen(p_pc uuid) returns void
language plpgsql security definer set search_path = public as $$
declare w public.ws_werkstatt_pcs%rowtype;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if not public.ws_ist_admin() then raise exception 'Werkstatt-PCs entfernt nur der Admin'; end if;
  select * into w from public.ws_werkstatt_pcs where id = p_pc;
  if not found then raise exception 'Werkstatt-PC nicht gefunden'; end if;
  if w.an and w.zuletzt > now() - interval '15 minutes' then
    raise exception 'Dieser PC ist gerade eingeschaltet – erst die Werkstatt dort ausschalten (oder 15 Minuten warten)';
  end if;
  delete from public.ws_werkstatt_pcs where id = p_pc;
  insert into public.ws_protokoll (wer, was, details)
    values (auth.uid(), 'pc_entfernt', jsonb_build_object('pc', p_pc, 'name', left(w.name, 80), 'benutzer', w.benutzer_id, 'zuletzt', w.zuletzt));
end $$;
revoke execute on function public.ws_werkstatt_pc_entfernen(uuid) from public, anon;
grant execute on function public.ws_werkstatt_pc_entfernen(uuid) to authenticated;

commit;
