-- Execute in a dedicated T07 Supabase project. Do not modify T06's public.pds_state.
create table if not exists public.pds_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"plans":[],"tasks":[],"executions":[],"reflections":[]}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.pds_user_state enable row level security;
revoke all on public.pds_user_state from anon;
grant select, insert, update, delete on public.pds_user_state to authenticated;
create policy "owner_select" on public.pds_user_state for select to authenticated using (auth.uid()=user_id);
create policy "owner_insert" on public.pds_user_state for insert to authenticated with check (auth.uid()=user_id);
create policy "owner_update" on public.pds_user_state for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "owner_delete" on public.pds_user_state for delete to authenticated using (auth.uid()=user_id);