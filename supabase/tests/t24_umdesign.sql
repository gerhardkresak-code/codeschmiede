-- Rechte-Test Datenbank v27 (Symbole und Grundbausteine umdesignen). Voraussetzung: mock2.sql, 0001 → … → 0027. Aufruf mit -v ON_ERROR_ROLLBACK=on.
\set QUIET 1
\pset footer off
begin;
insert into auth.users values ('00000000-0000-0000-0000-0000000000e1','e1@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set E1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000e1'',false) \\g /dev/null'
:ADM
select ws_projekt_anlegen('neu','Neu','x','','') \g /dev/null
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('e1@x.at','leser',auth.uid(),'neu');
:E1
select ws_einladung_annehmen('E1') \g /dev/null
\echo [1] Werte-Prüfung
select ws_umdesign_werte_ok('symbol','{"neu":"CalendarCheck"}') as lucide,
       ws_umdesign_werte_ok('symbol','{"eigen":{"name":"Tor","pfade":["M2 20h20"],"kreise":[{"cx":12,"cy":13,"r":3}]}}') as eigen,
       ws_umdesign_werte_ok('symbol','{"neu":"<svg>"}') as boese,
       ws_umdesign_werte_ok('symbol','{"eigen":{"pfade":["M0 0 url(x)"]}}') as pfad,
       ws_umdesign_werte_ok('baustein','{"einstellungen":{"hintergrund":"#fef3c7","ecken":"pille","symbol":"AlertTriangle"}}') as baustein,
       ws_umdesign_werte_ok('baustein','{"einstellungen":{"css":"color:red"}}') as css,
       ws_umdesign_werte_ok('baustein','{"neu":"Calendar"}') as falsche_art;
\echo [2] Leser speichert -> FEHLER; Admin -> OK; ohne Stelle / fremde Pfade -> FEHLER
select ws_umdesign_speichern(null,'neu','symbol','Calendar','{"neu":"CalendarCheck"}',array['src/pages/Kalender.jsx'],3);
:ADM
select ws_umdesign_speichern(null,'neu','symbol','Calendar','{"neu":"CalendarCheck"}',array['src/pages/Kalender.jsx','src/pages/Home.jsx'],3) > 0 as ok;
select ws_umdesign_speichern(null,'neu','symbol','Calendar','{"neu":"CalendarCheck"}','{}',3);
select ws_umdesign_speichern(null,'neu','symbol','Calendar','{"neu":"CalendarCheck"}',array['../../etc/passwd.js'],3);
select ws_umdesign_speichern(null,'neu','symbol','Calendar','{"neu":"CalendarCheck"}',array['src/../x.js'],3);
\echo [3] Senden: Leser -> FEHLER; Admin -> Auftrag in der Design-Gruppe; nochmal -> FEHLER
:E1
select count(*) as leser_sieht from ws_umdesign;
select ws_umdesign_senden((select max(id) from ws_umdesign),'Symbol tauschen bitte');
:ADM
select ws_umdesign_senden((select max(id) from ws_umdesign),'Symbol Calendar durch CalendarCheck ersetzen') > 0 as ok;
select ws_umdesign_senden((select max(id) from ws_umdesign),'nochmal senden');
select a.titel, a.gruppe_id = p.design_gruppe_id as design_gruppe from ws_auftraege a join ws_umdesign u on u.auftrag_id = a.id join ws_projekte p on p.id = u.projekt_id;
select position('src/pages/Home.jsx' in n.text) > 0 as stellen_im_text from ws_nachrichten n join ws_umdesign u on u.auftrag_id = n.auftrag_id;
\echo [4] Direkt schreiben -> FEHLER
insert into ws_umdesign(projekt_id,art,ziel,stellen) values ('neu','symbol','X',array['src/a.js']);
\echo [5] NULL-Stelle -> FEHLER; nur Beschreibung senden -> FEHLER; Beschreibung nicht als geprüft
:ADM
select ws_umdesign_speichern(null,'neu','symbol','Calendar','{"neu":"CalendarCheck"}',array['src/a.js',null],3);
select ws_umdesign_speichern(null,'neu','symbol','Bell','{"beschreibung":"nur Text"}',array['src/a.js'],1) > 0 as ok;
select ws_umdesign_senden((select max(id) from ws_umdesign),'Symbol Bell bitte ändern');
select ws_umdesign_speichern(null,'neu','symbol','Star','{"neu":"Sparkles","beschreibung":"GEHEIMHINWEIS"}',array['src/a.js'],1) > 0 as ok;
select ws_umdesign_senden((select max(id) from ws_umdesign),'Symbol Star bitte ändern') > 0 as ok;
select position('GEHEIMHINWEIS' in n.text) = 0 as beschreibung_nicht_angehaengt from ws_nachrichten n join ws_umdesign u on u.auftrag_id = n.auftrag_id where u.ziel = 'Star';
rollback;
