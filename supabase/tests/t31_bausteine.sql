-- Test Datenbank 0037 (App-Designer 2.0, Bausteine im Design-Chat). Voraussetzung: mock2.sql, 0001 → … → 0037. Aufruf mit -v ON_ERROR_ROLLBACK=on.
-- Erwartung steht jeweils in der \echo-Zeile ("-> FEHLER" = Fehlermeldung).
\set QUIET 1
\pset footer off
\echo [1] gültige Baustein-Werte -> t t t
select public.ws_design_werte_ok('{"bausteine":{"knopf-haupt":{"hell":{"bg":"#047857","text":"#ffffff"},"dunkel":{"rand":"#34D399"},"ecken":12,"groesse":"gross"}}}') a,
       public.ws_design_werte_ok('{"bausteine":{"status-offen":{"symbol":"AlertTriangle"}}}') b,
       public.ws_design_werte_ok('{"bausteine":{}}') c;
\echo [2] ungültig -> alle f (unbekannte Kennung, freies CSS, Ecken zu groß, falsche Größe, Symbol mit Zeichen, fremder Schlüssel, Array)
select public.ws_design_werte_ok('{"bausteine":{"knopf-xy":{"ecken":4}}}') a,
       public.ws_design_werte_ok('{"bausteine":{"knopf-haupt":{"hell":{"bg":"red;}body{x:y"}}}}') b,
       public.ws_design_werte_ok('{"bausteine":{"karte":{"ecken":40}}}') c,
       public.ws_design_werte_ok('{"bausteine":{"eingabe":{"groesse":"riesig"}}}') d,
       public.ws_design_werte_ok('{"bausteine":{"datei":{"symbol":"x<script>"}}}') e,
       public.ws_design_werte_ok('{"bausteine":{"karte":{"css":"x"}}}') f,
       public.ws_design_werte_ok('{"bausteine":[1]}') g;
\echo [3] bisherige Werte gelten weiter -> t f
select public.ws_design_werte_ok('{"farben":{"hell":{"primaer":"#059669"}},"tabellen":{"standard":"klar"}}') a,
       public.ws_design_werte_ok('{"unbekannt":{}}') b;
\echo [4] Admin fragt im Baustein-Chat mit Werten -> 1 Zeile; mit kaputten Werten -> FEHLER
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \g /dev/null
insert into ws_design_chat(projekt_id,text,werte) values ('trainer-to-go','[Baustein knopf-haupt] Besser lesbar','{"bausteine":{"knopf-haupt":{"hell":{"bg":"#059669","text":"#ffffff","rand":"#059669"},"ecken":6}}}');
select count(*) from ws_design_chat where text like '[Baustein knopf-haupt]%';
insert into ws_design_chat(projekt_id,text,werte) values ('trainer-to-go','[Baustein knopf-haupt] kaputt','{"bausteine":{"knopf-haupt":{"hell":{"bg":"url(x)"}}}}');
reset role;
