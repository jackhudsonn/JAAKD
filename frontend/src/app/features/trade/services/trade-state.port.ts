import { InjectionToken, Signal, WritableSignal } from '@angular/core';
import { Holding, Order } from '@core/models';
import { MOCK_STATE } from '@core/mocks/state.mock';
import { WATCHLIST_CONSTRAINTS } from '@core/mocks/watchlist.mock';
import type { TradePlaceOrderRequest } from './trade-order-engine.service';

export interface TradeWatchlist {
  id: string;
  name: string;
  symbols: string[];
}

export interface TradeStatePort {
  readonly accountCash: WritableSignal<number>;
  readonly holdings: WritableSignal<Holding[]>;
  readonly orders: WritableSignal<Order[]>;
  readonly watchlists: WritableSignal<TradeWatchlist[]>;
  readonly maxWatchlistHoldings: number;
  readonly backendDataMode?: boolean;
  readonly loadState?: Signal<'loading' | 'ready' | 'error'>;
  load?(): Promise<void>;
  submitOrder?(request: TradePlaceOrderRequest): Promise<void>;
  cancelOrder?(orderId: string): Promise<void>;
  setWatchlistMembership?(symbol: string, included: boolean): Promise<void>;
}

export const TRADE_STATE_PORT = new InjectionToken<TradeStatePort>('TRADE_STATE_PORT', {
  providedIn: 'root',
  factory: () => ({
    accountCash: MOCK_STATE.accountCash,
    holdings: MOCK_STATE.holdings,
    orders: MOCK_STATE.orders,
    watchlists: MOCK_STATE.watchlists,
    maxWatchlistHoldings: WATCHLIST_CONSTRAINTS.maxHoldingsPerWatchlist,
  }),
});
