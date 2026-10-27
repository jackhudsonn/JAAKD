import { Injectable, inject } from '@angular/core';
import { TRADE_STATE_PORT } from './trade-state.port';

export interface TradeSetWatchlistMembershipRequest {
  symbol: string;
  watchlistId: string;
  included: boolean;
}

export interface TradeWatchlistOption {
  id: string;
  name: string;
  symbolCount: number;
  containsSymbol: boolean;
  canAdd: boolean;
  disabledReason: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class TradeWatchlistService {
  private readonly state = inject(TRADE_STATE_PORT);

  private readonly watchlistsState = this.state.watchlists;

  readonly maxWatchlistHoldings = this.state.maxWatchlistHoldings;

  getWatchlistOptionsForSymbol(symbol: string | null): TradeWatchlistOption[] {
    if (!symbol) {
      return [];
    }

    return this.watchlistsState().map((watchlist) => {
      const containsSymbol = watchlist.symbols.includes(symbol);
      const isFull =
        this.maxWatchlistHoldings !== null && watchlist.symbols.length >= this.maxWatchlistHoldings;

      return {
        id: watchlist.id,
        name: watchlist.name,
        symbolCount: watchlist.symbols.length,
        containsSymbol,
        canAdd: !containsSymbol && !isFull,
        disabledReason: containsSymbol
          ? 'Already in this watchlist.'
          : isFull
            ? `Watchlist full (${this.maxWatchlistHoldings}/${this.maxWatchlistHoldings}).`
            : null,
      };
    });
  }

  async setWatchlistMembership(request: TradeSetWatchlistMembershipRequest) {
    if (!this.state.setWatchlistMembership) {
      throw new Error('Watchlist updates are unavailable.');
    }

    await this.state.setWatchlistMembership(request.symbol, request.watchlistId, request.included);
  }
}
