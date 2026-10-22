\set QUIET 1
\pset footer off
insert into auth.users values ('00000000-0000-0000-0000-0000000000a1','ua@x.at',now()),('00000000-0000-0000-0000-0000000000b1','ub@x.at',now()),('00000000-0000-0000-0000-0000000000c1','uc@x.at',now());
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set UA 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000a1'',false) \\g /dev/null'
\set UB 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000b1'',false) \\g /dev/null'
\set UC 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000c1'',false) \\g /dev/null'
\set FR 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000f'',false) \\g /dev/null'
\set B_ALLE 'select (select count(*) from ws_projekte where id=''proj-b'') proj,(select count(*) from ws_projekt_mitglieder where projekt_id=''proj-b'') mitgl,(select count(*) from ws_bereiche where projekt_id=''proj-b'') ber,(select count(*) from ws_gruppen where id like ''proj-b%'') grp,(select count(*) from ws_features where gruppe_id like ''proj-b%'') feat,(select count(*) from ws_auftraege where gruppe_id like ''proj-b%'') auf,(select count(*) from ws_nachrichten) nachr,(select count(*) from ws_live_log) log,(select count(*) from ws_erlaubnisse) erl,(select count(*) from ws_verbrauch where projekt_id=''proj-b'') verbr \\g'
\set A_ALLE 'select (select count(*) from ws_projekte where id=''trainer-to-go'') proj,(select count(*) from ws_bereiche where projekt_id=''trainer-to-go'') ber,(select count(*) from ws_gruppen where id not like ''proj-b%'') grp,(select count(*) from ws_auftraege where gruppe_id not like ''proj-b%'') auf,(select count(*) from ws_verbrauch where projekt_id=''trainer-to-go'') verbr \\g'
:ADM
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('ua@x.at','entwickler',auth.uid(),'trainer-to-go'),('uc@x.at','leser',auth.uid(),'trainer-to-go');
\echo [Admin] Projekt B anlegen
select ws_projekt_anlegen('proj-b','Projekt B','','owner/b','');
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('ub@x.at','entwickler',auth.uid(),'proj-b');
\echo [Admin] zweite Einladung derselben Adresse fuer Projekt B -> (Duplikat?)
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('UA@x.at','leser',auth.uid(),'proj-b');
:UA
select ws_einladung_annehmen('UA');
:UB
select ws_einladung_annehmen('UB');
:UC
select ws_einladung_annehmen('UC');
:ADM
select ws_mitglied_setzen('proj-b','00000000-0000-0000-0000-0000000000a1','leser');
select ws_mitglied_setzen('proj-b','00000000-0000-0000-0000-0000000000c1','entwickler');
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000a1','sport',true,true,true);
\echo [Admin] Rechte in B fuer UA (Leser in B) -> laesst sich setzen?
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000a1','proj-b-app',true,true,true);
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000b1','proj-b-app',true,true,false);
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000c1','proj-b-app',true,false,false);
\echo [Admin] Rechte fuer UB in A (kein Mitglied) -> FEHLER
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000b1','sport',true,true,true);
insert into ws_auftraege(gruppe_id,titel,erstellt_von) values ('training','A1',auth.uid()),('proj-b-funktionen','B1',auth.uid());
select ws_limit_setzen(50,80,true);
:UA
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-A',true);
:UB
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-B',true);
\echo [UC global Leser, Entwickler in B] PC anlegen -> ?
:UC
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-C',true);
\echo [UB, Entwickler in B] Werkstatt-Arbeit in B -> OK
:UB
update ws_auftraege set stand='laeuft' where titel='B1';
insert into ws_live_log(auftrag_id,art,text) select id,'info','b' from ws_auftraege where titel='B1';
insert into ws_erlaubnisse(auftrag_id,werkzeug,eingabe) select id,'Bash','npm test' from ws_auftraege where titel='B1';
insert into ws_nachrichten(auftrag_id,von,art,text) select id,null,'frage','B?' from ws_auftraege where titel='B1';
insert into ws_verbrauch(auftrag_id,projekt_id,modell,kosten_usd) select id,'proj-b','sonnet',1.5 from ws_auftraege where titel='B1';
insert into ws_features(id,gruppe_id,name,erstellt_von) values ('N-b1','proj-b-funktionen','B-Feature',auth.uid());
\echo [UB] sieht von A (soll alles 0):
:A_ALLE
\echo [UB] schreibt in A -> FEHLER
insert into ws_auftraege(gruppe_id,titel,erstellt_von) values ('training','X',auth.uid());
insert into ws_features(id,gruppe_id,name,erstellt_von) values ('N-x','kader','X',auth.uid());
\echo [UB] Verbrauch auf falsches Projekt / ohne Auftrag -> FEHLER
insert into ws_verbrauch(auftrag_id,projekt_id,modell,kosten_usd) select id,'trainer-to-go','x',1 from ws_auftraege where titel='B1';
insert into ws_verbrauch(auftrag_id,projekt_id,modell,kosten_usd) values (null,'proj-b','x',1);
\echo [UB] Admin-Funktionen -> FEHLER
select ws_limit_setzen(9999,80,false);
select ws_projekt_anlegen('proj-c','C','','','');
select ws_mitglied_setzen('trainer-to-go','00000000-0000-0000-0000-0000000000b1','entwickler');
insert into ws_projekt_mitglieder values ('trainer-to-go','00000000-0000-0000-0000-0000000000b1','entwickler');
update ws_projekte set name='gehackt';
update ws_einstellungen set monatslimit_usd=99999;
\echo [UB] sieht ws_benutzer / ws_werkstatt_pcs (fremde Projekte?):
select name from ws_benutzer order by name;
select name from ws_werkstatt_pcs order by name;
\echo [UA, Entwickler in A, Leser in B] Arbeit in A -> OK
:UA
update ws_auftraege set stand='laeuft' where titel='A1';
insert into ws_live_log(auftrag_id,art,text) select id,'info','a' from ws_auftraege where titel='A1';
insert into ws_verbrauch(auftrag_id,projekt_id,modell,kosten_usd) select id,'trainer-to-go','opus',2 from ws_auftraege where titel='A1';
\echo [UA] als Leser in B: sieht B (lesen erlaubt):
:B_ALLE
\echo [UA] als Leser in B: schreiben trotz vergebener Rechte -> FEHLER / 0 Zeilen
update ws_auftraege set stand='frage' where titel='B1';
insert into ws_live_log(auftrag_id,art,text) select id,'info','x' from ws_auftraege where titel='B1';
insert into ws_erlaubnisse(auftrag_id,werkzeug,eingabe) select id,'Bash','x' from ws_auftraege where titel='B1';
insert into ws_nachrichten(auftrag_id,von,art,text) select id,null,'frage','x' from ws_auftraege where titel='B1';
insert into ws_nachrichten(auftrag_id,von,art,text) select id,auth.uid(),'text','x' from ws_auftraege where titel='B1';
insert into ws_verbrauch(auftrag_id,projekt_id,modell,kosten_usd) select id,'proj-b','x',1 from ws_auftraege where titel='B1';
insert into ws_auftraege(gruppe_id,titel,erstellt_von) values ('proj-b-app','X',auth.uid());
update ws_features set stand='live' where id='N-b1';
select ws_erlaubnis_entscheiden((select min(id) from ws_erlaubnisse),'immer');
select ws_feature_ausblenden('N-b1',true);
\echo [UA] Auftrag in A mit Feature aus B -> ?
insert into ws_auftraege(gruppe_id,feature_id,titel,erstellt_von) values ('training','N-b1','A-mit-B-Feature',auth.uid());
\echo [UA] Verbrauchsanzeige:
select * from ws_verbrauch_monat();
select ws_verbrauch_gesamt_monat();
:ADM
update ws_auftraege set stand='freigabe', zweig='feature/b', pr_nummer=3 where titel='B1';
:UA
\echo [UA] freigeben B1 (Recht freigeben in B, aber Leser) -> FEHLER
select ws_freigeben((select id from ws_auftraege where titel='B1'));
:UB
\echo [UB] freigeben B1 -> OK
select ws_freigeben((select id from ws_auftraege where titel='B1'));
\echo [Fremder] sieht nichts, Verbrauchsfunktionen leer/null
:FR
:B_ALLE
:A_ALLE
select * from ws_verbrauch_monat();
select ws_verbrauch_gesamt_monat();
select count(*) from ws_einstellungen;
\echo [Admin] UA aus B entfernen -> Rechte in B weg, UA sieht B nicht mehr
:ADM
select ws_mitglied_setzen('proj-b','00000000-0000-0000-0000-0000000000a1',null);
select bereich_id from ws_rechte where benutzer_id='00000000-0000-0000-0000-0000000000a1';
:UA
:B_ALLE
reset role;
select titel,gruppe_id,feature_id,stand from ws_auftraege order by id;
select projekt_id,kosten_usd from ws_verbrauch;
select was from ws_protokoll order by id;
