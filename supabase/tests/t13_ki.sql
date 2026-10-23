-- Rechte-Test Datenbank v12 (KI-Anbieter). Voraussetzung: mock2.sql, 0001 → … → 0012.
-- Aufruf: psql -v ON_ERROR_ROLLBACK=on -f t13_ki.sql (Transaktion, rollt am Ende zurück)
\set QUIET 1
\pset footer off
begin;
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()),('00000000-0000-0000-0000-0000000000d2','d2@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
\set D2  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d2'',false) \\g /dev/null'
:ADM
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('d1@x.at','entwickler',auth.uid(),'trainer-to-go'),('d2@x.at','entwickler',auth.uid(),'trainer-to-go');
:D1
select ws_einladung_annehmen('D1') \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-D1',true);
:D2
select ws_einladung_annehmen('D2') \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-D2',true);
\echo [1] Admin setzt Chat-Reihe -> OK; Bauen mit ChatGPT -> FEHLER; Bauen nur Claude -> OK; doppelter Anbieter -> FEHLER; boeses Modell -> FEHLER; Pruefung nur ChatGPT ohne Claude -> FEHLER
:ADM
select ws_ki_zustaendigkeit_setzen('trainer-to-go','chat','[{"anbieter":"chatgpt"},{"anbieter":"claude","modell":"sonnet"}]',90);
select ws_ki_zustaendigkeit_setzen('trainer-to-go','bauen','[{"anbieter":"chatgpt"}]',90);
select ws_ki_zustaendigkeit_setzen('trainer-to-go','bauen','[{"anbieter":"claude"},{"anbieter":"chatgpt"}]',90);
select ws_ki_zustaendigkeit_setzen('trainer-to-go','bauen','[{"anbieter":"claude","modell":"opus"}]',90);
select ws_ki_zustaendigkeit_setzen('trainer-to-go','chat','[{"anbieter":"claude"},{"anbieter":"claude"}]',90);
select ws_ki_zustaendigkeit_setzen('trainer-to-go','chat','[{"anbieter":"gemini","modell":"x; rm -rf"}]',90);
select ws_ki_zustaendigkeit_setzen('trainer-to-go','pruefung','[{"anbieter":"chatgpt"}]',90);
\echo [2] Entwickler setzt -> FEHLER; Entwickler liest 2 Zeilen; direkt schreiben -> FEHLER
:D1
select ws_ki_zustaendigkeit_setzen('trainer-to-go','chat','[{"anbieter":"claude"}]',90);
select count(*) as d1_sieht from ws_ki_zustaendigkeit;
update ws_ki_zustaendigkeit set reihe='[{"anbieter":"chatgpt"}]' where aufgabe='bauen';
\echo [3] Kopplung: D1 eigener PC -> OK; D1 mit PC von D2 -> FEHLER; D2 sieht D1 nicht (0); D2 aendert D1-Zeile -> 0 Zeilen
:D1
insert into ws_ki_kopplung(pc_id,anbieter,gekoppelt) values ((select id from ws_werkstatt_pcs where name='PC-D1'),'chatgpt',true);
insert into ws_ki_kopplung(pc_id,anbieter,gekoppelt) values ((select id from ws_werkstatt_pcs where name='PC-D2'),'chatgpt',true);
:D2
select count(*) as d2_sieht from ws_ki_kopplung;
update ws_ki_kopplung set gekoppelt=false;
:ADM
select count(*) as admin_sieht, bool_and(gekoppelt) as noch_gekoppelt from ws_ki_kopplung;
\echo [4] Vorschlag mit Konzept: gueltig -> t; mit fremdem Schluessel -> f
reset role;
select ws_vorschlag_ok('trainer-to-go', jsonb_build_object('gruppe_id',(select g.id from ws_gruppen g join ws_bereiche b on b.id=g.bereich_id where b.projekt_id='trainer-to-go' limit 1),'titel','Fahrgemeinschaften','text','Baue die Fahrgemeinschaften laut Konzept.','konzept','{"ziel":"x","offen":[],"abnahme":["a"]}'::jsonb)) as gueltig;
select ws_vorschlag_ok('trainer-to-go', jsonb_build_object('gruppe_id',(select g.id from ws_gruppen g join ws_bereiche b on b.id=g.bereich_id where b.projekt_id='trainer-to-go' limit 1),'titel','Fahrgemeinschaften','text','Baue die Fahrgemeinschaften laut Konzept.','konzept','{"boese":"x"}'::jsonb)) as fremd;
\echo [5] Vermerken: fremde Antwort -> FEHLER
set role authenticated;
:D2
select ws_ki_vermerken('chat', 999999, 'chatgpt');
reset role;
rollback;
