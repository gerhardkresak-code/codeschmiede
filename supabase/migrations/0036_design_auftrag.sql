-- Codeschmiede · Datenbank v36: Aufträge aus dem App-Designer atomar anlegen (Fehlerkorrektur 0.9.5, Analyse App-Designer mit Gerhard 2026-10-24 21:24)
-- Bisher legte der Designer („Neuer Baustein“, „Kachel-Art wünschen“) zuerst den Auftrag und danach die Nachricht an. Dazwischen
-- konnte die Werkstatt den Auftrag schon holen (Stand „wartet“) und ohne Beschreibung starten. Jetzt legt eine Funktion Auftrag
-- und erste Nachricht in EINEM Schritt an (gleiches Muster wie ws_design_senden aus 0007). Rechte wie bisher: nur wer in der
-- Design-Gruppe des Projekts gestalten darf (ws_darf_design). Mehrfach ausführbar. Reihenfolge 0001 → … → 0036.
begin;

create or replace function public.ws_design_auftrag(p_projekt text, p_art text, p_titel text, p_text text) returns bigint
language plpgsql security definer set search_path = public as $$
declare g text; a bigint; t text; x text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if p_art is null or p_art not in ('baustein','kachel') then raise exception 'Unbekannte Auftragsart'; end if;
  if not public.ws_darf_design(p_projekt) then raise exception 'Keine Berechtigung für das Design dieses Projekts'; end if;
  t := btrim(coalesce(p_titel, '')); x := btrim(coalesce(p_text, ''));
  if char_length(t) not between 2 and 80 then raise exception 'Name fehlt oder ist zu lang (höchstens 80 Zeichen)'; end if;
  if char_length(x) not between 10 and 8000 then raise exception 'Beschreibung fehlt oder ist zu lang (10 bis 8000 Zeichen)'; end if;
  -- Steuerzeichen (außer Zeilenumbruch und Tabulator) haben im Titel und Text nichts verloren
  -- dazu C1-Steuerzeichen, Richtungs- und unsichtbare Zeichen (Verschleierung, Prüfung 2026-10-24)
  if t ~ '[[:cntrl:]\u200b-\u200f\u202a-\u202e\u2028\u2029\u2066-\u2069\ufeff]'
     or x ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u200b-\u200f\u202a-\u202e\u2028\u2029\u2066-\u2069\ufeff]' then raise exception 'Ungültige Zeichen'; end if;
  select design_gruppe_id into g from public.ws_projekte where id = p_projekt and not coalesce(archiviert, false);
  if not found then raise exception 'Projekt nicht gefunden oder archiviert'; end if;
  if g is null then raise exception 'Der App-Designer ist für dieses Projekt noch nicht eingerichtet'; end if;
  t := left(case p_art when 'baustein' then 'Neuer Baustein: ' else 'Neue Kachel für den Seiten-Designer: ' end || t, 80);
  insert into public.ws_auftraege (gruppe_id, titel, art, erstellt_von) values (g, t, 'neu', auth.uid()) returning id into a;
  insert into public.ws_nachrichten (auftrag_id, von, art, text, kanal) values (a, auth.uid(), 'text', x, 'codeschmiede');
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'design_auftrag', jsonb_build_object('projekt', p_projekt, 'art', p_art, 'auftrag', a));
  return a;
end $$;

revoke execute on function public.ws_design_auftrag(text, text, text, text) from public, anon;
grant execute on function public.ws_design_auftrag(text, text, text, text) to authenticated;

commit;
