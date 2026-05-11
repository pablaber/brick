const METERS_PER_MILE = 1609.344;
const MILES_PER_HOUR_PER_METER_PER_SECOND = 2.2369362920544;

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function metersToMiles(meters: number): number {
  return finiteOrZero(meters) / METERS_PER_MILE;
}

export function secondsToMinutes(seconds: number): number {
  return finiteOrZero(seconds) / 60;
}

export function metersPerSecondToMilesPerHour(metersPerSecond: number): number {
  return finiteOrZero(metersPerSecond) * MILES_PER_HOUR_PER_METER_PER_SECOND;
}
