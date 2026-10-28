import type { PortfolioPerformancePoint } from '@core/models/api.models';

export type PerformanceInterval = '1W' | '1M' | 'YTD' | '1Y' | 'ALL';

export const PERFORMANCE_INTERVALS: PerformanceInterval[] = ['1W', '1M', 'YTD', '1Y', 'ALL'];

function intervalStart(interval: PerformanceInterval, newest: string): string | null {
  const [year, month, day] = newest.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));

  switch (interval) {
    case '1W':
      start.setUTCDate(start.getUTCDate() - 7);
      break;
    case '1M':
      start.setUTCMonth(start.getUTCMonth() - 1);
      break;
    case 'YTD':
      return `${year}-01-01`;
    case '1Y':
      start.setUTCFullYear(start.getUTCFullYear() - 1);
      break;
    default:
      return null;
  }

  return start.toISOString().slice(0, 10);
}

// Points arrive oldest first, so the newest point is the last one.
export function filterByInterval(
  points: PortfolioPerformancePoint[],
  interval: PerformanceInterval,
): PortfolioPerformancePoint[] {
  const newest = points.at(-1);
  if (!newest) {
    return [];
  }

  const start = intervalStart(interval, newest.date);
  return start === null ? points : points.filter((point) => point.date >= start);
}

export function summarize(points: PortfolioPerformancePoint[]) {
  if (points.length === 0) {
    return null;
  }

  const values = points.map((point) => point.value);
  const [first, current] = [values[0], values[values.length - 1]];
  const change = current - first;
  return {
    current,
    change,
    changePct: first === 0 ? null : (change / first) * 100,
    high: Math.max(...values),
    low: Math.min(...values),
  };
}
