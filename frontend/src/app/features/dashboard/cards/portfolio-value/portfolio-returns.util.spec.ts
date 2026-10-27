import { describe, expect, it } from 'vitest';
import { Holding, Transaction } from '@core/models';
import { USD_RATES_BY_USD } from '@core/utils/cash-fx';
import {
  formatSignedPct,
  formatSignedUsd,
  toAllTimeReturn,
  toCashInUsd,
  toHoldingsValueInUsd,
  toNetDepositsInUsd,
  toReturnPct,
  toTodayReturn,
} from './portfolio-returns.util';

const holding = (
  quantity: number,
  indicativePrice: number | null,
  currency: Holding['currency'] = 'USD',
): Holding => ({
  symbol: 'AAPL',
  quantity,
  indicativePrice,
  currency,
  instrumentType: 'equity',
});

const tx = (
  type: Transaction['type'],
  amount: number,
  status = 'EXECUTED',
  currency: Transaction['currency'] = 'USD',
): Transaction => ({
  id: `${type}-${amount}-${status}`,
  type,
  amount,
  currency,
  method: 'bank_transfer',
  status: status as Transaction['status'],
  createdAt: '2026-10-01T00:00:00Z',
});

const rates = { USD: 1, EUR: 0.8 };

describe('portfolio returns', () => {
  it('counts only executed deposits and withdrawals, not exchanges', () => {
    const transactions = [
      tx('deposit', 1000),
      tx('withdrawal', 300),
      tx('deposit', 500, 'REJECTED'),
      tx('exchange', 200),
    ];
    expect(toNetDepositsInUsd(transactions, rates)).toBe(700);
  });

  it('works out the all-time return, or null when a price is missing', () => {
    expect(
      toAllTimeReturn(500, [holding(5, 120)], [tx('deposit', 1000)], USD_RATES_BY_USD),
    ).toBe(100);
    expect(
      toAllTimeReturn(500, [holding(5, null)], [tx('deposit', 1000)], USD_RATES_BY_USD),
    ).toBeNull();
  });

  it("works today's return back from the percent change", () => {
    const quotes = new Map([['AAPL', { price: 110, changePct: 10, currency: 'USD' as const }]]);
    expect(toTodayReturn([holding(2, 110)], quotes, USD_RATES_BY_USD)).toBeCloseTo(20);
  });

  it('converts cash and holdings from their own currency into USD', () => {
    expect(toCashInUsd(0, { EUR: 100 }, rates)).toBeCloseTo(125);
    expect(toHoldingsValueInUsd([holding(2, 50, 'EUR')], rates)).toBeCloseTo(125);
  });

  it('returns null rather than guessing when a rate is missing', () => {
    expect(toCashInUsd(0, { INR: 100 }, rates)).toBeNull();
    expect(toHoldingsValueInUsd([holding(2, 50, 'INR')], rates)).toBeNull();
    expect(toNetDepositsInUsd([tx('deposit', 100, 'EXECUTED', 'INR')], rates)).toBeNull();
    expect(
      toAllTimeReturn(500, [holding(2, 50, 'INR')], [tx('deposit', 1000)], rates),
    ).toBeNull();
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
