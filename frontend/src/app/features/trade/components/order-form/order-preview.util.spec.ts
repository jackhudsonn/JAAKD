import { describe, expect, it } from 'vitest';
import {
  floorToQuantityDecimals,
  isValidQuantity,
  OrderPreviewInput,
  toOrderPreview,
} from './order-preview.util';

const base: OrderPreviewInput = {
  type: 'buy',
  quantity: 3,
  currentPrice: 10,
  accountCash: 100,
};

describe('toOrderPreview', () => {
  it('shows the estimated cost and cash after for a market buy', () => {
    expect(toOrderPreview(base)).toEqual({ label: 'Estimated cost', total: 30, cashAfter: 70 });
  });

  it('shows the estimated proceeds and cash plus proceeds for a sell', () => {
    expect(toOrderPreview({ ...base, type: 'sell' })).toEqual({
      label: 'Estimated proceeds',
      total: 30,
      cashAfter: 130,
    });
  });

  it('prices fractional quantities', () => {
    const preview = toOrderPreview({ ...base, quantity: 0.5 });

    expect(preview.total).toBe(5);
    expect(preview.cashAfter).toBe(95);
  });

  it('uses the current price to estimate an order', () => {
    expect(toOrderPreview({ ...base, currentPrice: 12.5 }).total).toBe(37.5);
  });

  it('allows cash after to go below zero so the shortfall is visible', () => {
    expect(toOrderPreview({ ...base, quantity: 20 }).cashAfter).toBe(-100);
  });

  it.each([null, 0, -1, 0.0000001, Number.NaN])(
    'returns empty values for quantity %s',
    (quantity) => {
      expect(toOrderPreview({ ...base, quantity })).toEqual({
        label: 'Estimated cost',
        total: null,
        cashAfter: null,
      });
    },
  );

  it('keeps the sell label when values are empty', () => {
    expect(toOrderPreview({ ...base, type: 'sell', quantity: null })).toEqual({
      label: 'Estimated proceeds',
      total: null,
      cashAfter: null,
    });
  });

  it.each([0, -5, Number.NaN])('returns empty values for current price %s', (currentPrice) => {
    expect(toOrderPreview({ ...base, currentPrice }).total).toBeNull();
  });
});

describe('isValidQuantity', () => {
  it.each([1, 0.5, 0.000001, 1.123456, 250])('accepts %s', (quantity) => {
    expect(isValidQuantity(quantity)).toBe(true);
  });

  it.each([null, 0, -1, 0.0000001, 1.1234567, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects %s',
    (quantity) => {
      expect(isValidQuantity(quantity)).toBe(false);
    },
  );
});

describe('floorToQuantityDecimals', () => {
  it('rounds down to 6 decimals', () => {
    expect(floorToQuantityDecimals(100 / 3)).toBe(33.333333);
    expect(floorToQuantityDecimals(2 / 3)).toBe(0.666666);
  });

  it('keeps values that already have 6 decimals or fewer', () => {
    expect(floorToQuantityDecimals(0.29)).toBe(0.29);
    expect(floorToQuantityDecimals(10)).toBe(10);
  });
});
