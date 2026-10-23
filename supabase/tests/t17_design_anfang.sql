-- Rechte-Test Datenbank v19 (App-Designer von Anfang an). Voraussetzung: mock2.sql, 0001 → … → 0019. Aufruf mit -v ON_ERROR_ROLLBACK=on.
\set QUIET 1
\pset footer off
begin;
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()),('00000000-0000-0000-0000-0000000000d2','d2@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
\set D2  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d2'',false) \\g /dev/null'
\echo [1] Neues Projekt -> Design-Gruppe sofort gesetzt (neu-oberflaeche); Admin darf gestalten (t)
:ADM
select ws_projekt_anlegen('neu','Neu','Testprojekt','','') \g /dev/null
select design_gruppe_id from ws_projekte where id='neu';
select ws_darf_design('neu') as admin_darf;
\echo [2] Admin legt Entwurf und Design-Frage an, obwohl sonst nichts da ist -> OK (1, 1)
insert into ws_design_entwuerfe(projekt_id,name,werte) values ('neu','Erster Entwurf','{}');
insert into ws_design_chat(projekt_id,text,werte) values ('neu','Wie soll die App wirken?','{}');
select count(*) as entwuerfe from ws_design_entwuerfe where projekt_id='neu';
select count(*) as fragen from ws_design_chat where projekt_id='neu';
\echo [3] Projekt ohne Design-Gruppe: einrichten durch Admin -> Gruppe; durch Leser D2 -> FEHLER
reset role;
update ws_projekte set design_gruppe_id = null where id='neu';
set role authenticated;
:ADM
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('d1@x.at','entwickler',auth.uid(),'neu'),('d2@x.at','leser',auth.uid(),'neu');
:D1
select ws_einladung_annehmen('D1') \g /dev/null
:D2
select ws_einladung_annehmen('D2') \g /dev/null
select ws_design_einrichten('neu');
:ADM
select ws_design_einrichten('neu');
\echo [4] Fehlende Gruppe wird angelegt (ohne Oberflaeche-Gruppe) -> neu-oberflaeche entsteht neu
reset role;
update ws_projekte set design_gruppe_id = null where id='neu';
delete from ws_design_entwuerfe where projekt_id='neu'; delete from ws_design_chat where projekt_id='neu';
delete from ws_gruppen where id='neu-oberflaeche';
set role authenticated;
:D1
select ws_design_einrichten('neu');
reset role;
select name from ws_gruppen where id='neu-oberflaeche';
\echo [5] intern nicht aufrufbar -> FEHLER
set role authenticated;
:ADM
select ws_design_gruppe_sicher('neu');
reset role;
rollback;
