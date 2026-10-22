-- Codeschmiede · Datenbank v3: Abo-Nutzungslimits (Entscheidung Gerhard 2026-10-22 14:22: Werkstatt über das offizielle
-- Claude Code mit dem eigenen Abo-Login; Limits des Abos immer sichtbar, Werkstatt achtet darauf).
-- Mehrfach ausführbar. Reihenfolge 0001 → 0002 → 0003.

begin;

-- Letzter bekannter Stand der Abo-Limits je Mitglied (5-Stunden-Fenster und Woche), gemeldet von Claude Code auf seinem PC
create table if not exists public.ws_abo_limits (
  benutzer_id uuid primary key references public.ws_benutzer(id) on delete cascade,
  fuenf_std_prozent numeric(5,1) check (fuenf_std_prozent between 0 and 100),
  fuenf_std_reset timestamptz,
  woche_prozent numeric(5,1) check (woche_prozent between 0 and 100),
  woche_reset timestamptz,
  quelle text not null default 'werkstatt' check (quelle in ('werkstatt','statuszeile')),
  aktualisiert timestamptz not null default now()
);

-- Schwellen für die Werkstatt (Admin)
alter table public.ws_einstellungen add column if not exists abo_klein_ab_prozent int not null default 75 check (abo_klein_ab_prozent between 10 and 100);
alter table public.ws_einstellungen add column if not exists abo_pause_ab_prozent int not null default 95 check (abo_pause_ab_prozent between 10 and 100);

create or replace function public.ws_abo_schwellen_setzen(p_klein int, p_pause int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ws_ist_admin() then raise exception 'Nur der Admin setzt die Schwellen'; end if;
  if p_klein > p_pause then raise exception 'Die Schwelle „kleines Modell“ muss unter der Pause-Schwelle liegen'; end if;
  update public.ws_einstellungen set abo_klein_ab_prozent = p_klein, abo_pause_ab_prozent = p_pause, geaendert = now() where id = 1;
  insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'abo_schwellen', jsonb_build_object('klein', p_klein, 'pause', p_pause));
end $$;

alter table public.ws_abo_limits enable row level security;

-- Lesen: eigene Werte, Admin alle, sonst nur von Mitgliedern mit gemeinsamem Projekt
drop policy if exists ws_abo_limits_lesen on public.ws_abo_limits;
create policy ws_abo_limits_lesen on public.ws_abo_limits for select to authenticated
  using (public.ws_ist_mitglied() and public.ws_teilt_projekt(benutzer_id));
-- Schreiben: nur die eigene Zeile (Werkstatt-PC bzw. Statuszeile des Mitglieds)
drop policy if exists ws_abo_limits_eigen_neu on public.ws_abo_limits;
create policy ws_abo_limits_eigen_neu on public.ws_abo_limits for insert to authenticated
  with check (benutzer_id = auth.uid() and public.ws_ist_mitglied());
drop policy if exists ws_abo_limits_eigen_aendern on public.ws_abo_limits;
create policy ws_abo_limits_eigen_aendern on public.ws_abo_limits for update to authenticated
  using (benutzer_id = auth.uid()) with check (benutzer_id = auth.uid() and public.ws_ist_mitglied());

revoke all on public.ws_abo_limits from anon;
grant select on public.ws_abo_limits to authenticated;
grant insert (benutzer_id, fuenf_std_prozent, fuenf_std_reset, woche_prozent, woche_reset, quelle, aktualisiert),
      update (fuenf_std_prozent, fuenf_std_reset, woche_prozent, woche_reset, quelle, aktualisiert) on public.ws_abo_limits to authenticated;
revoke execute on function public.ws_abo_schwellen_setzen(int,int) from public, anon;
grant execute on function public.ws_abo_schwellen_setzen(int,int) to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ws_abo_limits') then
    alter publication supabase_realtime add table public.ws_abo_limits;
  end if;
end $$;

commit;

select count(*) as abo_limits from public.ws_abo_limits;
