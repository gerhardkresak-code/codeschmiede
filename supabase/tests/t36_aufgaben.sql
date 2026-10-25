-- Test Datenbank 0042 (Aufgaben: Rechte nach Projekt, Prüfungen, Anhänge im privaten Speicher, In den Chat schicken, Als Auftrag).
-- Voraussetzung: mock2.sql (mit Speicher-Nachbau), 0001 → … → 0042. Aufruf mit -v ON_ERROR_ROLLBACK=on.
-- Erwartung steht jeweils in der \echo-Zeile ("-> FEHLER" = Fehlermeldung). Nur erfundene Test-Konten.
\set QUIET 1
\pset footer off
begin;
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()), ('00000000-0000-0000-0000-0000000000e1','e1@x.at',now()),
  ('00000000-0000-0000-0000-0000000000f1','f1@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
\set LE  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000e1'',false) \\g /dev/null'
\set FR  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000f1'',false) \\g /dev/null'
:ADM
select ws_projekt_anlegen('zweit','Zweites Projekt','', '', 'layers') \g /dev/null
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('d1@x.at','entwickler',auth.uid(),'trainer-to-go'),('e1@x.at','leser',auth.uid(),'trainer-to-go'),('f1@x.at','entwickler',auth.uid(),'zweit');
insert into ws_features(id,gruppe_id,name,quelle,erstellt_von) values ('N-T1','training','Trainingsplan','manuell',auth.uid());
:D1
select ws_einladung_annehmen('D1') \g /dev/null
:LE
select ws_einladung_annehmen('LE') \g /dev/null
:FR
select ws_einladung_annehmen('FR') \g /dev/null
:ADM
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000d1','sport',true,false,false) \g /dev/null

\echo [1] Entwickler legt Aufgabe an -> id; Leser legt an -> FEHLER
:D1
insert into ws_aufgaben(projekt_id,titel,beschreibung,prioritaet,feature_id,links)
  values ('trainer-to-go','Schnellzugriffe zu klein','Am Handy sind die Kacheln zu klein zum Tippen.','hoch','N-T1','[{"titel":"Testfassung","url":"https://main.trainer-to-go.pages.dev/start?x=1"}]')
  returning id as a \gset
select :a > 0 as angelegt, (select erstellt_von = auth.uid() from ws_aufgaben where id = :a) as herkunft;
:LE
insert into ws_aufgaben(projekt_id,titel) values ('trainer-to-go','Leser darf nicht');
\echo [2] Sehen: Leser 1, Mitglied eines anderen Projekts 0
select count(*) as leser from ws_aufgaben;
:FR
select count(*) as fremd from ws_aufgaben;
\echo [3] Zuständig: Leser (Mitglied) -> ok; Fremder -> FEHLER; Bezug fremde Gruppe -> FEHLER; Feature UND Gruppe -> FEHLER
:D1
update ws_aufgaben set zustaendig = '00000000-0000-0000-0000-0000000000e1' where id = :a;
select zustaendig is not null as zustaendig_gesetzt from ws_aufgaben where id = :a;
update ws_aufgaben set zustaendig = '00000000-0000-0000-0000-0000000000f1' where id = :a;
update ws_aufgaben set feature_id = null, gruppe_id = 'zweit-funktionen' where id = :a;
update ws_aufgaben set gruppe_id = 'training' where id = :a;
\echo [4] Links: http, Zugangsdaten im Rechnernamen, token= in der Adresse, javascript:, Leerzeichen, fremder Schluessel -> 6x FEHLER
update ws_aufgaben set links = '[{"titel":"x","url":"http://example.org/"}]' where id = :a;
update ws_aufgaben set links = '[{"titel":"x","url":"https://user:pass@example.org/"}]' where id = :a;
update ws_aufgaben set links = '[{"titel":"x","url":"https://example.org/a?access_token=abc"}]' where id = :a;
update ws_aufgaben set links = '[{"titel":"x","url":"javascript:alert(1)"}]' where id = :a;
update ws_aufgaben set links = '[{"titel":"x","url":"https://example.org/a b"}]' where id = :a;
update ws_aufgaben set links = '[{"titel":"x","url":"https://example.org/","x":1}]' where id = :a;
\echo [5] Herkunft und Projekt ändern -> 2x FEHLER; unsichtbare Zeichen im Titel -> FEHLER; Status erledigt setzt erledigt_am -> t
update ws_aufgaben set erstellt_von = auth.uid() where id = :a;
update ws_aufgaben set projekt_id = 'zweit' where id = :a;
update ws_aufgaben set titel = E'Titel\u202emit Richtungszeichen' where id = :a;
update ws_aufgaben set status = 'erledigt' where id = :a;
select erledigt_am is not null as erledigt_am from ws_aufgaben where id = :a;
update ws_aufgaben set status = 'offen' where id = :a;
\echo [6] Anhänge reservieren: PNG 1 MB -> Pfad; PNG 6 MB, SVG, PDF 11 MB -> 3x FEHLER; Leser -> FEHLER
select pfad as p1, id as anh1 from ws_aufgabe_anhang_neu(:a, '../Handy Startseite<x>.png', 'image/png', 1048576) \gset
select :'p1' ~ ('^trainer-to-go/' || :a || '/[0-9a-f-]{36}\.png$') as pfad_ok, (select dateiname from ws_aufgabe_anhaenge where id = :anh1) as name;
select * from ws_aufgabe_anhang_neu(:a, 'gross.png', 'image/png', 6291456);
select * from ws_aufgabe_anhang_neu(:a, 'x.svg', 'image/svg+xml', 100);
select * from ws_aufgabe_anhang_neu(:a, 'gross.pdf', 'application/pdf', 11534336);
:LE
select * from ws_aufgabe_anhang_neu(:a, 'x.png', 'image/png', 100);
\echo [7] Speicher: Hochladen an reservierten Pfad -> ok (1); an anderen Pfad -> FEHLER; Leser hochladen -> FEHLER
:D1
insert into storage.objects(bucket_id,name) values ('ws-aufgaben', :'p1');
select count(*) as hochgeladen from storage.objects where name = :'p1';
insert into storage.objects(bucket_id,name) values ('ws-aufgaben', 'trainer-to-go/' || :a || '/00000000-0000-0000-0000-000000000000.png');
:LE
insert into storage.objects(bucket_id,name) values ('ws-aufgaben', 'trainer-to-go/' || :a || '/00000000-0000-0000-0000-000000000001.pdf');
\echo [8] Speicher lesen: Leser 1, Mitglied eines anderen Projekts 0; Bucket ist privat -> f
select count(*) as leser_sieht from storage.objects where bucket_id = 'ws-aufgaben';
:FR
select count(*) as fremd_sieht from storage.objects where bucket_id = 'ws-aufgaben';
select public from storage.buckets where id = 'ws-aufgaben';
\echo [9] Datei mit Eintrag löschen -> 0 Zeilen (geschützt)
:D1
delete from storage.objects where name = :'p1';
select count(*) as noch_da from storage.objects where name = :'p1';
\echo [10] In den Chat schicken: Ziel Feature -> Sendung mit 1 Anhang und 1 Link; fremde Gruppe, beide Ziele, kein Ziel -> 3x FEHLER; Leser -> FEHLER
select ws_aufgabe_senden(:a, 'N-T1', null) as s \gset
select gruppe_id, feature_id, jsonb_array_length(anhaenge) as anhaenge, jsonb_array_length(links) as links from ws_aufgabe_sendungen where id = :s;
select ws_aufgabe_senden(:a, null, 'zweit-funktionen');
select ws_aufgabe_senden(:a, 'N-T1', 'training');
select ws_aufgabe_senden(:a, null, null);
:LE
select ws_aufgabe_senden(:a, null, 'training');
\echo [11] Zu kurze Beschreibung -> FEHLER
:D1
insert into ws_aufgaben(projekt_id,titel,beschreibung) values ('trainer-to-go','Kurz','kurz') returning id as b \gset
select ws_aufgabe_senden(:b, null, 'training');
\echo [12] Als Auftrag: Leser -> FEHLER; Entwickler mit Auftragsrecht -> Auftrag (Gruppe training, Feature N-T1, Nachricht mit daten.aufgabe, 1 Anhang); Aufgabe in Arbeit
:LE
select ws_aufgabe_als_auftrag(:s);
:D1
select ws_aufgabe_als_auftrag(:s) as auf \gset
select a.gruppe_id, a.feature_id, a.stand, a.titel from ws_auftraege a where a.id = :auf;
select n.von = auth.uid() as von_mir, (n.daten -> 'aufgabe' ->> 'id')::bigint = :a as aufgabe, jsonb_array_length(n.daten -> 'aufgabe' -> 'anhaenge') as anhaenge, n.text like '**Aufgabe: %' as text
  from ws_nachrichten n where n.auftrag_id = :auf;
