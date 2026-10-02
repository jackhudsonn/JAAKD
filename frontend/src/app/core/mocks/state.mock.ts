import { signal } from '@angular/core';
import { Holding, Order, PaymentMethod, Transaction, TransactionStatus, TransactionType } from '@core/models';
import { DEFAULT_ACTIVE_WATCHLIST_ID, MOCK_WATCHLISTS, SharedWatchlist } from './watchlist.mock';

export interface MockOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  status: 'pending' | 'partially_filled';
}

export const MOCK_ACCOUNT_CASH = 0;

export const MOCK_HOLDINGS: Holding[] = [];

export const TRADE_MOCK_OPEN_ORDERS: Order[] = [];

export const TRADE_MOCK_ORDER_HISTORY: Order[] = [];

export const MOCK_TRANSACTIONS: Transaction[] = [];

export const DASHBOARD_MOCK_OPEN_ORDERS: MockOrder[] = [];

export const MOCK_RETURNS = {
  allTime: 0,
  daily: 0,
};

export const MOCK_STATE = {
  accountCash: signal<number>(MOCK_ACCOUNT_CASH),
  holdings: signal<Holding[]>([...MOCK_HOLDINGS]),
  orders: signal<Order[]>([...TRADE_MOCK_OPEN_ORDERS, ...TRADE_MOCK_ORDER_HISTORY]),
  watchlists: signal<SharedWatchlist[]>([...MOCK_WATCHLISTS]),
  activeWatchlistId: signal<string>(DEFAULT_ACTIVE_WATCHLIST_ID),
  transactions: signal<Transaction[]>([...MOCK_TRANSACTIONS]),
  dashboardOpenOrders: signal<MockOrder[]>([...DASHBOARD_MOCK_OPEN_ORDERS]),
};

export function addMockTransaction(type: TransactionType, amount: number, method: PaymentMethod) {
  const status: TransactionStatus = 'pending';

  const transaction: Transaction = {
    id: `txn-${Date.now()}`,
    type,
    amount,
    method,
    status,
    createdAt: new Date().toISOString(),
  };

  MOCK_STATE.transactions.update((current) => [transaction, ...current]);

  if (type === 'deposit' || type === 'withdrawal') {
    MOCK_STATE.accountCash.update((cash) => (type === 'deposit' ? cash + amount : cash - amount));
  }
}

export function addMockExchangeTransaction(
  amount: number,
  pairLabel: string,
  method: PaymentMethod = 'bank_transfer',
) {
  const status: TransactionStatus = 'pending';

  const transaction: Transaction = {
    id: `txn-${Date.now()}`,
    type: 'exchange',
    typeLabel: pairLabel,
    amount,
    method,
    status,
    createdAt: new Date().toISOString(),
  };

  MOCK_STATE.transactions.update((current) => [transaction, ...current]);
}
