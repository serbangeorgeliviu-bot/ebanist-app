-- 5.82.0: proiecte partajate între utilizatori (D-25 / D-159). Trei roluri: viewer (vede), commenter (vede și comentează), editor (vede, modifică și comentează).
-- Proprietarul rămâne cel din projects.created_by; membrii nu pot șterge proiectul, nu-i pot schimba proprietarul și nu pot partaja mai departe.
-- Invitația e un cod de unică folosință, valabil 7 zile (ca la atelier). Anulare completă la sfârșitul fișierului.

create type public.project_role as enum ('viewer', 'commenter', 'editor');

create table public.project_members (
  project_id text not null references public.projects(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.project_role not null,
  added_by   uuid not null references auth.users(id),
  added_at   timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

create table public.project_invites (
  code       text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  role       public.project_role not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by    uuid references auth.users(id),
  used_at    timestamptz
);

create table public.project_comments (
  id          uuid primary key default gen_random_uuid(),
  project_id  text not null references public.projects(id) on delete cascade,
  author      uuid not null default auth.uid() references auth.users(id),
  author_name text,
  body        text not null check (char_length(body) between 1 and 2000),
  piece_ref   text,
  created_at  timestamptz not null default now()
);
create index project_comments_project_idx on public.project_comments (project_id, created_at);

alter table public.project_members  enable row level security;
alter table public.project_invites  enable row level security;
alter table public.project_comments enable row level security;

-- rolul meu pe un proiect: 'owner' | 'editor' | 'commenter' | 'viewer' | null. SECURITY DEFINER ca să nu intre în recursie cu politicile.
create or replace function public.project_role_of(p_project text) returns text
language sql stable security definer set search_path = public as $f$
  select case
    when exists (select 1 from public.projects p where p.id = p_project and p.created_by = auth.uid()) then 'owner'
    else (select m.role::text from public.project_members m where m.project_id = p_project and m.user_id = auth.uid())
  end
$f$;

-- membrii: fiecare își vede rândul, proprietarul îi vede pe toți; scrierea numai prin funcțiile de mai jos
create policy "membri: propriul rând sau proprietarul" on public.project_members for select
  using (user_id = auth.uid() or public.project_role_of(project_id) = 'owner');

-- invitațiile le vede numai proprietarul
create policy "invitații: proprietarul" on public.project_invites for select
  using (public.project_role_of(project_id) = 'owner');

-- comentarii: le citește oricine are un rol pe proiect; scrie proprietarul, editorul, comentatorul, în numele lui; șterge autorul sau proprietarul
create policy "comentarii: citire" on public.project_comments for select
  using (public.project_role_of(project_id) is not null);
create policy "comentarii: scriere" on public.project_comments for insert
  with check (author = auth.uid() and public.project_role_of(project_id) in ('owner', 'editor', 'commenter'));
create policy "comentarii: ștergere" on public.project_comments for delete
  using (author = auth.uid() or public.project_role_of(project_id) = 'owner');

create or replace function public.project_comment_author() returns trigger
language plpgsql security definer set search_path = public as $f$
begin
  new.author := auth.uid();
  new.author_name := coalesce((select nullif(trim(full_name), '') from public.profiles where id = auth.uid()),
                              (select split_part(email::text, '@', 1) from auth.users where id = auth.uid()), '—');
  return new;
end $f$;
create trigger project_comment_author before insert on public.project_comments
  for each row execute function public.project_comment_author();

-- proiectele: membrii le citesc; numai editorii le modifică. Politica proprietarului (created_by = auth.uid()) rămâne neschimbată.
create policy "projects: membrii citesc" on public.projects for select
  using (exists (select 1 from public.project_members m where m.project_id = projects.id and m.user_id = auth.uid()));
create policy "projects: editorii modifică" on public.projects for update
  using (exists (select 1 from public.project_members m where m.project_id = projects.id and m.user_id = auth.uid() and m.role = 'editor'))
  with check (exists (select 1 from public.project_members m where m.project_id = projects.id and m.user_id = auth.uid() and m.role = 'editor'));

-- un editor nu poate muta proiectul pe alt proprietar și nu-i poate schimba id-ul
create or replace function public.projects_keep_owner() returns trigger
language plpgsql set search_path = public as $f$
begin
  new.created_by := old.created_by;
  new.id := old.id;
  return new;
end $f$;
create trigger projects_keep_owner before update on public.projects
  for each row execute function public.projects_keep_owner();

-- invitație (numai proprietarul): întoarce codul
create or replace function public.project_invite(p_project text, p_role public.project_role) returns text
language plpgsql security definer set search_path = public as $f$
declare v_code text;
begin
  if public.project_role_of(p_project) is distinct from 'owner' then raise exception 'project:not_allowed'; end if;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.project_invites (code, project_id, role, created_by) values (v_code, p_project, p_role, auth.uid());
  return v_code;
end $f$;

-- acceptare: întoarce id-ul proiectului
create or replace function public.project_accept(p_code text) returns text
language plpgsql security definer set search_path = public as $f$
declare v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g')); v_inv public.project_invites;
begin
  if auth.uid() is null then raise exception 'project:not_authenticated'; end if;
  select * into v_inv from public.project_invites where code = v_code for update;
  if not found or v_inv.used_at is not null or v_inv.expires_at < now() then raise exception 'project:code_invalid'; end if;
  if public.project_role_of(v_inv.project_id) is not null then raise exception 'project:already_member'; end if;
  insert into public.project_members (project_id, user_id, role, added_by) values (v_inv.project_id, auth.uid(), v_inv.role, v_inv.created_by);
  update public.project_invites set used_by = auth.uid(), used_at = now() where code = v_code;
  return v_inv.project_id;
end $f$;

-- lista membrilor (proprietarul vede și e-mailurile)
create or replace function public.project_members_list(p_project text)
returns table (user_id uuid, full_name text, email text, role public.project_role, added_at timestamptz)
language plpgsql stable security definer set search_path = public as $f$
declare v_me text := public.project_role_of(p_project);
begin
  if v_me is null then raise exception 'project:not_allowed'; end if;
  return query
    select m.user_id, p.full_name, case when v_me = 'owner' then u.email::text else null end, m.role, m.added_at
    from public.project_members m
    join public.profiles p on p.id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.project_id = p_project order by m.added_at;
end $f$;

create or replace function public.project_set_role(p_project text, p_user uuid, p_role public.project_role) returns void
language plpgsql security definer set search_path = public as $f$
begin
  if public.project_role_of(p_project) is distinct from 'owner' then raise exception 'project:not_allowed'; end if;
  update public.project_members set role = p_role where project_id = p_project and user_id = p_user;
end $f$;

-- proprietarul scoate pe oricine; un membru se poate scoate pe sine (iese din proiect)
create or replace function public.project_remove_member(p_project text, p_user uuid) returns void
language plpgsql security definer set search_path = public as $f$
begin
  if public.project_role_of(p_project) is distinct from 'owner' and p_user is distinct from auth.uid() then raise exception 'project:not_allowed'; end if;
  delete from public.project_members where project_id = p_project and user_id = p_user;
end $f$;

-- proiectele partajate cu mine: cine le deține și ce rol am
create or replace function public.project_shared_list()
returns table (project_id text, owner_id uuid, owner_name text, role public.project_role)
language sql stable security definer set search_path = public as $f$
  select m.project_id, p.created_by, pr.full_name, m.role
  from public.project_members m
  join public.projects p on p.id = m.project_id
  left join public.profiles pr on pr.id = p.created_by
  where m.user_id = auth.uid()
$f$;

revoke all on function public.project_invite(text, public.project_role), public.project_accept(text), public.project_members_list(text),
  public.project_set_role(text, uuid, public.project_role), public.project_remove_member(text, uuid), public.project_shared_list(),
  public.project_role_of(text) from public, anon;
grant execute on function public.project_invite(text, public.project_role), public.project_accept(text), public.project_members_list(text),
  public.project_set_role(text, uuid, public.project_role), public.project_remove_member(text, uuid), public.project_shared_list(),
  public.project_role_of(text) to authenticated;

-- Realtime: semnal către membri (RLS se aplică); comentariile apar fără reîncărcare
alter publication supabase_realtime add table public.project_comments;
alter publication supabase_realtime add table public.project_members;

-- ANULARE (în această ordine):
--   alter publication supabase_realtime drop table public.project_members, public.project_comments;
--   drop trigger projects_keep_owner on public.projects; drop function public.projects_keep_owner();
--   drop policy "projects: editorii modifică" on public.projects; drop policy "projects: membrii citesc" on public.projects;
--   drop function public.project_shared_list(), public.project_remove_member(text, uuid), public.project_set_role(text, uuid, public.project_role),
--     public.project_members_list(text), public.project_accept(text), public.project_invite(text, public.project_role);
--   drop table public.project_comments, public.project_invites, public.project_members;
--   drop function public.project_comment_author(), public.project_role_of(text); drop type public.project_role;
