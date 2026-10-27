-- Rechte-Test Datenbank 0050 (Unterhaltungen, Chat-Anhänge, Limits per Knopf). Voraussetzung: mock2.sql, 0001 → … → 0050.
\set QUIET 1
\pset footer off
insert into auth.users values ('00000000-0000-0000-0000-0000000000e1','e1@x.at',now()),('00000000-0000-0000-0000-0000000000e2','e2@x.at',now()),('00000000-0000-0000-0000-0000000000e9','e9@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set E1 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000e1'',false) \\g /dev/null'
\set E2 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000e2'',false) \\g /dev/null'
\set E9 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000e9'',false) \\g /dev/null'
:ADM
select ws_projekt_anlegen('proj-u','U','','owner/u','') \g /dev/null
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('e1@x.at','entwickler',auth.uid(),'trainer-to-go'),('e2@x.at','entwickler',auth.uid(),'trainer-to-go'),('e9@x.at','leser',auth.uid(),'trainer-to-go');
:E1
select ws_einladung_annehmen('E1') \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-E1',true);
:E2
select ws_einladung_annehmen('E2') \g /dev/null
:E9
select ws_einladung_annehmen('E9') \g /dev/null

\echo [1] E1 legt Unterhaltung an -> OK; Leser E9 -> FEHLER; fremdes Projekt -> FEHLER; fremder Besitzer -> FEHLER
:E1
insert into ws_unterhaltungen(projekt_id,titel) values ('trainer-to-go','Kader-Einladungen');
insert into ws_unterhaltungen(projekt_id,titel) values ('proj-u','fremd');
insert into ws_unterhaltungen(projekt_id,titel,besitzer) values ('trainer-to-go','x','00000000-0000-0000-0000-0000000000e2');
:E9
insert into ws_unterhaltungen(projekt_id,titel) values ('trainer-to-go','leser');

\echo [2] Nur eigene sichtbar: E1=1, E2=0
:E1
select count(*) e1 from ws_unterhaltungen;
:E2
select count(*) e2 from ws_unterhaltungen;
\echo [3] E2 schreibt in Unterhaltung von E1 -> FEHLER; E2 aendert/loescht fremde -> 0 Zeilen
insert into ws_claude_chat(projekt_id,ort,text,unterhaltung_id) values ('trainer-to-go','konzept','fremd',(select 1));
update ws_unterhaltungen set titel='gekapert' where true;
delete from ws_unterhaltungen where true;
:E1
select titel from ws_unterhaltungen;

\echo [4] E1 fragt in eigener Unterhaltung, Werkstatt antwortet -> Antwort traegt die Unterhaltung
insert into ws_claude_chat(projekt_id,ort,text,unterhaltung_id) values ('trainer-to-go','konzept','Wie laden wir ein?',(select id from ws_unterhaltungen limit 1));
select id from ws_claude_chat_nehmen((select id from ws_werkstatt_pcs where name='PC-E1')) \g /dev/null
select ws_claude_chat_antwort((select max(id) from ws_claude_chat where frage_id is null),'So.') > 0 as ok;
select count(*) filter (where unterhaltung_id is not null) as mit_unterhaltung, count(*) as alle from ws_claude_chat;

\echo [5] Anhaenge: gueltig -> OK; fremder Benutzer im Pfad / falscher Typ / 6 Stueck -> FEHLER
insert into ws_claude_chat(projekt_id,ort,text,anhaenge) values ('trainer-to-go','konzept','mit Bild','[{"pfad":"00000000-0000-0000-0000-0000000000e1/trainer-to-go/11111111-1111-1111-1111-111111111111.png","name":"skizze.png","typ":"image/png","groesse":2048}]');
insert into ws_claude_chat(projekt_id,ort,text,anhaenge) values ('trainer-to-go','konzept','fremd','[{"pfad":"00000000-0000-0000-0000-0000000000e2/trainer-to-go/11111111-1111-1111-1111-111111111111.png","name":"a.png","typ":"image/png","groesse":1}]');
insert into ws_claude_chat(projekt_id,ort,text,anhaenge) values ('trainer-to-go','konzept','exe','[{"pfad":"00000000-0000-0000-0000-0000000000e1/trainer-to-go/11111111-1111-1111-1111-111111111111.png","name":"a.exe","typ":"application/x-msdownload","groesse":1}]');
insert into ws_claude_chat(projekt_id,ort,text,anhaenge) values ('trainer-to-go','konzept','projekt','[{"pfad":"00000000-0000-0000-0000-0000000000e1/proj-u/11111111-1111-1111-1111-111111111111.png","name":"a.png","typ":"image/png","groesse":1}]');

