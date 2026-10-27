import { describe, expect, it } from 'vitest';
import { Holding, Transaction } from '@core/models';
import { LiveQuote } from '@features/dashboard/services/dashboard-backend.mappers';
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
  symbol: string,
  quantity: number,
  indicativePrice: number | null,
  currency: Holding['currency'] = 'USD',
): Holding => ({ symbol, quantity, indicativePrice, currency, instrumentType: 'equity' });

const transaction = (
  type: Transaction['type'],
  amount: number,
  status: Transaction['status'] = 'EXECUTED',
  currency: Transaction['currency'] = 'USD',
): Transaction => ({
  id: `${type}-${amount}`,
  type,
  amount,
  currency,
  method: 'bank_transfer',
  status,
  createdAt: '2026-10-01T00:00:00Z',
});

const quotes = (entries: [string, number, number | null][]): Map<string, LiveQuote> =>
  new Map(
    entries.map(([symbol, price, changePct]) => [symbol, { price, changePct, currency: 'USD' }]),
  );

describe('toCashInUsd', () => {
  it('falls back to account cash when there are no balances', () => {
    expect(toCashInUsd(250)).toBe(250);
    expect(toCashInUsd(250, {})).toBe(250);
  });

  it('converts every cash currency to USD', () => {
    expect(toCashInUsd(100, { USD: 100, EUR: 92 })).toBeCloseTo(200);
  });

  it('ignores unknown currency codes', () => {
    expect(toCashInUsd(0, { USD: 50, XYZ: 1000 })).toBe(50);
  });
});

describe('toNetDepositsInUsd', () => {
  it('subtracts withdrawals from deposits', () => {
    expect(toNetDepositsInUsd([transaction('deposit', 1000), transaction('withdrawal', 300)])).toBe(
      700,
    );
  });

  it('counts only executed transactions', () => {
    expect(
      toNetDepositsInUsd([
        transaction('deposit', 1000),
        transaction('deposit', 500, 'REJECTED'),
        transaction('deposit', 400, 'PENDING'),
        transaction('withdrawal', 200, 'FAILED'),
      ]),
    ).toBe(1000);
  });

  it('ignores exchanges', () => {
    expect(toNetDepositsInUsd([transaction('deposit', 1000), transaction('exchange', 500)])).toBe(
      1000,
    );
  });

  it('converts non-USD amounts', () => {
    expect(toNetDepositsInUsd([transaction('deposit', 79, 'EXECUTED', 'GBP')])).toBeCloseTo(100);
  });
});

describe('toAllTimeReturn', () => {
  it('is cash plus holdings value minus net deposits', () => {
    expect(toAllTimeReturn(500, [holding('AAPL', 5, 120)], [transaction('deposit', 1000)])).toBe(
      100,
    );
  });

  it('is negative after a loss', () => {
    expect(toAllTimeReturn(500, [holding('AAPL', 5, 80)], [transaction('deposit', 1000)])).toBe(
      -100,
    );
  });

  it('converts non-USD holdings', () => {
    expect(toAllTimeReturn(0, [holding('RELIANCE', 1, 8320, 'INR')], [])).toBeCloseTo(100);
  });

  it('returns null when a holding has no price', () => {
    expect(toAllTimeReturn(500, [holding('AAPL', 5, null)], [])).toBeNull();
  });
});

describe('toTodayReturn', () => {
  it('works the gain back from the percent change', () => {
    expect(toTodayReturn([holding('AAPL', 2, 110)], quotes([['AAPL', 110, 10]]))).toBeCloseTo(20);
  });

  it('works the loss back from the percent change', () => {
    expect(toTodayReturn([holding('MSFT', 1, 90)], quotes([['MSFT', 90, -10]]))).toBeCloseTo(-10);
  });

  it('looks quotes up by upper-case symbol', () => {
    expect(toTodayReturn([holding('aapl', 1, 110)], quotes([['AAPL', 110, 10]]))).toBeCloseTo(10);
  });

  it('skips holdings with no quote or no change', () => {
    expect(
      toTodayReturn(
        [holding('AAPL', 1, 110), holding('TSLA', 1, 100), holding('NVDA', 1, 100)],
        quotes([
          ['AAPL', 110, 10],
          ['TSLA', 100, null],
        ]),
      ),
    ).toBeCloseTo(10);
  });
});

describe('formatSignedUsd', () => {
  it('adds a plus sign to gains and a minus sign to losses', () => {
    expect(formatSignedUsd(1234.5)).toBe('+$1,234.50');
    expect(formatSignedUsd(-12.346)).toBe('-$12.35');
  });

  it('shows no sign for zero or less than a cent', () => {
    expect(formatSignedUsd(0)).toBe('$0.00');
    expect(formatSignedUsd(-0.001)).toBe('$0.00');
  });
});

describe('toHoldingsValueInUsd', () => {
  it('sums holdings in USD', () => {
    expect(
      toHoldingsValueInUsd([holding('AAPL', 2, 100), holding('RELIANCE', 1, 8320, 'INR')]),
    ).toBeCloseTo(300);
  });

  it('returns null when a holding has no price', () => {
    expect(toHoldingsValueInUsd([holding('AAPL', 2, 100), holding('TSLA', 1, null)])).toBeNull();
  });
});

describe('toReturnPct', () => {
  it('divides the return by the base', () => {
    expect(toReturnPct(20592.08, 94982.1)).toBeCloseTo(21.68, 2);
    expect(toReturnPct(-50, 1000)).toBe(-5);
  });

  it('returns null when the base is zero, negative or unknown', () => {
    expect(toReturnPct(100, 0)).toBeNull();
    expect(toReturnPct(100, -500)).toBeNull();
    expect(toReturnPct(100, null)).toBeNull();
  });

  it("gives today's percent against yesterday's value", () => {
    // Holdings now worth 220 after a 20 gain today, so yesterday they were worth 200.
    expect(toReturnPct(20, 220 - 20)).toBe(10);
  });
});

describe('formatSignedPct', () => {
  it('signs gains and losses with 2 decimals', () => {
    expect(formatSignedPct(21.678)).toBe('+21.68%');
    expect(formatSignedPct(-3.2)).toBe('-3.20%');
  });

  it('shows no sign when flat', () => {
    expect(formatSignedPct(0)).toBe('0.00%');
    expect(formatSignedPct(-0.001)).toBe('0.00%');
  });
});
