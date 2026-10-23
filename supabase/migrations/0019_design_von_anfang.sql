-- Codeschmiede · Datenbank v19: App-Designer von Anfang an (Gerhard 2026-10-23 17:49 „App-Designer soll auch gestaltbar sein,
-- wenn noch nichts angelegt ist, und den Chat haben – das Design ist eines der ersten Dinge, die man plant“).
-- Bisher brauchte der Designer eine fest eingetragene Design-Gruppe (ws_projekte.design_gruppe_id) – neue Projekte hatten keine.
-- Jetzt: jedes Projekt bekommt sie automatisch (die Gruppe „Oberfläche & Design“, die beim Anlegen ohnehin entsteht;
-- fehlt sie, wird sie angelegt). Rechte unverändert: gestalten dürfen Admin und Entwickler mit „Aufträge geben“ im Bereich.
-- Mehrfach ausführbar. Reihenfolge 0001 → … → 0019.
begin;

-- Kern: Design-Gruppe eines Projekts sicherstellen (ohne Rechteprüfung – nur intern aufrufen)
create or replace function public.ws_design_gruppe_sicher(p_projekt text) returns text
language plpgsql security definer set search_path = public as $$
declare g text; b text; wer uuid;
begin
  select design_gruppe_id, coalesce(auth.uid(), erstellt_von) into g, wer from public.ws_projekte where id = p_projekt;
  if not found then raise exception 'Projekt nicht gefunden'; end if;
  if g is not null and public.ws_projekt_von_gruppe(g) = p_projekt then return g; end if;
  -- 1. vorhandene Gruppe <projekt>-oberflaeche nehmen
  select gr.id into g from public.ws_gruppen gr join public.ws_bereiche be on be.id = gr.bereich_id
   where be.projekt_id = p_projekt and gr.id = p_projekt || '-oberflaeche' limit 1;   -- nur die feste Kennung (Prüfung N2)
  -- 2. sonst anlegen: im Bereich „App“ (bzw. dem ersten Bereich; fehlt jeder, Bereich „App“ neu)
  if g is null then
    select id into b from public.ws_bereiche where projekt_id = p_projekt order by (id = p_projekt || '-app') desc, reihenfolge limit 1;
    if b is null then
      b := p_projekt || '-app';
      insert into public.ws_bereiche (id, projekt_id, name, reihenfolge) values (b, p_projekt, 'App', 1);
    end if;
    g := p_projekt || '-oberflaeche';
    insert into public.ws_gruppen (id, bereich_id, name, symbol, reihenfolge, erstellt_von)
      values (g, b, 'Oberfläche & Design', 'palette', 0, wer);
  end if;
  -- nie auf eine Gruppe eines anderen Projekts zeigen (Prüfung N1)
  if public.ws_projekt_von_gruppe(g) is distinct from p_projekt then raise exception 'Design-Gruppe gehört nicht zu diesem Projekt'; end if;
  update public.ws_projekte set design_gruppe_id = g where id = p_projekt;
  return g;
end $$;
revoke execute on function public.ws_design_gruppe_sicher(text) from public, anon, authenticated;

-- Aufruf aus dem Designer: Admin oder Entwickler des Projekts
create or replace function public.ws_design_einrichten(p_projekt text) returns text
language plpgsql security definer set search_path = public as $$
declare g text; alt text;
begin
  if coalesce(public.ws_rolle_im_projekt(p_projekt), '') not in ('admin','entwickler') then raise exception 'Den App-Designer richtet der Admin oder ein Entwickler des Projekts ein'; end if;
  select design_gruppe_id into alt from public.ws_projekte where id = p_projekt and not coalesce(archiviert, false);
  if not found then raise exception 'Projekt ist archiviert'; end if;   -- Prüfung N3
  g := public.ws_design_gruppe_sicher(p_projekt);
  if alt is distinct from g then
    insert into public.ws_protokoll (wer, was, details) values (auth.uid(), 'design_eingerichtet', jsonb_build_object('projekt', p_projekt, 'gruppe', g));
  end if;
  return g;
end $$;
revoke execute on function public.ws_design_einrichten(text) from public, anon;
grant execute on function public.ws_design_einrichten(text) to authenticated;

-- Neue Projekte: sobald die Gruppe „<projekt>-oberflaeche“ entsteht, ist sie die Design-Gruppe
create or replace function public.ws_gruppe_design_auto() returns trigger
language plpgsql security definer set search_path = public as $$
declare p text;
begin
  select projekt_id into p from public.ws_bereiche where id = new.bereich_id;
  if p is not null and new.id = p || '-oberflaeche' then
    update public.ws_projekte set design_gruppe_id = new.id where id = p and design_gruppe_id is null;
  end if;
  return new;
end $$;
revoke execute on function public.ws_gruppe_design_auto() from public, anon, authenticated;
drop trigger if exists ws_gruppe_design_auto on public.ws_gruppen;
create trigger ws_gruppe_design_auto after insert on public.ws_gruppen for each row execute function public.ws_gruppe_design_auto();

-- Bestehende Projekte ohne Design-Gruppe nachziehen (archivierte ausgenommen)
do $$ declare r record; begin
  for r in select id from public.ws_projekte where design_gruppe_id is null and not coalesce(archiviert, false) loop
    perform public.ws_design_gruppe_sicher(r.id);
  end loop;
end $$;

commit;
