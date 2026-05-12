import { createServiceSupabaseClient } from './supabase.js';
import { syncUserActivities } from './sync.js';
import type { Env } from '../env.js';

const DEFAULT_MIN_SYNC_INTERVAL_HOURS = 6;
const DEFAULT_SCHEDULED_SYNC_LIMIT = 25;

export type ScheduledSyncCandidateUser = {
  userId: string;
  lastSyncedAt: string | null;
};

export type FindUsersDueForScheduledSyncOptions = {
  env: Env;
  now?: Date;
  minSyncIntervalHours?: number;
  limit?: number;
};

export type RunScheduledSyncOptions = {
  env: Env;
  controller: ScheduledController;
  now?: Date;
};

export type ScheduledSyncSummary = {
  ok: boolean;
  cron: string;
  scheduledTime: string;
  usersConsidered: number;
  usersSynced: number;
  usersSkipped: number;
  usersFailed: number;
};

export async function findUsersDueForScheduledSync({
  env,
  now = new Date(),
  minSyncIntervalHours = DEFAULT_MIN_SYNC_INTERVAL_HOURS,
  limit = DEFAULT_SCHEDULED_SYNC_LIMIT
}: FindUsersDueForScheduledSyncOptions): Promise<ScheduledSyncCandidateUser[]> {
  const supabase = createServiceSupabaseClient(env);
  const { data, error } = await supabase
    .from('strava_connections')
    .select('user_id,last_synced_at')
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(Math.max(limit * 3, limit));

  if (error) {
    throw new Error('Unable to load connected users for scheduled sync.');
  }

  const cutoffMs = now.getTime() - minSyncIntervalHours * 60 * 60 * 1000;
  const dueUsers = (data ?? [])
    .filter((row) => {
      if (!row.last_synced_at) {
        return true;
      }

      const lastSyncedMs = new Date(row.last_synced_at).getTime();
      if (Number.isNaN(lastSyncedMs)) {
        return true;
      }

      return lastSyncedMs < cutoffMs;
    })
    .slice(0, limit)
    .map((row) => ({
      userId: row.user_id,
      lastSyncedAt: row.last_synced_at
    }));

  return dueUsers;
}

export async function runScheduledSync({
  env,
  controller,
  now = new Date()
}: RunScheduledSyncOptions): Promise<ScheduledSyncSummary> {
  const minSyncIntervalHours = resolvePositiveInt(
    env.STRAVA_SCHEDULED_SYNC_MIN_INTERVAL_HOURS,
    DEFAULT_MIN_SYNC_INTERVAL_HOURS
  );
  const limit = resolvePositiveInt(env.STRAVA_SCHEDULED_SYNC_LIMIT, DEFAULT_SCHEDULED_SYNC_LIMIT);

  const users = await findUsersDueForScheduledSync({
    env,
    now,
    minSyncIntervalHours,
    limit
  });

  let usersSynced = 0;
  let usersSkipped = 0;
  let usersFailed = 0;

  for (const user of users) {
    try {
      const result = await syncUserActivities({
        env,
        userId: user.userId,
        syncType: 'scheduled',
        triggeredBy: 'cron',
        now,
        minSyncIntervalHours
      });

      if (!result.ok) {
        usersFailed += 1;
        console.error(
          'Scheduled sync failed for user.',
          JSON.stringify({
            userId: user.userId,
            statusCode: result.statusCode,
            error: result.error
          })
        );
        continue;
      }

      if (result.skipped) {
        usersSkipped += 1;
        continue;
      }

      usersSynced += 1;
    } catch (error) {
      usersFailed += 1;
      console.error(
        'Scheduled sync threw unexpected error for user.',
        JSON.stringify({
          userId: user.userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      );
    }
  }

  const summary: ScheduledSyncSummary = {
    ok: true,
    cron: controller.cron,
    scheduledTime: now.toISOString(),
    usersConsidered: users.length,
    usersSynced,
    usersSkipped,
    usersFailed
  };

  console.log('Scheduled sync summary.', JSON.stringify(summary));
  return summary;
}

function resolvePositiveInt(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}
