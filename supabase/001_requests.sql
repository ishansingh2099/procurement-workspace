create table if not exists public.requests (
  id text primary key,
  form jsonb not null,
  status text not null check (status in ('Draft', 'Submitted for review')),
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.requests enable row level security;

-- The current prototype uses the server-only service role key from the API route.
-- Add authenticated-user policies when Supabase Auth is introduced.
