import { InstrumentClass } from '@core/models/api.models';
import { DateRange, MAX_SERIES_YEARS, SortDirection } from '@core/models/analytics.models';
import { LineChartPoint } from '@shared/components/line-chart/line-chart.component';
import { PieChartSlice } from '@shared/components/pie-chart/pie-chart.component';

export const INSTRUMENT_CLASSES: InstrumentClass[] = ['EQUITY', 'ETF', 'CRYPTO', 'FX', 'CASH'];

export const CLASS_LABELS: Record<InstrumentClass, string> = {
  EQUITY: 'Equity',
  ETF: 'ETF',
  CRYPTO: 'Crypto',
  FX: 'FX',
  CASH: 'Cash',
};

// Same colours as the dashboard's allocation chart, so a class looks the same everywhere.
export const CLASS_COLORS: Record<InstrumentClass, string> = {
  EQUITY: '#3498DB',
  ETF: '#9B59B6',
  CRYPTO: '#E67E22',
  FX: '#1ABC9C',
  CASH: '#2ECC71',
};

// Pie slices for a value per class, biggest first. Classes worth nothing would be invisible, so they're left out.
export function classSlices(
  values: { instrumentClass: InstrumentClass; value: number | null }[],
): PieChartSlice[] {
  return values
    .filter((entry) => (entry.value ?? 0) > 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .map((entry) => ({
      label: CLASS_LABELS[entry.instrumentClass],
      value: entry.value ?? 0,
      color: CLASS_COLORS[entry.instrumentClass],
    }));
}

const TOP_SLICES = 4;
const OTHER_COLOR = '#7f8c8d';

/**
 * Pie slices for the holdings inside one class: the biggest few by name, in shades of the class colour, then one
 * "Other (n)" slice for the rest. Items worth nothing are left out.
 */
export function topSlices<T>(
  items: T[],
  label: (item: T) => string,
  value: (item: T) => number | null,
  instrumentClass: InstrumentClass,
): PieChartSlice[] {
  const held = items
    .filter((item) => (value(item) ?? 0) > 0)
    .sort((a, b) => (value(b) ?? 0) - (value(a) ?? 0));
  // Grouping a single leftover as "Other" would hide its name for no reason.
  const shown = held.length <= TOP_SLICES + 1 ? held : held.slice(0, TOP_SLICES);
  const rest = held.slice(shown.length);

  const slices = shown.map((item, index) => ({
    label: label(item),
    value: value(item) ?? 0,
    color: shade(CLASS_COLORS[instrumentClass], index),
  }));
  if (rest.length > 0) {
    slices.push({
      label: `Other (${rest.length})`,
      value: rest.reduce((sum, item) => sum + (value(item) ?? 0), 0),
      color: OTHER_COLOR,
    });
  }
  return slices;
}

// Lighter shades of a colour for each slice, so a class's holdings still read as that class.
function shade(hexColor: string, index: number): string {
  const amount = Math.min(index * 0.16, 0.64);
  const channels = [1, 3, 5].map((start) => Number.parseInt(hexColor.slice(start, start + 2), 16));
  const lighter = channels.map((channel) => Math.round(channel + (255 - channel) * amount));
  return `#${lighter.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function classForLabel(label: string): InstrumentClass | undefined {
  return INSTRUMENT_CLASSES.find((instrumentClass) => CLASS_LABELS[instrumentClass] === label);
}

/**
 * Sorts rows that are already all on the page (no paging), for tables the API doesn't sort. Missing values go
 * last whichever way it sorts, the same as the API's NULLS LAST.
 */
export function sortRows<T>(
  rows: T[],
  value: (row: T) => string | number | null | undefined,
  direction: SortDirection,
): T[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    if (left == null || right == null) {
      return left == null ? (right == null ? 0 : 1) : -1;
    }
    if (typeof left === 'string' || typeof right === 'string') {
      return String(left).localeCompare(String(right)) * factor;
    }
    return (left - right) * factor;
  });
}

export function sortIndicator(active: boolean, direction: SortDirection): string {
  if (!active) {
    return '';
  }
  return direction === 'asc' ? ' ▲' : ' ▼';
}

// Missing values (not enough history, no price yet) show as a dash, never as 0.
const MISSING = '—';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});
const quantity = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 });

export function formatUsd(value: number | null | undefined): string {
  return value == null ? MISSING : usd.format(value);
}

// Returns, volatility and drawdown arrive as fractions: 0.0512 → "+5.12%".
export function formatPercent(value: number | null | undefined): string {
  return value == null ? MISSING : percent.format(value);
}

const share = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });

// A part of a whole (0.723 → "72.3%"): no sign, unlike a return.
export function formatShare(value: number | null | undefined): string {
  return value == null ? MISSING : share.format(value);
}

export function formatQuantity(value: number | null | undefined): string {
  return value == null ? MISSING : quantity.format(value);
}

// CSS class for colouring gains and losses.
export function signClass(value: number | null | undefined): string {
  if (value == null || value === 0) {
    return '';
  }
  return value > 0 ? 'positive' : 'negative';
}

// Ids are UUIDs; the first block is enough to tell rows apart on screen.
export function shortId(id: string): string {
  return id.split('-')[0];
}

export type RangeKey = '1M' | '3M' | 'YTD' | '1Y' | '5Y';

export const RANGE_OPTIONS: RangeKey[] = ['1M', '3M', 'YTD', '1Y', '5Y'];

// The API allows at most 5 years per request, so the longest option is 5Y rather than "All".
export function rangeFor(key: RangeKey, today = new Date()): DateRange {
  const to = toIsoDate(today);
  const from = new Date(today);

  switch (key) {
    case '1M':
      from.setMonth(from.getMonth() - 1);
      break;
    case '3M':
      from.setMonth(from.getMonth() - 3);
      break;
    case 'YTD':
      from.setMonth(0, 1);
      break;
    case '1Y':
      from.setFullYear(from.getFullYear() - 1);
      break;
    case '5Y':
      from.setFullYear(from.getFullYear() - MAX_SERIES_YEARS);
      break;
  }

  return { from: toIsoDate(from), to };
}

function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The series' cumulative returns count from the instrument's or portfolio's very first day. Rebasing makes
 * the chart start at 0% on the first day of the selected range: (1 + c_t) / (1 + c_start) - 1.
 */
export function rebaseCumulative(
  points: { date: string; value: number | null }[],
): LineChartPoint[] {
  const start = points.find((point) => point.value != null)?.value;
  if (start == null) {
    return [];
  }

  return points
    .filter((point) => point.value != null)
    .map((point) => ({ label: point.date, value: (1 + point.value!) / (1 + start) - 1 }));
}
