-- Add user_id column to requests table for RLS
alter table public.requests add column user_id uuid default null;

-- Create index on user_id for efficient queries
create index idx_requests_user_id on public.requests(user_id);

-- Add Row Level Security policies
create policy "Users can view their own requests" on public.requests
  for select using (auth.uid() = user_id);

create policy "Users can insert their own requests" on public.requests
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own requests" on public.requests
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own requests" on public.requests
  for delete using (auth.uid() = user_id);
