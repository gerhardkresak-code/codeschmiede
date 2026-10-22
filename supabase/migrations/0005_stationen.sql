-- Codeschmiede · Datenbank v5: Stationen bis live (Entwurf 0.7, freigegeben von Gerhard 2026-10-22 20:41)
-- Weg: wartet → laeuft → freigabe → sicherheit (automatisch, Admin-PC) → zusammen (wartet auf Klick „Zusammenführen“)
--      → feature (Testfassung + Prüfung des ganzen Features, automatisch) → wissen (live & Wissen).
-- Rot in einer Prüfung → nacharbeit (Werkstatt arbeitet den Befund ab, danach wieder freigabe).
-- Reine Fragen ohne Änderung → erledigt (abgeschlossen, ohne Zweig).
-- Mehrfach ausführbar. Reihenfolge 0001 → 0002 → 0003 → 0004 → 0005.

begin;

-- ---------- Stände ----------
alter table public.ws_auftraege drop constraint if exists ws_auftraege_stand_check;
alter table public.ws_auftraege add constraint ws_auftraege_stand_check
  check (stand in ('wartet','laeuft','frage','freigabe','sicherheit','zusammen','feature','wissen','nacharbeit','erledigt','abgebrochen'));

-- Prüfergebnisse je Station: {"lokal":{...},"sicherheit":{...},"feature":{...}} mit ergebnis gruen|rot|laeuft, befund, zeit, pc
alter table public.ws_auftraege add column if not exists pruefung jsonb not null default '{}'::jsonb;
alter table public.ws_auftraege add column if not exists letzter_commit text;   -- zuletzt hochgeladener Stand (für die Live-Vorschau)
alter table public.ws_auftraege add column if not exists live_commit text;      -- Stand, mit dem der Auftrag live gegangen ist
-- Zweignamen nur in der Form der Werkstatt (verhindert Git-Optionen wie „--upload-pack=…“ als Zweigname)
alter table public.ws_auftraege drop constraint if exists ws_auftraege_zweig_check;
alter table public.ws_auftraege add constraint ws_auftraege_zweig_check check (zweig is null or zweig ~ '^feature/cs-[0-9]+-[a-z0-9-]{1,40}$');

-- Vorschau je Projekt: Testseiten der Zweige (Cloudflare Pages) und die echte App
alter table public.ws_projekte add column if not exists vorschau_domain text
  check (vorschau_domain is null or vorschau_domain ~ '^[a-z0-9-]+\.pages\.dev$');
alter table public.ws_projekte add column if not exists live_url text
  check (live_url is null or live_url ~ '^https://[A-Za-z0-9.-]+(/.*)?$');
grant update (vorschau_domain, live_url) on public.ws_projekte to authenticated;
update public.ws_projekte set vorschau_domain = 'trainer-to-go.pages.dev', live_url = 'https://trainer-to-go.pages.dev'
  where id = 'trainer-to-go' and vorschau_domain is null;

-- Herkunft einer Nachricht: Codeschmiede (Feature-Chat), Gruppen-Chat oder Claude-Chat (nur Claude selbst, nicht über die App)
alter table public.ws_nachrichten add column if not exists kanal text not null default 'codeschmiede';
alter table public.ws_nachrichten drop constraint if exists ws_nachrichten_kanal_check;
alter table public.ws_nachrichten add constraint ws_nachrichten_kanal_check check (kanal in ('codeschmiede','gruppe','claude-chat'));

drop policy if exists ws_nachrichten_neu on public.ws_nachrichten;
create policy ws_nachrichten_neu on public.ws_nachrichten for insert to authenticated
  with check (kanal <> 'claude-chat' and (
    (von = auth.uid() and art = 'text' and exists (select 1 from public.ws_auftraege a where a.id = auftrag_id and public.ws_darf(public.ws_bereich_von_gruppe(a.gruppe_id), 'auftraege')))
    or (von is null and art <> 'system' and exists (select 1 from public.ws_auftraege a where a.id = auftrag_id and public.ws_ist_werkstatt_fuer(a.gruppe_id)))));

