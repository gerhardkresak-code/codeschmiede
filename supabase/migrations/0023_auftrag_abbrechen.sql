-- Codeschmiede · Datenbank v23: Auftrag abbrechen (Gerhard 2026-10-23 19:02/19:08 – eine offene Rückfrage ließ sich nicht schließen,
-- dadurch ließ sich das Projekt nicht löschen; „Brich ab“ im Chat hat die Werkstatt nicht als Abbruch verstanden).
-- Abbrechen dürfen der Admin und wer den Auftrag erteilt hat – solange er wartet, eine Rückfrage offen ist, Nacharbeit oder Freigabe ansteht.
-- Läuft die Werkstatt gerade, geht es nicht (sie würde den Stand sonst überschreiben). Ein offener Pull Request bleibt bei GitHub bestehen.
-- Mehrfach ausführbar. Reihenfolge 0001 → … → 0023.
begin;

create or replace function public.ws_auftrag_abbrechen(p_auftrag bigint, p_grund text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ws_auftraege;
begin
  select * into a from public.ws_auftraege where id = p_auftrag for update;
  if a.id is null then raise exception 'Auftrag nicht gefunden'; end if;
  if not (public.ws_ist_admin() or a.erstellt_von = auth.uid()) then raise exception 'Abbrechen dürfen der Admin und wer den Auftrag erteilt hat'; end if;
  if a.stand = 'laeuft' then raise exception 'Die Werkstatt arbeitet gerade daran – bitte kurz warten, dann abbrechen'; end if;
  if a.stand not in ('wartet','frage','nacharbeit','freigabe') then raise exception 'Dieser Auftrag lässt sich nicht mehr abbrechen (Stand: %)', a.stand; end if;
  update public.ws_auftraege set stand = 'abgebrochen' where id = p_auftrag;
  insert into public.ws_nachrichten (auftrag_id, von, art, text)
    values (p_auftrag, null, 'system', 'Auftrag abgebrochen' || coalesce(' – ' || nullif(left(btrim(p_grund), 300), ''), '') || '.');
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'auftrag_abgebrochen', jsonb_build_object('auftrag', p_auftrag, 'stand_vorher', a.stand, 'pr', a.pr_nummer));
end $$;
revoke execute on function public.ws_auftrag_abbrechen(bigint, text) from public, anon;
grant execute on function public.ws_auftrag_abbrechen(bigint, text) to authenticated;

commit;
