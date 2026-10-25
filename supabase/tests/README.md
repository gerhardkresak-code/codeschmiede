# Rechte-Tests Codeschmiede (ws_*)

Unabhängige Prüfung 2026-10-22: Datenbank v1 GEPRÜFT (df1c7b2), v2 mit Projekten GEPRÜFT (e85816d).
Ablauf in einem lokalen Postgres 16: `mock2.sql` (stellt Supabase nach) → `../migrations/0001_grundlage.sql` → `../migrations/0002_projekte_verbrauch.sql`
→ Tests `t3v2.sql` (Rollen, Angriffe), `t4.sql` (Stände der Admin-Stationen), `t5.sql` (Trennung der Projekte), `t6.sql` (Mitglieder sichtbar nur bei gemeinsamem Projekt, Verbrauch, Einladungen).
Nur erfundene Test-Konten.

Ab Datenbank v11: `t12_abgleich.sql` (Projekt-Abgleich: nur eigener PC, nur Admin/Entwickler, nur erlaubte Pfade, nur lesen für Mitglieder).
Ab Datenbank v12: `t13_ki.sql` (KI-Anbieter: nur Admin stellt ein, Bauen nur Claude, Kopplung nur eigener PC, Konzept im Vorschlag).
Ab Datenbank v13: `t14_projekt_loeschen.sql` (Projekte archivieren/löschen: nur Admin, Name als Bestätigung, gesperrt bei laufendem Auftrag, anderes Projekt unberührt).
Ab Datenbank v15: `t15_bezuege.sql` (Feature-Bezüge: gleiches Projekt, Auftragsrecht, Nachziehen-Hinweis, Vorschläge feature_neu/bezug). v14/v16/v17 ändern nur Prüffunktionen (Schema), getestet über t13 und ws_design_werte_ok.
Ab Datenbank v18: `t16_ki_frei.sql` (eigene KI-Anbieter: nur Admin, nur Programmname ohne Pfad/Shell-Zeichen, Zulassung je PC wird bei Änderung zurückgesetzt).
Ab Datenbank v36: `t30_design_auftrag.sql` (Aufträge aus dem App-Designer: Auftrag + Nachricht in einem Schritt, nur mit Design-Recht, Eingaben begrenzt, nichts halb angelegt).
Ab Datenbank 0041: `t35_kachel_chat.sql` (Chat zur Kachel: strenges Kachel-Schema, KI-Wunsch nur im erlaubten Format, Werkstatt bekommt den Wunsch mit, ungültiger Vorschlag wird verworfen).
Ab Datenbank v42: `t36_aufgaben.sql` (Aufgaben: sehen alle Mitglieder des Projekts, bearbeiten Admin/Entwickler/Texter, Zuständig nur Projekt-Mitglieder, Bezug nur im eigenen Projekt, Links nur https ohne Zugangsdaten, Anhänge nur reserviert/typ- und größengeprüft/≤ 20, privater Speicher nach Projekt, In den Chat schicken, Als Auftrag mit Auftragsrecht, Löschen nur Ersteller/Admin). `mock2.sql` bildet dafür den Speicher (storage.buckets/objects) nach.
