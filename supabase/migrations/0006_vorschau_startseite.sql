-- Codeschmiede · Datenbank v6: Startseite der Live-Vorschau je Projekt (Meldung Gerhard 2026-10-22 21:35:
-- „ich komme nicht in die App“ – die Vorschau zeigte die Startseite der Website statt der App).
-- Mehrfach ausführbar.
begin;
alter table public.ws_projekte add column if not exists vorschau_pfad text not null default '/'
  check (vorschau_pfad ~ '^/[A-Za-z0-9/_-]*$');
grant update (vorschau_pfad) on public.ws_projekte to authenticated;   -- Policy ws_projekte_admin: nur Admin
update public.ws_projekte set vorschau_pfad = '/home' where id = 'trainer-to-go' and vorschau_pfad = '/';
commit;
select id, vorschau_domain, live_url, vorschau_pfad from public.ws_projekte;
