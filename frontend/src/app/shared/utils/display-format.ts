import type { CashCurrency } from '@core/models/api.models';

export function toDisplaySymbol(symbol: string): string {
  return /^X:([^-]+)-/i.exec(symbol)?.[1] ?? symbol.replace(/\.NS$/i, '');
}

export function formatCurrency(value: number | string, currency: CashCurrency): string {
  if (typeof value === 'string' && value.trim() === '') {
    throw new TypeError('Currency value must be a non-empty numeric string.');
  }

  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) {
    throw new TypeError('Currency value must be a finite number.');
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}
