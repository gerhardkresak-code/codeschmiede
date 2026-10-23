-- Rechte-Test Datenbank v21 (GitHub-Repository anlegen). Voraussetzung: mock2.sql, 0001 → … → 0021. Aufruf mit -v ON_ERROR_ROLLBACK=on.
\set QUIET 1
\pset footer off
begin;
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
:ADM
select ws_projekt_anlegen('neu','Neu','Kassenbuch','','') \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-ADM',true);
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('d1@x.at','entwickler',auth.uid(),'neu');
:D1
select ws_einladung_annehmen('D1') \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-D1',true);
\echo [1] Entwickler fordert an -> FEHLER; Admin -> OK; nochmal bei vorhandenem Repo (trainer-to-go) -> FEHLER
select ws_repo_anfordern('neu', false);
:ADM
select ws_repo_anfordern('neu', false);
select ws_repo_anfordern('trainer-to-go', false);
\echo [2] Entwickler-Werkstatt nimmt -> nichts; Admin-Werkstatt nimmt -> neu/anlegen; fremder PC -> FEHLER
:D1
select count(*) as d1 from ws_repo_nehmen((select id from ws_werkstatt_pcs where name='PC-D1'));
:ADM
select ws_repo_nehmen((select id from ws_werkstatt_pcs where name='PC-D1'));
select projekt_id, aktion, privat from ws_repo_nehmen((select id from ws_werkstatt_pcs where name='PC-ADM'));
\echo [3] Ergebnis: ungueltiges Repo -> FEHLER; gueltig -> repo gesetzt, fertig
select ws_repo_ergebnis((select id from ws_werkstatt_pcs where name='PC-ADM'),'neu','boese/../x');
select ws_repo_ergebnis((select id from ws_werkstatt_pcs where name='PC-ADM'),'neu','gerhardkresak-code/neu');
select repo, repo_stand, repo_aktion from ws_projekte where id='neu';
\echo [4] Sichtbarkeit privat: Admin -> angefragt; Entwickler -> FEHLER
select ws_repo_sichtbarkeit('neu', true);
select repo_aktion, repo_privat, repo_stand from ws_projekte where id='neu';
:D1
select ws_repo_sichtbarkeit('neu', false);
\echo [5] Ergebnis ohne laufenden Auftrag -> FEHLER
:ADM
select ws_repo_ergebnis((select id from ws_werkstatt_pcs where name='PC-ADM'),'neu','gerhardkresak-code/neu');
reset role;
rollback;
