-- Rechte-Test Datenbank v28 (Live-Vorschau öffnet die Seite des Features). Voraussetzung: mock2.sql, 0001 → … → 0028. Aufruf mit -v ON_ERROR_ROLLBACK=on.
\set QUIET 1
\pset footer off
begin;
insert into auth.users values ('00000000-0000-0000-0000-0000000000e1','e1@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set E1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000e1'',false) \\g /dev/null'
:ADM
select ws_projekt_anlegen('neu','Neu','x','','') \g /dev/null
reset role;
insert into ws_features(id,gruppe_id,name,stand,quelle,erstellt_von) select 'V-1', g.id, 'Spielidee', 'live', 'manuell', '00000000-0000-0000-0000-00000000000a' from ws_gruppen g join ws_bereiche b on b.id=g.bereich_id where b.projekt_id='neu' and not b.global limit 1;
set role authenticated;
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('e1@x.at','leser',auth.uid(),'neu');
:E1
select ws_einladung_annehmen('E1') \g /dev/null
\echo [1] Leser setzt -> FEHLER; direkt schreiben -> FEHLER
select ws_feature_vorschau_setzen('V-1','/tactics');
update ws_features set vorschau_pfad = '/x' where id = 'V-1';
\echo [2] Admin setzt gültig -> OK; ungültig (fremde Adresse, .., Leerzeichen, javascript) -> FEHLER; leer -> null
:ADM
select ws_feature_vorschau_setzen('V-1','/tactics?tab=plans') \g /dev/null
select vorschau_pfad from ws_features where id='V-1';
select ws_feature_vorschau_setzen('V-1','//boese.example/x');
select ws_feature_vorschau_setzen('V-1','/a/../b');
select ws_feature_vorschau_setzen('V-1','/a b');
select ws_feature_vorschau_setzen('V-1','javascript:alert(1)');
select ws_feature_vorschau_setzen('V-1','https://boese.example');
select ws_feature_vorschau_setzen('V-1','') \g /dev/null
select vorschau_pfad is null as leer from ws_features where id='V-1';
rollback;
