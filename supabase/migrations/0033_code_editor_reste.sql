-- Codeschmiede · Datenbank v33: Restpunkte der Nachprüfung Code-Editor (2026-10-24)
-- Inhalte von Hand-Änderungen werden bei jedem Endstand gelöscht; Geheimnisse schon beim Speichern abgelehnt; nur die bauende Werkstatt
-- (oder der Admin) darf Inhalte löschen; Windows-Pfade (Punkt/Leerzeichen am Abschnittsende, reservierte Namen); CODEOWNERS nur Admin.
-- Mehrfach ausführbar. Reihenfolge 0001 → … → 0033.
begin;

create or replace function public.ws_code_pfad_ok(p text) returns boolean
language sql immutable set search_path = public as $$
  select p is not null and char_length(p) between 1 and 400
     and p !~ '(^|/)\.\.?(/|$)'
     and p !~ '^/' and p !~ '/$' and p !~ '//'
     and p !~ '[\x00-\x1f\\:*?"<>|]'
     and p !~ '(^|/)\.git(/|$)' and p !~ '^-'
     and p !~ '[ .](/|$)'                                           -- Punkt/Leerzeichen am Ende eines Abschnitts (Windows)
     and lower(p) !~ '(^|/)(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.[^/]*)?(/|$)'   -- reservierte Windows-Namen
$$;

-- Einfache Muster für Geheimnisse (wie lib/geheim.mjs, ohne die allgemeinen Zuweisungen)
create or replace function public.ws_code_hat_geheimnis(t text) returns boolean
language sql immutable set search_path = public as $$
  select t ~ 'sk-ant-[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sbp_[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\m(sk|rk)_live_[A-Za-z0-9]{10,}|AIza[0-9A-Za-z_-]{30,}|xox[bpas]-[A-Za-z0-9-]{10,}'
$$;
revoke execute on function public.ws_code_hat_geheimnis(text) from public, anon;
grant execute on function public.ws_code_hat_geheimnis(text) to authenticated;

alter table public.ws_code_aenderungen drop constraint if exists ws_code_aenderungen_geheim_check;
alter table public.ws_code_aenderungen add constraint ws_code_aenderungen_geheim_check check (not public.ws_code_hat_geheimnis(inhalt) and not public.ws_code_geheim(pfad)) not valid;

-- CODEOWNERS nur Admin: Prüfung als eigene Regel vor dem Einfügen (ergänzt die Liste in ws_code_hand_auftrag)
create or replace function public.ws_code_aenderungen_admin() returns trigger language plpgsql set search_path = public as $$
begin
  if not public.ws_ist_admin() and lower(new.pfad) ~ '(^|/)codeowners$' then raise exception 'Diese Datei ändert nur der Admin: %', new.pfad; end if;
  if public.ws_code_hat_geheimnis(new.inhalt) then raise exception 'In % steht vermutlich ein Geheimnis (Schlüssel, Token) – Geheimnisse gehören in die Umgebungsvariablen', new.pfad; end if;
  return new;
end $$;
drop trigger if exists ws_code_aenderungen_admin on public.ws_code_aenderungen;
create trigger ws_code_aenderungen_admin before insert on public.ws_code_aenderungen for each row execute function public.ws_code_aenderungen_admin();

-- Endstand eines Hand-Auftrags: gespeicherte Inhalte löschen
create or replace function public.ws_auftraege_hand_aufraeumen() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.hand and new.stand is distinct from old.stand and new.stand in ('abgebrochen','erledigt','frage') then
    delete from public.ws_code_aenderungen where auftrag_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists ws_auftraege_hand_aufraeumen on public.ws_auftraege;
create trigger ws_auftraege_hand_aufraeumen after update of stand on public.ws_auftraege for each row execute function public.ws_auftraege_hand_aufraeumen();
-- Nach dem Pull Request löscht die Werkstatt selbst (ws_code_aenderungen_erledigt).

create or replace function public.ws_code_aenderungen_erledigt(p_auftrag bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.ws_auftraege a where a.id = p_auftrag and a.hand
                  and (public.ws_ist_admin() or exists (select 1 from public.ws_werkstatt_pcs w where w.id = a.werkstatt_pc and w.benutzer_id = auth.uid()))) then
    raise exception 'Nur die Werkstatt, die diesen Auftrag baut';
  end if;
  delete from public.ws_code_aenderungen where auftrag_id = p_auftrag;
end $$;

-- Schon gespeicherte Inhalte abgeschlossener Hand-Aufträge entfernen
delete from public.ws_code_aenderungen c using public.ws_auftraege a where a.id = c.auftrag_id and a.stand not in ('wartet','laeuft');

commit;
