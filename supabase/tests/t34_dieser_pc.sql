-- Test Datenbank 0040 (Einrichtung › Dieser PC: Fähigkeiten, alte PCs entfernen). Voraussetzung: mock2.sql, 0001 → … → 0040.
-- Aufruf mit -v ON_ERROR_ROLLBACK=on. Erwartung steht jeweils in der \echo-Zeile ("-> FEHLER" = Fehlermeldung).
\set QUIET 1
\pset footer off
begin;
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
:ADM
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('d1@x.at','entwickler',auth.uid(),'trainer-to-go');
:D1
select ws_einladung_annehmen('D1') \g /dev/null
\echo [1] D1 meldet PCs mit gueltigen Faehigkeiten -> OK; unbekannter Schluessel, Pfad statt Wort -> 2x FEHLER
insert into ws_werkstatt_pcs (id, benutzer_id, name, an, zuletzt, faehigkeiten) values
  ('00000000-0000-0000-0000-0000000000f1', auth.uid(), 'ALT-PC', false, now() - interval '30 days', '{"plattform":"win32","windows_sandbox":true,"os_sandbox":null,"dienst":"0.9.8"}'),
  ('00000000-0000-0000-0000-0000000000f2', auth.uid(), 'NEU-PC', true, now(), '{"plattform":"darwin","windows_sandbox":false,"os_sandbox":"macos"}');
update ws_werkstatt_pcs set faehigkeiten = '{"pfad":"C:\\Users\\x"}' where id = '00000000-0000-0000-0000-0000000000f2';
update ws_werkstatt_pcs set faehigkeiten = '{"plattform":"C:/Windows"}' where id = '00000000-0000-0000-0000-0000000000f2';
select name, faehigkeiten ->> 'plattform' as plattform from ws_werkstatt_pcs where benutzer_id = auth.uid() order by name;
\echo [2] D1 (kein Admin) entfernt PC -> FEHLER
select ws_werkstatt_pc_entfernen('00000000-0000-0000-0000-0000000000f1');
\echo [3] Admin: aktiver PC -> FEHLER; alter PC -> OK; unbekannter PC -> FEHLER
:ADM
select ws_werkstatt_pc_entfernen('00000000-0000-0000-0000-0000000000f2');
select ws_werkstatt_pc_entfernen('00000000-0000-0000-0000-0000000000f1') \g /dev/null
select ws_werkstatt_pc_entfernen('00000000-0000-0000-0000-0000000000f9');
\echo [4] Danach: nur NEU-PC uebrig, Protokoll pc_entfernt mit Name -> NEU-PC | ALT-PC
reset role;
select (select string_agg(name, ',') from ws_werkstatt_pcs where benutzer_id = '00000000-0000-0000-0000-0000000000d1') pcs,
       (select details ->> 'name' from ws_protokoll where was = 'pc_entfernt' order by id desc limit 1) protokoll;
\echo [5] Anonym -> FEHLER
set role anon;
select ws_werkstatt_pc_entfernen('00000000-0000-0000-0000-0000000000f2');
reset role;
rollback;
