import { describe, expect, it } from 'vitest';
import { OrderPreviewInput, toOrderPreview } from './order-preview.util';

const base: OrderPreviewInput = {
  type: 'buy',
  kind: 'market',
  quantity: 3,
  limitPrice: null,
  currentPrice: 10,
  accountCash: 100,
};

describe('toOrderPreview', () => {
  it('shows the estimated cost and cash after for a market buy', () => {
    expect(toOrderPreview(base)).toEqual({ label: 'Estimated cost', total: 30, cashAfter: 70 });
  });

  it('shows the estimated proceeds without cash after for a sell', () => {
    expect(toOrderPreview({ ...base, type: 'sell' })).toEqual({
      label: 'Estimated proceeds',
      total: 30,
      cashAfter: null,
    });
  });

  it('uses the limit price for limit orders', () => {
    const preview = toOrderPreview({ ...base, kind: 'limit', limitPrice: 12.5 });

    expect(preview?.total).toBe(37.5);
    expect(preview?.cashAfter).toBe(62.5);
  });

  it('uses the current price for market orders even when a limit price is set', () => {
    expect(toOrderPreview({ ...base, limitPrice: 50 })?.total).toBe(30);
  });

  it('allows cash after to go below zero so the shortfall is visible', () => {
    expect(toOrderPreview({ ...base, quantity: 20 })?.cashAfter).toBe(-100);
  });

  it.each([null, 0, -1, 1.5, Number.NaN])('hides the preview for quantity %s', (quantity) => {
    expect(toOrderPreview({ ...base, quantity })).toBeNull();
  });

  it.each([0, -5, Number.NaN])('hides the preview for current price %s', (currentPrice) => {
    expect(toOrderPreview({ ...base, currentPrice })).toBeNull();
  });

  it.each([null, 0, -2])('hides the preview for limit price %s', (limitPrice) => {
    expect(toOrderPreview({ ...base, kind: 'limit', limitPrice })).toBeNull();
  });
});
