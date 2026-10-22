-- Rechte-Test Datenbank v5 (Stationen: sicherheit → zusammen → feature → wissen) – unabhängige Prüfung 2026-10-22
-- Voraussetzung: frische Datenbank mit mock2.sql, dann 0001 → 0002 → 0003 → 0004 → 0005 eingespielt.
-- Erwartung steht jeweils in der \echo-Zeile ("-> FEHLER" = Fehlermeldung, "-> 0" = keine Zeile betroffen).
\set QUIET 1
\pset footer off
insert into auth.users values
 ('00000000-0000-0000-0000-0000000000e1','e1@x.at',now()),   -- Entwickler sport: Aufträge + freigeben, PC an
 ('00000000-0000-0000-0000-0000000000e2','e2@x.at',now()),   -- Entwickler sport: nur Aufträge, PC an
 ('00000000-0000-0000-0000-0000000000b1','b1@x.at',now())    -- Entwickler nur in Projekt B
on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set E1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000e1'',false) \\g /dev/null'
\set E2  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000e2'',false) \\g /dev/null'
\set B1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000b1'',false) \\g /dev/null'
:ADM
select ws_projekt_anlegen('proj-b','B','','owner/b','') \g /dev/null
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values
 ('e1@x.at','entwickler',auth.uid(),'trainer-to-go'),('e2@x.at','entwickler',auth.uid(),'trainer-to-go'),('b1@x.at','entwickler',auth.uid(),'proj-b');
:E1
select ws_einladung_annehmen('E1') \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-E1',true);
:E2
select ws_einladung_annehmen('E2') \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-E2',true);
:B1
select ws_einladung_annehmen('B1') \g /dev/null
:ADM
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000e1','sport',true,true,false) \g /dev/null
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000e2','sport',true,false,false) \g /dev/null
insert into ws_features(id,gruppe_id,name,quelle,erstellt_von) values ('N-b','proj-b-funktionen','B-Feature','manuell',auth.uid()) on conflict do nothing;

