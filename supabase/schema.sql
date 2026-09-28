-- DesignFlow database. Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now()
);

-- Who can open a workspace. Invites are rows with an email and no user_id yet.
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces on delete cascade,
  email text not null,
  user_id uuid references auth.users on delete cascade,
  role text not null default 'Designer' check (role in ('Owner', 'Admin', 'Designer', 'Reviewer', 'Viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, email)
);
-- A secret per invite. The share link carries it, so only the person you sent it to can join.
alter table public.workspace_members add column if not exists invite_code uuid not null default gen_random_uuid();

-- Every project, task, client, time entry etc. is one row, so teammates never overwrite each other's whole workspace.
create table if not exists public.records (
  workspace_id uuid not null references public.workspaces on delete cascade,
  collection text not null,
  id text not null,
  data jsonb not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (workspace_id, collection, id)
);

create or replace function public.my_role(ws uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.workspace_members
  where workspace_id = ws and user_id = auth.uid()
  limit 1
$$;
-- Access comes only from a claimed membership (user_id), never from a matching email alone:
-- with email confirmation off, anyone can sign up with any address.

-- The creator becomes the Owner automatically.
create or replace function public.add_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.workspace_members (workspace_id, email, user_id, role)
  values (new.id, lower(coalesce(auth.jwt() ->> 'email', '')), auth.uid(), 'Owner')
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists workspaces_add_owner on public.workspaces;
create trigger workspaces_add_owner after insert on public.workspaces for each row execute function public.add_owner();

-- True when this session was opened from a link emailed to the address (magic link, confirmation, reset),
-- which proves the person owns that inbox. A password sign-in proves nothing while confirmation is off.
create or replace function public.email_proven() returns boolean
language sql stable set search_path = public as $$
  select coalesce((
    select bool_or(a ->> 'method' in ('otp', 'magiclink', 'email/signup', 'invite', 'recovery', 'email_change'))
    from jsonb_array_elements(case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end) a
  ), false)
$$;

-- Link pending invites to the signed-in user: they need the invite link's code, or to have signed in from their email.
drop function if exists public.claim_invites();
create or replace function public.claim_invites(code uuid default null) returns void
language sql security definer set search_path = public as $$
  update public.workspace_members set user_id = auth.uid()
  where user_id is null and auth.uid() is not null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and (invite_code = code or public.email_proven())
$$;

-- Owners and admins read an invite's code to build the share link. Nobody else can see codes.
create or replace function public.invite_code(ws uuid, invitee text) returns uuid
language sql stable security definer set search_path = public as $$
  select invite_code from public.workspace_members
  where workspace_id = ws and lower(email) = lower(invitee) and user_id is null
    and public.my_role(ws) in ('Owner', 'Admin')
$$;

-- Teammates' rows can only change role. Moving a row to another person or studio is refused.
create or replace function public.guard_member_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') and (
    new.workspace_id <> old.workspace_id or new.email <> old.email
    or new.user_id is distinct from old.user_id or new.invite_code <> old.invite_code
  ) then
    raise exception 'Only a teammate''s role can be changed.';
  end if;
  return new;
end $$;
drop trigger if exists workspace_members_guard on public.workspace_members;
create trigger workspace_members_guard before update on public.workspace_members for each row execute function public.guard_member_update();

-- Records always show who really saved them and when.
create or replace function public.stamp_record() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists records_stamp on public.records;
create trigger records_stamp before insert or update on public.records for each row execute function public.stamp_record();

-- Signed-out visitors get nothing. Signed-in people are limited by the policies below.
revoke all on public.workspaces, public.workspace_members, public.records from anon;
revoke update on public.workspaces from authenticated;
grant update (name) on public.workspaces to authenticated;
revoke select on public.workspace_members from authenticated;
grant select (workspace_id, email, user_id, role, created_at) on public.workspace_members to authenticated;
revoke execute on function public.my_role(uuid), public.claim_invites(uuid), public.invite_code(uuid, text), public.email_proven() from public, anon;
grant execute on function public.my_role(uuid), public.claim_invites(uuid), public.invite_code(uuid, text), public.email_proven() to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.records enable row level security;

drop policy if exists "members read workspace" on public.workspaces;
create policy "members read workspace" on public.workspaces for select to authenticated using (public.my_role(id) is not null or created_by = auth.uid());
drop policy if exists "anyone signed in creates workspace" on public.workspaces;
create policy "anyone signed in creates workspace" on public.workspaces for insert to authenticated with check (auth.uid() is not null and created_by = auth.uid());
drop policy if exists "admins rename workspace" on public.workspaces;
create policy "admins rename workspace" on public.workspaces for update to authenticated using (public.my_role(id) in ('Owner', 'Admin'));
drop policy if exists "owner deletes workspace" on public.workspaces;
create policy "owner deletes workspace" on public.workspaces for delete to authenticated using (public.my_role(id) = 'Owner');

drop policy if exists "members see team" on public.workspace_members;
create policy "members see team" on public.workspace_members for select to authenticated using (public.my_role(workspace_id) is not null);
drop policy if exists "admins invite" on public.workspace_members;
create policy "admins invite" on public.workspace_members for insert to authenticated with check (public.my_role(workspace_id) in ('Owner', 'Admin') and role <> 'Owner' and user_id is null and email = lower(email));
drop policy if exists "admins change roles" on public.workspace_members;
create policy "admins change roles" on public.workspace_members for update to authenticated using (public.my_role(workspace_id) in ('Owner', 'Admin') and role <> 'Owner');
drop policy if exists "admins remove people" on public.workspace_members;
create policy "admins remove people" on public.workspace_members for delete to authenticated using (public.my_role(workspace_id) in ('Owner', 'Admin') and role <> 'Owner');

drop policy if exists "members read records" on public.records;
create policy "members read records" on public.records for select to authenticated using (public.my_role(workspace_id) is not null);
drop policy if exists "editors write records" on public.records;
create policy "editors write records" on public.records for insert to authenticated with check (public.my_role(workspace_id) in ('Owner', 'Admin', 'Designer', 'Reviewer'));
drop policy if exists "editors update records" on public.records;
create policy "editors update records" on public.records for update to authenticated using (public.my_role(workspace_id) in ('Owner', 'Admin', 'Designer', 'Reviewer'));

-- Live updates between teammates.
do $$ begin
  alter publication supabase_realtime add table public.records;
exception when duplicate_object then null; end $$;

-- Project files (briefs, KLDs, artwork). The bucket is private: members get short-lived links.
-- Files live at <workspace id>/<project id>/<file>, so access follows the workspace role.
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 52428800)
on conflict (id) do nothing;

create or replace function public.file_workspace(path text) returns uuid
language sql immutable as $$
  select case when split_part(path, '/', 1) ~ '^[0-9a-f-]{36}$' then split_part(path, '/', 1)::uuid end
$$;

drop policy if exists "members read project files" on storage.objects;
create policy "members read project files" on storage.objects for select to authenticated
  using (bucket_id = 'project-files' and public.my_role(public.file_workspace(name)) is not null);
drop policy if exists "editors upload project files" on storage.objects;
create policy "editors upload project files" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and public.my_role(public.file_workspace(name)) in ('Owner', 'Admin', 'Designer', 'Reviewer'));
drop policy if exists "editors delete project files" on storage.objects;
create policy "editors delete project files" on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and public.my_role(public.file_workspace(name)) in ('Owner', 'Admin', 'Designer'));
