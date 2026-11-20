-- Schema minimă care imită Supabase (roluri, auth.users, auth.uid(), profiles, projects cu politica proprietarului),
-- peste care se aplică migrația REALĂ 20261118_project_sharing.sql. Doar pentru testul local share-rls.test.mjs.
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true), (nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'sub'), '')::uuid $$;
create type public.app_role as enum ('user');
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text, role public.app_role, created_at timestamptz default now());
create table public.projects (id text primary key, name text not null, client text, data jsonb, legacy_key text, created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now());
alter table public.profiles enable row level security; alter table public.projects enable row level security;
create policy "profiles: citește propriul rând" on public.profiles for select using (auth.uid() = id);
create policy "projects: doar propriile proiecte" on public.projects for all using (created_by = auth.uid()) with check (created_by = auth.uid());
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path to 'public' as $f$
begin insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data ->> 'full_name'); return new; end $f$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create publication supabase_realtime;
grant usage on schema public, auth to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on auth.users to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
