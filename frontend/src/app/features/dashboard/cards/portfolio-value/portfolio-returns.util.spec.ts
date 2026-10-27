import { describe, expect, it } from 'vitest';
import { Holding, Transaction } from '@core/models';
import {
  formatSignedPct,
  formatSignedUsd,
  toAllTimeReturn,
  toNetDepositsInUsd,
  toReturnPct,
  toTodayReturn,
} from './portfolio-returns.util';

const holding = (quantity: number, indicativePrice: number | null): Holding => ({
  symbol: 'AAPL',
  quantity,
  indicativePrice,
  currency: 'USD',
  instrumentType: 'equity',
});

const tx = (type: Transaction['type'], amount: number, status = 'EXECUTED'): Transaction => ({
  id: `${type}-${amount}-${status}`,
  type,
  amount,
  currency: 'USD',
  method: 'bank_transfer',
  status: status as Transaction['status'],
  createdAt: '2026-10-01T00:00:00Z',
});

describe('portfolio returns', () => {
  it('counts only executed deposits and withdrawals, not exchanges', () => {
    const transactions = [
      tx('deposit', 1000),
      tx('withdrawal', 300),
      tx('deposit', 500, 'REJECTED'),
      tx('exchange', 200),
    ];
    expect(toNetDepositsInUsd(transactions)).toBe(700);
  });

  it('works out the all-time return, or null when a price is missing', () => {
    expect(toAllTimeReturn(500, [holding(5, 120)], [tx('deposit', 1000)])).toBe(100);
    expect(toAllTimeReturn(500, [holding(5, null)], [tx('deposit', 1000)])).toBeNull();
  });

  it("works today's return back from the percent change", () => {
    const quotes = new Map([['AAPL', { price: 110, changePct: 10, currency: 'USD' as const }]]);
    expect(toTodayReturn([holding(2, 110)], quotes)).toBeCloseTo(20);
  });

  it('has no percent without a positive base', () => {
    expect(toReturnPct(50, 1000)).toBe(5);
    expect(toReturnPct(50, 0)).toBeNull();
  });

  it('signs gains and losses, and leaves flat values unsigned', () => {
    expect(formatSignedUsd(1234.5)).toBe('+$1,234.50');
    expect(formatSignedUsd(-0.001)).toBe('$0.00');
    expect(formatSignedPct(-3.2)).toBe('-3.20%');
  });
});
