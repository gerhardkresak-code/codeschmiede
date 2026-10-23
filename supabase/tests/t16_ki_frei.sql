-- Rechte-Test Datenbank v18 (beliebige KI-Anbieter). Voraussetzung: mock2.sql, 0001 → … → 0018. Aufruf mit -v ON_ERROR_ROLLBACK=on.
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
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-D1',true);
\echo [1] Admin legt Copilot an -> OK; Pfad als Programm -> FEHLER; Shell-Zeichen in Argument -> FEHLER; eingebaute Kennung -> FEHLER
:ADM
select ws_ki_anbieter_speichern('{"id":"copilot","name":"GitHub Copilot","programm":"copilot","argumente":["-p","{prompt}","--model={modell}"],"modelle":["gpt-5","claude-sonnet-4.5"]}');
select ws_ki_anbieter_speichern('{"id":"boese","name":"Böse","programm":"C:/Windows/cmd.exe","argumente":[]}');
select ws_ki_anbieter_speichern('{"id":"boese2","name":"Böse","programm":"cmd","argumente":["/c","del x & y"]}');
select ws_ki_anbieter_speichern('{"id":"claude","name":"Fake","programm":"x","argumente":[]}');
\echo [2] Entwickler legt an -> FEHLER; Zuständigkeit mit copilot -> OK; unbekannter Anbieter -> FEHLER
:D1
select ws_ki_anbieter_speichern('{"id":"x1","name":"X","programm":"x","argumente":[]}');
:ADM
select ws_ki_zustaendigkeit_setzen('trainer-to-go','chat','[{"anbieter":"copilot","modell":"gpt-5"},{"anbieter":"claude"}]',90);
select ws_ki_zustaendigkeit_setzen('trainer-to-go','chat','[{"anbieter":"unbekannt"}]',90);
\echo [3] Zulassen ohne/mit falschem Fingerabdruck -> FEHLER; mit richtigem -> OK; Admin aendert -> Zulassung weg (f, leer); alter Abdruck -> FEHLER
:D1
\set FP '(select fp from ws_ki_anbieter where id=''copilot'')'
insert into ws_ki_kopplung(pc_id,benutzer_id,anbieter,zugelassen) values ((select id from ws_werkstatt_pcs where name='PC-D1'),auth.uid(),'copilot',true);
insert into ws_ki_kopplung(pc_id,benutzer_id,anbieter,zugelassen,zugelassen_fp) values ((select id from ws_werkstatt_pcs where name='PC-D1'),auth.uid(),'copilot',true,'falsch');
select fp as alt_fp from ws_ki_anbieter where id='copilot' \gset
insert into ws_ki_kopplung(pc_id,benutzer_id,anbieter,zugelassen,zugelassen_fp) values ((select id from ws_werkstatt_pcs where name='PC-D1'),auth.uid(),'copilot',true,:FP);
:ADM
select ws_ki_anbieter_speichern('{"id":"copilot","name":"GitHub Copilot","programm":"copilot","argumente":["-p","{prompt}"]}');
reset role;
select zugelassen, zugelassen_fp is null as ohne_fp from ws_ki_kopplung where anbieter='copilot';
set role authenticated;
:D1
update ws_ki_kopplung set zugelassen = true, zugelassen_fp = :'alt_fp' where anbieter='copilot';
reset role;
\echo [3b] Shells/Interpreter als Programm -> FEHLER (bash, python3, powershell.exe, node)
set role authenticated;
:ADM
select ws_ki_anbieter_speichern('{"id":"s1","name":"S1","programm":"bash","argumente":["-c","x"]}');
select ws_ki_anbieter_speichern('{"id":"s2","name":"S2","programm":"python3","argumente":["-c","x"]}');
select ws_ki_anbieter_speichern('{"id":"s3","name":"S3","programm":"powershell.exe","argumente":[]}');
select ws_ki_anbieter_speichern('{"id":"s4","name":"S4","programm":"node","argumente":[]}');
reset role;
\echo [4] Loeschen -> Zustaendigkeit ohne copilot
set role authenticated;
:ADM
select ws_ki_anbieter_loeschen('copilot');
select reihe from ws_ki_zustaendigkeit where aufgabe='chat';
reset role;
rollback;
