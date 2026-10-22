# Rechte-Test Programmierumgebung (ws_*)

Von der unabhängigen Prüfung am 2026-10-22 (Urteil GEPRÜFT, Commit df1c7b2). Läuft gegen ein lokales Postgres 16:
1. `mock2.sql` – stellt Supabase nach (Rollen anon/authenticated, auth.users, auth.uid(), Realtime-Veröffentlichung)
2. `supabase/dev-data/20261022_programmierumgebung.sql` und `..._features.sql` einspielen (zweimal)
3. `t3.sql` (rund 60 Fälle: Angriffe und erlaubte Abläufe je Rolle), `t4.sql` (Stände der Admin-Stationen, Freigabe nur mit Pull Request)
Keine echten Daten, nur erfundene Test-Konten.
