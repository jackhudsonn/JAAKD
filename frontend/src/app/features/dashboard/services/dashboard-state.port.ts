import { InjectionToken, Signal, WritableSignal } from '@angular/core';
import { Holding, InstrumentType, Order, Transaction } from '@core/models';
import { LiveQuote } from './dashboard-backend.mappers';
import {
  DASHBOARD_RETURNS_BASE,
  DASHBOARD_WATCHLIST_CONSTRAINTS,
  DashboardOpenOrder,
  DashboardReturns,
  DashboardWatchlistConstraints,
  SharedWatchlist,
} from './dashboard-state.types';

export interface DashboardWatchlistInstrumentOption {
  instrumentId: string;
  symbol: string;
  name: string;
  instrumentType: InstrumentType;
}

export interface DashboardStatePort {
  readonly cashBalances?: WritableSignal<Record<string, number>>;
  readonly holdings: WritableSignal<Holding[]>;
  readonly orders: WritableSignal<Order[]>;
  readonly transactions: WritableSignal<Transaction[]>;
  readonly watchlists: WritableSignal<SharedWatchlist[]>;
  readonly activeWatchlistId: WritableSignal<string>;
  readonly dashboardOpenOrders: WritableSignal<DashboardOpenOrder[]>;
  readonly returns: Readonly<DashboardReturns>;
  readonly watchlistConstraints: Readonly<DashboardWatchlistConstraints>;
  readonly backendDataMode?: boolean;
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
    throw new Error(
      'DASHBOARD_STATE_PORT is not provided. Register a DashboardStatePort implementation in the component providers.',
    );
  },
});

export { DASHBOARD_RETURNS_BASE, DASHBOARD_WATCHLIST_CONSTRAINTS } from './dashboard-state.types';
