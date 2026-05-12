create table if not exists public.user_sport_category_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('running', 'cycling', 'swimming', 'other')),
  color_hex text not null check (color_hex ~ '^#[0-9A-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_type text not null check (goal_type in ('yearly_running_distance', 'weekly_workout_minutes')),
  sport_category text check (sport_category in ('running', 'cycling', 'swimming', 'other')),
  target_value numeric not null check (target_value > 0),
  unit text not null check (unit in ('miles', 'minutes')),
  period text not null check (period in ('weekly', 'monthly', 'yearly')),
  starts_on date,
  ends_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

create table if not exists public.user_dashboard_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_goals_user_goal_type_active_idx
  on public.user_goals (user_id, goal_type, is_active);

create or replace trigger user_sport_category_settings_set_updated_at
before update on public.user_sport_category_settings
for each row execute function public.set_updated_at();

create or replace trigger user_goals_set_updated_at
before update on public.user_goals
for each row execute function public.set_updated_at();

create or replace trigger user_dashboard_preferences_set_updated_at
before update on public.user_dashboard_preferences
for each row execute function public.set_updated_at();

alter table public.user_sport_category_settings enable row level security;
alter table public.user_goals enable row level security;
alter table public.user_dashboard_preferences enable row level security;

create policy "Users can select their own sport category settings"
  on public.user_sport_category_settings
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own sport category settings"
  on public.user_sport_category_settings
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own sport category settings"
  on public.user_sport_category_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own sport category settings"
  on public.user_sport_category_settings
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can select their own goals"
  on public.user_goals
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own goals"
  on public.user_goals
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own goals"
  on public.user_goals
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own goals"
  on public.user_goals
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can select their own dashboard preferences"
  on public.user_dashboard_preferences
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own dashboard preferences"
  on public.user_dashboard_preferences
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own dashboard preferences"
  on public.user_dashboard_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own dashboard preferences"
  on public.user_dashboard_preferences
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant all on table public.user_sport_category_settings to service_role;
grant select, insert, update, delete on table public.user_sport_category_settings to authenticated;

grant all on table public.user_goals to service_role;
grant select, insert, update, delete on table public.user_goals to authenticated;

grant all on table public.user_dashboard_preferences to service_role;
grant select, insert, update, delete on table public.user_dashboard_preferences to authenticated;
