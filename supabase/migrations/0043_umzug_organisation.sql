-- Codeschmiede · Datenbank 0043: Umzug in die GitHub-Organisation (Anweisung Gerhard 2026-10-25 20:13).
-- Die Repos „trainer-to-go“ und „codeschmiede“ liegen jetzt unter kresak-it-solutions (GitHub Enterprise „Kresak IT-Solutions“).
-- Nur diese beiden Einträge werden umgestellt – Repos anderer Projekte, die noch beim Konto gerhardkresak-code liegen, bleiben unverändert.
-- Die Repository-Kennung bei GitHub bleibt beim Umzug gleich; Links auf Pull Requests und Abläufe bauen auf ws_projekte.repo auf.

update public.ws_projekte
   set repo = 'kresak-it-solutions/' || split_part(repo, '/', 2)
 where repo in ('gerhardkresak-code/trainer-to-go', 'gerhardkresak-code/codeschmiede');
