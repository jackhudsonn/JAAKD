import { OrderKind, OrderType } from '@core/models';

export interface OrderPreviewInput {
  type: OrderType;
  kind: OrderKind;
  quantity: number | null;
  limitPrice: number | null;
  currentPrice: number;
  accountCash: number;
}

export interface OrderPreview {
  label: 'Estimated cost' | 'Estimated proceeds';
  total: number;
  cashAfter: number | null;
}

/**
 * Estimated total shown before submit. Returns null when the quantity or the
 * price is not usable yet, so the form shows nothing instead of a wrong number.
 */
export function toOrderPreview(input: OrderPreviewInput): OrderPreview | null {
  const { type, kind, quantity, limitPrice, currentPrice, accountCash } = input;
  const price = kind === 'limit' ? limitPrice : currentPrice;

  if (quantity === null || !Number.isInteger(quantity) || quantity <= 0) {
    return null;
  }

  if (price === null || !(price > 0)) {
    return null;
  }

  const total = quantity * price;

  if (type === 'buy') {
    return { label: 'Estimated cost', total, cashAfter: accountCash - total };
  }

  return { label: 'Estimated proceeds', total, cashAfter: null };
}
