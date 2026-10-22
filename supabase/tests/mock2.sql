create schema auth;
create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
create publication supabase_realtime;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','gerhard.kresak@gmail.com',now()),
 ('00000000-0000-0000-0000-00000000000e','dev@x.at',now()),
 ('00000000-0000-0000-0000-00000000000f','fremd@x.at',now()),
 ('00000000-0000-0000-0000-00000000000b','Opfer@X.at',null);
