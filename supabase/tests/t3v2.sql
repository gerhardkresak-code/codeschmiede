\set ON_ERROR_STOP 0
\set QUIET 1
insert into auth.users values ('00000000-0000-0000-0000-0000000000c1','dev2@x.at',now()),('00000000-0000-0000-0000-0000000000c2','texter@x.at',now()),('00000000-0000-0000-0000-0000000000c3','leser@x.at',now());
set role authenticated;
\set A 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set E 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000e'',false) \\g /dev/null'
\set E2 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000c1'',false) \\g /dev/null'
\set T 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000c2'',false) \\g /dev/null'
\set L 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000c3'',false) \\g /dev/null'
\set F 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000f'',false) \\g /dev/null'
\set B 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000b'',false) \\g /dev/null'
:A
\echo [Admin] Einladungen (inkl. Duplikat Gross/klein -> FEHLER erwartet beim 2.)
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('DEV@x.at','entwickler',auth.uid(),'trainer-to-go');
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('dev@X.AT','leser',auth.uid(),'trainer-to-go');
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('opfer@x.at','leser',auth.uid(),'trainer-to-go'),('dev2@x.at','entwickler',auth.uid(),'trainer-to-go'),('texter@x.at','texter',auth.uid(),'trainer-to-go'),('leser@x.at','leser',auth.uid(),'trainer-to-go');
\echo [Unbestaetigt] annehmen -> FEHLER erwartet
:B
select ws_einladung_annehmen('Opfer');
:E
select ws_einladung_annehmen('Dev');
:E2
select ws_einladung_annehmen('Dev2');
:T
select ws_einladung_annehmen('Texter');
:L
select ws_einladung_annehmen('Leser');
\echo [Fremd] nach Annahme anderer: annehmen -> FEHLER erwartet
:F
select ws_einladung_annehmen('Fremd');
:A
\echo [Admin] Rechte, Auftraege, Feature-Stand, verschieben -> alles OK erwartet
select ws_rechte_setzen('00000000-0000-0000-0000-00000000000e','sport',true,true,false);
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000c1','sport',true,false,false);
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000c2','sport',true,false,false);
insert into ws_auftraege(gruppe_id,titel,erstellt_von) values ('vorstand','LEITUNG',auth.uid()),('training','SPORT',auth.uid());
update ws_auftraege set stand='laeuft' where titel='LEITUNG';
update ws_features set stand='arbeit' where id='F-190';
select ws_feature_verschieben('F-191','werkstatt');
select ws_feature_ausblenden('F-192',true);
select ws_feature_ausblenden('F-192',false);
select id,gruppe_id,stand,ausgeblendet from ws_features where id in ('F-190','F-191','F-192');
:E
\echo [Dev, PC aus] Stand laeuft im eigenen Bereich -> 0 Zeilen erwartet
update ws_auftraege set stand='laeuft' where titel='SPORT';
\echo [Dev, PC aus] Live-Log -> FEHLER erwartet
insert into ws_live_log(auftrag_id,art,text) select id,'info','x' from ws_auftraege where titel='SPORT';
\echo [Dev] PC anlegen und einschalten -> OK
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC',true);
\echo [Dev, PC an] eigener Bereich: laeuft/frage/freigabe, Live-Log, Erlaubnis, Werkstatt-Nachricht -> OK
update ws_auftraege set stand='laeuft', zweig='feature/ws-1', werkstatt_pc=(select id from ws_werkstatt_pcs limit 1) where titel='SPORT';
update ws_auftraege set stand='frage' where titel='SPORT';
update ws_auftraege set stand='freigabe', pr_nummer=7 where titel='SPORT';
insert into ws_live_log(auftrag_id,art,text) select id,'info','x' from ws_auftraege where titel='SPORT';
insert into ws_erlaubnisse(auftrag_id,werkzeug,eingabe) select id,'Bash','npm test' from ws_auftraege where titel='SPORT';
insert into ws_nachrichten(auftrag_id,von,art,text) select id,null,'frage','Rueckfrage' from ws_auftraege where titel='SPORT';
update ws_features set stand='arbeit' where id='F-040';
\echo [Dev, PC an] fremder Bereich: Stand -> 0 Zeilen; Log/Erlaubnis/Nachricht -> FEHLER erwartet
update ws_auftraege set stand='freigabe' where titel='LEITUNG';
insert into ws_live_log(auftrag_id,art,text) select id,'info','x' from ws_auftraege where titel='LEITUNG';
insert into ws_erlaubnisse(auftrag_id,werkzeug,eingabe) select id,'Bash','x' from ws_auftraege where titel='LEITUNG';
insert into ws_nachrichten(auftrag_id,von,art,text) select id,null,'frage','x' from ws_auftraege where titel='LEITUNG';
update ws_features set stand='arbeit' where id='F-120';
\echo [Dev] Angriffe -> alle FEHLER / 0 Zeilen erwartet
update ws_auftraege set gruppe_id='training' where titel='LEITUNG';
update ws_auftraege set gruppe_id='vorstand' where titel='SPORT';
update ws_auftraege set baustein='{"x":1}' where titel='SPORT';
update ws_auftraege set stand='zusammen' where titel='SPORT';
update ws_features set ausgeblendet=true where id='F-040';
update ws_features set quelle='manuell' where id='F-040';
update ws_features set gruppe_id='training' where id='F-120';
select ws_feature_ausblenden('F-040',true);
select ws_feature_verschieben('F-040','vorstand');
update ws_benutzer set rolle='admin' where id=auth.uid();
update ws_benutzer set claude_konto='max' where id=auth.uid();
update ws_benutzer set eingeladen_von=auth.uid() where id=auth.uid();
insert into ws_nachrichten(auftrag_id,von,art,text) select id,null,'system','Freigegeben durch Gerhard' from ws_auftraege where titel='SPORT';
insert into ws_erlaubnisse(auftrag_id,werkzeug,eingabe,status) select id,'Bash','rm -rf','immer' from ws_auftraege where titel='SPORT';
insert into ws_erlaubnisse(auftrag_id,werkzeug,eingabe,entschieden_von) select id,'Bash','rm -rf',auth.uid() from ws_auftraege where titel='SPORT';
update ws_erlaubnisse set status='immer';
delete from ws_live_log;
delete from ws_auftraege;
insert into ws_features(id,gruppe_id,name,erstellt_von) values ('F-999','training','Fake',auth.uid());
insert into ws_werkstatt_pcs(benutzer_id,name,admin_pc) values (auth.uid(),'p',true);
select ws_rechte_setzen(auth.uid(),'leitung',true,true,true);
\echo [Dev] eigenes Feature N- anlegen -> OK; Name aendern -> OK
insert into ws_features(id,gruppe_id,name,erstellt_von) values ('N-1','training','Neu',auth.uid());
update ws_benutzer set name='Dev Neu' where id=auth.uid();
\echo [Dev] Erlaubnis entscheiden + freigeben im eigenen Bereich -> OK
select ws_erlaubnis_entscheiden((select min(id) from ws_erlaubnisse),'einmal');
select ws_freigeben((select id from ws_auftraege where titel='SPORT'));
\echo [Dev] freigeben fremder Bereich -> FEHLER
select ws_freigeben((select id from ws_auftraege where titel='LEITUNG'));
:E2
\echo [Dev2 ohne PC, ohne freigeben] -> 0 Zeilen / FEHLER
update ws_auftraege set stand='abgebrochen' where titel='SPORT';
insert into ws_live_log(auftrag_id,art,text) select id,'info','x' from ws_auftraege where titel='SPORT';
update ws_werkstatt_pcs set an=true;
\echo [Dev2] fremden PC loeschen -> 0 Zeilen
delete from ws_werkstatt_pcs;
:T
\echo [Texter] Auftrag Art text -> OK; Art aendern / mit zweig -> FEHLER
insert into ws_auftraege(gruppe_id,titel,art,erstellt_von) values ('training','Text','text',auth.uid());
insert into ws_auftraege(gruppe_id,titel,art,erstellt_von) values ('training','Code','aendern',auth.uid());
insert into ws_auftraege(gruppe_id,titel,art,erstellt_von,zweig) values ('training','T2','text',auth.uid(),'main');
insert into ws_nachrichten(auftrag_id,von,art,text) select id,auth.uid(),'text','Hallo' from ws_auftraege where titel='Text';
update ws_auftraege set stand='freigabe';
:L
\echo [Leser] Auftrag anlegen -> FEHLER; lesen -> Zahlen
insert into ws_auftraege(gruppe_id,titel,art,erstellt_von) values ('training','L','text',auth.uid());
select (select count(*) from ws_auftraege) a,(select count(*) from ws_features) f;
:F
\echo [Fremd] lesen -> alles 0
select (select count(*) from ws_benutzer) b,(select count(*) from ws_features) f,(select count(*) from ws_auftraege) a,(select count(*) from ws_einladungen) e,(select count(*) from ws_protokoll) p;
insert into ws_benutzer(id,name,rolle) values (auth.uid(),'x','admin');
insert into ws_werkstatt_pcs(benutzer_id,name) values (auth.uid(),'x');
:A
\echo [Admin] Dev deaktivieren; Dev reaktiviert sich -> FEHLER/0
update ws_benutzer set aktiv=false where name='Dev Neu';
:E
update ws_benutzer set aktiv=true where id=auth.uid();
update ws_auftraege set stand='laeuft' where titel='SPORT';
delete from ws_werkstatt_pcs;
reset role;
\echo [Endstand]
select titel,gruppe_id,stand,zweig,pr_nummer,baustein from ws_auftraege order by id;
select id,gruppe_id,quelle,ausgeblendet,stand from ws_features where id in ('F-040','F-120','F-190','F-191','F-192','N-1','F-999');
select art,von is null werkstatt,text from ws_nachrichten order by id;
select status,eingabe from ws_erlaubnisse;
select name,rolle,aktiv,claude_konto from ws_benutzer order by name;
select was from ws_protokoll order by id;
set role anon;
\echo [anon]
select count(*) from ws_benutzer;
select ws_darf('sport','auftraege');
select ws_freigeben(1);
