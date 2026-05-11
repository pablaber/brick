import { describe, expect, it } from 'vitest';

import { isRunningSportType, RUNNING_SPORT_TYPES } from './types.js';

describe('running sport types', () => {
  it('matches the SQL running sport list', () => {
    expect(RUNNING_SPORT_TYPES).toEqual(['Run', 'TrailRun', 'VirtualRun']);
  });

  it.each(['Run', 'TrailRun', 'VirtualRun'])('recognizes %s as running', (sportType) => {
    expect(isRunningSportType(sportType)).toBe(true);
  });

  it('does not recognize non-running or missing sport types as running', () => {
    expect(isRunningSportType('Ride')).toBe(false);
    expect(isRunningSportType(null)).toBe(false);
    expect(isRunningSportType(undefined)).toBe(false);
  });
});
