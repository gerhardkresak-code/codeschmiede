-- Rechte-Test Datenbank v35 (Fehler-Meldungen). Voraussetzung: mock2.sql, 0001 → … → 0035. Aufruf mit -v ON_ERROR_ROLLBACK=on.
\set QUIET 1
\pset footer off
begin;
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()),('00000000-0000-0000-0000-0000000000e1','e1@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
\set LE  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000e1'',false) \\g /dev/null'
:ADM
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('d1@x.at','entwickler',auth.uid(),'trainer-to-go'),('e1@x.at','leser',auth.uid(),'trainer-to-go');
:D1
select ws_einladung_annehmen('D1') \g /dev/null
select ws_fehler_schluessel_erzeugen('trainer-to-go');
:LE
select ws_einladung_annehmen('LE') \g /dev/null
:ADM
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000d1','plattform',true,false,false) \g /dev/null
select ws_fehler_schluessel_erzeugen('trainer-to-go') as k \gset
\echo [1] Entwickler erzeugt Schluessel -> FEHLER (oben); Admin -> OK; Leser sieht Schluessel nicht (0)
:LE
select count(*) from ws_fehler_schluessel;
\echo [2] Anonym melden: bereinigt (E-Mail, UUID, Token, Telefon, Parameter), Seite ohne Kennungen, zusammengefasst (anzahl 2), Geraete gezaehlt
reset role; set role anon;
select ws_fehler_melden(:'k', jsonb_build_object('nachricht','TypeError bei max@verein.at mit 3f2b8c1a-1111-2222-3333-444455556666 und eyJabcdefghij.klmnopqrstuv.wxyz012345 Tel +43 664 1234567','stelle','src/pages/Calendar.jsx:142:31','seite','/kader/8f3a9b2c/spieler/12?name=Max#x','ablauf','at Woche (https://x.pages.dev/assets/a.js?token=geheim:1:2)','version','v2.14.0','geraet','handy','umgebung','live'));
select ws_fehler_melden(:'k', jsonb_build_object('nachricht','TypeError bei max@verein.at mit 3f2b8c1a-1111-2222-3333-444455556666 und eyJabcdefghij.klmnopqrstuv.wxyz012345 Tel +43 664 1234567','stelle','src/pages/Calendar.jsx:150:2','geraet','pc'));
select ws_fehler_melden('csf_00000000000000000000000000000000', '{"nachricht":"fremd"}');
select ws_fehler_melden(:'k', '"kein objekt"');
select count(*) as anon_sieht from ws_fehler;
reset role; set role authenticated;
:LE
select nachricht, seite, ablauf, anzahl, geraete from ws_fehler;
\echo [3] Grenze: 300 je Stunde -> danach verworfen
reset role; set role anon;
select count(*) from (select ws_fehler_melden(:'k', jsonb_build_object('nachricht','Viele ' || g::text)) from generate_series(1,320) g) x;
reset role;
select count(*) as fehler_zeilen, (select anzahl from ws_fehler_grenze limit 1) as zaehler from ws_fehler;
set role authenticated;
\echo [4] Leser setzt Stand -> FEHLER; Entwickler erledigt -> OK; neue Meldung oeffnet wieder
:LE
select ws_fehler_stand((select min(id) from ws_fehler), 'erledigt');
:D1
select ws_fehler_stand((select min(id) from ws_fehler), 'erledigt');
reset role; delete from ws_fehler_grenze; set role anon;
select ws_fehler_melden(:'k', jsonb_build_object('nachricht','TypeError bei max@verein.at mit 3f2b8c1a-1111-2222-3333-444455556666 und eyJabcdefghij.klmnopqrstuv.wxyz012345 Tel +43 664 1234567','stelle','src/pages/Calendar.jsx:9:9'));
reset role; set role authenticated;
:D1
select stand, anzahl, neu from ws_fehler where id = (select min(id) from ws_fehler);
\echo [5] Als Auftrag: Leser -> FEHLER; D1 in plattform -> OK; nochmal -> FEHLER (offener Auftrag)
:LE
select ws_fehler_als_auftrag((select min(id) from ws_fehler), (select id from ws_gruppen where bereich_id='plattform' limit 1));
:D1
select ws_fehler_als_auftrag((select min(id) from ws_fehler), (select id from ws_gruppen where bereich_id='plattform' limit 1)) > 0 as ok;
select ws_fehler_als_auftrag((select min(id) from ws_fehler), (select id from ws_gruppen where bereich_id='plattform' limit 1));
select a.titel, f.stand from ws_fehler f join ws_auftraege a on a.id = f.auftrag_id;
\echo [6] Schluessel aus -> Meldung verworfen
:ADM
select ws_fehler_schluessel_aus('trainer-to-go');
reset role; delete from ws_fehler; set role anon;
select ws_fehler_melden(:'k', '{"nachricht":"nach aus"}');
reset role; set role authenticated;
:ADM
select count(*) as nach_aus from ws_fehler;
rollback;
