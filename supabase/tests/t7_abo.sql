-- Rechte-Test Datenbank v3 (ws_abo_limits, ws_abo_schwellen_setzen) – unabhängige Prüfung 2026-10-22
-- Voraussetzung: frische Datenbank mit mock2.sql, dann 0001 → 0002 → 0003 eingespielt.
-- Erwartung steht jeweils in der \echo-Zeile ("-> FEHLER" = Fehlermeldung erwartet, "-> 0" = keine Zeile betroffen/sichtbar).
\set QUIET 1
\pset footer off
insert into auth.users values
 ('00000000-0000-0000-0000-0000000000a1','pa@x.at',now()),   -- Entwickler in A (trainer-to-go)
 ('00000000-0000-0000-0000-0000000000a2','pa2@x.at',now()),  -- Leser in A
 ('00000000-0000-0000-0000-0000000000b1','pb@x.at',now())    -- Entwickler nur in B
on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set PA  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000a1'',false) \\g /dev/null'
\set PA2 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000a2'',false) \\g /dev/null'
\set PB  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000b1'',false) \\g /dev/null'
\set FR  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000f'',false) \\g /dev/null'

:ADM
select ws_projekt_anlegen('proj-b','Projekt B','','owner/b','') \g /dev/null
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values
 ('pa@x.at','entwickler',auth.uid(),'trainer-to-go'),('pa2@x.at','leser',auth.uid(),'trainer-to-go'),('pb@x.at','entwickler',auth.uid(),'proj-b');
:PA
select ws_einladung_annehmen('PA') \g /dev/null
:PA2
select ws_einladung_annehmen('PA2') \g /dev/null
:PB
select ws_einladung_annehmen('PB') \g /dev/null

\echo [1] Jeder schreibt die eigene Zeile -> OK (4x)
:ADM
insert into ws_abo_limits(benutzer_id,fuenf_std_prozent,woche_prozent) values (auth.uid(),10,20);
:PA
insert into ws_abo_limits(benutzer_id,fuenf_std_prozent,woche_prozent) values (auth.uid(),30,40);
:PA2
insert into ws_abo_limits(benutzer_id,fuenf_std_prozent,woche_prozent,quelle) values (auth.uid(),5,5,'statuszeile');
:PB
insert into ws_abo_limits(benutzer_id,fuenf_std_prozent,woche_prozent) values (auth.uid(),50,60);
\echo [1b] Upsert wie im Werkstatt-Dienst (on conflict do update) -> OK
insert into ws_abo_limits(benutzer_id,fuenf_std_prozent,woche_prozent,quelle,aktualisiert) values (auth.uid(),55,61,'werkstatt',now())
 on conflict (benutzer_id) do update set fuenf_std_prozent=excluded.fuenf_std_prozent, woche_prozent=excluded.woche_prozent, quelle=excluded.quelle, aktualisiert=excluded.aktualisiert;

\echo [2] PB: fremde Zeile anlegen -> FEHLER; fremde Zeile aendern -> 0; eigene auf fremde ID umhaengen -> FEHLER
insert into ws_abo_limits(benutzer_id,fuenf_std_prozent) values ('00000000-0000-0000-0000-00000000000a',99);
update ws_abo_limits set fuenf_std_prozent=99 where benutzer_id='00000000-0000-0000-0000-0000000000a1';
update ws_abo_limits set benutzer_id='00000000-0000-0000-0000-0000000000a1' where benutzer_id=auth.uid();
\echo [2b] PB: Upsert auf fremde ID (on conflict) -> FEHLER
insert into ws_abo_limits(benutzer_id,fuenf_std_prozent) values ('00000000-0000-0000-0000-0000000000a1',99)
 on conflict (benutzer_id) do update set fuenf_std_prozent=excluded.fuenf_std_prozent;
\echo [2c] PB: ungueltige Werte (>100, Quelle) -> FEHLER; loeschen -> FEHLER
update ws_abo_limits set fuenf_std_prozent=150 where benutzer_id=auth.uid();
update ws_abo_limits set quelle='admin' where benutzer_id=auth.uid();
delete from ws_abo_limits where benutzer_id=auth.uid();
\echo [3] Lesen PB (nur B): nur PB
select string_agg(b.name,', ' order by b.name) sieht from ws_abo_limits l join ws_benutzer b on b.id=l.benutzer_id;
select count(*) gesamt_zeilen from ws_abo_limits;
:PA
\echo [3b] Lesen PA (A): PA, PA2 (Admin nicht, da nicht Projektmitglied)
select string_agg(b.name,', ' order by b.name) sieht from ws_abo_limits l join ws_benutzer b on b.id=l.benutzer_id;
select count(*) gesamt_zeilen from ws_abo_limits;
:ADM
\echo [3c] Admin sieht alle 4
select count(*) gesamt_zeilen from ws_abo_limits;

\echo [4] Fremder (angemeldet, kein Mitglied): lesen -> 0; eigene Zeile anlegen -> FEHLER
:FR
select count(*) from ws_abo_limits;
insert into ws_abo_limits(benutzer_id,fuenf_std_prozent) values (auth.uid(),1);

\echo [5] Deaktiviertes Mitglied: eigene Zeile aendern -> FEHLER/0, lesen -> 0
:ADM
update ws_benutzer set aktiv=false where id='00000000-0000-0000-0000-0000000000a2';
:PA2
update ws_abo_limits set fuenf_std_prozent=1 where benutzer_id=auth.uid();
select count(*) from ws_abo_limits;
:ADM
update ws_benutzer set aktiv=true where id='00000000-0000-0000-0000-0000000000a2';

\echo [6] Schwellen: PA/PB -> FEHLER; Admin klein>pause -> FEHLER; Grenzwerte 5/101 -> FEHLER; null -> FEHLER; 70/90 -> OK; 90/90 -> OK
:PA
select ws_abo_schwellen_setzen(10,20);
update ws_einstellungen set abo_klein_ab_prozent=10;
:ADM
select ws_abo_schwellen_setzen(96,95);
select ws_abo_schwellen_setzen(5,95);
select ws_abo_schwellen_setzen(70,101);
select ws_abo_schwellen_setzen(null,95);
select ws_abo_schwellen_setzen(70,90) \g /dev/null
select ws_abo_schwellen_setzen(90,90) \g /dev/null
select abo_klein_ab_prozent, abo_pause_ab_prozent from ws_einstellungen;
\echo [6b] PA liest Schwellen (fuer die Werkstatt noetig) -> 1 Zeile
:PA
select abo_klein_ab_prozent, abo_pause_ab_prozent from ws_einstellungen;

\echo [7] anon: lesen/schreiben/Funktion -> FEHLER
reset role; set role anon;
select count(*) from ws_abo_limits;
insert into ws_abo_limits(benutzer_id) values ('00000000-0000-0000-0000-00000000000a');
select ws_abo_schwellen_setzen(70,90);
reset role;

\echo [8] Realtime-Veroeffentlichung enthaelt ws_abo_limits -> 1
select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename='ws_abo_limits';
\echo [9] Endstand
select b.name, l.fuenf_std_prozent, l.woche_prozent, l.quelle from ws_abo_limits l join ws_benutzer b on b.id=l.benutzer_id order by b.name;
select was, details from ws_protokoll where was='abo_schwellen' order by id;
