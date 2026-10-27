import type { OrderStatus } from '@core/constants/order-status.constants';
import type { CashCurrency, InstrumentClass } from './api.models';
// Domain interfaces — expand as the backend API is defined

export type InstrumentType = 'crypto' | 'equity' | 'etf';
export type HoldingInstrumentClass = Extract<InstrumentClass, 'EQUITY' | 'ETF' | 'CRYPTO'>;
export type OrderKind = 'market' | 'limit';
export type OrderType = 'buy' | 'sell';
export type { OrderStatus };

export interface SharedWatchlist {
  id: string;
  name: string;
  symbols: string[];
}

export interface Holding {
  symbol: string;
  currency?: CashCurrency;
  instrumentType: InstrumentType;
  instrumentClass?: HoldingInstrumentClass;
  quantity: number;
  indicativePrice?: number | null;
  priceStatus?: 'available' | 'price unavailable';
}

export interface Order {
  id: string;
  symbol: string;
  currency?: CashCurrency;
  instrumentType: InstrumentType;
  kind: OrderKind;
  type: OrderType;
  quantity: number;
  /** Only present on limit orders. */
  limitPrice?: number;
  fillPrice?: number;
  status: OrderStatus;
  createdAt: string;
  filledAt?: string;
  cancelledAt?: string;
  /** Why the backend rejected or failed the order, in plain . */
  statusReason?: string;
}

export interface MarketQuote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  change: number;
  changePct: number;
}

export type TransactionType = 'deposit' | 'withdrawal' | 'exchange';
export type PaymentMethod = 'bank_transfer';
export type TransactionStatus = OrderStatus;

export interface Transaction {
  id: string;
  type: TransactionType;
  /** Optional display label for exchange rows (example: USD → INR). */
  typeLabel?: string;
  amount: number;
  currency?: CashCurrency;
  method: PaymentMethod;
  status: TransactionStatus;
  createdAt: string;
}

export interface Deposit {
  amount: number;
  method: PaymentMethod;
  currency: CashCurrency;
}

export interface Withdrawal {
  amount: number;
  method: PaymentMethod;
  currency: CashCurrency;
}
