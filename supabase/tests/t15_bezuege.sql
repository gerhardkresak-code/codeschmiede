-- Rechte-Test Datenbank v15 (Feature-Bezüge). Voraussetzung: mock2.sql, 0001 → … → 0015. Aufruf mit -v ON_ERROR_ROLLBACK=on.
\set QUIET 1
\pset footer off
begin;
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()),('00000000-0000-0000-0000-0000000000d2','d2@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
\set D2  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d2'',false) \\g /dev/null'
:ADM
select ws_projekt_anlegen('proj-b','B','','owner/b','') \g /dev/null
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('d1@x.at','entwickler',auth.uid(),'trainer-to-go'),('d2@x.at','leser',auth.uid(),'trainer-to-go');
:D1
select ws_einladung_annehmen('D1') \g /dev/null
:D2
select ws_einladung_annehmen('D2') \g /dev/null
reset role;
-- Testdaten: zwei Features im Projekt, eines in proj-b
create temp table g as select (select g.id from ws_gruppen g join ws_bereiche b on b.id=g.bereich_id where b.projekt_id='trainer-to-go' and not b.global order by g.id limit 1) a,
  (select g.id from ws_gruppen g join ws_bereiche b on b.id=g.bereich_id where b.projekt_id='proj-b' and not b.global order by g.id limit 1) b;
grant select on g to authenticated;
insert into ws_features(id,gruppe_id,name,stand,quelle,erstellt_von) select 'N-1',a,'Liga','live','manuell','00000000-0000-0000-0000-00000000000a' from g;
insert into ws_features(id,gruppe_id,name,stand,quelle,erstellt_von) select 'N-2',a,'Turniere','geplant','manuell','00000000-0000-0000-0000-00000000000a' from g;
insert into ws_features(id,gruppe_id,name,stand,quelle,erstellt_von) select 'N-9',b,'Fremd','geplant','manuell','00000000-0000-0000-0000-00000000000a' from g;
set role authenticated;
:ADM
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000d1', (select bereich_id from ws_gruppen where id=(select a from g)), true,false,false) \g /dev/null
\echo [1] D1 setzt Bezug Turniere->Liga -> OK; fremdes Projekt -> FEHLER; sich selbst -> FEHLER; Leser D2 -> FEHLER
:D1
select ws_bezug_setzen('N-2','N-1') > 0 as gesetzt;
select ws_bezug_setzen('N-2','N-9');
select ws_bezug_setzen('N-2','N-2');
:D2
select ws_bezug_setzen('N-1','N-2');
\echo [2] D2 sieht den Bezug (1); direkt schreiben -> FEHLER
select count(*) as d2_sieht from ws_feature_bezuege;
insert into ws_feature_bezuege(von_feature,zu_feature) values ('N-1','N-2');
\echo [3] Liga-Auftrag geht live -> Hinweis bei Turniere (1); D2 erledigt -> FEHLER; D1 erledigt -> OK
reset role;
insert into ws_auftraege(gruppe_id,feature_id,titel,erstellt_von,stand) select a,'N-1','Liga Tabelle','00000000-0000-0000-0000-00000000000a','zusammen' from g;
update ws_auftraege set stand='wissen' where titel='Liga Tabelle';
set role authenticated;
:D1
select count(*) as hinweise, min(text) from ws_feature_hinweise where feature_id='N-2';
:D2
select ws_hinweis_erledigen((select id from ws_feature_hinweise limit 1),'nicht_noetig');
:D1
select ws_hinweis_erledigen((select id from ws_feature_hinweise limit 1),'nachgezogen');
select stand from ws_feature_hinweise;
\echo [4] Feature aus Gespraech anlegen (D1) -> OK; Vorschlaege pruefen: feature_neu t, bezug t, bezug fremd f
insert into ws_features(id,gruppe_id,name,stand,quelle,erstellt_von) select 'N-3',a,'Spielplan','geplant','gespraech',auth.uid() from g;
reset role;
select ws_vorschlag_ok('trainer-to-go', jsonb_build_object('feature_neu', jsonb_build_object('gruppe_id',(select a from g),'name','Spielplan'))) a,
       ws_vorschlag_ok('trainer-to-go', '{"bezug":{"von":"N-2","zu":"N-1"}}') b, ws_vorschlag_ok('trainer-to-go', '{"bezug":{"von":"N-2","zu":"N-9"}}') c;
\echo [5] D1 loescht Bezug -> OK
set role authenticated;
:D1
select ws_bezug_loeschen((select id from ws_feature_bezuege limit 1));
select count(*) as rest from ws_feature_bezuege;
reset role;
rollback;
