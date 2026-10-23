-- Rechte-Test Datenbank v22 (App-Designer nach App-Art). Voraussetzung: mock2.sql, 0001 → … → 0022. Aufruf mit -v ON_ERROR_ROLLBACK=on.
\set QUIET 1
\pset footer off
begin;
insert into auth.users values ('00000000-0000-0000-0000-0000000000d2','d2@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D2  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d2'',false) \\g /dev/null'
\echo [1] Neues Projekt: App-Art verwaltung; Admin setzt spiel -> OK; unbekannt -> FEHLER
:ADM
select ws_projekt_anlegen('neu','Neu','Torjäger','','') \g /dev/null
select app_art from ws_projekte where id='neu';
select ws_projekt_app_art('neu','spiel');
select ws_projekt_app_art('neu','rakete');
select app_art from ws_projekte where id='neu';
\echo [2] Leser setzt -> FEHLER
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('d2@x.at','leser',auth.uid(),'neu');
:D2
select ws_einladung_annehmen('D2') \g /dev/null
select ws_projekt_app_art('neu','webseite');
\echo [3] Werte: Spiel + Beispiele t; Beispiel mit < f; zu viele Menuepunkte f; fremder Schluessel f
reset role;
select ws_design_werte_ok('{"spiel":{"feld":"#14532d","figur":"#f59e0b","figur_form":"pixel","punkte":"oben","knoepfe":"gross"},"beispiele":{"menue":["Start","Spiel"],"spiel":{"titel":"Level 1","knoepfe":["Los"]}}}') a,
       ws_design_werte_ok('{"beispiele":{"titel":"<b>x</b>"}}') b,
       ws_design_werte_ok('{"beispiele":{"menue":["1","2","3","4","5","6","7","8"]}}') c,
       ws_design_werte_ok('{"beispiele":{"bild":"x"}}') d;
rollback;
