-- Rechte-Test Datenbank v13 (Projekte archivieren/löschen). Voraussetzung: mock2.sql, 0001 → … → 0013.
-- Aufruf: psql -v ON_ERROR_ROLLBACK=on -f t14_projekt_loeschen.sql (Transaktion, rollt am Ende zurück)
\set QUIET 1
\pset footer off
begin;
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
:ADM
select ws_projekt_anlegen('weg','Wegwerf','','owner/weg','') \g /dev/null
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('d1@x.at','entwickler',auth.uid(),'weg');
:D1
select ws_einladung_annehmen('D1') \g /dev/null
reset role;
insert into ws_features(id,gruppe_id,name,stand,quelle,erstellt_von) select 'W-1', g.id, 'Test', 'geplant', 'manuell', '00000000-0000-0000-0000-00000000000a' from ws_gruppen g join ws_bereiche b on b.id=g.bereich_id where b.projekt_id='weg' and not b.global limit 1;
insert into ws_auftraege(gruppe_id,feature_id,titel,erstellt_von) values ((select gruppe_id from ws_features where id='W-1'),'W-1','Testauftrag','00000000-0000-0000-0000-00000000000a');
insert into ws_nachrichten(auftrag_id,von,text) values ((select max(id) from ws_auftraege),'00000000-0000-0000-0000-00000000000a','Hallo');
set role authenticated;
:ADM
\echo [1] Umfang (Admin) -> Zahlen; Entwickler -> FEHLER
select ws_projekt_umfang('weg');
:D1
select ws_projekt_umfang('weg');
\echo [2] Entwickler loescht/archiviert -> FEHLER (2x); Admin falscher Name -> FEHLER
select ws_projekt_loeschen('weg','Wegwerf');
select ws_projekt_archivieren('weg',true);
:ADM
select ws_projekt_loeschen('weg','wegwerf');
\echo [3] Laufender Auftrag -> FEHLER
reset role;
update ws_auftraege set stand='laeuft' where titel='Testauftrag';
set role authenticated;
:ADM
select ws_projekt_loeschen('weg','Wegwerf');
reset role;
update ws_auftraege set stand='wartet' where titel='Testauftrag';
set role authenticated;
:ADM
\echo [4] Archivieren und zurueck -> OK; Loeschen -> OK; danach nichts mehr da (alle 0); trainer-to-go unberuehrt (>0)
select ws_projekt_archivieren('weg',true) \g /dev/null
select archiviert from ws_projekte where id='weg';
select ws_projekt_archivieren('weg',false) \g /dev/null
select ws_projekt_loeschen('weg','Wegwerf') is not null as geloescht;
reset role;
select (select count(*) from ws_projekte where id='weg') p, (select count(*) from ws_bereiche where projekt_id='weg') b, (select count(*) from ws_features where id='W-1') f,
  (select count(*) from ws_auftraege where titel='Testauftrag') a, (select count(*) from ws_projekt_mitglieder where projekt_id='weg') m, (select count(*) from ws_bereiche where projekt_id='trainer-to-go') ttg;
\echo [5] anon -> FEHLER
set role anon;
select ws_projekt_loeschen('trainer-to-go','x');
reset role;
rollback;
