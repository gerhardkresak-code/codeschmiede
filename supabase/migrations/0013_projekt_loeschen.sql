-- Codeschmiede · Datenbank v13: Projekte archivieren und löschen (Hinweis Gerhard 2026-10-23 15:34 „angelegte neue Projekte nicht löschen“)
-- Nur Admin. Archivieren blendet ein Projekt aus (umkehrbar). Endgültig löschen entfernt alle Daten des Projekts IN DER CODESCHMIEDE
-- (Bereiche, Gruppen, Features, Aufträge mit Verlauf, Chats, Designer, Abgleich, KI-Zuständigkeiten, Verbrauch) – nach Eingabe des
-- Projektnamens. Das GitHub-Repository und die App selbst bleiben unberührt. Nicht möglich, solange ein Auftrag läuft oder geprüft wird.
-- Mehrfach ausführbar. Reihenfolge 0001 → … → 0013.

begin;

create or replace function public.ws_projekt_umfang(p_projekt text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'Nur der Admin'; end if;
  return jsonb_build_object(
    'gruppen', (select count(*) from public.ws_gruppen g join public.ws_bereiche b on b.id = g.bereich_id where b.projekt_id = p_projekt),
    'features', (select count(*) from public.ws_features f join public.ws_gruppen g on g.id = f.gruppe_id join public.ws_bereiche b on b.id = g.bereich_id where b.projekt_id = p_projekt),
    'auftraege', (select count(*) from public.ws_auftraege a join public.ws_gruppen g on g.id = a.gruppe_id join public.ws_bereiche b on b.id = g.bereich_id where b.projekt_id = p_projekt),
    'laufend', (select count(*) from public.ws_auftraege a join public.ws_gruppen g on g.id = a.gruppe_id join public.ws_bereiche b on b.id = g.bereich_id
                where b.projekt_id = p_projekt and a.stand in ('laeuft','sicherheit','feature')),
    'mitglieder', (select count(*) from public.ws_projekt_mitglieder where projekt_id = p_projekt));
end $$;

create or replace function public.ws_projekt_archivieren(p_projekt text, p_aus boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'Projekte archiviert nur der Admin'; end if;
  update public.ws_projekte set archiviert = p_aus where id = p_projekt;
  if not found then raise exception 'Projekt nicht gefunden'; end if;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), case when p_aus then 'projekt_archiviert' else 'projekt_wiederhergestellt' end, jsonb_build_object('projekt', p_projekt));
end $$;

create or replace function public.ws_projekt_loeschen(p_projekt text, p_bestaetigung text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.ws_projekte; umfang jsonb; bids text[]; gids text[];
begin
  if not public.ws_ist_admin() then raise exception 'Projekte löscht nur der Admin'; end if;
  select * into p from public.ws_projekte where id = p_projekt for update;
  if p.id is null then raise exception 'Projekt nicht gefunden'; end if;
  if p_bestaetigung is distinct from p.name then raise exception 'Zur Bestätigung genau den Projektnamen „%“ eingeben', p.name; end if;
  umfang := public.ws_projekt_umfang(p_projekt);
  if (umfang->>'laufend')::int > 0 then raise exception 'Es läuft noch ein Auftrag oder eine Prüfung – erst abschließen oder abbrechen'; end if;

  select coalesce(array_agg(id), '{}') into bids from public.ws_bereiche where projekt_id = p_projekt;
  select coalesce(array_agg(id), '{}') into gids from public.ws_gruppen where bereich_id = any(bids);

  update public.ws_projekte set design_gruppe_id = null where id = p_projekt;
  delete from public.ws_claude_chat where projekt_id = p_projekt;
  delete from public.ws_design_chat where projekt_id = p_projekt;
  delete from public.ws_design_entwuerfe where projekt_id = p_projekt;
  delete from public.ws_verbrauch where projekt_id = p_projekt;
  delete from public.ws_auftraege where gruppe_id = any(gids);            -- Nachrichten, Live-Log, Erlaubnisse fallen mit
  delete from public.ws_features where gruppe_id = any(gids);
  delete from public.ws_rechte where bereich_id = any(bids);
  delete from public.ws_gruppen where id = any(gids);
  delete from public.ws_bereiche where id = any(bids);
  delete from public.ws_einladungen where projekt_id = p_projekt;
  delete from public.ws_projekte where id = p_projekt;                     -- Mitglieder, Abgleich, KI-Zuständigkeiten fallen mit

  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'projekt_geloescht', jsonb_build_object('projekt', p_projekt, 'name', p.name, 'umfang', umfang));
  return umfang;
end $$;

revoke execute on function public.ws_projekt_umfang(text), public.ws_projekt_archivieren(text, boolean), public.ws_projekt_loeschen(text, text) from public, anon;
grant execute on function public.ws_projekt_umfang(text), public.ws_projekt_archivieren(text, boolean), public.ws_projekt_loeschen(text, text) to authenticated;

commit;
