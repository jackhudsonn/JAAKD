// Domain interfaces — expand as the backend API is defined

export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  executedAt: string;
}

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
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
