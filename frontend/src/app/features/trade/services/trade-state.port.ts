import { InjectionToken, Signal, WritableSignal } from '@angular/core';
import { Holding, Order } from '@core/models';
import { WATCHLIST_CONSTRAINTS } from '@core/constants/watchlist.constants';
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
  readonly maxWatchlistHoldings: number | null;
  readonly loadState?: Signal<'loading' | 'ready' | 'error'>;
  readonly cashBalances?: Signal<Record<string, number>>;
  load?(): Promise<void>;
  submitOrder?(request: TradePlaceOrderRequest): Promise<void>;
  cancelOrder?(orderId: string): Promise<void>;
  setWatchlistMembership?(symbol: string, watchlistId: string, included: boolean): Promise<void>;
  createWatchlist?(watchlistName: string): Promise<void>;
  renameWatchlist?(watchlistId: string, watchlistName: string): Promise<void>;
  deleteWatchlist?(watchlistId: string): Promise<void>;
}

export const TRADE_STATE_PORT = new InjectionToken<TradeStatePort>('TRADE_STATE_PORT', {
  providedIn: 'root',
  factory: () => {
    throw new Error('TRADE_STATE_PORT requires a backend provider.');
  },
});
