import { OrderKind, OrderType } from '@core/models';

// Order quantities are stored as NUMERIC(19,6) on the backend.
export const MAX_QUANTITY_DECIMALS = 6;
const QUANTITY_SCALE = 10 ** MAX_QUANTITY_DECIMALS;

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
  total: number | null;
  cashAfter: number | null;
}

export function isValidQuantity(quantity: number | null): quantity is number {
  if (quantity === null || !Number.isFinite(quantity) || quantity <= 0) {
    return false;
  }

  return Number(quantity.toFixed(MAX_QUANTITY_DECIMALS)) === quantity;
}

/**
 * Rounds down to the quantity precision. toFixed(3) first absorbs float noise
 * such as 0.29 * 1e6 = 289999.99999999994 before flooring.
 */
export function floorToQuantityDecimals(value: number): number {
  return Math.floor(Number((value * QUANTITY_SCALE).toFixed(3))) / QUANTITY_SCALE;
}

/**
 * Estimated total shown before submit. Values are null when the quantity or the
 * price is not usable yet, so the form shows "-" instead of a wrong number.
 */
export function toOrderPreview(input: OrderPreviewInput): OrderPreview {
  const { type, kind, quantity, limitPrice, currentPrice, accountCash } = input;
  const price = kind === 'limit' ? limitPrice : currentPrice;
  const label = type === 'buy' ? 'Estimated cost' : 'Estimated proceeds';

  if (!isValidQuantity(quantity) || price === null || !(price > 0)) {
    return { label, total: null, cashAfter: null };
  }

  const total = quantity * price;
  const cashAfter = type === 'buy' ? accountCash - total : accountCash + total;

  return { label, total, cashAfter };
}
