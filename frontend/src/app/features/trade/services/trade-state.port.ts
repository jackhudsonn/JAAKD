import { InjectionToken, WritableSignal } from '@angular/core';
import { Holding, Order } from '@core/models';
import { MOCK_STATE } from '@core/mocks/state.mock';
import { WATCHLIST_CONSTRAINTS } from '@core/mocks/watchlist.mock';

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
