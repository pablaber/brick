import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth';
import { ensureProfile } from '$lib/server/profiles';
import {
  DEFAULT_CATEGORY_COLORS,
  GOAL_DEFINITIONS,
  SPORT_CATEGORIES,
  deactivateGoal,
  loadUserSettings,
  parseGoalType,
  upsertGoal,
  upsertSportCategoryColors,
  validateCategoryColors,
  validateGoalTarget
} from '$lib/server/user-settings';
import type { Actions, PageServerLoad } from './$types';

const STRAVA_RESULTS = new Set(['connected', 'denied', 'invalid_state', 'error']);
const SYNC_RESULTS = new Set(['success', 'error', 'running', 'not_connected']);
const DISPLAY_NAME_MAX_LENGTH = 80;

export const load: PageServerLoad = async (event) => {
  const user = await requireUser(event);
  await ensureProfile(event.locals.supabase, user);

  const { data: profile } = await event.locals.supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  const { data: stravaConnection } = await event.locals.supabase
    .from('strava_connections')
    .select('strava_athlete_id,scope,last_synced_at,created_at,updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: latestSyncRun } = await event.locals.supabase
    .from('sync_runs')
    .select('status,sync_type,started_at,completed_at,activities_fetched,activities_upserted,error')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestManualSyncRun } = await event.locals.supabase
    .from('sync_runs')
    .select('status,sync_type,started_at,completed_at,activities_fetched,activities_upserted,error')
    .eq('user_id', user.id)
    .eq('sync_type', 'manual')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestScheduledSyncRun } = await event.locals.supabase
    .from('sync_runs')
    .select('status,sync_type,started_at,completed_at,activities_fetched,activities_upserted,error')
    .eq('user_id', user.id)
    .eq('sync_type', 'scheduled')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const userSettings = await loadUserSettings(event.locals.supabase, user.id);

  const stravaResultQuery = event.url.searchParams.get('strava');
  const stravaResult =
    stravaResultQuery && STRAVA_RESULTS.has(stravaResultQuery) ? stravaResultQuery : null;
  const syncResultQuery = event.url.searchParams.get('sync');
  const syncResult = syncResultQuery && SYNC_RESULTS.has(syncResultQuery) ? syncResultQuery : null;

  return {
    email: user.email ?? null,
    userId: user.id,
    displayName: profile?.display_name ?? null,
    stravaResult,
    syncResult,
    settings: {
      colors: userSettings.colors,
      defaultColors: DEFAULT_CATEGORY_COLORS,
      activeGoals: userSettings.activeGoals,
      categories: SPORT_CATEGORIES,
      goalDefinitions: Object.values(GOAL_DEFINITIONS)
    },
    strava: stravaConnection
      ? {
          connected: true,
          strava_athlete_id: stravaConnection.strava_athlete_id,
          scope: stravaConnection.scope,
          last_synced_at: stravaConnection.last_synced_at,
          created_at: stravaConnection.created_at,
          updated_at: stravaConnection.updated_at
        }
      : {
          connected: false,
          strava_athlete_id: null,
          scope: null,
          last_synced_at: null,
          created_at: null,
          updated_at: null
        },
    latestSyncRun: latestSyncRun
      ? {
          status: latestSyncRun.status,
          sync_type: latestSyncRun.sync_type,
          started_at: latestSyncRun.started_at,
          completed_at: latestSyncRun.completed_at,
          activities_fetched: latestSyncRun.activities_fetched,
          activities_upserted: latestSyncRun.activities_upserted,
          error: latestSyncRun.error
        }
      : null,
    latestManualSyncRun: latestManualSyncRun
      ? {
          status: latestManualSyncRun.status,
          sync_type: latestManualSyncRun.sync_type,
          started_at: latestManualSyncRun.started_at,
          completed_at: latestManualSyncRun.completed_at,
          activities_fetched: latestManualSyncRun.activities_fetched,
          activities_upserted: latestManualSyncRun.activities_upserted,
          error: latestManualSyncRun.error
        }
      : null,
    latestScheduledSyncRun: latestScheduledSyncRun
      ? {
          status: latestScheduledSyncRun.status,
          sync_type: latestScheduledSyncRun.sync_type,
          started_at: latestScheduledSyncRun.started_at,
          completed_at: latestScheduledSyncRun.completed_at,
          activities_fetched: latestScheduledSyncRun.activities_fetched,
          activities_upserted: latestScheduledSyncRun.activities_upserted,
          error: latestScheduledSyncRun.error
        }
      : null
  };
};

