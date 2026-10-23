-- Rechte-Test Datenbank v10 (Chat mit Claude überall). Voraussetzung: mock2.sql, 0001 → … → 0010.
\set QUIET 1
\pset footer off
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()),('00000000-0000-0000-0000-0000000000d2','d2@x.at',now()),('00000000-0000-0000-0000-0000000000b9','b9@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
\set D2 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d2'',false) \\g /dev/null'
\set B9 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000b9'',false) \\g /dev/null'
:ADM
select ws_projekt_anlegen('proj-b','B','','owner/b','') \g /dev/null
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('d1@x.at','entwickler',auth.uid(),'trainer-to-go'),('d2@x.at','leser',auth.uid(),'trainer-to-go'),('b9@x.at','entwickler',auth.uid(),'proj-b');
:D1
select ws_einladung_annehmen('D1') \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-D1',true);
:D2
select ws_einladung_annehmen('D2') \g /dev/null
:B9
select ws_einladung_annehmen('B9') \g /dev/null
\echo [1] D1 fragt -> OK; Leser D2 -> FEHLER; B9 in fremdes Projekt -> FEHLER; Felder faelschen -> FEHLER
:D1
insert into ws_claude_chat(projekt_id,ort,text,kontext) values ('trainer-to-go','feature:f-001','Wie bleibe ich angemeldet?','Seite');
:D2
insert into ws_claude_chat(projekt_id,ort,text) values ('trainer-to-go','zentrale','Leser fragt');
:B9
insert into ws_claude_chat(projekt_id,ort,text) values ('trainer-to-go','zentrale','fremd');
:D1
insert into ws_claude_chat(projekt_id,ort,text,von) values ('trainer-to-go','zentrale','x','00000000-0000-0000-0000-0000000000d2');
\echo [2] Lesen: D1 sieht 1, D2 sieht 0, B9 sieht 0 (persoenlich, keine Rekursion)
select count(*) d1 from ws_claude_chat;
:D2
select count(*) d2 from ws_claude_chat;
:B9
select count(*) b9 from ws_claude_chat;
\echo [3] D1 Werkstatt nimmt + antwortet mit gueltigem Vorschlag; Vorschlag in fremde Gruppe wird verworfen
:D1
select id from ws_claude_chat_nehmen((select id from ws_werkstatt_pcs where name='PC-D1')) \g /dev/null
select ws_claude_chat_antwort(1,'So geht es.','{"gruppe_id":"global-einstellungen","feature_id":null,"titel":"Angemeldet bleiben","text":"Nach erster Anmeldung angemeldet bleiben."}') > 0 as ok;
select count(*) as d1_sieht_jetzt, count(vorschlag) as mit_vorschlag from ws_claude_chat;
insert into ws_claude_chat(projekt_id,ort,text) values ('trainer-to-go','zentrale','zweite');
select id from ws_claude_chat_nehmen((select id from ws_werkstatt_pcs where name='PC-D1')) \g /dev/null
select ws_claude_chat_antwort((select max(id) from ws_claude_chat where frage_id is null),'x','{"gruppe_id":"proj-b-funktionen","titel":"Fremd","text":"in fremdes Projekt schieben"}') \g /dev/null
select count(*) filter (where frage_id is not null and vorschlag is null) as verworfen from ws_claude_chat;
\echo [4] Entscheiden mit fremdem Auftrag -> FEHLER
select ws_claude_chat_entscheiden((select id from ws_claude_chat where frage_id=1),'uebernommen',999);
reset role;
