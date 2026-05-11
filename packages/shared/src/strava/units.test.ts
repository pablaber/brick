import { describe, expect, it } from 'vitest';

import { metersPerSecondToMilesPerHour, metersToMiles, secondsToMinutes } from './units.js';

describe('unit conversion helpers', () => {
  it('converts meters to miles without aggressive rounding', () => {
    expect(metersToMiles(1609.344)).toBeCloseTo(1, 12);
  });

  it('converts seconds to minutes', () => {
    expect(secondsToMinutes(120)).toBe(2);
  });

  it('converts meters per second to miles per hour', () => {
    expect(metersPerSecondToMilesPerHour(1)).toBeCloseTo(2.2369362920544, 12);
  });

  it('returns zero for zero values', () => {
    expect(metersToMiles(0)).toBe(0);
    expect(secondsToMinutes(0)).toBe(0);
    expect(metersPerSecondToMilesPerHour(0)).toBe(0);
  });

  it('returns zero for non-finite values to keep sync calculations resilient', () => {
    expect(metersToMiles(Number.POSITIVE_INFINITY)).toBe(0);
    expect(secondsToMinutes(Number.NaN)).toBe(0);
    expect(metersPerSecondToMilesPerHour(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});