-- ---------- Schutz der Stände ----------
-- Prüf- und Live-Stände (sicherheit, zusammen, feature, wissen) setzt nur der Admin-PC (Admin-Konto) bzw. die Funktionen unten.
-- Feature-Zuordnung: Admin jederzeit; Werkstatt darf ein noch fehlendes Feature einmalig setzen (Feature aus demselben Projekt).
create or replace function public.ws_auftraege_schutz() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and not public.ws_ist_admin() then
    if (new.gruppe_id, new.erstellt_von, new.erstellt, new.art, new.baustein)
         is distinct from (old.gruppe_id, old.erstellt_von, old.erstellt, old.art, old.baustein)
    then raise exception 'Dieses Feld ist nicht änderbar'; end if;
    if new.feature_id is distinct from old.feature_id and not (
         old.feature_id is null and public.ws_ist_werkstatt_fuer(old.gruppe_id)
         and public.ws_projekt_von_feature(new.feature_id) = public.ws_projekt_von_gruppe(old.gruppe_id))
    then raise exception 'Das Feature eines Auftrags ändert nur der Admin'; end if;
    if (old.stand in ('sicherheit','zusammen','feature','wissen') or new.stand in ('sicherheit','zusammen','feature','wissen'))
       and new.stand is distinct from old.stand
    then raise exception 'Dieser Stand wird nur auf dem Admin-PC gesetzt'; end if;
    -- Nach der Freigabe sind Zweig, Pull Request und Stand fest (Prüfung 2026-10-22, R1)
    if old.stand in ('sicherheit','zusammen','feature','wissen')
       and (new.zweig, new.pr_nummer, new.letzter_commit) is distinct from (old.zweig, old.pr_nummer, old.letzter_commit)
    then raise exception 'Zweig und Pull Request sind nach der Freigabe fest'; end if;
    -- „lokal“ (Bauen & Tests auf dem Werkstatt-PC vor der Freigabe) darf jede Werkstatt schreiben, die Stationen nur der Admin-PC
    if (new.pruefung - 'lokal', new.live_commit) is distinct from (old.pruefung - 'lokal', old.live_commit)
    then raise exception 'Prüfergebnisse schreibt nur der Admin-PC'; end if;
  end if;
  if new.stand = 'freigabe' and new.stand is distinct from old.stand and (new.pr_nummer is null or new.zweig is null)
  then raise exception 'Zur Freigabe braucht es einen Pull Request'; end if;
  return new;
end $$;

drop policy if exists ws_auftraege_werkstatt on public.ws_auftraege;
create policy ws_auftraege_werkstatt on public.ws_auftraege for update to authenticated
  using (public.ws_ist_werkstatt_fuer(gruppe_id))
  with check (public.ws_ist_werkstatt_fuer(gruppe_id)
              and stand in ('wartet','laeuft','frage','freigabe','sicherheit','zusammen','feature','wissen','nacharbeit','erledigt','abgebrochen'));

-- ---------- Aktionen ----------
-- Freigeben: nur Admin oder Recht „freigeben“; aus „freigabe“ → „sicherheit“ (Sicherheitsprüfung startet automatisch)
create or replace function public.ws_freigeben(p_auftrag bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ws_auftraege;
begin
  select * into a from public.ws_auftraege where id = p_auftrag for update;
  if a.id is null then raise exception 'Auftrag nicht gefunden'; end if;
  if not public.ws_darf(public.ws_bereich_von_gruppe(a.gruppe_id), 'freigeben') then
    raise exception 'Keine Berechtigung zum Freigeben in diesem Bereich';
  end if;
  if a.stand <> 'freigabe' then raise exception 'Auftrag ist nicht zur Freigabe bereit'; end if;
  if a.pr_nummer is null or a.zweig is null then raise exception 'Kein Pull Request hinterlegt'; end if;
  update public.ws_auftraege set stand = 'sicherheit', pruefung = pruefung - 'sicherheit' - 'feature', geaendert = now() where id = p_auftrag;
  insert into public.ws_nachrichten (auftrag_id, von, art, text) values (p_auftrag, auth.uid(), 'system', 'Freigegeben – Sicherheitsprüfung startet');
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'freigeben', jsonb_build_object('auftrag', p_auftrag, 'zweig', a.zweig, 'pr', a.pr_nummer));
end $$;

-- Zusammenführen: nur Admin oder Recht „freigeben“; aus „zusammen“ (Sicherheitsprüfung grün) → „feature“
-- (Admin-PC führt in einer Testfassung zusammen, prüft das ganze Feature und schaltet erst bei Grün live)
create or replace function public.ws_zusammenfuehren(p_auftrag bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ws_auftraege;
begin
  select * into a from public.ws_auftraege where id = p_auftrag for update;
  if a.id is null then raise exception 'Auftrag nicht gefunden'; end if;
  if not public.ws_darf(public.ws_bereich_von_gruppe(a.gruppe_id), 'freigeben') then
    raise exception 'Keine Berechtigung zum Zusammenführen in diesem Bereich';
  end if;
  if a.stand <> 'zusammen' then raise exception 'Auftrag wartet nicht auf das Zusammenführen'; end if;
  if coalesce(a.pruefung -> 'sicherheit' ->> 'ergebnis', '') <> 'gruen' then raise exception 'Die Sicherheitsprüfung ist nicht grün'; end if;
  update public.ws_auftraege set stand = 'feature', pruefung = pruefung - 'feature', geaendert = now() where id = p_auftrag;
  insert into public.ws_nachrichten (auftrag_id, von, art, text) values (p_auftrag, auth.uid(), 'system', 'Zusammenführen gestartet – das ganze Feature wird in einer Testfassung geprüft, dann live');
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'zusammenfuehren', jsonb_build_object('auftrag', p_auftrag, 'zweig', a.zweig, 'pr', a.pr_nummer));
end $$;

revoke execute on function public.ws_zusammenfuehren(bigint) from public, anon;
grant execute on function public.ws_zusammenfuehren(bigint) to authenticated;

-- ---------- Bestehende Aufträge auf den neuen Weg ----------
-- „zusammen“ hieß bisher „freigegeben, wartet aufs Zusammenführen“ → jetzt zuerst Sicherheitsprüfung
update public.ws_auftraege set stand = 'sicherheit', geaendert = now()
  where stand = 'zusammen' and not (pruefung ? 'sicherheit');

commit;

select stand, count(*) from public.ws_auftraege group by stand order by stand;
