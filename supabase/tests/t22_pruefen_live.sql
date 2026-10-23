-- Rechte-Test Datenbank v24 (Prüfen per Knopf, Test & Live). Voraussetzung: mock2.sql, 0001 → … → 0024. Aufruf mit -v ON_ERROR_ROLLBACK=on.
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
reset role;
update ws_projekte set repo='gerhardkresak-code/neu' where id='neu';
insert into ws_features(id,gruppe_id,name) values ('N-1','neu-funktionen','Kasse');
set role authenticated;

\echo [1] Entwickler ohne Recht prüft Feature -> FEHLER; ganze App -> FEHLER; Admin ganze App -> OK; zweite offene -> FEHLER
:D1
select ws_pruefung_anfordern('neu','feature','N-1');
select ws_pruefung_anfordern('neu','app',null);
:ADM
select ws_pruefung_anfordern('neu','app','irgendwas') > 0 as ok;
select ws_pruefung_anfordern('neu','gruppe','neu-funktionen');
\echo [2] Konzept-Gruppe / fremde Gruppe -> FEHLER (Projekt trainer-to-go hat eigene)
select ws_pruefung_anfordern('neu','gruppe',(select konzept_gruppe_id from ws_projekte where id='neu'));
select ws_pruefung_anfordern('neu','gruppe','trainer-to-go-konzept');
\echo [3] Entwickler-Werkstatt nimmt -> nichts; Admin-Werkstatt -> app; Ergebnis von fremdem PC -> FEHLER; rot -> OK
:D1
select count(*) as d1 from ws_pruefung_nehmen((select id from ws_werkstatt_pcs where name='PC-D1'));
:ADM
select umfang, ziel from ws_pruefung_nehmen((select id from ws_werkstatt_pcs where name='PC-ADM'));
select ws_pruefung_ergebnis((select id from ws_werkstatt_pcs where name='PC-D1'),(select max(id) from ws_pruefungen),'rot','x','claude/opus',repeat('a',40));
select ws_pruefung_ergebnis((select id from ws_werkstatt_pcs where name='PC-ADM'),(select max(id) from ws_pruefungen),'rot','- rot: RLS fehlt','claude/opus',repeat('a',40));
\echo [4] Als Auftrag: ganze App ohne Gruppe -> FEHLER; Konzept -> FEHLER; Entwickler ohne Recht -> FEHLER; Admin mit Gruppe -> OK; zweimal -> FEHLER
select ws_pruefung_als_auftrag((select max(id) from ws_pruefungen), null);
select ws_pruefung_als_auftrag((select max(id) from ws_pruefungen), (select konzept_gruppe_id from ws_projekte where id='neu'));
:D1
select ws_pruefung_als_auftrag((select max(id) from ws_pruefungen), 'neu-funktionen');
:ADM
select ws_pruefung_als_auftrag((select max(id) from ws_pruefungen), 'neu-funktionen') > 0 as ok;
select ws_pruefung_als_auftrag((select max(id) from ws_pruefungen), 'neu-funktionen');
select titel from ws_auftraege where id=(select auftrag_id from ws_pruefungen where id=(select max(id) from ws_pruefungen));
\echo [5] Direkt schreiben -> FEHLER
insert into ws_pruefungen(projekt_id,umfang) values ('neu','app');
update ws_pruefungen set stand='gruen';
\echo [6] Feature-Prüfung durch Entwickler mit Recht Freigeben -> OK; abbrechen fremd -> FEHLER, selbst -> OK
reset role;
insert into ws_rechte(benutzer_id,bereich_id,auftraege,freigeben,loeschen) select '00000000-0000-0000-0000-0000000000d1', bereich_id, true, true, false from ws_gruppen where id='neu-funktionen'
  on conflict (benutzer_id,bereich_id) do update set freigeben=true, auftraege=true;
set role authenticated;
:D1
select ws_pruefung_anfordern('neu','feature','N-1') > 0 as ok;
reset role;
set role authenticated;
:ADM
select stand from ws_pruefungen order by id desc limit 1;
:D1
select ws_pruefung_abbrechen((select max(id) from ws_pruefungen));
select stand from ws_pruefungen order by id desc limit 1;

