import { describe, expect, it } from 'vitest';
import { WidgetId } from '../components/widget-selector/widget-selector.component';
import { sanitizeDashboardWidgetIds } from './dashboard-widget-preferences.util';

const ALLOWED: WidgetId[] = [
  'performance-graph',
  'watchlist',
  'portfolio-value',
  'allocation-by-asset',
  'open-orders',
  'top-movers',
];

const DEFAULTS: WidgetId[] = [
  'performance-graph',
  'watchlist',
  'portfolio-value',
  'allocation-by-asset',
];

describe('sanitizeDashboardWidgetIds', () => {
  it('deduplicates and drops invalid string IDs', () => {
    const result = sanitizeDashboardWidgetIds(
      ['watchlist', 'watchlist', 'bad-id', 'portfolio-value'],
      ALLOWED,
      DEFAULTS,
    );

    expect(result).toEqual(['watchlist', 'portfolio-value']);
  });

  it('heals one-based numeric corruption arrays', () => {
    const result = sanitizeDashboardWidgetIds([1, 3, 3, 5, 2], ALLOWED, DEFAULTS);

    expect(result).toEqual(['performance-graph', 'portfolio-value', 'open-orders', 'watchlist']);
  });

  it('falls back to defaults when nothing valid remains', () => {
    const result = sanitizeDashboardWidgetIds([{}, null, ''], ALLOWED, DEFAULTS);

    expect(result).toEqual(DEFAULTS);
  });

  it('pads to minimum widget count', () => {
    const result = sanitizeDashboardWidgetIds(['watchlist'], ALLOWED, DEFAULTS, 2);

    expect(result).toEqual(['watchlist', 'performance-graph']);
  });
});
