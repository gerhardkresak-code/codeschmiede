-- Rechte-Test Datenbank v26 (Logo einlesen, Programmieren mit Ersatz). Voraussetzung: mock2.sql, 0001 → … → 0026. Aufruf mit -v ON_ERROR_ROLLBACK=on.
\set QUIET 1
\pset footer off
begin;
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()),('00000000-0000-0000-0000-0000000000e1','e1@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
\set E1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000e1'',false) \\g /dev/null'
:ADM
select ws_projekt_anlegen('neu','Neu','x','','') \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-ADM',true);
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('e1@x.at','leser',auth.uid(),'neu');
:E1
select ws_einladung_annehmen('E1') \g /dev/null
\echo [1] Vektor-Prüfung: gültig -> t; freies Attribut / Skript-Pfad / falsche Farbe -> f
select ws_marke_vektor_ok('{"elemente":[{"t":"rect","x":4,"y":4,"w":56,"h":56,"rx":14,"fill":"#059669"},{"t":"text","x":32,"y":41,"text":"TG","size":24,"weight":700,"anchor":"middle","fill":"#ffffff"}]}') as gut,
       ws_marke_vektor_ok('{"elemente":[{"t":"rect","onclick":"x"}]}') as attr,
       ws_marke_vektor_ok('{"elemente":[{"t":"path","d":"M0 0 url(x)"}]}') as pfad,
       ws_marke_vektor_ok('{"elemente":[{"t":"circle","fill":"red"}]}') as farbe,
       ws_marke_vektor_ok('{"elemente":[{"t":"image"}]}') as bild;
\echo [2] Leser liest ein -> FEHLER; Admin -> OK; falsches Format -> FEHLER
select ws_marke_einlesen('neu','data:image/png;base64,iVBORw0KGgo=');
:ADM
select ws_marke_einlesen('neu','data:image/png;base64,iVBORw0KGgo=','logo<script>.png') > 0 as ok;
select ws_marke_einlesen('neu','data:text/html;base64,PGI+');
select dateiname from ws_marke_vorlagen order by id desc limit 1;
\echo [3] Leser sieht nichts; Admin-Werkstatt nimmt, ungültiges Ergebnis -> fehler; gültiges -> fertig
:E1
select count(*) as leser from ws_marke_vorlagen;
:ADM
select projekt_id from ws_marke_nehmen((select id from ws_werkstatt_pcs where name='PC-ADM'));
select ws_marke_ergebnis((select id from ws_werkstatt_pcs where name='PC-ADM'),(select max(id) from ws_marke_vorlagen),'{"elemente":[{"t":"script"}]}','x');
select stand, hinweis from ws_marke_vorlagen order by id desc limit 1;
select ws_marke_nochmal((select max(id) from ws_marke_vorlagen),'runder');
select count(*) from ws_marke_nehmen((select id from ws_werkstatt_pcs where name='PC-ADM'));
select ws_marke_ergebnis((select id from ws_werkstatt_pcs where name='PC-ADM'),(select max(id) from ws_marke_vorlagen),'{"elemente":[{"t":"circle","cx":32,"cy":32,"r":20,"fill":"#123456"}]}','ok','claude/opus');
select stand from ws_marke_vorlagen order by id desc limit 1;
\echo [4] Marke mit eigen + vektor im Projektlogo -> OK; freies SVG -> FEHLER
select ws_projekt_logo('neu','{"zeichen":"eigen","vektor":{"elemente":[{"t":"circle","cx":32,"cy":32,"r":20,"fill":"#123456"}]}}');
select ws_projekt_logo('neu','{"zeichen":"eigen","vektor":"<svg onload=alert(1)>"}');
\echo [5] Programmieren: Claude + ChatGPT -> OK; nur ChatGPT / Claude + Gemini / drei -> FEHLER
select ws_ki_zustaendigkeit_setzen('neu','bauen','[{"anbieter":"claude"},{"anbieter":"chatgpt"}]');
select ws_ki_zustaendigkeit_setzen('neu','bauen','[{"anbieter":"chatgpt"}]');
select ws_ki_zustaendigkeit_setzen('neu','bauen','[{"anbieter":"claude"},{"anbieter":"gemini"}]');
select ws_ki_zustaendigkeit_setzen('neu','bauen','[{"anbieter":"claude"},{"anbieter":"chatgpt"},{"anbieter":"gemini"}]');
select reihe from ws_ki_zustaendigkeit where projekt_id='neu' and aufgabe='bauen';
rollback;
