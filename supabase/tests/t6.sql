\set QUIET 1
\pset footer off
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1','ud@x.at',now());
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set UA 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000a1'',false) \\g /dev/null'
\set UB 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000b1'',false) \\g /dev/null'
\set UC 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000c1'',false) \\g /dev/null'
\set UD 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
:ADM
\echo [O4] UA (schon Mitglied A) wird per Einladung zu Projekt C eingeladen -> OK; zweite offene -> FEHLER
select ws_projekt_anlegen('proj-c','C','','','');
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('ud@x.at','entwickler',auth.uid(),'proj-c');
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('UA@x.at','leser',auth.uid(),'proj-c');
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('ua@X.at','texter',auth.uid(),'proj-c');
:UD
select ws_einladung_annehmen('UD');
:UA
select ws_einladung_annehmen('UA');
:ADM
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000d1','proj-c-app',true,true,true);
select ws_mitglied_setzen('proj-c','00000000-0000-0000-0000-0000000000a1',null);
\echo [R1] UD nur in C: sieht Benutzer / PCs (soll nur UD bzw. eigene)
:UD
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-D',true);
select string_agg(name,', ' order by name) benutzer from ws_benutzer; select string_agg(name,', ' order by name) pcs from ws_werkstatt_pcs;
\echo [R1] UB (nur B): sieht Benutzer/PCs
:UB
select string_agg(name,', ' order by name) benutzer from ws_benutzer; select string_agg(name,', ' order by name) pcs from ws_werkstatt_pcs;
\echo [R1] UA (A, B entfernt in t5): sieht Benutzer/PCs
:UA
select string_agg(name,', ' order by name) benutzer from ws_benutzer; select string_agg(name,', ' order by name) pcs from ws_werkstatt_pcs;
\echo [O1] UD (Grundrolle entwickler? ) und UC (Grundrolle leser, Entwickler in B): PC + Werkstatt
:UC
select count(*) uc_pcs from ws_werkstatt_pcs where benutzer_id=auth.uid();
:ADM
insert into ws_auftraege(gruppe_id,titel,erstellt_von) values ('proj-b-funktionen','B2',auth.uid()),('proj-c-funktionen','C1',auth.uid());
:UC
update ws_auftraege set stand='laeuft' where titel='B2';
insert into ws_live_log(auftrag_id,art,text) select id,'info','c' from ws_auftraege where titel='B2';
\echo [O1] UC in C (kein Mitglied) -> 0 Zeilen / FEHLER
update ws_auftraege set stand='laeuft' where titel='C1';
\echo [O1] Leser ohne Entwicklerrolle in irgendeinem Projekt (Leser aus t3 gibt es hier nicht) -> UA als Entwickler in A darf PC; UD ok
\echo [O2] Admin setzt Feature aus B in Auftrag von A -> FEHLER; passend -> OK
:ADM
update ws_auftraege set feature_id='N-b1' where titel='A1';
update ws_auftraege set feature_id=null where titel='A1';
insert into ws_auftraege(gruppe_id,feature_id,titel,erstellt_von) values ('training','N-b1','Admin-Kreuz',auth.uid());
\echo [O3] UB: Verbrauch zurueckdatiert / mit fremdem PC -> FEHLER; normal -> OK
:UB
insert into ws_auftraege(gruppe_id,titel,erstellt_von) values ('proj-b-funktionen','B3',auth.uid());
update ws_auftraege set stand='laeuft' where titel='B3';
insert into ws_verbrauch(auftrag_id,projekt_id,modell,kosten_usd,erstellt) select id,'proj-b','x',1,'2020-01-01' from ws_auftraege where titel='B3';
insert into ws_verbrauch(auftrag_id,projekt_id,modell,kosten_usd,id) select id,'proj-b','x',1,999 from ws_auftraege where titel='B3';
insert into ws_verbrauch(auftrag_id,projekt_id,modell,kosten_usd,werkstatt_pc) select a.id,'proj-b','x',1,(select id from ws_werkstatt_pcs where name='PC-C') from ws_auftraege a where titel='B3';
insert into ws_verbrauch(auftrag_id,projekt_id,modell,kosten_usd,werkstatt_pc) select a.id,'proj-b','x',1,gen_random_uuid() from ws_auftraege a where titel='B3';
insert into ws_verbrauch(auftrag_id,projekt_id,modell,kosten_usd,werkstatt_pc) select a.id,'proj-b','x',0.25,(select id from ws_werkstatt_pcs where name='PC-B') from ws_auftraege a where titel='B3';
insert into ws_verbrauch(auftrag_id,projekt_id,modell,kosten_usd,werkstatt_pc) select a.id,'proj-b','x',-5,(select id from ws_werkstatt_pcs where name='PC-B') from ws_auftraege a where titel='B3';
reset role;
\echo [Endstand]
select a.titel, v.kosten_usd, v.erstellt::date, p.name pc from ws_verbrauch v left join ws_auftraege a on a.id=v.auftrag_id left join ws_werkstatt_pcs p on p.id=v.werkstatt_pc order by v.id;
select m.projekt_id, b.name, m.rolle from ws_projekt_mitglieder m join ws_benutzer b on b.id=m.benutzer_id order by 1,2;
select email, projekt_id, angenommen is not null angenommen from ws_einladungen where email ilike 'u%' order by email, projekt_id;
select titel, feature_id, stand from ws_auftraege order by id;
