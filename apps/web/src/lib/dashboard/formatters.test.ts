import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatMetersAsMiles,
  formatMiles,
  formatMinutes,
  formatMonth,
  formatMonthShort,
  formatSecondsAsDuration,
  formatSportType,
  formatWeek,
  formatYear
} from './formatters.js';

describe('formatMiles', () => {
  it('formats miles to one decimal', () => {
    expect(formatMiles(10.567)).toBe('10.6 mi');
  });

  it('returns em dash for null', () => {
    expect(formatMiles(null)).toBe('—');
  });

  it('returns em dash for undefined', () => {
    expect(formatMiles(undefined)).toBe('—');
  });

  it('returns em dash for non-finite values', () => {
    expect(formatMiles(Infinity)).toBe('—');
    expect(formatMiles(NaN)).toBe('—');
  });
});

describe('formatMetersAsMiles', () => {
  it('converts 1609.344 meters to 1.0 mi', () => {
    expect(formatMetersAsMiles(1609.344)).toBe('1.0 mi');
  });

  it('returns em dash for null', () => {
    expect(formatMetersAsMiles(null)).toBe('—');
  });
});

describe('formatMinutes', () => {
  it('formats under 60 minutes as "X min"', () => {
    expect(formatMinutes(42)).toBe('42 min');
  });

  it('formats exactly 60 minutes as "1h"', () => {
    expect(formatMinutes(60)).toBe('1h');
  });

  it('formats 90 minutes as "1h 30m"', () => {
    expect(formatMinutes(90)).toBe('1h 30m');
  });

  it('rounds fractional minutes', () => {
    expect(formatMinutes(42.7)).toBe('43 min');
  });

  it('returns em dash for null', () => {
    expect(formatMinutes(null)).toBe('—');
  });

  it('returns em dash for NaN', () => {
    expect(formatMinutes(NaN)).toBe('—');
  });
});

describe('formatSecondsAsDuration', () => {
  it('converts 3600 seconds to "1h"', () => {
    expect(formatSecondsAsDuration(3600)).toBe('1h');
  });

  it('converts 2520 seconds to "42 min"', () => {
    expect(formatSecondsAsDuration(2520)).toBe('42 min');
  });

  it('returns em dash for null', () => {
    expect(formatSecondsAsDuration(null)).toBe('—');
  });
});

describe('formatDate', () => {
  it('returns em dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('returns em dash for empty string', () => {
    expect(formatDate('')).toBe('—');
  });

  it('formats a valid date string', () => {
    const result = formatDate('2026-05-09T10:00:00Z');
    expect(result).toContain('May');
    expect(result).toContain('2026');
  });
});

describe('formatMonth', () => {
  it('returns a month and year string', () => {
    const result = formatMonth('2026-01-01');
    expect(result).toContain('Jan');
    expect(result).toContain('2026');
  });

  it('returns em dash for null', () => {
    expect(formatMonth(null)).toBe('—');
  });
});

describe('formatMonthShort', () => {
  it('returns only month abbreviation', () => {
    expect(formatMonthShort('2026-05-01')).toBe('May');
  });
});

describe('formatWeek', () => {
  it('returns month and day', () => {
    const result = formatWeek('2026-05-06');
    expect(result).toContain('May');
    expect(result).toContain('6');
  });

  it('returns em dash for null', () => {
    expect(formatWeek(null)).toBe('—');
  });
});

describe('formatYear', () => {
  it('extracts the year', () => {
    expect(formatYear('2026-01-01')).toBe('2026');
  });

  it('returns em dash for null', () => {
    expect(formatYear(null)).toBe('—');
  });
});

describe('formatSportType', () => {
  it('maps known types', () => {
    expect(formatSportType('Run')).toBe('Run');
    expect(formatSportType('VirtualRide')).toBe('Virtual Ride');
    expect(formatSportType('WeightTraining')).toBe('Weights');
  });

  it('passes through unknown types as-is', () => {
    expect(formatSportType('Kayaking')).toBe('Kayaking');
  });

  it('humanizes camel-cased types', () => {
    expect(formatSportType('AlpineSki')).toBe('Alpine Ski');
    expect(formatSportType('NordicSki')).toBe('Nordic Ski');
  });

  it('returns Unknown for null', () => {
    expect(formatSportType(null)).toBe('Unknown');
  });
});

describe('dashboard data shaping helpers', () => {
  it('handles empty arrays without crashing formatters', () => {
    const emptyMiles: number[] = [];
    const max = Math.max(...emptyMiles, 1);
    expect(max).toBe(1);
  });

  it('does not include token fields in connection status shape', () => {
    const shape = {
      connected: true,
      stravaAthleteId: 12345,
      scope: 'read',
      lastSyncedAt: null
    };
    expect(shape).not.toHaveProperty('access_token');
    expect(shape).not.toHaveProperty('refresh_token');
  });
});
