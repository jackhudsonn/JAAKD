import { InjectionToken, Signal, WritableSignal } from '@angular/core';
import { MOCK_RETURNS, MOCK_STATE, MockOrder } from '@core/mocks/state.mock';
import { SharedWatchlist, WATCHLIST_CONSTRAINTS } from '@core/mocks/watchlist.mock';
import { Holding, InstrumentType, Order, Transaction } from '@core/models';

export interface DashboardWatchlistInstrumentOption {
  instrumentId: string;
  symbol: string;
  name: string;
  instrumentType: InstrumentType;
}

export interface DashboardStatePort {
  readonly accountCash: WritableSignal<number>;
  readonly holdings: WritableSignal<Holding[]>;
  readonly orders: WritableSignal<Order[]>;
  readonly transactions: WritableSignal<Transaction[]>;
  // CONTRACT_DIFF: UI state is modeled as named watchlists with variable symbol counts.
  // Backend may need a watchlist aggregate endpoint/model beyond item-level rows.
  readonly watchlists: WritableSignal<SharedWatchlist[]>;
  readonly activeWatchlistId: WritableSignal<string>;
  readonly dashboardOpenOrders: WritableSignal<MockOrder[]>;
  readonly returns: Readonly<typeof MOCK_RETURNS>;
  readonly watchlistConstraints: typeof WATCHLIST_CONSTRAINTS;
  readonly backendDataMode?: boolean;
  readonly backendWatchlistInstrumentOptions?: Signal<DashboardWatchlistInstrumentOption[]>;
  load?(): Promise<void>;
  setWatchlistMembership?(symbol: string, included: boolean): Promise<void>;
}

export const DASHBOARD_STATE_PORT = new InjectionToken<DashboardStatePort>('DASHBOARD_STATE_PORT', {
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
    backendDataMode: false,
  }),
});
