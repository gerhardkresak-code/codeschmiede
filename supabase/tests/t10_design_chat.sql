-- Rechte-Test Datenbank v8 (Designer-Chat). Voraussetzung: frische Datenbank, mock2.sql, 0001 → … → 0008.
-- Erwartung in den \echo-Zeilen ("-> FEHLER" = Fehlermeldung).
\set QUIET 1
\pset footer off
insert into auth.users values
 ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()),('00000000-0000-0000-0000-0000000000d2','d2@x.at',now()),
 ('00000000-0000-0000-0000-0000000000d3','d3@x.at',now()),('00000000-0000-0000-0000-0000000000b9','b9@x.at',now())
on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
\set D2  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d2'',false) \\g /dev/null'
\set D3  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d3'',false) \\g /dev/null'
\set B9  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000b9'',false) \\g /dev/null'
:ADM
select ws_projekt_anlegen('proj-b','B','','owner/b','') \g /dev/null
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values
 ('d1@x.at','entwickler',auth.uid(),'trainer-to-go'),('d2@x.at','entwickler',auth.uid(),'trainer-to-go'),
 ('d3@x.at','entwickler',auth.uid(),'trainer-to-go'),('b9@x.at','entwickler',auth.uid(),'proj-b');
:D1
select ws_einladung_annehmen('D1') \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-D1',true);
:D2
select ws_einladung_annehmen('D2') \g /dev/null
:D3
select ws_einladung_annehmen('D3') \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-D3',true);
:B9
select ws_einladung_annehmen('B9') \g /dev/null
:ADM
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000d1','plattform',true,false,false) \g /dev/null
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000d3','plattform',true,false,false) \g /dev/null
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000d2','sport',true,false,false) \g /dev/null

\echo [1] D1 fragt -> OK; D2 (kein Design-Recht) -> FEHLER; B9 -> FEHLER; ungueltige Werte -> FEHLER; als Antwort tarnen -> FEHLER
:D1
insert into ws_design_chat(projekt_id,text,werte) values ('trainer-to-go','Mach die Knöpfe besser lesbar','{"farben":{"hell":{"primaer":"#059669"}}}');
:D2
insert into ws_design_chat(projekt_id,text) values ('trainer-to-go','D2 fragt');
:B9
insert into ws_design_chat(projekt_id,text) values ('trainer-to-go','B9 fragt');
:D1
insert into ws_design_chat(projekt_id,text,werte) values ('trainer-to-go','kaputt','{"farben":"x"}');
insert into ws_design_chat(projekt_id,text,frage_id) values ('trainer-to-go','Antwort?',1);
insert into ws_design_chat(projekt_id,text,stand) values ('trainer-to-go','x','beantwortet');

\echo [2] Frage in fremdes Projekt mit eigenem Entwurf als Bezug -> FEHLER
:D1
insert into ws_design_entwuerfe(projekt_id,name,werte) values ('trainer-to-go','E1','{}');
insert into ws_design_chat(projekt_id,entwurf_id,text) values ('proj-b',(select id from ws_design_entwuerfe where name='E1'),'Bezug falsch');

\echo [3] Sichtbarkeit: D2 sieht 1 (gleiches Projekt), B9 sieht 0
:D2
select count(*) as d2_sieht from ws_design_chat;
:B9
select count(*) as b9_sieht from ws_design_chat;

\echo [4] D3 nimmt mit eigenem PC -> keine (nur eigene Fragen); D3 mit fremdem PC -> FEHLER; D1 nimmt -> 1 Frage
:D3
select count(*) as d3_bekommt from ws_design_chat_nehmen((select id from ws_werkstatt_pcs where name='PC-D3'));
select * from ws_design_chat_nehmen((select id from ws_werkstatt_pcs where name='PC-D1'));
:D1
select id, stand from ws_design_chat_nehmen((select id from ws_werkstatt_pcs where name='PC-D1'));

\echo [5] D3 antwortet auf D1s Frage -> FEHLER; D1-Werkstatt antwortet mit gueltigem Vorschlag -> OK; nochmal -> FEHLER
:D3
select ws_design_chat_antwort(1,'Fremde Antwort','{"farben":{"hell":{"primaer":"#000000"}}}');
:D1
select ws_design_chat_antwort(1,'Ein dunkleres Grün hebt den Kontrast auf 5,5 : 1.','{"farben":{"hell":{"primaer":"#047857"}}}') > 0 as beantwortet;
select ws_design_chat_antwort(1,'nochmal');
select stand, (select werte from ws_design_chat a where a.frage_id=1) as vorschlag from ws_design_chat where id=1;

\echo [6] Ungueltiger Vorschlag wird verworfen, Antwort bleibt
insert into ws_design_chat(projekt_id,text) values ('trainer-to-go','Zweite Frage');
select id from ws_design_chat_nehmen((select id from ws_werkstatt_pcs where name='PC-D1')) \g /dev/null
select ws_design_chat_antwort((select max(id) from ws_design_chat where frage_id is null),'Hier ein Vorschlag','{"form":{"radius":"url(x)"}}') \g /dev/null
select text, werte is null as vorschlag_verworfen from ws_design_chat where frage_id=(select max(id) from ws_design_chat where frage_id is null);

\echo [7] Entscheiden: D3 -> FEHLER; D1 uebernommen -> OK; auf Antwort ohne Vorschlag -> FEHLER
:D3
select ws_design_chat_entscheiden((select id from ws_design_chat where frage_id=1),'uebernommen');
:D1
select ws_design_chat_entscheiden((select id from ws_design_chat where frage_id=1),'uebernommen') \g /dev/null
select entscheidung from ws_design_chat where frage_id=1;
select ws_design_chat_entscheiden((select id from ws_design_chat where frage_id=(select max(id) from ws_design_chat where frage_id is null)),'uebernommen');

\echo [8] Direkt aendern/loeschen -> FEHLER (2x); mehr als 5 offene Fragen -> FEHLER beim 6.
update ws_design_chat set stand='beantwortet';
delete from ws_design_chat;
insert into ws_design_chat(projekt_id,text) values ('trainer-to-go','f1'),('trainer-to-go','f2'),('trainer-to-go','f3'),('trainer-to-go','f4'),('trainer-to-go','f5');
insert into ws_design_chat(projekt_id,text) values ('trainer-to-go','f6');
\echo [9] Trigger-Funktion direkt -> FEHLER; anon -> FEHLER
select ws_design_chat_neu();
reset role;
set role anon;
select count(*) from ws_design_chat;
reset role;
