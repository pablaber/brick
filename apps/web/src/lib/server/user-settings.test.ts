import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CATEGORY_COLORS,
  getActiveGoalsByType,
  isValidColorHex,
  mergeCategoryColorOverrides,
  validateCategoryColors,
  validateGoalTarget
} from './user-settings';

describe('user settings helpers', () => {
  it('merges defaults when there are no rows', () => {
    expect(mergeCategoryColorOverrides([])).toEqual(DEFAULT_CATEGORY_COLORS);
  });

  it('applies valid overrides and ignores invalid rows', () => {
    const merged = mergeCategoryColorOverrides([
      { category: 'running', color_hex: '#123abc' },
      { category: 'swimming', color_hex: 'nope' }
    ]);

    expect(merged.running).toBe('#123ABC');
    expect(merged.swimming).toBe(DEFAULT_CATEGORY_COLORS.swimming);
  });

  it('validates hex colors', () => {
    expect(isValidColorHex('#A1B2C3')).toBe(true);
    expect(isValidColorHex('#a1b2c3')).toBe(false);
    expect(isValidColorHex('A1B2C3')).toBe(false);
  });

  it('validates category color payload', () => {
    const valid = validateCategoryColors({
      running: '#112233',
      cycling: '#445566',
      swimming: '#778899',
      other: '#ABCDEF'
    });

    expect(valid.error).toBeUndefined();
    expect(valid.colors?.running).toBe('#112233');

    const invalid = validateCategoryColors({
      running: '#112233',
      cycling: '#445566',
      swimming: '#778899',
      other: 'bad'
    });

    expect(invalid.error).toContain('Invalid color');
  });

  it('validates goal targets', () => {
    expect(validateGoalTarget('yearly_running_distance', '250').value).toBe(250);
    expect(validateGoalTarget('weekly_workout_minutes', '0').error).toContain('between');
    expect(validateGoalTarget('weekly_workout_minutes', 'abc').error).toContain('number');
  });

  it('filters active goals by type and date', () => {
    const at = new Date('2026-05-12T12:00:00Z');

    const rows = [
      {
        id: 'newer',
        user_id: 'u1',
        goal_type: 'yearly_running_distance',
        sport_category: 'running',
        target_value: 1200,
        unit: 'miles',
        period: 'yearly',
        starts_on: null,
        ends_on: null,
        is_active: true,
        created_at: '2026-05-12T00:00:00Z',
        updated_at: '2026-05-12T00:00:00Z'
      },
      {
        id: 'older',
        user_id: 'u1',
        goal_type: 'yearly_running_distance',
        sport_category: 'running',
        target_value: 800,
        unit: 'miles',
        period: 'yearly',
        starts_on: null,
        ends_on: null,
        is_active: true,
        created_at: '2026-05-10T00:00:00Z',
        updated_at: '2026-05-10T00:00:00Z'
      },
      {
        id: 'inactive',
        user_id: 'u1',
        goal_type: 'weekly_workout_minutes',
        sport_category: null,
        target_value: 300,
        unit: 'minutes',
        period: 'weekly',
        starts_on: null,
        ends_on: null,
        is_active: false,
        created_at: '2026-05-10T00:00:00Z',
        updated_at: '2026-05-10T00:00:00Z'
      },
      {
        id: 'expired',
        user_id: 'u1',
        goal_type: 'weekly_workout_minutes',
        sport_category: null,
        target_value: 180,
        unit: 'minutes',
        period: 'weekly',
        starts_on: '2026-04-01',
        ends_on: '2026-04-07',
        is_active: true,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z'
      },
      {
        id: 'current',
        user_id: 'u1',
        goal_type: 'weekly_workout_minutes',
        sport_category: null,
        target_value: 240,
        unit: 'minutes',
        period: 'weekly',
        starts_on: '2026-05-01',
        ends_on: null,
        is_active: true,
        created_at: '2026-05-01T00:00:00Z',
        updated_at: '2026-05-01T00:00:00Z'
      }
    ];

    const active = getActiveGoalsByType(rows, at);

    expect(active.yearly_running_distance?.targetValue).toBe(1200);
    expect(active.weekly_workout_minutes?.targetValue).toBe(240);
  });
});
