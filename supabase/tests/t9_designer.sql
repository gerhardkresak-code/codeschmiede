-- Rechte-Test Datenbank v7 (App-Designer, Etappe 1)
-- Voraussetzung: frische Datenbank mit mock2.sql, dann 0001 → … → 0007 eingespielt.
-- Erwartung steht jeweils in der \echo-Zeile ("-> FEHLER" = Fehlermeldung, "-> 0" = keine Zeile betroffen).
\set QUIET 1
\pset footer off
insert into auth.users values
 ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()),   -- Entwickler: Aufträge in „plattform“ (darf gestalten)
 ('00000000-0000-0000-0000-0000000000d2','d2@x.at',now()),   -- Entwickler: Aufträge nur in „sport“ (darf nicht gestalten)
 ('00000000-0000-0000-0000-0000000000b9','b9@x.at',now())    -- nur Projekt B
on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
\set D2  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d2'',false) \\g /dev/null'
\set B9  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000b9'',false) \\g /dev/null'
:ADM
select ws_projekt_anlegen('proj-b','B','','owner/b','') \g /dev/null
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values
 ('d1@x.at','entwickler',auth.uid(),'trainer-to-go'),('d2@x.at','entwickler',auth.uid(),'trainer-to-go'),('b9@x.at','entwickler',auth.uid(),'proj-b');
:D1
select ws_einladung_annehmen('D1') \g /dev/null
:D2
select ws_einladung_annehmen('D2') \g /dev/null
:B9
select ws_einladung_annehmen('B9') \g /dev/null
:ADM
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000d1','plattform',true,false,false) \g /dev/null
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000d2','sport',true,false,false) \g /dev/null

\echo [1] D1 legt Entwurf an -> OK; D2 (kein Recht im Design-Bereich) -> FEHLER; B9 (anderes Projekt) -> FEHLER
:D1
insert into ws_design_entwuerfe(projekt_id,name,werte) values ('trainer-to-go','Hell & klar','{"farben":{"hell":{"primaer":"#047857"}}}');
:D2
insert into ws_design_entwuerfe(projekt_id,name,werte) values ('trainer-to-go','D2','{}');
:B9
insert into ws_design_entwuerfe(projekt_id,name,werte) values ('trainer-to-go','B9','{}');
\echo [1b] D1 legt Entwurf gleich als live/gesendet bzw. mit fremdem Ersteller an -> FEHLER (2x)
:D1
insert into ws_design_entwuerfe(projekt_id,name,stand) values ('trainer-to-go','X','live');
insert into ws_design_entwuerfe(projekt_id,name,erstellt_von) values ('trainer-to-go','X','00000000-0000-0000-0000-0000000000d2');

\echo [2] Sichtbarkeit: D2 sieht 1 (gleiches Projekt), B9 sieht 0
:D2
select count(*) as d2_sieht from ws_design_entwuerfe;
:B9
select count(*) as b9_sieht from ws_design_entwuerfe;

\echo [3] Direktes Aendern/Loeschen durch D1 -> 0 (nur ueber Funktionen)
:D1
update ws_design_entwuerfe set stand='live';
delete from ws_design_entwuerfe;
\echo [3b] D1 speichert -> Version 2; D2 speichert fremden Entwurf -> FEHLER; Werte kein Objekt -> FEHLER
select ws_design_speichern((select id from ws_design_entwuerfe where name='Hell & klar'),'{"farben":{"hell":{"primaer":"#065f46"}}}') as version;
select ws_design_speichern((select id from ws_design_entwuerfe where name='Hell & klar'),'[1,2]');
:D2
select ws_design_speichern((select id from ws_design_entwuerfe where name='Hell & klar'),'{}');
select count(*) as versionen_sichtbar from ws_design_versionen;

\echo [4] D2 sendet fremden Entwurf -> FEHLER; D1 sendet -> Auftrag in Gruppe design; zweites Senden -> FEHLER; Speichern danach -> FEHLER
select ws_design_senden((select id from ws_design_entwuerfe where name='Hell & klar'),'Bitte umsetzen: Primärfarbe dunkler');
:D1
select ws_design_senden((select id from ws_design_entwuerfe where name='Hell & klar'),'Bitte umsetzen: Primärfarbe dunkler') > 0 as gesendet;
select a.gruppe_id, a.titel, a.stand, (select count(*) from ws_nachrichten n where n.auftrag_id=a.id and n.daten ? 'werte') as nachricht_mit_werten
  from ws_auftraege a where a.titel like 'Grunddesign:%';
select ws_design_senden((select id from ws_design_entwuerfe where name='Hell & klar'),'nochmal senden bitte');
select ws_design_speichern((select id from ws_design_entwuerfe where name='Hell & klar'),'{}');

