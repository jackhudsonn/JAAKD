import { InjectionToken, Signal, WritableSignal } from '@angular/core';
import { Holding, Order } from '@core/models';
import type { TradePlaceOrderRequest } from './trade-order-engine.service';

export interface TradeWatchlist {
  id: string;
  name: string;
  symbols: string[];
}

export interface TradeStatePort {
  readonly cashBalances?: WritableSignal<Record<string, number>>;
  readonly holdings: WritableSignal<Holding[]>;
  readonly orders: WritableSignal<Order[]>;
  readonly watchlists: WritableSignal<TradeWatchlist[]>;
  readonly maxWatchlistHoldings: number | null;
  readonly backendDataMode?: boolean;
  readonly loadState?: Signal<'loading' | 'ready' | 'error'>;
  load?(): Promise<void>;
  submitOrder?(request: TradePlaceOrderRequest): Promise<void>;
  cancelOrder?(orderId: string): Promise<void>;
  setWatchlistMembership?(symbol: string, watchlistId: string, included: boolean): Promise<void>;
  createWatchlist?(watchlistName: string): Promise<void>;
  renameWatchlist?(watchlistId: string, watchlistName: string): Promise<void>;
  deleteWatchlist?(watchlistId: string): Promise<void>;
}

export const TRADE_WATCHLIST_CONSTRAINTS = {
  minWatchlists: 0,
  maxWatchlists: 15,
  minHoldingsPerWatchlist: 0,
  maxHoldingsPerWatchlist: null,
} as const;

export const TRADE_STATE_PORT = new InjectionToken<TradeStatePort>('TRADE_STATE_PORT', {
  providedIn: 'root',
  factory: () => {
    throw new Error(
      'TRADE_STATE_PORT is not provided. Register a TradeStatePort implementation in the component providers.',
    );
  },
});
