create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.strava_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  strava_athlete_id bigint not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  strava_activity_id bigint not null,
  name text,
  sport_type text,
  start_date timestamptz,
  moving_time_seconds integer,
  elapsed_time_seconds integer,
  distance_meters numeric,
  total_elevation_gain_meters numeric,
  average_speed_mps numeric,
  max_speed_mps numeric,
  average_heartrate numeric,
  max_heartrate numeric,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_user_strava_activity_unique unique (user_id, strava_activity_id)
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  activities_fetched integer,
  error text,
  created_at timestamptz not null default now(),
  constraint sync_runs_status_check check (status in ('running', 'success', 'failed'))
);

create index strava_connections_athlete_id_idx
  on public.strava_connections (strava_athlete_id);

create index activities_user_start_date_idx
  on public.activities (user_id, start_date desc);

create index activities_user_sport_type_start_date_idx
  on public.activities (user_id, sport_type, start_date desc);

create index sync_runs_user_started_at_idx
  on public.sync_runs (user_id, started_at desc);

alter table public.profiles enable row level security;
alter table public.strava_connections enable row level security;
alter table public.activities enable row level security;
alter table public.sync_runs enable row level security;

create policy "Users can select their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can select their own Strava connection"
on public.strava_connections
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can select their own activities"
on public.activities
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can select their own sync runs"
on public.sync_runs
for select
to authenticated
using (auth.uid() = user_id);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger strava_connections_set_updated_at
before update on public.strava_connections
for each row execute function public.set_updated_at();

create trigger activities_set_updated_at
before update on public.activities
for each row execute function public.set_updated_at();

create or replace view public.weekly_activity_minutes
with (security_invoker = true)
as
select
  user_id,
  date_trunc('week', start_date)::date as week_start,
  sport_type,
  sum(moving_time_seconds) / 60.0 as total_moving_minutes,
  count(*) as activity_count
from public.activities
where start_date is not null
group by user_id, date_trunc('week', start_date), sport_type;

create or replace view public.monthly_distance_by_sport
with (security_invoker = true)
as
select
  user_id,
  date_trunc('month', start_date)::date as month_start,
  sport_type,
  sum(distance_meters) as total_distance_meters,
  sum(distance_meters / 1609.344) as total_distance_miles,
  count(*) as activity_count
from public.activities
where start_date is not null
group by user_id, date_trunc('month', start_date), sport_type;

create or replace view public.yearly_running_distance
with (security_invoker = true)
as
select
  user_id,
  date_trunc('year', start_date)::date as year_start,
  sum(distance_meters) as total_distance_meters,
  sum(distance_meters / 1609.344) as total_distance_miles,
  count(*) as activity_count
from public.activities
where start_date is not null
  and sport_type in ('Run', 'TrailRun', 'VirtualRun')
group by user_id, date_trunc('year', start_date);

create or replace view public.weekly_sport_breakdown
with (security_invoker = true)
as
select
  user_id,
  date_trunc('week', start_date)::date as week_start,
  sport_type,
  sum(moving_time_seconds) as total_moving_seconds,
  sum(moving_time_seconds) / 60.0 as total_moving_minutes,
  sum(distance_meters) as total_distance_meters,
  count(*) as activity_count
from public.activities
where start_date is not null
group by user_id, date_trunc('week', start_date), sport_type;
