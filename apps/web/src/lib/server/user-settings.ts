import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@workout/shared';

type Supabase = SupabaseClient<Database>;

type GoalRow = Database['public']['Tables']['user_goals']['Row'];

export const SPORT_CATEGORIES = ['running', 'cycling', 'swimming', 'other'] as const;
export type SportCategory = (typeof SPORT_CATEGORIES)[number];

export const GOAL_TYPES = [
  'yearly_running_distance',
  'yearly_cycling_distance',
  'yearly_swimming_distance',
  'weekly_workout_minutes'
] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const DEFAULT_CATEGORY_COLORS: Record<SportCategory, string> = {
  running: '#F97316',
  cycling: '#22C55E',
  swimming: '#0EA5E9',
  other: '#8B5CF6'
};

const COLOR_HEX_REGEX = /^#[0-9A-F]{6}$/;

type GoalDefinition = {
  goalType: GoalType;
  label: string;
  unit: 'miles' | 'minutes';
  period: 'weekly' | 'yearly';
  sportCategory: SportCategory | null;
  min: number;
  max: number;
  step: number;
};

export const GOAL_DEFINITIONS: Record<GoalType, GoalDefinition> = {
  yearly_running_distance: {
    goalType: 'yearly_running_distance',
    label: 'Yearly running distance',
    unit: 'miles',
    period: 'yearly',
    sportCategory: 'running',
    min: 1,
    max: 10000,
    step: 1
  },
  yearly_cycling_distance: {
    goalType: 'yearly_cycling_distance',
    label: 'Yearly cycling distance',
    unit: 'miles',
    period: 'yearly',
    sportCategory: 'cycling',
    min: 1,
    max: 10000,
    step: 1
  },
  yearly_swimming_distance: {
    goalType: 'yearly_swimming_distance',
    label: 'Yearly swimming distance',
    unit: 'miles',
    period: 'yearly',
    sportCategory: 'swimming',
    min: 1,
    max: 10000,
    step: 1
  },
  weekly_workout_minutes: {
    goalType: 'weekly_workout_minutes',
    label: 'Weekly workout minutes',
    unit: 'minutes',
    period: 'weekly',
    sportCategory: null,
    min: 1,
    max: 10080,
    step: 5
  }
};

export type ActiveGoalSummary = {
  id: string;
  goalType: GoalType;
  targetValue: number;
  unit: 'miles' | 'minutes';
  period: 'weekly' | 'yearly';
  sportCategory: SportCategory | null;
};

export type UserSettings = {
  colors: Record<SportCategory, string>;
  activeGoals: Partial<Record<GoalType, ActiveGoalSummary>>;
};

function isSportCategory(value: string): value is SportCategory {
  return (SPORT_CATEGORIES as readonly string[]).includes(value);
}

function isGoalType(value: string): value is GoalType {
  return (GOAL_TYPES as readonly string[]).includes(value);
}

