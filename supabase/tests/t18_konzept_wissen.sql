-- Rechte-Test Datenbank v20 (Konzept zuerst, Wissen). Voraussetzung: mock2.sql, 0001 → … → 0020. Aufruf mit -v ON_ERROR_ROLLBACK=on.
\set QUIET 1
\pset footer off
begin;
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()),('00000000-0000-0000-0000-0000000000d2','d2@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
\set D2  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d2'',false) \\g /dev/null'
\echo [1] Neues Projekt -> Konzept ist erste Gruppe im Bereich App (neu-konzept vor neu-oberflaeche)
:ADM
select ws_projekt_anlegen('neu','Neu','Kassenbuch','','') \g /dev/null
select konzept_gruppe_id from ws_projekte where id='neu';
select string_agg(g.id, ' > ' order by g.reihenfolge) as reihenfolge from ws_gruppen g where g.bereich_id='neu-app';
\echo [2] Bestehendes Projekt trainer-to-go hat Konzept (Bereich App neu, als erster)
reset role;
select p.konzept_gruppe_id, b.name, b.reihenfolge <= (select min(reihenfolge) from ws_bereiche where projekt_id='trainer-to-go') as erster
  from ws_projekte p join ws_gruppen g on g.id=p.konzept_gruppe_id join ws_bereiche b on b.id=g.bereich_id where p.id='trainer-to-go';
set role authenticated;
\echo [3] Rollen: D1 Entwickler, D2 Leser
:ADM
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('d1@x.at','entwickler',auth.uid(),'neu'),('d2@x.at','leser',auth.uid(),'neu');
:D1
select ws_einladung_annehmen('D1') \g /dev/null
:D2
select ws_einladung_annehmen('D2') \g /dev/null
\echo [4] D1 traegt von Hand ein -> OK; D2 (Leser) -> FEHLER; falsches Kapitel -> FEHLER; D2 sieht Eintrag (1)
:D1
select ws_wissen_eintragen('neu','ziel','Kassier und Vorstand eines Vereins') > 0 as ok;
:D2
select ws_wissen_eintragen('neu','ziel','Darf ich nicht');
:D1
select ws_wissen_eintragen('neu','boese','x x x');
:D2
select count(*) as d2_sieht from ws_wissen where projekt_id='neu';
insert into ws_wissen(projekt_id,kapitel,text) values ('neu','ziel','direkt geht nicht');
\echo [5] Vorschlag aus Chat: D1 fragt, Antwort mit wissen-Vorschlag; D2 uebernimmt -> FEHLER; D1 -> OK; zweimal -> FEHLER
:D1
insert into ws_claude_chat(projekt_id,ort,text) values ('neu','konzept','Wer nutzt die App?');
reset role;
select id as frage from ws_claude_chat where projekt_id='neu' and frage_id is null order by id desc limit 1 \gset
insert into ws_claude_chat(projekt_id,ort,frage_id,von,text,vorschlag,stand) values ('neu','konzept',:frage,null,'Halte ich fest','{"wissen":{"kapitel":"funktionen","text":"Buchungen mit Belegfoto"}}','beantwortet');
select id as antwort from ws_claude_chat where frage_id=:frage \gset
set role authenticated;
:D2
select ws_wissen_uebernehmen(:antwort);
:D1
select ws_wissen_uebernehmen(:antwort) > 0 as ok;
select ws_wissen_uebernehmen(:antwort);
select kapitel, text from ws_wissen where projekt_id='neu' order by id;
\echo [6] Vorschlag-Pruefung: wissen gueltig t, falsches Kapitel f, Zusatzschluessel f
reset role;
select ws_vorschlag_ok('neu','{"wissen":{"kapitel":"daten","text":"Keine Personendaten"}}') a, ws_vorschlag_ok('neu','{"wissen":{"kapitel":"x","text":"abc"}}') b, ws_vorschlag_ok('neu','{"wissen":{"kapitel":"daten","text":"abc"},"titel":"x"}') c;
\echo [7] Loeschen: D2 -> FEHLER; Admin -> OK
set role authenticated;
:D2
select ws_wissen_loeschen((select min(id) from ws_wissen where projekt_id='neu'));
:ADM
select ws_wissen_loeschen((select min(id) from ws_wissen where projekt_id='neu'));
select count(*) as rest from ws_wissen where projekt_id='neu';
reset role;
rollback;
