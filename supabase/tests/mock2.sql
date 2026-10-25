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

-- Speicher (Supabase Storage) – nur die Tabellen und die Hilfsfunktion, die die Regeln brauchen (ab Datenbank 0042)
create schema if not exists storage;
create table if not exists storage.buckets(id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[], owner uuid);
create table if not exists storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid default auth.uid(),
  metadata jsonb, created_at timestamptz default now(), unique (bucket_id, name));
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
