-- Rechte-Test Datenbank v36 (Aufträge aus dem App-Designer atomar). Voraussetzung: mock2.sql, 0001 → … → 0036. Aufruf mit -v ON_ERROR_ROLLBACK=on.
-- Erwartung steht jeweils in der \echo-Zeile ("-> FEHLER" = Fehlermeldung).
\set QUIET 1
\pset footer off
begin;
insert into auth.users values
 ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()),   -- Entwickler mit Auftragsrecht im Design-Bereich (plattform)
 ('00000000-0000-0000-0000-0000000000d2','d2@x.at',now()),   -- Entwickler nur in „sport“
 ('00000000-0000-0000-0000-0000000000e1','e1@x.at',now())    -- Leser
on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
\set D2  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d2'',false) \\g /dev/null'
\set LE  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000e1'',false) \\g /dev/null'
:ADM
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values
 ('d1@x.at','entwickler',auth.uid(),'trainer-to-go'),('d2@x.at','entwickler',auth.uid(),'trainer-to-go'),('e1@x.at','leser',auth.uid(),'trainer-to-go');
:D1
select ws_einladung_annehmen('D1') \g /dev/null
:D2
select ws_einladung_annehmen('D2') \g /dev/null
:LE
select ws_einladung_annehmen('LE') \g /dev/null
:ADM
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000d1','plattform',true,false,false) \g /dev/null
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000d2','sport',true,false,false) \g /dev/null

\echo [1] D1 legt Baustein-Auftrag an -> OK; Auftrag und Nachricht sind gemeinsam da (1 | 1 | wartet | Neuer Baustein: Spieltag-Karte)
:D1
select ws_design_auftrag('trainer-to-go','baustein','Spieltag-Karte','Neuen Baustein bauen: Spieltag-Karte mit Gegner, Uhrzeit und Ort.') as a \gset
select count(*) as auftraege, (select count(*) from ws_nachrichten n where n.auftrag_id = :a and n.von = auth.uid() and n.kanal = 'codeschmiede') as nachrichten,
  min(stand) as stand, min(titel) as titel from ws_auftraege where id = :a;
\echo [1b] Kachel-Auftrag -> OK (Titel mit Vorsilbe)
select ws_design_auftrag('trainer-to-go','kachel','Wetter am Platz','Neue Kachel-Art fuer den Seiten-Designer: Wetter am Platz.') as k \gset
select titel from ws_auftraege where id = :k;
\echo [2] Ohne Recht: D2 (nur sport) -> FEHLER; Leser -> FEHLER
:D2
select ws_design_auftrag('trainer-to-go','baustein','X-Karte','Beschreibung lang genug.');
:LE
select ws_design_auftrag('trainer-to-go','baustein','X-Karte','Beschreibung lang genug.');
\echo [3] Eingaben: zu kurzer Text, zu langer Name, unbekannte Art, Steuerzeichen, fremdes Projekt -> 5x FEHLER
:D1
select ws_design_auftrag('trainer-to-go','baustein','Karte','kurz');
select ws_design_auftrag('trainer-to-go','baustein',repeat('x',81),'Beschreibung lang genug.');
select ws_design_auftrag('trainer-to-go','feature','Karte','Beschreibung lang genug.');
select ws_design_auftrag('trainer-to-go','baustein','Kar' || chr(7) || 'te','Beschreibung lang genug.');
select ws_design_auftrag('gibt-es-nicht','baustein','Karte','Beschreibung lang genug.');
\echo [4] Fehlschlag legt nichts halb an: weiterhin genau 2 Auftraege von D1 mit je einer Nachricht (2 | 2)
select count(*) as auftraege, (select count(*) from ws_nachrichten n join ws_auftraege a on a.id = n.auftrag_id where a.erstellt_von = auth.uid()) as nachrichten
  from ws_auftraege where erstellt_von = auth.uid();
\echo [5] Anonym -> FEHLER (keine Ausfuehrungsrechte)
reset role; set role anon;
select ws_design_auftrag('trainer-to-go','baustein','Karte','Beschreibung lang genug.');
reset role;
\echo [6] Protokoll hat 2 Eintraege design_auftrag
select count(*) from ws_protokoll where was = 'design_auftrag';
rollback;
