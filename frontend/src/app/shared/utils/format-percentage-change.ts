// Rounds to the 2 decimals we display; `|| 0` turns -0 into 0 so a tiny loss never shows "-0.00".
export function roundChangePct(changePct: number): number {
  return Math.round(changePct * 100) / 100 || 0;
}

// True when the value shows as 0.00 at 2 decimals, so it is displayed grey and unsigned.
// Non-finite values (no price yet) are not treated as flat.
export function isFlatChange(value: number): boolean {
  return Number.isFinite(value) && roundChangePct(value) === 0;
}

export type Trend = 'up' | 'down' | 'flat';

// Sign of a value as it is displayed: values that round to 0.00 are flat, not green or red.
export function trendForValue(value: number | null | undefined): Trend {
  if (value == null || !Number.isFinite(value) || isFlatChange(value)) {
    return 'flat';
  }
  return value > 0 ? 'up' : 'down';
}

// Same as trendForValue for a return stored as a fraction (0.05 = 5%).
export function trendForFraction(value: number | null | undefined): Trend {
  return value == null ? 'flat' : trendForValue(value * 100);
}

// Trend over a plotted series, from its first point to its last (as a percent change).
export function trendForSeries(points: readonly { value: number }[]): Trend {
  const first = points.at(0)?.value;
  const last = points.at(-1)?.value;
  if (first == null || last == null || first === 0) {
    return 'flat';
  }
  return trendForValue(((last - first) / first) * 100);
}

export function formatPercentageChange(changePct: number): string {
  const roundedPct = roundChangePct(changePct);
  const formattedPct = roundedPct.toFixed(2);

  if (roundedPct > 0) {
    return `+${formattedPct}% ↑`;
  }

  if (roundedPct < 0) {
    return `${formattedPct}% ↓`;
  }

  return `${formattedPct}%`;
}
