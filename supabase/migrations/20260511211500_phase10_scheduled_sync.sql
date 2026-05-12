alter table public.sync_runs
  add column if not exists sync_type text not null default 'manual',
  add column if not exists activities_upserted integer;

update public.sync_runs
set sync_type = 'manual'
where sync_type is null;

alter table public.sync_runs
  drop constraint if exists sync_runs_sync_type_check;

alter table public.sync_runs
  add constraint sync_runs_sync_type_check
  check (sync_type in ('manual', 'scheduled'));
