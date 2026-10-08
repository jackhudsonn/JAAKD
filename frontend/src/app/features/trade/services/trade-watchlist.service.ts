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
      const isFull = watchlist.symbols.length >= this.maxWatchlistHoldings;

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
    if (this.state.backendDataMode && this.state.setWatchlistMembership) {
      if (request.watchlistId !== 'watchlist') {
        return;
      }

      await this.state.setWatchlistMembership(request.symbol, request.included);
      return;
    }

    const target = this.watchlistsState().find((watchlist) => watchlist.id === request.watchlistId);
    if (!target) {
      return;
    }

    const alreadyIncluded = target.symbols.includes(request.symbol);
    if (request.included === alreadyIncluded) {
      return;
    }

    if (request.included && target.symbols.length >= this.maxWatchlistHoldings) {
      return;
    }

    this.watchlistsState.update((current) =>
      current.map((watchlist) =>
        watchlist.id === request.watchlistId
          ? {
              ...watchlist,
              symbols: request.included
                ? [...watchlist.symbols, request.symbol]
                : watchlist.symbols.filter((symbol) => symbol !== request.symbol),
            }
          : watchlist,
      ),
    );
  }
}