\echo [7] Live: Entwickler -> FEHLER; live ohne Einrichtung -> FEHLER; Admin einrichten -> OK; doppelt -> FEHLER
select ws_live_anfordern('neu','einrichten');
:ADM
select ws_live_anfordern('neu','live');
select ws_live_anfordern('neu','einrichten') > 0 as ok;
select ws_live_anfordern('neu','einrichten');
\echo [8] Umgestellt vor Version -> FEHLER; Werkstatt nimmt, meldet Erfolg; umgestellt -> OK
select ws_live_umgestellt('neu', true, 'https://main.neu.pages.dev');
select art, repo from ws_live_nehmen((select id from ws_werkstatt_pcs where name='PC-ADM'));
select ws_live_ergebnis((select id from ws_werkstatt_pcs where name='PC-ADM'),(select max(id) from ws_live_auftraege),repeat('1',40),'v1',array['0001.sql','0002.sql']);
select ws_live_umgestellt('neu', true, 'javascript:alert(1)');
select ws_live_umgestellt('neu', true, 'https://main.neu.pages.dev');
select live_zweig, test_url from ws_projekte where id='neu';
\echo [8b] Live ohne Test-Stand -> FEHLER
select ws_live_anfordern('neu','live');
\echo [9] Live schalten -> v2 mit neuer Migration; zurück auf v1 -> FEHLER (Datenbank passt nicht)
select ws_live_anfordern('neu','live',null,repeat('f',40)) > 0 as ok;
select art from ws_live_nehmen((select id from ws_werkstatt_pcs where name='PC-ADM'));
select ws_live_ergebnis((select id from ws_werkstatt_pcs where name='PC-ADM'),(select max(id) from ws_live_auftraege),repeat('2',40),'v2',array['0001.sql','0002.sql','0003.sql']);
select ws_live_anfordern('neu','zurueck',(select id from ws_live_versionen where bezeichnung='v1'));
\echo [10] v3 ohne neue Migration; zurück auf v2 -> OK; auf aktuelle -> FEHLER; fremde Version -> FEHLER
select ws_live_anfordern('neu','live',null,repeat('f',40)) > 0 as ok;
select art from ws_live_nehmen((select id from ws_werkstatt_pcs where name='PC-ADM'));
select ws_live_ergebnis((select id from ws_werkstatt_pcs where name='PC-ADM'),(select max(id) from ws_live_auftraege),repeat('3',40),'v3',array['0001.sql','0002.sql','0003.sql']);
select ws_live_anfordern('neu','zurueck',(select id from ws_live_versionen where bezeichnung='v3'));
select ws_live_anfordern('neu','zurueck',(select id from ws_live_versionen where bezeichnung='v2')) > 0 as ok;
select art, commit_sha = repeat('2',40) as v2 from ws_live_nehmen((select id from ws_werkstatt_pcs where name='PC-ADM'));
select ws_live_ergebnis((select id from ws_werkstatt_pcs where name='PC-ADM'),(select max(id) from ws_live_auftraege),repeat('2',40),'v2',array['0001.sql','0002.sql','0003.sql']);
select bezeichnung, art from ws_live_versionen where projekt_id='neu' order by id;
\echo [11] Fehler melden -> Stand fehler, keine Version
select ws_live_anfordern('neu','live',null,repeat('f',40)) > 0 as ok;
select art from ws_live_nehmen((select id from ws_werkstatt_pcs where name='PC-ADM'));
select ws_live_ergebnis((select id from ws_werkstatt_pcs where name='PC-ADM'),(select max(id) from ws_live_auftraege),null,null,null,'GitHub nicht erreichbar');
select stand, hinweis from ws_live_auftraege order by id desc limit 1;
select count(*) as versionen from ws_live_versionen where projekt_id='neu';
\echo [12] Feature im Test wird beim Live schalten live
reset role; update ws_features set stand='test' where id='N-1'; set role authenticated;
:ADM
select ws_live_anfordern('neu','live',null,repeat('f',40)) > 0 as ok;
select art from ws_live_nehmen((select id from ws_werkstatt_pcs where name='PC-ADM'));
select ws_live_ergebnis((select id from ws_werkstatt_pcs where name='PC-ADM'),(select max(id) from ws_live_auftraege),repeat('4',40),'v4',array['0001.sql','0002.sql','0003.sql'],null,array['N-1','trainer-fremd']);
select stand from ws_features where id='N-1';
\echo [13] Leser sieht keine Prüfungen; Entwickler sieht Feature-, aber keine App-Prüfung; fremder PC meldet -> FEHLER
reset role;
insert into auth.users values ('00000000-0000-0000-0000-0000000000e1','e1@x.at',now()) on conflict do nothing;
insert into ws_benutzer(id,name,rolle,aktiv) values ('00000000-0000-0000-0000-0000000000e1','Leser','leser',true) on conflict do nothing;
insert into ws_projekt_mitglieder values ('neu','00000000-0000-0000-0000-0000000000e1','leser') on conflict do nothing;
set role authenticated;
\set E1 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000e1'',false) \\g /dev/null'
:E1
select count(*) as leser_sieht from ws_pruefungen;
:D1
select umfang, count(*) from ws_pruefungen group by umfang order by umfang;
:ADM
select ws_live_anfordern('neu','live',null,repeat('f',40)) > 0 as ok;
select art from ws_live_nehmen((select id from ws_werkstatt_pcs where name='PC-ADM'));
select ws_live_ergebnis((select id from ws_werkstatt_pcs where name='PC-D1'),(select max(id) from ws_live_auftraege),repeat('5',40),'v5',array['x']);
rollback;
