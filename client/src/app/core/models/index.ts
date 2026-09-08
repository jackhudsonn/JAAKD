// Domain interfaces — expand as the backend API is defined

export type InstrumentType = 'crypto' | 'stock' | 'bond';
export type OrderKind = 'market' | 'limit';
export type OrderType = 'buy' | 'sell';
export type OrderStatus = 'pending' | 'open' | 'filled' | 'cancelled';

export interface Holding {
  symbol: string;
  instrumentType: InstrumentType;
  quantity: number;
}

export interface Order {
  id: string;
  symbol: string;
  instrumentType: InstrumentType;
  kind: OrderKind;
  type: OrderType;
  quantity: number;
  /** Only present on limit orders. */
  limitPrice?: number;
  /** Set once the order fills (market: mock price at fill time; limit: the limit price). */
  fillPrice?: number;
  status: OrderStatus;
  createdAt: string;
  filledAt?: string;
  cancelledAt?: string;
}

export interface MarketQuote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  change: number;
  changePct: number;
}

export type TransactionType = 'deposit' | 'withdrawal';
export type PaymentMethod = 'bank_transfer' | 'card' | 'crypto_wallet';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  method: PaymentMethod;
  status: TransactionStatus;
  createdAt: string;
}

export interface Deposit {
  amount: number;
  method: PaymentMethod;
}

export interface Withdrawal {
  amount: number;
  method: PaymentMethod;
}
