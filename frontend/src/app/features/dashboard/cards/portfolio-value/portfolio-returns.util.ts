import { ORDER_STATUS } from '@core/constants/order-status.constants';
import { CashCurrency, REPORTING_CURRENCY } from '@core/models/api.models';
import { Holding, Transaction } from '@core/models';
import { LiveQuote } from '@features/dashboard/services/dashboard-backend.mappers';
import { formatCurrency } from '@shared/utils/display-format';
import { roundChangePct } from '@shared/utils/format-percentage-change';
import { CashRatesByUsd, convertAmountBetweenCurrencies } from '@core/utils/cash-fx';

const isCashCurrency = (code: string): code is CashCurrency =>
  code === 'USD' || code === 'EUR' || code === 'GBP' || code === 'INR';

const toUsd = (
  amount: number,
  currency: CashCurrency | undefined,
  rates: CashRatesByUsd,
): number | null =>
  convertAmountBetweenCurrencies(amount, currency ?? REPORTING_CURRENCY, REPORTING_CURRENCY, rates);

// Every cash currency counts, so a deposit in EUR or an FX exchange does not look like a loss.
export function toCashInUsd(
  accountCash: number,
  cashBalances: Record<string, number> | undefined,
  rates: CashRatesByUsd,
): number | null {
  if (!cashBalances || Object.keys(cashBalances).length === 0) {
    return accountCash;
  }

  let total = 0;
  for (const [code, amount] of Object.entries(cashBalances)) {
    if (isCashCurrency(code)) {
      const converted = toUsd(amount, code, rates);
      if (converted === null) {
        return null;
      }
      total += converted;
    }
  }
  return total;
}

// Exchanges only move money between currencies, so they are not money paid in or out.
export function toNetDepositsInUsd(
  transactions: Transaction[],
  rates: CashRatesByUsd,
): number | null {
  let total = 0;
  for (const transaction of transactions) {
    if (transaction.status !== ORDER_STATUS.EXECUTED || transaction.type === 'exchange') {
      continue;
    }
    const amount = toUsd(transaction.amount, transaction.currency, rates);
    if (amount === null) {
      return null;
    }
    total += transaction.type === 'deposit' ? amount : -amount;
  }
  return total;
}

// Null when a holding has no price, so a missing price never shows as a loss.
export function toHoldingsValueInUsd(holdings: Holding[], rates: CashRatesByUsd): number | null {
  let holdingsValue = 0;
  for (const holding of holdings) {
    if (holding.indicativePrice == null) {
      return null;
    }
    const value = toUsd(holding.quantity * holding.indicativePrice, holding.currency, rates);
    if (value === null) {
      return null;
    }
    holdingsValue += value;
  }
  return holdingsValue;
}

export function toAllTimeReturn(
  cashInUsd: number | null,
  holdings: Holding[],
  transactions: Transaction[],
  rates: CashRatesByUsd,
): number | null {
  if (cashInUsd === null) {
    return null;
  }

  const holdingsValue = toHoldingsValueInUsd(holdings, rates);
  if (holdingsValue === null) {
    return null;
  }

  const netDeposits = toNetDepositsInUsd(transactions, rates);
  if (netDeposits === null) {
    return null;
  }

  return cashInUsd + holdingsValue - netDeposits;
}

// Null when there is nothing to measure against (no money in, or more taken out than paid in).
export function toReturnPct(amount: number, base: number | null): number | null {
  if (base === null || base <= 0) {
    return null;
  }
  return (amount / base) * 100;
}

// Quotes only carry a percent change, so today's gain is worked back from the previous close.
export function toTodayReturn(
  holdings: Holding[],
  liveQuotes: ReadonlyMap<string, LiveQuote>,
  rates: CashRatesByUsd,
): number | null {
  let total = 0;
  for (const holding of holdings) {
    const quote = liveQuotes.get(holding.symbol.toUpperCase());
    if (!quote || quote.changePct === null || quote.changePct <= -100) {
      continue;
    }
    const value = toUsd(holding.quantity * quote.price, quote.currency, rates);
    if (value === null) {
      return null;
    }
    total += (value * quote.changePct) / (100 + quote.changePct);
  }
  return total;
}

function signOf(rounded: number): string {
  if (rounded > 0) {
    return '+';
  }
  return rounded < 0 ? '-' : '';
}

export function formatSignedUsd(amount: number): string {
  const cents = Math.round(amount * 100) / 100;
  return signOf(cents) + formatCurrency(Math.abs(cents), REPORTING_CURRENCY);
}

export function formatSignedPct(pct: number): string {
  const rounded = roundChangePct(pct);
  return `${signOf(rounded)}${Math.abs(rounded).toFixed(2)}%`;
}
