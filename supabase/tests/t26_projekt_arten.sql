-- Rechte-Test Datenbank v30 (Projekt-Arten, Anbindungen, Aktionen). Voraussetzung: mock2.sql, 0001 → … → 0030. Aufruf mit -v ON_ERROR_ROLLBACK=on.
\set QUIET 1
\pset footer off
begin;
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
:ADM
select ws_projekt_anlegen('prog','Prog','','gerhardkresak-code/prog','') \g /dev/null
select ws_projekt_anlegen('tool','Tool','','','') \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-ADM',true);
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('d1@x.at','entwickler',auth.uid(),'prog');
:D1
select ws_einladung_annehmen('D1') \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-D1',true);
\echo [1] Standard web/keine; Entwickler setzt Art -> FEHLER; Admin -> OK; ungueltige Art -> FEHLER
select technik_art, datenbank from ws_projekte where id='prog';
select ws_projekt_technik('prog','programm','keine');
:ADM
select ws_projekt_technik('prog','programm','keine');
select ws_projekt_technik('tool','werkzeug','spielwiese');
select ws_projekt_technik('prog','spiel','keine');
select id, technik_art, datenbank from ws_projekte where id in ('prog','tool') order by id;
\echo [2] Ampel: gueltig -> OK; fremder Schluessel / falscher Stand / zu langer Text -> FEHLER (3x); Entwickler -> FEHLER
select ws_anbindungen_melden((select id from ws_werkstatt_pcs where name='PC-ADM'),'prog','{"github":{"stand":"gruen","text":"ok"},"sandbox":{"stand":"gelb","text":"einschalten"}}');
select ws_anbindungen_melden((select id from ws_werkstatt_pcs where name='PC-ADM'),'prog','{"boese":{"stand":"gruen","text":"x"}}');
select ws_anbindungen_melden((select id from ws_werkstatt_pcs where name='PC-ADM'),'prog','{"github":{"stand":"lila","text":"x"}}');
select ws_anbindungen_melden((select id from ws_werkstatt_pcs where name='PC-ADM'),'prog',jsonb_build_object('github',jsonb_build_object('stand','gruen','text',repeat('x',201))));
:D1
select ws_anbindungen_melden((select id from ws_werkstatt_pcs where name='PC-D1'),'prog','{}');
select anbindungen->'github'->>'stand' as gh from ws_projekte where id='prog';
\echo [3] Direktes Schreiben der Ampel durch Entwickler -> FEHLER oder 0
update ws_projekte set anbindungen='{}' where id='prog';
\echo [4] Aktionen: Entwickler -> FEHLER; Sandbox fuer Werkzeug -> FEHLER; Testlauf ohne Repo -> FEHLER; Sandbox ohne PC -> FEHLER; Sandbox mit PC -> OK; doppelt -> FEHLER; boeser Zweig -> FEHLER
select ws_projekt_aktion_anfordern('prog','sandbox','main',(select id from ws_werkstatt_pcs where name='PC-D1'));
:ADM
select ws_projekt_aktion_anfordern('tool','sandbox','main',(select id from ws_werkstatt_pcs where name='PC-ADM'));
select ws_projekt_aktion_anfordern('tool','testlauf','main');
select ws_projekt_aktion_anfordern('prog','sandbox','main',null);
select ws_projekt_aktion_anfordern('prog','sandbox','main',(select id from ws_werkstatt_pcs where name='PC-ADM')) > 0 as ok;
select ws_projekt_aktion_anfordern('prog','sandbox','main',(select id from ws_werkstatt_pcs where name='PC-ADM'));
select ws_projekt_aktion_anfordern('prog','pruefen','../x');
\echo [5] Entwickler sieht Aktionen nicht (0); Entwickler-Werkstatt nimmt nichts (0); Admin nimmt -> prog/sandbox
:D1
select count(*) from ws_projekt_aktionen;
select count(*) from ws_projekt_aktion_nehmen((select id from ws_werkstatt_pcs where name='PC-D1'));
:ADM
select projekt_id, art, zweig, repo, technik_art from ws_projekt_aktion_nehmen((select id from ws_werkstatt_pcs where name='PC-ADM'));
\echo [6] Ergebnis mit fremdem Link -> fertig, Link leer; nochmal -> FEHLER
select ws_projekt_aktion_ergebnis((select id from ws_werkstatt_pcs where name='PC-ADM'),(select max(id) from ws_projekt_aktionen),'Sandbox gestartet','https://boese.example/x');
select stand, hinweis, link from ws_projekt_aktionen order by id desc limit 1;
select ws_projekt_aktion_ergebnis((select id from ws_werkstatt_pcs where name='PC-ADM'),(select max(id) from ws_projekt_aktionen),'x');
rollback;