\echo [5] Auftrag geht live (Admin setzt wissen) -> Entwurf live; zweiter Entwurf live -> erster ersetzt
:ADM
update ws_auftraege set stand='wissen' where titel='Grunddesign: Hell & klar';
:D1
insert into ws_design_entwuerfe(projekt_id,name,werte) values ('trainer-to-go','Dunkler','{}');
select ws_design_senden((select id from ws_design_entwuerfe where name='Dunkler'),'Zweiter Entwurf umsetzen') > 0 as gesendet2;
:ADM
update ws_auftraege set stand='wissen' where titel='Grunddesign: Dunkler';
select name, stand from ws_design_entwuerfe order by id;

\echo [6] Abgebrochener Auftrag -> Entwurf wieder bearbeitbar; verwerfen -> verworfen; D2 verwirft fremden -> FEHLER
:D1
insert into ws_design_entwuerfe(projekt_id,name,werte) values ('trainer-to-go','Probe','{}');
select ws_design_senden((select id from ws_design_entwuerfe where name='Probe'),'Probe umsetzen bitte') > 0 as gesendet3;
:ADM
update ws_auftraege set stand='abgebrochen' where titel='Grunddesign: Probe';
:D2
select ws_design_verwerfen((select id from ws_design_entwuerfe where name='Probe'));
:D1
select stand as probe_nach_abbruch from ws_design_entwuerfe where name='Probe';
select ws_design_verwerfen((select id from ws_design_entwuerfe where name='Probe')) \g /dev/null
select stand as probe_verworfen from ws_design_entwuerfe where name='Probe';
\echo [7] Trigger-Funktion direkt aufrufen -> FEHLER
select ws_design_nach_auftrag();
reset role;

-- Nachprüfung 2026-10-23 (Befunde R1, R2, O3–O7)
\set QUIET 1
insert into auth.users values ('00000000-0000-0000-0000-0000000000c3','t3@x.at',now()) on conflict do nothing;
set role authenticated;
:ADM
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('t3@x.at','texter',auth.uid(),'trainer-to-go');
\set T3 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000c3'',false) \\g /dev/null'
:T3
select ws_einladung_annehmen('T3') \g /dev/null
:ADM
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000c3','plattform',true,false,false) \g /dev/null
\echo [R1] Texter legt Design-Entwurf an -> FEHLER
:T3
insert into ws_design_entwuerfe(projekt_id,name,werte) values ('trainer-to-go','T3','{}');
\echo [R2] Unbekannte Schluessel / __proto__ / CSS-url / Zahl ausserhalb -> FEHLER (4x)
:D1
insert into ws_design_entwuerfe(projekt_id,name,werte) values ('trainer-to-go','P1','{"__proto__":{"x":1}}');
insert into ws_design_entwuerfe(projekt_id,name,werte) values ('trainer-to-go','P2','{"farben":"kaputt"}');
insert into ws_design_entwuerfe(projekt_id,name,werte) values ('trainer-to-go','P3','{"farben":{"hell":{"primaer":"url(https://fremd/x)"}}}');
insert into ws_design_entwuerfe(projekt_id,name,werte) values ('trainer-to-go','P4','{"form":{"radius":999}}');
\echo [R2b] Gueltige Werte -> OK; speichern mit kaputten Werten -> FEHLER
insert into ws_design_entwuerfe(projekt_id,name,werte) values ('trainer-to-go','Gut','{"farben":{"dunkel":{"primaer":"#10B981"}},"menue":{"aufklappbar":false,"handy":"burger"},"schrift":{"basis":16,"gewicht":600}}');
select ws_design_speichern((select id from ws_design_entwuerfe where name='Gut'),'{"logo":{"platz":"irgendwo"}}');
\echo [O5] Version 1 liegt beim Anlegen vor -> 1
select count(*) as v1 from ws_design_versionen where entwurf_id=(select id from ws_design_entwuerfe where name='Gut') and nr=1;
\echo [O6] Id/Zeitstempel/Ersteller vorgeben -> FEHLER (2x)
insert into ws_design_entwuerfe(id,projekt_id,name) values (1000,'trainer-to-go','X');
insert into ws_design_entwuerfe(projekt_id,name,erstellt) values ('trainer-to-go','X','2000-01-01');
\echo [O3] Werkstatt holt abgebrochenen Auftrag zurueck -> FEHLER
:ADM
update ws_auftraege set stand='abgebrochen' where titel='Grunddesign: Gut' or id=(select max(id) from ws_auftraege);
:D1
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-D1',true);
update ws_auftraege set stand='laeuft' where id=(select max(id) from ws_auftraege);
\echo [O4] Design-Auftrag erledigt -> Entwurf wieder entwurf
select ws_design_senden((select id from ws_design_entwuerfe where name='Gut'),'Gut umsetzen bitte') > 0 as gesendet4;
:ADM
update ws_auftraege set stand='erledigt' where titel='Grunddesign: Gut';
select stand as gut_nach_erledigt from ws_design_entwuerfe where name='Gut';
reset role;
