create table public.oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  state text not null unique,
  redirect_to text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint oauth_states_provider_check check (provider in ('strava'))
);

create index oauth_states_state_idx
  on public.oauth_states (state);

create index oauth_states_user_provider_idx
  on public.oauth_states (user_id, provider);

create index oauth_states_expires_at_idx
  on public.oauth_states (expires_at);

alter table public.oauth_states enable row level security;

revoke all privileges on public.oauth_states from public;
revoke all privileges on public.oauth_states from anon;
revoke all privileges on public.oauth_states from authenticated;

grant all privileges on public.oauth_states to service_role;
