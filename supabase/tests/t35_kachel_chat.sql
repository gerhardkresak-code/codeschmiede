-- Test Datenbank 0041 (Seiten-Designer · Chat zur Kachel). Voraussetzung: mock2.sql, 0001 → … → 0041. Aufruf mit -v ON_ERROR_ROLLBACK=on.
-- Erwartung steht jeweils in der \echo-Zeile ("-> FEHLER" = Fehlermeldung). Nur erfundene Test-Konten.
\set QUIET 1
\pset footer off
\echo [1] gültige Kachel-Werte -> t t t t
select public.ws_design_werte_ok('{"kachel":{"seite":"home_trainer","geraet":"pc","block":"next","w":6,"h":4,"auto":true,"variant":"kompakt","style":{"flat":true,"farbe":"#FEF3C7","farbe_dunkel":"#1c1917"},"props":{"anzahl":5}}}') a,
       public.ws_design_werte_ok('{"kachel":{"seite":"training","geraet":"handy","block":"links","props":{"ziele":["calendar","exercise-library"]}}}') b,
       public.ws_design_werte_ok('{"kachel":{"block":"text","props":{"title":"Hallo","text":"Training fällt aus"}}}') c,
       public.ws_design_werte_ok('{"kachel":{}}') d;
\echo [2] ungültig -> alle f (fremder Schlüssel, Breite 0/25/Bruch, Gerät, Seite mit Zeichen, Farbe als CSS, fremdes Stil-Feld, Bild-Adresse in props, Ziel mit Zeichen, 25 Ziele, Anzahl 51, Titel zu lang, auto als Text, Array)
select public.ws_design_werte_ok('{"kachel":{"css":"x"}}') a,
       public.ws_design_werte_ok('{"kachel":{"w":0}}') b,
       public.ws_design_werte_ok('{"kachel":{"h":25}}') c,
       public.ws_design_werte_ok('{"kachel":{"w":2.5}}') d,
       public.ws_design_werte_ok('{"kachel":{"geraet":"fernseher"}}') e,
       public.ws_design_werte_ok('{"kachel":{"seite":"home/../x"}}') f,
       public.ws_design_werte_ok('{"kachel":{"style":{"farbe":"red;}body{x:y"}}}') g,
       public.ws_design_werte_ok('{"kachel":{"style":{"schatten":true}}}') h,
       public.ws_design_werte_ok('{"kachel":{"props":{"image_url":"https://fremd.example/x.png"}}}') i,
       public.ws_design_werte_ok('{"kachel":{"props":{"ziele":["<script>"]}}}') j,
       public.ws_design_werte_ok(jsonb_build_object('kachel', jsonb_build_object('props', jsonb_build_object('ziele', (select jsonb_agg('chat'::text) from generate_series(1,25)))))) k,
       public.ws_design_werte_ok('{"kachel":{"props":{"anzahl":51}}}') l,
       public.ws_design_werte_ok(jsonb_build_object('kachel', jsonb_build_object('props', jsonb_build_object('title', repeat('x', 81))))) m,
       public.ws_design_werte_ok('{"kachel":{"auto":"ja"}}') n,
       public.ws_design_werte_ok('{"kachel":[1]}') o;
\echo [3] bisherige Werte gelten weiter -> t t f
select public.ws_design_werte_ok('{"farben":{"hell":{"primaer":"#059669"}},"tabellen":{"standard":"klar"}}') a,
       public.ws_design_werte_ok('{"bausteine":{"knopf-haupt":{"ecken":6}}}') b,
       public.ws_design_werte_ok('{"unbekannt":{}}') c;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \g /dev/null
insert into ws_werkstatt_pcs(benutzer_id,name,an) values (auth.uid(),'PC-K',true);
\echo [4] Admin fragt zur Kachel mit Werten und KI-Wunsch -> 1 Zeile mit ki chatgpt; ungültiger KI-Wunsch -> FEHLER; kaputte Werte -> FEHLER
insert into ws_design_chat(projekt_id,entwurf_id,text,werte,ki) values ('trainer-to-go',null,'[Kachel home_trainer/pc/next-0] Ruhiger bitte',
  '{"kachel":{"seite":"home_trainer","geraet":"pc","block":"next","w":7,"h":6,"auto":true}}','chatgpt');
select count(*) as fragen, max(ki) as ki from ws_design_chat where text like '[Kachel home_trainer/pc/next-0]%';
insert into ws_design_chat(projekt_id,text,ki) values ('trainer-to-go','[Kachel home_trainer/pc/next-0] x','--yolo');
insert into ws_design_chat(projekt_id,text,werte) values ('trainer-to-go','[Kachel home_trainer/pc/next-0] kaputt','{"kachel":{"style":{"farbe":"url(x)"}}}');
\echo [5] Stand, Antwort-Kennung oder Absender vorgeben -> FEHLER (3x)
insert into ws_design_chat(projekt_id,text,stand) values ('trainer-to-go','[Kachel home_trainer/pc/next-0] x','beantwortet');
insert into ws_design_chat(projekt_id,text,frage_id) values ('trainer-to-go','[Kachel home_trainer/pc/next-0] x',1);
insert into ws_design_chat(projekt_id,text,von) values ('trainer-to-go','[Kachel home_trainer/pc/next-0] x','00000000-0000-0000-0000-00000000000e');
\echo [6] Werkstatt nimmt die Frage -> Spalte ki = chatgpt kommt mit
select ki, stand from ws_design_chat_nehmen((select id from ws_werkstatt_pcs where name='PC-K'));
\echo [7] Antwort mit gültigem Kachel-Vorschlag -> t, Vorschlag gespeichert
select ws_design_chat_antwort((select max(id) from ws_design_chat where frage_id is null),'Flach und etwas schmaler wirkt ruhiger.','{"kachel":{"w":6,"style":{"flat":true}}}') > 0 as beantwortet;
select werte as vorschlag from ws_design_chat where frage_id=(select max(id) from ws_design_chat where frage_id is null);
\echo [8] Antwort mit ungültigem Kachel-Vorschlag -> Vorschlag verworfen (t), Text bleibt
insert into ws_design_chat(projekt_id,text,werte) values ('trainer-to-go','[Kachel home_trainer/pc/next-0] Bild?','{"kachel":{"block":"next"}}');
select id from ws_design_chat_nehmen((select id from ws_werkstatt_pcs where name='PC-K')) \g /dev/null
select ws_design_chat_antwort((select max(id) from ws_design_chat where frage_id is null),'Hier ein Bild','{"kachel":{"props":{"image_url":"https://x.example/a.png"}}}') \g /dev/null
select text, werte is null as vorschlag_verworfen from ws_design_chat where frage_id=(select max(id) from ws_design_chat where frage_id is null);
\echo [9] Entscheiden über den gültigen Vorschlag -> uebernommen
select ws_design_chat_entscheiden((select id from ws_design_chat where werte ? 'kachel' and frage_id is not null and werte->'kachel' ? 'w'),'uebernommen') \g /dev/null
select entscheidung from ws_design_chat where frage_id is not null and werte->'kachel' ? 'w';
\echo [10] Werte prüfen bleibt nur für angemeldete (anon -> FEHLER)
reset role;
set role anon;
select public.ws_kachel_ok('{}');
reset role;
