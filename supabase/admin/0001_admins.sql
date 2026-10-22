-- Codeschmiede · Admin-Konten (Anweisung Gerhard 2026-10-22: beide Admin-Konten bleiben).
-- Erst ausführen, nachdem sich das Konto in der Codeschmiede registriert und die E-Mail bestätigt hat. Mehrfach ausführbar.
-- 2026-10-22 15:09 für office@trainer-to-go.at ausgeführt (Claude, SQL über Supabase).
insert into public.ws_benutzer (id, name, rolle, claude_konto)
select id, 'Gerhard Kresak', 'admin', 'max' from auth.users
where lower(email) in ('office@trainer-to-go.at','gerhard.kresak@gmail.com') and email_confirmed_at is not null
on conflict (id) do update set rolle = 'admin', aktiv = true;
select u.email, b.rolle, b.aktiv from public.ws_benutzer b join auth.users u on u.id = b.id;