export const actions: Actions = {
  saveDisplayName: async (event) => {
    const user = await requireUser(event);
    const formData = await event.request.formData();
    const displayNameInput = formData.get('displayName')?.toString() ?? '';
    const displayName = displayNameInput.trim();

    if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
      return fail(400, {
        settingsForm: {
          scope: 'profile',
          error: `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`
        }
      });
    }

    const { error } = await event.locals.supabase.from('profiles').upsert(
      {
        id: user.id,
        display_name: displayName.length > 0 ? displayName : null
      },
      { onConflict: 'id' }
    );

    if (error) {
      console.error('Unable to save display name', error);
      return fail(500, {
        settingsForm: {
          scope: 'profile',
          error: 'Unable to save display name right now.'
        }
      });
    }

    return {
      settingsForm: {
        scope: 'profile',
        success: 'Display name saved.'
      }
    };
  },

  saveSportColors: async (event) => {
    const user = await requireUser(event);
    const formData = await event.request.formData();

    const parsed = validateCategoryColors({
      running: formData.get('running')?.toString(),
      cycling: formData.get('cycling')?.toString(),
      swimming: formData.get('swimming')?.toString(),
      other: formData.get('other')?.toString()
    });

    if (parsed.error || !parsed.colors) {
      return fail(400, {
        settingsForm: {
          scope: 'colors',
          error: parsed.error ?? 'Invalid color values.'
        }
      });
    }

    try {
      await upsertSportCategoryColors(event.locals.supabase, user.id, parsed.colors);
      return {
        settingsForm: {
          scope: 'colors',
          success: 'Sport colors updated.'
        }
      };
    } catch (error) {
      console.error('Unable to save sport colors', error);
      return fail(500, {
        settingsForm: {
          scope: 'colors',
          error: 'Unable to save sport colors right now.'
        }
      });
    }
  },

  saveGoal: async (event) => {
    const user = await requireUser(event);
    const formData = await event.request.formData();

    const goalType = parseGoalType(formData.get('goalType'));
    if (!goalType) {
      return fail(400, {
        settingsForm: {
          scope: 'goals',
          error: 'Invalid goal type.'
        }
      });
    }

    const mode = formData.get('mode')?.toString();

    try {
      if (mode === 'deactivate') {
        await deactivateGoal(event.locals.supabase, user.id, goalType);
        return {
          settingsForm: {
            scope: 'goals',
            success: `${GOAL_DEFINITIONS[goalType].label} goal removed.`
          }
        };
      }

      const rawTarget = formData.get('targetValue')?.toString() ?? '';
      const validation = validateGoalTarget(goalType, rawTarget);

      if (validation.error || validation.value == null) {
        return fail(400, {
          settingsForm: {
            scope: 'goals',
            goalType,
            error: validation.error ?? 'Invalid goal target.'
          }
        });
      }

      await upsertGoal(event.locals.supabase, user.id, goalType, validation.value);

      return {
        settingsForm: {
          scope: 'goals',
          success: `${GOAL_DEFINITIONS[goalType].label} goal saved.`
        }
      };
    } catch (error) {
      console.error('Unable to save goal', error);
      return fail(500, {
        settingsForm: {
          scope: 'goals',
          goalType,
          error: 'Unable to save goal right now.'
        }
      });
    }
  }
};
