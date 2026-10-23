-- Rechte-Test Datenbank v23 (Auftrag abbrechen). Voraussetzung: mock2.sql, 0001 → … → 0023. Aufruf mit -v ON_ERROR_ROLLBACK=on.
\set QUIET 1
\pset footer off
begin;
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()),('00000000-0000-0000-0000-0000000000d2','d2@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
\set D2  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d2'',false) \\g /dev/null'
:ADM
select ws_projekt_anlegen('neu','Neu','x','','') \g /dev/null
insert into ws_auftraege(gruppe_id,titel,art,erstellt_von) values ('neu-funktionen','Testauftrag','aendern',auth.uid());
reset role;
select id as a from ws_auftraege where titel='Testauftrag' \gset
update ws_auftraege set stand='frage' where id=:a;
set role authenticated;
\echo [1] Fremder (D2) bricht ab -> FEHLER; Admin bricht Rueckfrage ab -> OK; nochmal -> FEHLER
:D2
select ws_auftrag_abbrechen(:a, 'weg');
:ADM
select ws_auftrag_abbrechen(:a, 'Projekt wird gelöscht');
select ws_auftrag_abbrechen(:a, null);
reset role;
select stand from ws_auftraege where id=:a;
select art, text from ws_nachrichten where auftrag_id=:a order by id desc limit 1;
\echo [2] Laufender Auftrag -> FEHLER
update ws_auftraege set stand='laeuft' where id=:a;
set role authenticated;
:ADM
select ws_auftrag_abbrechen(:a, null);
reset role;
rollback;
