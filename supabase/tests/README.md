# Rechte-Tests Codeschmiede (ws_*)

Unabhängige Prüfung 2026-10-22: Datenbank v1 GEPRÜFT (df1c7b2), v2 mit Projekten GEPRÜFT (e85816d).
Ablauf in einem lokalen Postgres 16: `mock2.sql` (stellt Supabase nach) → `../migrations/0001_grundlage.sql` → `../migrations/0002_projekte_verbrauch.sql`
→ Tests `t3v2.sql` (Rollen, Angriffe), `t4.sql` (Stände der Admin-Stationen), `t5.sql` (Trennung der Projekte), `t6.sql` (Mitglieder sichtbar nur bei gemeinsamem Projekt, Verbrauch, Einladungen).
Nur erfundene Test-Konten.

Ab Datenbank v11: `t12_abgleich.sql` (Projekt-Abgleich: nur eigener PC, nur Admin/Entwickler, nur erlaubte Pfade, nur lesen für Mitglieder).
