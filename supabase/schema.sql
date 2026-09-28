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
  where workspace_id = ws
    and (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  limit 1
$$;

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

-- Link any pending invites to the signed-in user.
create or replace function public.claim_invites() returns void
language sql security definer set search_path = public as $$
  update public.workspace_members set user_id = auth.uid()
  where user_id is null and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.records enable row level security;

drop policy if exists "members read workspace" on public.workspaces;
create policy "members read workspace" on public.workspaces for select using (public.my_role(id) is not null or created_by = auth.uid());
drop policy if exists "anyone signed in creates workspace" on public.workspaces;
create policy "anyone signed in creates workspace" on public.workspaces for insert with check (auth.uid() is not null and created_by = auth.uid());
drop policy if exists "admins rename workspace" on public.workspaces;
create policy "admins rename workspace" on public.workspaces for update using (public.my_role(id) in ('Owner', 'Admin'));
drop policy if exists "owner deletes workspace" on public.workspaces;
create policy "owner deletes workspace" on public.workspaces for delete using (public.my_role(id) = 'Owner');

drop policy if exists "members see team" on public.workspace_members;
create policy "members see team" on public.workspace_members for select using (public.my_role(workspace_id) is not null);
drop policy if exists "admins invite" on public.workspace_members;
create policy "admins invite" on public.workspace_members for insert with check (public.my_role(workspace_id) in ('Owner', 'Admin') and role <> 'Owner');
drop policy if exists "admins change roles" on public.workspace_members;
create policy "admins change roles" on public.workspace_members for update using (public.my_role(workspace_id) in ('Owner', 'Admin') and role <> 'Owner');
drop policy if exists "admins remove people" on public.workspace_members;
create policy "admins remove people" on public.workspace_members for delete using (public.my_role(workspace_id) in ('Owner', 'Admin') and role <> 'Owner');

drop policy if exists "members read records" on public.records;
create policy "members read records" on public.records for select using (public.my_role(workspace_id) is not null);
drop policy if exists "editors write records" on public.records;
create policy "editors write records" on public.records for insert with check (public.my_role(workspace_id) in ('Owner', 'Admin', 'Designer', 'Reviewer'));
drop policy if exists "editors update records" on public.records;
create policy "editors update records" on public.records for update using (public.my_role(workspace_id) in ('Owner', 'Admin', 'Designer', 'Reviewer'));

-- Live updates between teammates.
do $$ begin
  alter publication supabase_realtime add table public.records;
exception when duplicate_object then null; end $$;
