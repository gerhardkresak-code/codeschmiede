-- Codeschmiede 0.9.14 · Hängende Aufträge abbrechen (Meldung Gerhard 26.10.2026 09:11 „kann die Anfrage nicht ablehnen“)
-- Auftrag #18 stand nach einem Neustart der Werkstatt in „In Arbeit“, obwohl niemand mehr daran arbeitete – Abbrechen lehnte die Datenbank ab.
-- Jetzt: „In Arbeit“ lässt sich abbrechen, wenn seit 3 Minuten nichts mehr vom Werkstatt-PC kam (kein Live-Protokoll) oder der PC aus ist.
-- (Die Werkstatt meldet solche Aufträge beim nächsten Start außerdem selbst als Rückfrage.) Mehrfach ausführbar.
begin;
create or replace function public.ws_auftrag_abbrechen(p_auftrag bigint, p_grund text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ws_auftraege; zuletzt timestamptz; pc_an boolean;
begin
  select * into a from public.ws_auftraege where id = p_auftrag for update;
  if a.id is null then raise exception 'Auftrag nicht gefunden'; end if;
  if not (public.ws_ist_admin() or a.erstellt_von = auth.uid()) then raise exception 'Abbrechen dürfen der Admin und wer den Auftrag erteilt hat'; end if;
  if a.stand = 'laeuft' then
    select max(erstellt) into zuletzt from public.ws_live_log where auftrag_id = a.id;
    select an into pc_an from public.ws_werkstatt_pcs where id = a.werkstatt_pc;
    if coalesce(pc_an, false) and coalesce(greatest(zuletzt, a.laeuft_seit), now()) > now() - interval '3 minutes' then
      raise exception 'Die Werkstatt arbeitet gerade daran – bitte kurz warten, dann abbrechen'; end if;
  elsif a.stand not in ('wartet','frage','nacharbeit','freigabe') then
    raise exception 'Dieser Auftrag lässt sich nicht mehr abbrechen (Stand: %)', a.stand;
  end if;
  update public.ws_auftraege set stand = 'abgebrochen' where id = p_auftrag;
  insert into public.ws_nachrichten (auftrag_id, von, art, text)
    values (p_auftrag, null, 'system', 'Auftrag abgebrochen' || coalesce(' – ' || nullif(left(btrim(p_grund), 300), ''), '') || '.');
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'auftrag_abgebrochen', jsonb_build_object('auftrag', p_auftrag, 'stand_vorher', a.stand, 'pr', a.pr_nummer));
end $$;
revoke execute on function public.ws_auftrag_abbrechen(bigint, text) from public, anon;
grant execute on function public.ws_auftrag_abbrechen(bigint, text) to authenticated;
commit;
