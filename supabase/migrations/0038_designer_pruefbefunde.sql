-- Codeschmiede · Datenbank 0038: App-Designer 2.0 – Prüfbefunde der Sicherheitsprüfung zu Etappe 1 (GRÜN, 2026-10-24).
-- 0037 hat „bausteine“ in ws_design_werte_ok aufgenommen, damit der Baustein-Chat seine Werte als Kontext mitschicken kann.
-- Damit ließen sich Baustein-Werte aber auch in Grunddesign-Entwürfen (ws_design_entwuerfe) speichern – die gehören dort nicht hin:
-- das Aussehen der Bausteine liegt ausschließlich im Design-Paket der App. Jetzt: ws_design_speichern lehnt „bausteine“ ab und eine
-- Bedingung schützt die Tabelle (auch beim Anlegen per insert). Vorhandene Zeilen bleiben unberührt (not valid).
-- Mehrfach ausführbar. Reihenfolge 0001 → … → 0038.
begin;

alter table public.ws_design_entwuerfe drop constraint if exists ws_design_entwuerfe_ohne_bausteine;
alter table public.ws_design_entwuerfe add constraint ws_design_entwuerfe_ohne_bausteine check (not (werte ? 'bausteine')) not valid;

create or replace function public.ws_design_speichern(p_entwurf bigint, p_werte jsonb, p_name text default null, p_notiz text default null)
returns int language plpgsql security definer set search_path = public as $$
declare e public.ws_design_entwuerfe; n int;
begin
  select * into e from public.ws_design_entwuerfe where id = p_entwurf for update;
  if e.id is null then raise exception 'Entwurf nicht gefunden'; end if;
  if not public.ws_darf_design(e.projekt_id) then raise exception 'Keine Berechtigung für das Design dieses Projekts'; end if;
  if e.erstellt_von <> auth.uid() and not public.ws_ist_admin() then raise exception 'Nur der eigene Entwurf ist änderbar'; end if;
  if e.stand <> 'entwurf' then raise exception 'Gesendete Entwürfe sind fest – lege eine Kopie an'; end if;
  if pg_column_size(p_werte) >= 65536 or not public.ws_design_werte_ok(p_werte) then raise exception 'Ungültige Design-Werte'; end if;
  -- Baustein-Werte gehören ins Design-Paket der App, nicht in den Grunddesign-Entwurf (Prüfbefund Etappe 1)
  if p_werte ? 'bausteine' then raise exception 'Baustein-Werte werden im Design-Paket der App gespeichert, nicht im Grunddesign'; end if;
  n := e.version + 1;
  if n > 300 then raise exception 'Zu viele Versionen – lege eine Kopie an'; end if;
  update public.ws_design_entwuerfe set werte = p_werte, version = n,
    name = coalesce(nullif(trim(p_name), ''), name), notiz = coalesce(p_notiz, notiz), geaendert = now() where id = p_entwurf;
  insert into public.ws_design_versionen (entwurf_id, nr, werte, erstellt_von) values (p_entwurf, n, p_werte, auth.uid());
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'design_speichern', jsonb_build_object('entwurf', p_entwurf, 'version', n));
  return n;
end $$;
revoke execute on function public.ws_design_speichern(bigint, jsonb, text, text) from public, anon;
grant execute on function public.ws_design_speichern(bigint, jsonb, text, text) to authenticated;

commit;