\echo [1] E2 legt Auftrag an, Werkstatt bis freigabe -> OK
:E2
insert into ws_auftraege(gruppe_id,titel,erstellt_von) values ('training','T1',auth.uid());
update ws_auftraege set stand='laeuft', zweig='feature/cs-1-t1' where titel='T1';
update ws_auftraege set pruefung = pruefung || '{"lokal":{"ergebnis":"gruen"}}' where titel='T1';
\echo [1b] E2 faelscht Station-Ergebnis sicherheit/feature bzw. live_commit -> FEHLER (3x)
update ws_auftraege set pruefung = pruefung || '{"sicherheit":{"ergebnis":"gruen"}}' where titel='T1';
update ws_auftraege set pruefung = pruefung || '{"feature":{"ergebnis":"gruen"}}' where titel='T1';
update ws_auftraege set live_commit='abc' where titel='T1';
\echo [1c] feature_id: fremdes Projekt -> FEHLER; eigenes (einmalig) -> OK; danach aendern/entfernen -> FEHLER
update ws_auftraege set feature_id='N-b' where titel='T1';
update ws_auftraege set feature_id='F-040' where titel='T1';
update ws_auftraege set feature_id='F-041' where titel='T1';
update ws_auftraege set feature_id=null where titel='T1';
update ws_auftraege set stand='freigabe', pr_nummer=11 where titel='T1';
\echo [2] E2 setzt Stationen selbst (sicherheit/zusammen/feature/wissen) -> FEHLER (4x)
update ws_auftraege set stand='sicherheit' where titel='T1';
update ws_auftraege set stand='zusammen' where titel='T1';
update ws_auftraege set stand='feature' where titel='T1';
update ws_auftraege set stand='wissen' where titel='T1';
\echo [2b] E2 freigeben (ohne Recht) -> FEHLER; E1 freigeben -> OK (-> sicherheit)
select ws_freigeben((select id from ws_auftraege where titel='T1'));
:E1
select ws_freigeben((select id from ws_auftraege where titel='T1')) \g /dev/null
\echo [2c] E1 zusammenfuehren aus sicherheit (nicht zusammen) -> FEHLER
select ws_zusammenfuehren((select id from ws_auftraege where titel='T1'));
\echo [2d] Stand sicherheit verlassen (nacharbeit/abgebrochen) durch E2 -> FEHLER (2x)
:E2
update ws_auftraege set stand='nacharbeit' where titel='T1';
update ws_auftraege set stand='abgebrochen' where titel='T1';
\echo [3] *** E2 tauscht im Stand sicherheit Zweig/PR/Commit aus (sollte FEHLER sein) ***
update ws_auftraege set zweig='feature/cs-77-ungeprueft', pr_nummer=99, letzter_commit='deadbeef' where titel='T1';
reset role; select stand, zweig, pr_nummer, letzter_commit from ws_auftraege where titel='T1'; set role authenticated;
\echo [4] Admin-PC: Sicherheitsprüfung grün -> zusammen
:ADM
update ws_auftraege set stand='zusammen', pruefung = pruefung || '{"sicherheit":{"ergebnis":"gruen"}}' where titel='T1';
\echo [4b] E2 zusammenfuehren (ohne Recht freigeben) -> FEHLER; B1 (anderes Projekt) -> FEHLER
:E2
select ws_zusammenfuehren((select id from ws_auftraege where titel='T1'));
:B1
select ws_zusammenfuehren((select id from ws_auftraege where titel='T1'));
\echo [4c] *** E2 tauscht im Stand zusammen (nach grüner Prüfung) Zweig/PR aus (sollte FEHLER sein) ***
:E2
update ws_auftraege set zweig='feature/cs-78-getauscht', pr_nummer=98 where titel='T1';
\echo [4d] E1 zusammenfuehren -> OK (-> feature); erneut -> FEHLER
:E1
select ws_zusammenfuehren((select id from ws_auftraege where titel='T1')) \g /dev/null
select ws_zusammenfuehren((select id from ws_auftraege where titel='T1'));
\echo [4e] Sicherheit nicht grün: zusammenfuehren -> FEHLER
:ADM
insert into ws_auftraege(gruppe_id,titel,erstellt_von,zweig,pr_nummer) values ('training','T2',auth.uid(),null,null);
update ws_auftraege set zweig='feature/cs-2-t2', pr_nummer=12, stand='zusammen', pruefung='{"sicherheit":{"ergebnis":"rot"}}' where titel='T2';
:E1
select ws_zusammenfuehren((select id from ws_auftraege where titel='T2'));

\echo [5] Nachrichten: kanal claude-chat -> FEHLER; kanal gruppe -> OK
:E2
insert into ws_nachrichten(auftrag_id,von,art,text,kanal) select id,auth.uid(),'text','x','claude-chat' from ws_auftraege where titel='T1';
insert into ws_nachrichten(auftrag_id,von,art,text,kanal) select id,auth.uid(),'text','x','gruppe' from ws_auftraege where titel='T1';
\echo [6] Projekte: E1 aendert vorschau_domain/live_url -> 0 Zeilen; Admin -> OK; ungueltig -> FEHLER
:E1
update ws_projekte set vorschau_domain='boese.pages.dev', live_url='https://boese.example' where id='trainer-to-go';
:ADM
update ws_projekte set vorschau_domain='trainer-to-go.pages.dev' where id='trainer-to-go';
update ws_projekte set vorschau_domain='evil.example.com' where id='trainer-to-go';
update ws_projekte set live_url='javascript:alert(1)' where id='trainer-to-go';
reset role;
\echo [Endstand]
select titel, stand, zweig, pr_nummer, feature_id, pruefung from ws_auftraege order by id;
select id, vorschau_domain, live_url from ws_projekte order by id;
select was from ws_protokoll where was in ('freigeben','zusammenfuehren') order by id;
