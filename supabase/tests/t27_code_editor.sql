-- Rechte-Test Datenbank v31 (Code-Editor). Voraussetzung: mock2.sql, 0001 → … → 0031. Aufruf mit -v ON_ERROR_ROLLBACK=on.
\set QUIET 1
\pset footer off
begin;
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1','d1@x.at',now()),('00000000-0000-0000-0000-0000000000d2','d2@x.at',now()),
  ('00000000-0000-0000-0000-0000000000e1','e1@x.at',now()),('00000000-0000-0000-0000-0000000000f1','f1@x.at',now()) on conflict do nothing;
set role authenticated;
\set ADM 'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-00000000000a'',false) \\g /dev/null'
\set D1  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d1'',false) \\g /dev/null'
\set D2  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000d2'',false) \\g /dev/null'
\set LE  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000e1'',false) \\g /dev/null'
\set FR  'select set_config(''request.jwt.claim.sub'',''00000000-0000-0000-0000-0000000000f1'',false) \\g /dev/null'
:ADM
select ws_projekt_anlegen('ohne','Ohne','','','') \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-ADM',true);
select id as adm_pc from ws_werkstatt_pcs where name='PC-ADM' \gset
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('d1@x.at','entwickler',auth.uid(),'trainer-to-go'),('d2@x.at','entwickler',auth.uid(),'trainer-to-go'),('e1@x.at','leser',auth.uid(),'trainer-to-go'),('f1@x.at','leser',auth.uid(),'ohne');
:D1
select ws_einladung_annehmen('D1') \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-D1',true);
:D2
select ws_einladung_annehmen('D2') \g /dev/null
:LE
select ws_einladung_annehmen('LE') \g /dev/null
:FR
select ws_einladung_annehmen('FR') \g /dev/null
:ADM
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000d1','plattform',true,false,false) \g /dev/null
\echo [1] Leser fragt Baum an -> OK; fremdes Projekt -> FEHLER; Projekt ohne Repo -> FEHLER; boeser Pfad -> FEHLER; fremder PC -> FEHLER
:LE
select ws_code_anfragen('trainer-to-go','main','baum') > 0 as ok;
select ws_code_anfragen('ohne','main','baum');
select ws_code_anfragen('trainer-to-go','main','datei','../etc/passwd');
select ws_code_anfragen('trainer-to-go','main','baum',null,:'adm_pc');
:FR
select ws_code_anfragen('trainer-to-go','main','baum');
\echo [2] Entwickler-PC nimmt Leser-Anfrage nicht (0); Admin-PC nimmt -> baum; Leser sieht nur eigene (1), D1 sieht 0
:D1
select count(*) from ws_code_nehmen((select id from ws_werkstatt_pcs where name='PC-D1'));
:ADM
select id as nid, art, zweig, repo from ws_code_nehmen(:'adm_pc') \gset
\echo :art :zweig :repo
select ws_code_antwort(:'adm_pc',:nid,repeat('a',40),'[{"p":"README.md"}]',null,null,'ok',false);
:LE
select count(*) as le, min(stand) as min_stand from ws_code_anfragen;
:D1
select count(*) as d1 from ws_code_anfragen;
\echo [3] Hand-Auftrag: Leser -> FEHLER; D2 ohne Recht -> FEHLER; D1 in plattform -> OK; .git-Pfad -> FEHLER; 0 Dateien -> FEHLER
:LE
select ws_code_hand_auftrag((select id from ws_gruppen where bereich_id='plattform' limit 1),'Kleine Korrektur','',repeat('a',40),'[{"pfad":"src/a.js","inhalt":"x"}]');
:D2
select ws_code_hand_auftrag((select id from ws_gruppen where bereich_id='plattform' limit 1),'Kleine Korrektur','',repeat('a',40),'[{"pfad":"src/a.js","inhalt":"x"}]');
:D1
select ws_code_hand_auftrag((select id from ws_gruppen where bereich_id='plattform' limit 1),'Kleine Korrektur','Wochenstart',repeat('a',40),('[{"pfad":"src/a.js","inhalt":"x","basis_blob":"' || repeat('b',40) || '"}]')::jsonb) > 0 as ok;
select ws_code_hand_auftrag((select id from ws_gruppen where bereich_id='plattform' limit 1),'Kleine Korrektur','',repeat('a',40),'[{"pfad":".git/hooks/pre-commit","inhalt":"x"}]');
select ws_code_hand_auftrag((select id from ws_gruppen where bereich_id='plattform' limit 1),'Kleine Korrektur','',repeat('a',40),'[]');
select a.hand, a.art, a.stand, c.pfad, c.basis_blob is not null as basis from ws_auftraege a join ws_code_aenderungen c on c.auftrag_id=a.id;
\echo [3b] D1: .env -> FEHLER; .github/workflows -> FEHLER (nur Admin); Admin .github -> OK
select ws_code_hand_auftrag((select id from ws_gruppen where bereich_id='plattform' limit 1),'Kleine Korrektur','',repeat('a',40),'[{"pfad":"config/.env.local","inhalt":"x"}]');
select ws_code_hand_auftrag((select id from ws_gruppen where bereich_id='plattform' limit 1),'Kleine Korrektur','',repeat('a',40),'[{"pfad":".github/workflows/x.yml","inhalt":"x"}]');
:ADM
select ws_code_hand_auftrag((select id from ws_gruppen where bereich_id='plattform' limit 1),'Ablauf','',repeat('a',40),'[{"pfad":".github/workflows/x.yml","inhalt":"x"}]') > 0 as ok;
:D1
\echo [4] Direkt hand=true setzen -> FEHLER (insert und update)
insert into ws_auftraege(gruppe_id,titel,erstellt_von,hand) values ((select id from ws_gruppen where bereich_id='plattform' limit 1),'X',auth.uid(),true);
:ADM
update ws_auftraege set hand=false where hand;
\echo [5] Leser sieht die Aenderung nicht (0)
:LE
select count(*) from ws_code_aenderungen;
\echo [6] 0032: Ordner-Pfade ('.', 'config/') und geheime Datei -> FEHLER (3x); Texter mit Auftragsrecht in zweitem Projekt -> FEHLER
:LE
select ws_code_anfragen('trainer-to-go','main','datei','.');
select ws_code_anfragen('trainer-to-go','main','datei','config/');
select ws_code_anfragen('trainer-to-go','main','datei','config/.env');
:ADM
select ws_projekt_anlegen('zwei','Zwei','','owner/zwei','') \g /dev/null
insert into ws_bereiche(id,projekt_id,name) values ('zwei-b','zwei','B') on conflict do nothing;
insert into ws_gruppen(id,bereich_id,name) values ('zwei-g','zwei-b','G') on conflict do nothing;
insert into ws_einladungen(email,rolle,eingeladen_von,projekt_id) values ('d1@x.at','texter',auth.uid(),'zwei');
:D1
select ws_einladung_annehmen('D1') \g /dev/null
:ADM
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000d1','zwei-b',true,false,false) \g /dev/null
:D1
select ws_code_hand_auftrag('zwei-g','Als Texter','',repeat('a',40),'[{"pfad":"a.js","inhalt":"x"}]');
\echo [7] Eigene Hand-Aenderung selbst freigeben -> FEHLER
:ADM
select ws_rechte_setzen('00000000-0000-0000-0000-0000000000d1','plattform',true,true,false) \g /dev/null
update ws_auftraege set stand='freigabe', pr_nummer=1, zweig='auftrag-x' where hand and erstellt_von='00000000-0000-0000-0000-0000000000d1';
:D1
select ws_freigeben((select min(id) from ws_auftraege where hand));
rollback;
