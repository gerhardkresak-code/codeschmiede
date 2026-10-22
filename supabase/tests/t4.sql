\set QUIET 1
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC2',true);
\echo [Dev2] zusammen->wissen, ->sicherheit, laeuft->freigabe ohne PR, zusammen-Auftrag aendern -> FEHLER
update ws_auftraege set stand='wissen' where titel='SPORT';
update ws_auftraege set stand='sicherheit' where titel='Text';
update ws_auftraege set stand='laeuft' where titel='Text';
update ws_auftraege set stand='freigabe' where titel='Text';
update ws_auftraege set zweig='feature/boese' where titel='SPORT';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \g /dev/null
\echo [Admin] freigabe ohne PR -> FEHLER; mit PR -> OK; freigeben ohne PR (Altbestand) -> FEHLER
update ws_auftraege set stand='freigabe' where titel='LEITUNG';
update ws_auftraege set stand='freigabe', zweig='feature/ws-2', pr_nummer=8 where titel='LEITUNG';
reset role; alter table ws_auftraege disable trigger ws_auftraege_schutz; update ws_auftraege set stand='freigabe', pr_nummer=null where titel='Text'; alter table ws_auftraege enable trigger ws_auftraege_schutz; set role authenticated;
select ws_freigeben((select id from ws_auftraege where titel='Text'));
\echo [Admin] sicherheit/wissen -> OK
update ws_auftraege set stand='sicherheit' where titel='SPORT';
update ws_auftraege set stand='wissen' where titel='SPORT';
select ws_freigeben((select id from ws_auftraege where titel='LEITUNG'));
reset role;
select titel,stand,zweig,pr_nummer from ws_auftraege order by id;
