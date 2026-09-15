-- Fix: requests previously used a single fixed id ("demo-request-1") shared
-- by every signed-in user. Each user now gets their own request rows.
alter table public.requests alter column id set default gen_random_uuid()::text;
alter table public.requests add column if not exists review_decision text
  check (review_decision in ('In review', 'Clarification requested', 'Ready for approval'))
  default 'In review';

create table if not exists public.clarifications (
  id uuid primary key default gen_random_uuid(),
  request_id text not null references public.requests(id) on delete cascade,
  user_id uuid not null,
  requirements text not null,
  vendors text not null,
  controls text not null,
  questions text not null,
  submitted_at timestamptz not null default now(),
  unique (request_id)
);

create index if not exists idx_clarifications_request_id on public.clarifications(request_id);
create index if not exists idx_clarifications_user_id on public.clarifications(user_id);

alter table public.clarifications enable row level security;

create policy "Users can view their own clarifications" on public.clarifications
  for select using (auth.uid() = user_id);

create policy "Users can insert their own clarifications" on public.clarifications
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own clarifications" on public.clarifications
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  request_id text not null references public.requests(id) on delete cascade,
  user_id uuid not null,
  decision text not null check (decision in ('Pending approval', 'Approved', 'Returned for clarification')),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id)
);

create index if not exists idx_approvals_request_id on public.approvals(request_id);
create index if not exists idx_approvals_user_id on public.approvals(user_id);

alter table public.approvals enable row level security;

create policy "Users can view their own approvals" on public.approvals
  for select using (auth.uid() = user_id);

create policy "Users can insert their own approvals" on public.approvals
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own approvals" on public.approvals
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
