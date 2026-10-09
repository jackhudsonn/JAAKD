import { Injectable, signal } from '@angular/core';
import { MOCK_RETURNS, MockOrder } from '@core/mocks/state.mock';
import { SharedWatchlist, WATCHLIST_CONSTRAINTS } from '@core/mocks/watchlist.mock';
import { Holding, Order, Transaction } from '@core/models';
import { HoldingApiService } from '@core/services/holding-api.service';
import { InstrumentApiService } from '@core/services/instrument-api.service';
import { OrderLogApiService } from '@core/services/order-log-api.service';
import { PortfolioApiService } from '@core/services/portfolio-api.service';
import { WatchlistApiService } from '@core/services/watchlist-api.service';
import {
  DashboardStatePort,
  DashboardWatchlistInstrumentOption,
} from './dashboard-state.port';
import {
  toCash,
  toHoldings,
  toOpenOrders,
  toInstrumentType,
  toTransactions,
  toWatchlist,
} from './dashboard-backend.mappers';

export type DashboardLoadState = 'loading' | 'ready' | 'error';

@Injectable({
  providedIn: 'root',
})
export class BackendDashboardStateService implements DashboardStatePort {
  readonly accountCash = signal(0);
  readonly holdings = signal<Holding[]>([]);
  readonly orders = signal<Order[]>([]);

  readonly transactions = signal<Transaction[]>([]);
  readonly watchlists = signal<SharedWatchlist[]>([]);
  readonly activeWatchlistId = signal('watchlist');
  readonly dashboardOpenOrders = signal<MockOrder[]>([]);
  readonly backendWatchlistInstrumentOptions = signal<DashboardWatchlistInstrumentOption[]>([]);
  readonly returns = { ...MOCK_RETURNS, allTime: 0, daily: 0 };
  readonly watchlistConstraints = WATCHLIST_CONSTRAINTS;
  readonly backendDataMode = true;

  readonly loadState = signal<DashboardLoadState>('loading');
  private readonly portfolioId = signal<string | null>(null);
  private readonly watchlistItemIdByInstrumentId = signal<Map<string, string>>(new Map());

  constructor(
    private portfolioApiService: PortfolioApiService,
    private holdingApiService: HoldingApiService,
    private instrumentApiService: InstrumentApiService,
    private orderLogApiService: OrderLogApiService,
    private watchlistApiService: WatchlistApiService,
  ) {}

  async load(): Promise<void> {
    this.loadState.set('loading');
    this.accountCash.set(0);
    this.holdings.set([]);
    this.orders.set([]);
    this.transactions.set([]);
    this.watchlists.set([]);
    this.activeWatchlistId.set('watchlist');
    this.dashboardOpenOrders.set([]);
    this.backendWatchlistInstrumentOptions.set([]);
    this.portfolioId.set(null);
    this.watchlistItemIdByInstrumentId.set(new Map());

    try {
      const portfolio = await this.portfolioApiService.ensureDefault();

      const [holdings, instruments, orderLogs, watchlistItems] = await Promise.all([
        this.holdingApiService.listByPortfolio(portfolio.portfolioId),
        this.instrumentApiService.list(),
        this.orderLogApiService.listByPortfolio(portfolio.portfolioId),
        this.watchlistApiService.listByPortfolio(portfolio.portfolioId),
      ]);

      this.accountCash.set(toCash(holdings, instruments));
      this.holdings.set(
        toHoldings(holdings, instruments, orderLogs, {
          isKnownSymbol: () => false,
          getPrice: () => 0,
        }),
      );
      this.orders.set(toOpenOrders(orderLogs, instruments));
      this.transactions.set(toTransactions(orderLogs));
      this.watchlists.set([toWatchlist(watchlistItems, instruments)]);
      this.activeWatchlistId.set('watchlist');
      this.dashboardOpenOrders.set([]);
      this.backendWatchlistInstrumentOptions.set(
        instruments
          .map((instrument) => {
            const instrumentType = toInstrumentType(instrument.instrumentClass);
            if (!instrumentType) {
              return null;
            }

            return {
              instrumentId: instrument.instrumentId,
              symbol: instrument.ticker,
              name: instrument.name,
              instrumentType,
            };
          })
          .filter((instrument): instrument is DashboardWatchlistInstrumentOption => !!instrument),
      );
      this.watchlistItemIdByInstrumentId.set(
        new Map(watchlistItems.map((item) => [item.instrumentId, item.listItemId])),
      );
      this.portfolioId.set(portfolio.portfolioId);
      this.loadState.set('ready');
    } catch {
      this.accountCash.set(0);
      this.holdings.set([]);
      this.orders.set([]);
      this.transactions.set([]);
      this.watchlists.set([]);
      this.activeWatchlistId.set('watchlist');
      this.dashboardOpenOrders.set([]);
      this.backendWatchlistInstrumentOptions.set([]);
      this.portfolioId.set(null);
      this.watchlistItemIdByInstrumentId.set(new Map());
      this.loadState.set('error');
    }
  }

  async setWatchlistMembership(symbol: string, included: boolean): Promise<void> {
    const portfolioId = this.portfolioId();
    if (!portfolioId) {
      return;
    }

    const normalizedSymbol = symbol.trim().toUpperCase();
    const selectedInstrument = this.backendWatchlistInstrumentOptions().find(
      (instrument) => instrument.symbol.trim().toUpperCase() === normalizedSymbol,
    );

    if (!selectedInstrument) {
      return;
    }

    const watchlist = this.watchlists()[0];
    const existingSymbols = new Set(watchlist?.symbols ?? []);

    if (included) {
      if (existingSymbols.has(selectedInstrument.symbol)) {
        return;
      }

      await this.watchlistApiService.add({
        portfolioId,
        instrumentId: selectedInstrument.instrumentId,
        name: 'Watchlist',
      });
      await this.load();
      return;
    }

    if (!existingSymbols.has(selectedInstrument.symbol)) {
      return;
    }

    const matchingItemId = this.watchlistItemIdByInstrumentId().get(selectedInstrument.instrumentId);

    if (!matchingItemId) {
      return;
    }

    await this.watchlistApiService.remove(matchingItemId);
    await this.load();
  }
}
