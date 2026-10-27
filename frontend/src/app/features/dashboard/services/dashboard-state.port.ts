import { InjectionToken, Signal, WritableSignal } from '@angular/core';
import { CashCurrency } from '@core/models/api.models';
import { WATCHLIST_CONSTRAINTS } from '@core/constants/watchlist.constants';
import { Holding, InstrumentType, Order, SharedWatchlist, Transaction } from '@core/models';
import { LiveQuote } from './dashboard-backend.mappers';

export interface DashboardWatchlistInstrumentOption {
  instrumentId: string;
  symbol: string;
  name: string;
  currency: CashCurrency;
  instrumentType: InstrumentType;
}

export interface DashboardStatePort {
  readonly accountCash: WritableSignal<number>;
  readonly cashBalances?: WritableSignal<Record<string, number>>;
  readonly holdings: WritableSignal<Holding[]>;
  readonly orders: WritableSignal<Order[]>;
  readonly transactions: WritableSignal<Transaction[]>;
  readonly watchlists: WritableSignal<SharedWatchlist[]>;
  readonly activeWatchlistId: WritableSignal<string>;
  readonly watchlistConstraints: typeof WATCHLIST_CONSTRAINTS;
  readonly backendWatchlistInstrumentOptions?: Signal<DashboardWatchlistInstrumentOption[]>;
  readonly dashboardWidgets?: Signal<readonly string[] | null>;
  readonly liveQuotes?: Signal<ReadonlyMap<string, LiveQuote>>;
  load?(): Promise<void>;
  setWatchlistMembership?(symbol: string, watchlistId: string, included: boolean): Promise<void>;
  createWatchlist?(watchlistName: string): Promise<void>;
  renameWatchlist?(watchlistId: string, watchlistName: string): Promise<void>;
  deleteWatchlist?(watchlistId: string): Promise<void>;
  setDashboardWidgets?(dashboardWidgets: readonly string[]): Promise<void>;
}

export const DASHBOARD_STATE_PORT = new InjectionToken<DashboardStatePort>('DASHBOARD_STATE_PORT', {
  providedIn: 'root',
  factory: () => {
    throw new Error('DASHBOARD_STATE_PORT requires a backend provider.');
  },
});