select status from ws_aufgaben where id = :a;
\echo [13] Zweimal Als Auftrag -> FEHLER; Zurückziehen danach -> FEHLER; neue Sendung zurückziehen -> ok, danach Als Auftrag -> FEHLER
select ws_aufgabe_als_auftrag(:s);
select ws_aufgabe_sendung_zurueckziehen(:s);
select ws_aufgabe_senden(:a, null, 'training') as s2 \gset
select ws_aufgabe_sendung_zurueckziehen(:s2) \g /dev/null
select zurueckgezogen is not null as zurueckgezogen from ws_aufgabe_sendungen where id = :s2;
select ws_aufgabe_als_auftrag(:s2);
\echo [14] Direkt schreiben in Anhänge/Sendungen -> 2x FEHLER
insert into ws_aufgabe_anhaenge(aufgabe_id,projekt_id,art,dateiname,mime,groesse,pfad) values (:a,'trainer-to-go','datei','x.pdf','application/pdf',1,'trainer-to-go/1/00000000-0000-0000-0000-000000000000.pdf');
insert into ws_aufgabe_sendungen(aufgabe_id,projekt_id,gruppe_id,titel,text) values (:a,'trainer-to-go','training','xx','yy');
\echo [15] Anhang entfernen -> Pfad; danach Datei löschen -> 0 übrig
select ws_aufgabe_anhang_loeschen(:anh1) = :'p1' as pfad_zurueck;
delete from storage.objects where name = :'p1';
select count(*) as uebrig from storage.objects where name = :'p1';
\echo [16] Höchstens 20 Anhänge: 20 ok, 21. -> FEHLER
select count(*) as reserviert from generate_series(1,20) i, lateral ws_aufgabe_anhang_neu(:a, 'b' || i || '.pdf', 'application/pdf', 10) x;
select * from ws_aufgabe_anhang_neu(:a, 'zuviel.pdf', 'application/pdf', 10);
\echo [17] Löschen: Leser -> FEHLER; Mitglied anderer Projekt -> FEHLER; wer angelegt hat -> 20 Pfade, Aufgabe weg (0)
:LE
select ws_aufgabe_loeschen(:a);
:FR
select ws_aufgabe_loeschen(:a);
:D1
select count(*) as pfade from ws_aufgabe_loeschen(:a);
select count(*) as weg from ws_aufgaben where id = :a;
rollback;