export function normalizeColorHex(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidColorHex(value: string): boolean {
  return COLOR_HEX_REGEX.test(value);
}

export function mergeCategoryColorOverrides(
  rows:
    | Pick<
        Database['public']['Tables']['user_sport_category_settings']['Row'],
        'category' | 'color_hex'
      >[]
    | null
    | undefined
): Record<SportCategory, string> {
  const merged = { ...DEFAULT_CATEGORY_COLORS };

  for (const row of rows ?? []) {
    if (!row) continue;
    if (!isSportCategory(row.category)) continue;

    const normalized = normalizeColorHex(row.color_hex);
    if (!isValidColorHex(normalized)) continue;

    merged[row.category] = normalized;
  }

  return merged;
}

export function validateGoalTarget(
  goalType: GoalType,
  rawTarget: string
): { value?: number; error?: string } {
  const target = Number(rawTarget.trim());
  if (!Number.isFinite(target)) {
    return { error: 'Target must be a number.' };
  }

  const def = GOAL_DEFINITIONS[goalType];
  if (target < def.min || target > def.max) {
    return { error: `Target must be between ${def.min} and ${def.max} ${def.unit}.` };
  }

  return { value: target };
}

export function validateCategoryColors(input: Partial<Record<SportCategory, string>>): {
  colors?: Record<SportCategory, string>;
  error?: string;
} {
  const merged = { ...DEFAULT_CATEGORY_COLORS };

  for (const category of SPORT_CATEGORIES) {
    const raw = input[category];
    if (!raw) {
      return { error: `Missing color for ${category}.` };
    }

    const normalized = normalizeColorHex(raw);
    if (!isValidColorHex(normalized)) {
      return { error: `Invalid color for ${category}. Use #RRGGBB.` };
    }

    merged[category] = normalized;
  }

  return { colors: merged };
}

function isActiveForDate(goal: GoalRow, at: Date): boolean {
  if (!goal.is_active) return false;

  const day = at.toISOString().split('T')[0];
  if (goal.starts_on && goal.starts_on > day) return false;
  if (goal.ends_on && goal.ends_on < day) return false;

  return true;
}

export function getActiveGoalsByType(
  rows: GoalRow[] | null | undefined,
  at: Date = new Date()
): Partial<Record<GoalType, ActiveGoalSummary>> {
  const activeGoals: Partial<Record<GoalType, ActiveGoalSummary>> = {};

  for (const row of rows ?? []) {
    if (!row) continue;
    if (!isGoalType(row.goal_type)) continue;
    if (!isActiveForDate(row, at)) continue;

    const def = GOAL_DEFINITIONS[row.goal_type];
    const summary: ActiveGoalSummary = {
      id: row.id,
      goalType: row.goal_type,
      targetValue: Number(row.target_value),
      unit: def.unit,
      period: def.period,
      sportCategory: def.sportCategory
    };

    if (!activeGoals[row.goal_type]) {
      activeGoals[row.goal_type] = summary;
    }
  }

  return activeGoals;
}

export async function loadUserSettings(supabase: Supabase, userId: string): Promise<UserSettings> {
  const [{ data: colorRows, error: colorError }, { data: goalRows, error: goalError }] =
    await Promise.all([
      supabase
        .from('user_sport_category_settings')
        .select('category,color_hex')
        .eq('user_id', userId),
      supabase
        .from('user_goals')
        .select(
          'id,user_id,goal_type,sport_category,target_value,unit,period,starts_on,ends_on,is_active,created_at,updated_at'
        )
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
    ]);

  if (colorError) throw colorError;
  if (goalError) throw goalError;

  return {
    colors: mergeCategoryColorOverrides(colorRows),
    activeGoals: getActiveGoalsByType(goalRows)
  };
}

export async function upsertSportCategoryColors(
  supabase: Supabase,
  userId: string,
  colors: Record<SportCategory, string>
): Promise<void> {
  const upserts = SPORT_CATEGORIES.map((category) => ({
    user_id: userId,
    category,
    color_hex: normalizeColorHex(colors[category])
  }));

  const { error } = await supabase
    .from('user_sport_category_settings')
    .upsert(upserts, { onConflict: 'user_id,category' });

  if (error) throw error;
}

export async function upsertGoal(
  supabase: Supabase,
  userId: string,
  goalType: GoalType,
  targetValue: number
): Promise<void> {
  const definition = GOAL_DEFINITIONS[goalType];

  const { data: insertedGoal, error: insertError } = await supabase
    .from('user_goals')
    .insert({
      user_id: userId,
      goal_type: goalType,
      sport_category: definition.sportCategory,
      target_value: targetValue,
      unit: definition.unit,
      period: definition.period,
      is_active: true
    })
    .select('id')
    .single();

  if (insertError) throw insertError;

  const { error: deactivateError } = await supabase
    .from('user_goals')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('goal_type', goalType)
    .eq('is_active', true)
    .neq('id', insertedGoal.id);

  if (deactivateError) throw deactivateError;
}

export async function deactivateGoal(supabase: Supabase, userId: string, goalType: GoalType) {
  const { error } = await supabase
    .from('user_goals')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('goal_type', goalType)
    .eq('is_active', true);

  if (error) throw error;
}

export function parseGoalType(raw: FormDataEntryValue | null): GoalType | null {
  if (typeof raw !== 'string') return null;
  return isGoalType(raw) ? raw : null;
}
