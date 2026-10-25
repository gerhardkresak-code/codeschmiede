-- Codeschmiede 0.9.13 · Programmierstunden – Nachbesserung nach der Prüfung (26.10.2026). Mehrfach ausführbar.
--  4  Laufzeit (laeuft_seit, laufzeit_min) setzt nur die Datenbank – Eingaben von außen werden bei JEDER Änderung ignoriert
--  5  Stille-Schalter für das Aufbau-Protokoll wird wiederhergestellt statt geleert
--  6  Neue gemessene Laufzeit erscheint als Aufbau-Änderung (Banner „In die App übernehmen“), damit die ERP-Kalkulation aktuell bleibt
begin;
create or replace function public.ws_auftrag_laufzeit() returns trigger
language plpgsql security definer set search_path = public as $$
declare m numeric; alt text; p text; fname text;
begin
  -- nie von außen setzbar
  new.laeuft_seit := old.laeuft_seit; new.laufzeit_min := old.laufzeit_min;
  if new.stand = 'laeuft' and old.stand is distinct from 'laeuft' then new.laeuft_seit := now(); end if;
  if old.stand = 'laeuft' and new.stand is distinct from 'laeuft' and old.laeuft_seit is not null then
    m := least(480, greatest(0, extract(epoch from (now() - old.laeuft_seit)) / 60));
    new.laufzeit_min := coalesce(old.laufzeit_min, 0) + round(m, 1);
    new.laeuft_seit := null;
    if new.feature_id is not null and m >= 1 then
      alt := coalesce(current_setting('cs.aufbau_still', true), '');
      perform set_config('cs.aufbau_still', 'an', true);
      update ws_features set stunden_gemessen = stunden_gemessen + round(m / 60, 2) where id = new.feature_id returning name into fname;
      perform set_config('cs.aufbau_still', alt, true);
      p := (select b.projekt_id from ws_gruppen g join ws_bereiche b on b.id = g.bereich_id where g.id = new.gruppe_id);
      if p is not null and (select aufbau_datei from ws_projekte where id = p) is not null then
        insert into ws_aufbau_aenderungen (projekt_id, art, text, details) values (p, 'feature_daten',
          'Feature ' || new.feature_id || ' „' || coalesce(fname, '?') || '“: +' || replace(round(m / 60, 1)::text, '.', ',') || ' h gemessen (Auftrag #' || new.id || ')',
          jsonb_build_object('feature', new.feature_id, 'auftrag', new.id));
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists ws_auftrag_laufzeit on public.ws_auftraege;
create trigger ws_auftrag_laufzeit before update on public.ws_auftraege for each row execute function public.ws_auftrag_laufzeit();
revoke all on function public.ws_auftrag_laufzeit() from public, anon, authenticated;
commit;