\echo [6] Speicher: eigener Ordner hochladen -> OK; fremder Ordner -> FEHLER; Leser hochladen -> FEHLER
insert into storage.objects(bucket_id,name) values ('ws-chat','00000000-0000-0000-0000-0000000000e1/trainer-to-go/22222222-2222-2222-2222-222222222222.png');
insert into storage.objects(bucket_id,name) values ('ws-chat','00000000-0000-0000-0000-0000000000e2/trainer-to-go/22222222-2222-2222-2222-222222222222.png');
:E9
insert into storage.objects(bucket_id,name) values ('ws-chat','00000000-0000-0000-0000-0000000000e9/trainer-to-go/33333333-3333-3333-3333-333333333333.png');
\echo [7] E2 sieht Dateien von E1 nicht (0)
:E2
select count(*) e2_dateien from storage.objects where bucket_id='ws-chat';

\echo [8] Limits-Knopf: erstes Mal OK, sofort nochmal -> FEHLER; Werkstatt meldet Ergebnis
:E1
select ws_abo_abruf();
select ws_abo_abruf();
update ws_abo_limits set abruf_erledigt=now(), abruf_art='abruf', abruf_hinweis='ok', fuenf_std_prozent=12, quelle='abruf' where benutzer_id=auth.uid();
select abruf_art, quelle, abruf_angefordert is not null as angefordert from ws_abo_limits where benutzer_id=auth.uid();
\echo [9] E1 aendert fremde Abo-Zeile nicht (E2 hat keine) und kann abruf_angefordert nicht direkt setzen -> FEHLER
update ws_abo_limits set abruf_angefordert = now() - interval '1 hour' where benutzer_id=auth.uid();
\echo [9b] Anhang ohne Pflichtschluessel -> FEHLER
insert into ws_claude_chat(projekt_id,ort,text,anhaenge) values ('trainer-to-go','konzept','leer','[{"name":"x"}]');
\echo [9c] Anhaenge entfernen: eigene -> OK und Pfad in Loesch-Warteschlange (1); fremde -> FEHLER
select ws_chat_anhaenge_entfernen((select id from ws_claude_chat where text='mit Bild'));
select count(*) warteschlange from ws_chat_dateien_weg;
:E2
select ws_chat_anhaenge_entfernen((select max(id) from ws_claude_chat));
select count(*) e2_sieht_warteschlange from ws_chat_dateien_weg;
:E1
\echo [9d] Austragen nur, wenn Datei weg: vorhandene Datei bleibt (0), nach Loeschen (1)
insert into storage.objects(bucket_id,name) values ('ws-chat','00000000-0000-0000-0000-0000000000e1/trainer-to-go/11111111-1111-1111-1111-111111111111.png');
select ws_chat_dateien_erledigt(array['00000000-0000-0000-0000-0000000000e1/trainer-to-go/11111111-1111-1111-1111-111111111111.png']) as bleibt;
delete from storage.objects where name='00000000-0000-0000-0000-0000000000e1/trainer-to-go/11111111-1111-1111-1111-111111111111.png';
select ws_chat_dateien_erledigt(array['00000000-0000-0000-0000-0000000000e1/trainer-to-go/11111111-1111-1111-1111-111111111111.png']) as erledigt;
\echo [10] Unterhaltung loeschen entfernt ihre Nachrichten
delete from ws_unterhaltungen where true;
select count(*) filter (where unterhaltung_id is not null) as rest from ws_claude_chat;
reset role;
