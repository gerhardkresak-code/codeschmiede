-- Test Datenbank 0038 (Prüfbefunde Etappe 1: keine Baustein-Werte im Grunddesign-Entwurf). Voraussetzung: mock2.sql, 0001 → … → 0038.
-- Aufruf mit -v ON_ERROR_ROLLBACK=on. Erwartung steht jeweils in der \echo-Zeile ("-> FEHLER" = Fehlermeldung).
\set QUIET 1
\pset footer off
begin;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \g /dev/null
\echo [1] Admin legt Grunddesign-Entwurf ohne Bausteine an -> 1
insert into ws_design_entwuerfe(projekt_id,name,werte) values ('trainer-to-go','T32','{"farben":{"hell":{"primaer":"#047857"}}}') returning id as e \gset
select count(*) from ws_design_entwuerfe where id = :e;
\echo [2] Speichern mit Bausteinen -> FEHLER; Anlegen mit Bausteinen -> FEHLER
select ws_design_speichern(:e, '{"bausteine":{"karte":{"ecken":4}}}');
insert into ws_design_entwuerfe(projekt_id,name,werte) values ('trainer-to-go','T32b','{"bausteine":{"karte":{"ecken":4}}}');
\echo [3] Speichern ohne Bausteine -> 2 (neue Version)
select ws_design_speichern(:e, '{"farben":{"hell":{"primaer":"#065f46"}}}');
\echo [4] Baustein-Chat darf weiter Baustein-Werte mitschicken -> 1
insert into ws_design_chat(projekt_id,text,werte) values ('trainer-to-go','[Baustein karte] runder','{"bausteine":{"karte":{"ecken":16}}}');
select count(*) from ws_design_chat where text = '[Baustein karte] runder';
reset role;
rollback;
