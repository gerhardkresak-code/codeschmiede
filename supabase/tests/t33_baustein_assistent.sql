-- Test Datenbank 0039 (Assistent „Neuer Baustein“: Daten, Zuweisung, Bild-Anhang). Voraussetzung: mock2.sql, 0001 → … → 0039.
-- Aufruf mit -v ON_ERROR_ROLLBACK=on. Erwartung steht jeweils in der \echo-Zeile ("-> FEHLER" = Fehlermeldung).
\set QUIET 1
\pset footer off
begin;
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()), ('00000000-0000-0000-0000-0000000000e1','e1@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
\set LE  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000e1'',false) \\g /dev/null'
:ADM
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('d1@x.at','entwickler',auth.uid(),'trainer-to-go'),('e1@x.at','leser',auth.uid(),'trainer-to-go');
:D1
select ws_einladung_annehmen('D1') \g /dev/null
:LE
select ws_einladung_annehmen('LE') \g /dev/null
:ADM
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000d1','plattform',true,false,false) \g /dev/null
\echo [1] Daten-Prüfung: gültig -> t; unbekannter Schlüssel, falsche Art, freies CSS, fehlende Art, Kennung mit Leerzeichen -> f f f f f
select ws_baustein_daten_ok('{"art":"knopf","weg":"vorlage","gestaltung":{"farbe":"#047857","symbol":"Download","groesse":"gross","variante":"umriss","ecken":8},"zuweisung":{"gruppen":["training"],"features":[]}}') a,
       ws_baustein_daten_ok('{"art":"knopf","css":"x"}') b, ws_baustein_daten_ok('{"art":"rakete"}') c,
       ws_baustein_daten_ok('{"art":"knopf","gestaltung":{"farbe":"red;}"}}') d, ws_baustein_daten_ok('{"weg":"vorlage"}') e,
       ws_baustein_daten_ok('{"art":"knopf","zuweisung":{"gruppen":["a b"]}}') f;
\echo [2] D1 stellt Auftrag mit Daten und Bild -> Auftrag; Nachricht hat design + bilder (t | 1 | 1)
:D1
select ws_design_auftrag_neu('trainer-to-go','Download-Knopf','Neuen Baustein bauen: Download-Knopf fuer PDFs.',
  '{"art":"download","weg":"einlesen","gestaltung":{"farbe":"#047857","symbol":"FileDown"},"zuweisung":{"gruppen":["training"]}}',
  'data:image/png;base64,iVBORw0KGgo=','vorlage.png') as a \gset
select (n.daten ? 'design') as daten, jsonb_array_length(n.daten -> 'bilder') as bilder, (select count(*) from ws_auftrag_bilder b where b.auftrag_id = :a) as gespeichert
  from ws_nachrichten n where n.auftrag_id = :a;
\echo [3] Zuweisung an fremde Gruppe/Feature -> 2x FEHLER; SVG-Bild -> FEHLER; ungültige Daten -> FEHLER
select ws_design_auftrag_neu('trainer-to-go','Karte X','Beschreibung lang genug.','{"art":"karte","zuweisung":{"gruppen":["gibt-es-nicht"]}}');
select ws_design_auftrag_neu('trainer-to-go','Karte X','Beschreibung lang genug.','{"art":"karte","zuweisung":{"features":["F-99999"]}}');
select ws_design_auftrag_neu('trainer-to-go','Karte X','Beschreibung lang genug.','{"art":"karte"}','data:image/svg+xml;base64,PHN2Zz4=','x.svg');
select ws_design_auftrag_neu('trainer-to-go','Karte X','Beschreibung lang genug.','{"art":"karte","x":1}');
\echo [4] Fehlschläge legen nichts an: genau 1 Auftrag von D1 -> 1
select count(*) from ws_auftraege where erstellt_von = auth.uid();
\echo [5] Leser ohne Design-Recht -> FEHLER; Leser sieht das Bild nicht -> 0; D1 sieht es -> 1
:LE
select ws_design_auftrag_neu('trainer-to-go','Karte X','Beschreibung lang genug.','{"art":"karte"}');
select count(*) from ws_auftrag_bilder;
:D1
select count(*) from ws_auftrag_bilder;
\echo [6] Direkt einfügen -> FEHLER (kein Schreibrecht)
insert into ws_auftrag_bilder(auftrag_id,bild) values (:a,'data:image/png;base64,AAAA');
\echo [7] Auftrag abgebrochen -> Bild-Vorlage geloescht (0)
reset role;
update ws_auftraege set stand = 'abgebrochen' where id = :a;
select count(*) from ws_auftrag_bilder where auftrag_id = :a;
rollback;
