-- Rechte-Test Datenbank v11 (Projekt-Abgleich). Voraussetzung: frische Datenbank, mock2.sql, 0001 → … → 0011.
\set QUIET 1
\pset footer off
insert into auth.users values
 ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()),('00000000-0000-0000-0000-0000000000e1','e1@x.at',now()),
 ('00000000-0000-0000-0000-0000000000b9','b9@x.at',now())
on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
\set E1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000e1'',false) \\g /dev/null'
\set B9  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000b9'',false) \\g /dev/null'
:ADM
select ws_projekt_anlegen('proj-b','B','','owner/b','') \g /dev/null
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values
 ('d1@x.at','entwickler',auth.uid(),'trainer-to-go'),('e1@x.at','leser',auth.uid(),'trainer-to-go'),('b9@x.at','entwickler',auth.uid(),'proj-b');
:D1
select ws_einladung_annehmen('D1') \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-D1',true);
:E1
select ws_einladung_annehmen('E1') \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-E1',true);
:B9
select ws_einladung_annehmen('B9') \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-B9',true);

\echo [1] D1 (Entwickler, eigener PC) schreibt -> OK; Zahlen 2 Zweige, 1 Dokument
:D1
select ws_abgleich_schreiben((select id from ws_werkstatt_pcs where name='PC-D1'),'trainer-to-go','abc1234',
 '[{"name":"main","sha":"abc1234","datum":"2026-10-23T10:00:00Z","betreff":"x","vor":0,"hinter":0},{"name":"feature/a","sha":"def5678","vor":2,"hinter":1}]',
 '[{"pfad":"docs/CHANGELOG.md","inhalt":"# Log","sha":"abc1234"}]');
select (select count(*) from ws_zweige) as zweige, (select count(*) from ws_dokumente) as doks;
\echo [2] Leser E1 -> FEHLER; B9 (anderes Projekt) -> FEHLER; D1 mit fremdem PC -> FEHLER
:E1
select ws_abgleich_schreiben((select id from ws_werkstatt_pcs where name='PC-E1'),'trainer-to-go','abc1234','[]','[]');
:B9
select ws_abgleich_schreiben((select id from ws_werkstatt_pcs where name='PC-B9'),'trainer-to-go','abc1234','[]','[]');
:D1
select ws_abgleich_schreiben((select id from ws_werkstatt_pcs where name='PC-E1'),'trainer-to-go','abc1234','[]','[]');
\echo [3] Unerlaubter Pfad -> FEHLER (2x); ungueltiges sha -> FEHLER
select ws_abgleich_schreiben((select id from ws_werkstatt_pcs where name='PC-D1'),'trainer-to-go','abc1234','[]','[{"pfad":"src/geheim.js","inhalt":"x","sha":"abc1234"}]');
select ws_abgleich_schreiben((select id from ws_werkstatt_pcs where name='PC-D1'),'trainer-to-go','abc1234','[]','[{"pfad":"docs/../.env.md","inhalt":"x","sha":"abc1234"}]');
select ws_abgleich_schreiben((select id from ws_werkstatt_pcs where name='PC-D1'),'trainer-to-go','abc; drop','[]','[]');
\echo [4] Sichtbarkeit: E1 sieht 2 Zweige, B9 sieht 0
:E1
select count(*) as e1_sieht from ws_zweige;
:B9
select count(*) as b9_sieht from ws_zweige;
\echo [5] Direkt schreiben -> FEHLER (3x); anon -> FEHLER
:D1
insert into ws_zweige(projekt_id,name,sha) values ('trainer-to-go','x','abc1234');
update ws_dokumente set inhalt='y';
delete from ws_zweige;
reset role;
set role anon;
select count(*) from ws_dokumente;
reset role;
\echo [6] Ersetzen: D1 schreibt nur main -> 1 Zweig, 0 Dokumente
set role authenticated;
:D1
select ws_abgleich_schreiben((select id from ws_werkstatt_pcs where name='PC-D1'),'trainer-to-go','abc1234','[{"name":"main","sha":"abc1234"}]','[]');
select (select count(*) from ws_zweige) as zweige, (select count(*) from ws_dokumente) as doks;
reset role;
