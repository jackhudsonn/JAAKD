import { InjectionToken, WritableSignal } from '@angular/core';
import {
  MOCK_RETURNS,
  MOCK_STATE,
  MockOrder,
  SharedWatchlist,
  WATCHLIST_CONSTRAINTS,
} from '@core/mocks/mock-data';
import { Holding, Order, Transaction } from '@core/models';

export interface DashboardStatePort {
  readonly accountCash: WritableSignal<number>;
  readonly holdings: WritableSignal<Holding[]>;
  readonly orders: WritableSignal<Order[]>;
  readonly transactions: WritableSignal<Transaction[]>;
  readonly watchlists: WritableSignal<SharedWatchlist[]>;
  readonly activeWatchlistId: WritableSignal<string>;
  readonly dashboardOpenOrders: WritableSignal<MockOrder[]>;
  readonly returns: Readonly<typeof MOCK_RETURNS>;
  readonly watchlistConstraints: typeof WATCHLIST_CONSTRAINTS;
}

export const DASHBOARD_STATE_PORT = new InjectionToken<DashboardStatePort>(
  'DASHBOARD_STATE_PORT',
  {
    providedIn: 'root',
    factory: () => ({
      accountCash: MOCK_STATE.accountCash,
      holdings: MOCK_STATE.holdings,
      orders: MOCK_STATE.orders,
      transactions: MOCK_STATE.transactions,
      watchlists: MOCK_STATE.watchlists,
      activeWatchlistId: MOCK_STATE.activeWatchlistId,
      dashboardOpenOrders: MOCK_STATE.dashboardOpenOrders,
      returns: MOCK_RETURNS,
      watchlistConstraints: WATCHLIST_CONSTRAINTS,
    }),
  },
);
