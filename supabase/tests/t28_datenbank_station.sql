-- Rechte-Test Datenbank v34 (Datenbank-Station). Voraussetzung: mock2.sql, 0001 → … → 0034. Aufruf mit -v ON_ERROR_ROLLBACK=on.
\set QUIET 1
\pset footer off
begin;
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
:ADM
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-ADM',true);
select id as adm_pc from ws_werkstatt_pcs where name='PC-ADM' \gset
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('d1@x.at','entwickler',auth.uid(),'trainer-to-go');
:D1
select ws_einladung_annehmen('D1') \g /dev/null
\echo [1] Entwickler traegt ein -> FEHLER; Admin ungueltige Kennung -> FEHLER; gleiche Kennung -> FEHLER; gueltig -> OK; fremde Gruppe -> FEHLER
select ws_projekt_datenbank('trainer-to-go','lhdoyjdothombwslfeco',null,true,false,null);
:ADM
select ws_projekt_datenbank('trainer-to-go','abc',null,true,false,null);
select ws_projekt_datenbank('trainer-to-go','lhdoyjdothombwslfeco','lhdoyjdothombwslfeco',true,false,null);
select ws_projekt_datenbank('trainer-to-go','lhdoyjdothombwslfeco','abcdefghijabcdefghij',true,false,(select id from ws_gruppen where bereich_id='plattform' limit 1));
select ws_projekt_datenbank('trainer-to-go','lhdoyjdothombwslfeco',null,true,false,'gibtsnicht');
select db_test_ref, db_live_ref, db_test_bestehend, db_live_bestehend, datenbank from ws_projekte where id='trainer-to-go';
\echo [2] Offen melden: gueltig -> OK; boeser Dateiname / zu lang -> FEHLER (2x); Entwickler -> FEHLER
select ws_db_offen_melden(:'adm_pc','trainer-to-go','[{"datei":"20261025_x.sql","sql":"create table x();"}]', true);
select ws_db_offen_melden(:'adm_pc','trainer-to-go','[{"datei":"../x.sql","sql":"x"}]');
select ws_db_offen_melden(:'adm_pc','trainer-to-go',jsonb_build_array(jsonb_build_object('datei','a.sql','sql',repeat('x',20001))));
:D1
select ws_db_offen_melden(:'adm_pc','trainer-to-go','[]');
select jsonb_array_length(db_offen) as offen from ws_projekte where id='trainer-to-go';
\echo [3] Aktion db_einrichten: Admin -> OK; Entwickler -> FEHLER; Ampel mit datenbank_live -> OK
:ADM
select ws_projekt_aktion_anfordern('trainer-to-go','db_einrichten') > 0 as ok;
select ws_anbindungen_melden(:'adm_pc','trainer-to-go','{"datenbank_live":{"stand":"gelb","text":"x"}}');
:D1
select ws_projekt_aktion_anfordern('trainer-to-go','db_einrichten');
rollback;
