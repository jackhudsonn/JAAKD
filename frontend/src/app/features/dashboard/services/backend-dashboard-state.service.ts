import { Injectable, signal } from '@angular/core';
import { MOCK_RETURNS, MockOrder } from '@core/mocks/state.mock';
import { SharedWatchlist, WATCHLIST_CONSTRAINTS } from '@core/mocks/watchlist.mock';
import { Holding, Order, Transaction } from '@core/models';
import { HoldingApiService } from '@core/services/holding-api.service';
import { InstrumentApiService } from '@core/services/instrument-api.service';
import { OrderLogApiService } from '@core/services/order-log-api.service';
import { PortfolioApiService } from '@core/services/portfolio-api.service';
import { WatchlistApiService } from '@core/services/watchlist-api.service';
import { DashboardPreferencesSyncService } from './dashboard-preferences-sync.service';
import { DashboardStatePort, DashboardWatchlistInstrumentOption } from './dashboard-state.port';
import {
  toCash,
  toCashBalances,
  toHoldings,
  toOpenOrders,
  toInstrumentType,
  toPriceResolver,
  toQuotePriceBySymbol,
  toQuoteSymbols,
  toTransactions,
  toWatchlists,
} from './dashboard-backend.mappers';

export type DashboardLoadState = 'loading' | 'ready' | 'error';

@Injectable({
  providedIn: 'root',
})
export class BackendDashboardStateService implements DashboardStatePort {
  readonly accountCash = signal(0);
  readonly cashBalances = signal<Record<string, number>>({});
  readonly holdings = signal<Holding[]>([]);
  readonly orders = signal<Order[]>([]);

  readonly transactions = signal<Transaction[]>([]);
  readonly watchlists = signal<SharedWatchlist[]>([]);
  readonly activeWatchlistId = signal('watchlist');
  readonly dashboardOpenOrders = signal<MockOrder[]>([]);
  readonly backendWatchlistInstrumentOptions = signal<DashboardWatchlistInstrumentOption[]>([]);
  readonly dashboardWidgets = signal<readonly string[] | null>(null);
  readonly returns = { ...MOCK_RETURNS, allTime: 0, daily: 0 };
  readonly watchlistConstraints = WATCHLIST_CONSTRAINTS;
  readonly backendDataMode = true;

  readonly loadState = signal<DashboardLoadState>('loading');
  private readonly portfolioId = signal<string | null>(null);

  constructor(
    private portfolioApiService: PortfolioApiService,
    private holdingApiService: HoldingApiService,
    private instrumentApiService: InstrumentApiService,
    private orderLogApiService: OrderLogApiService,
    private watchlistApiService: WatchlistApiService,
    private dashboardPreferencesSyncService: DashboardPreferencesSyncService,
  ) {}

  async load(): Promise<void> {
    this.loadState.set('loading');
    this.accountCash.set(0);
    this.cashBalances.set({});
    this.holdings.set([]);
    this.orders.set([]);
    this.transactions.set([]);
    this.watchlists.set([]);
    this.activeWatchlistId.set('');
    this.dashboardOpenOrders.set([]);
    this.backendWatchlistInstrumentOptions.set([]);
    this.dashboardWidgets.set(null);
    this.portfolioId.set(null);

    try {
      const portfolio = await this.portfolioApiService.ensureDefault();

      const initialWidgets = await this.dashboardPreferencesSyncService.getInitialWidgets(
        portfolio.portfolioId,
      );
      if (initialWidgets) {
        this.dashboardWidgets.set([...initialWidgets]);
      }

      const [holdings, instruments, orderLogs, watchlists] = await Promise.all([
        this.holdingApiService.listByPortfolio(portfolio.portfolioId),
        this.instrumentApiService.list(),
        this.orderLogApiService.listByPortfolio(portfolio.portfolioId),
        this.watchlistApiService.list(portfolio.portfolioId),
      ]);

      let quotePrices = new Map<string, number>();
      try {
        quotePrices = toQuotePriceBySymbol(
          await this.instrumentApiService.getQuotes(toQuoteSymbols(instruments)),
        );
      } catch (error) {
        console.error('BackendDashboardStateService quotes failed', error);
      }

      this.accountCash.set(toCash(holdings, instruments));
      this.cashBalances.set(toCashBalances(holdings, instruments));
      this.holdings.set(toHoldings(holdings, instruments, orderLogs, toPriceResolver(quotePrices)));
      this.orders.set(toOpenOrders(orderLogs, instruments));
      this.transactions.set(toTransactions(orderLogs, instruments));
      const mappedWatchlists = toWatchlists(watchlists, instruments);
      this.watchlists.set(mappedWatchlists);
      this.activeWatchlistId.set(mappedWatchlists[0]?.id ?? '');
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

      void this.dashboardPreferencesSyncService.reconcile(portfolio.portfolioId, (widgets) => {
        this.dashboardWidgets.set([...widgets]);
      });

      this.portfolioId.set(portfolio.portfolioId);
      this.loadState.set('ready');
    } catch {
      this.accountCash.set(0);
      this.cashBalances.set({});
      this.holdings.set([]);
      this.orders.set([]);
      this.transactions.set([]);
      this.watchlists.set([]);
      this.activeWatchlistId.set('');
      this.dashboardOpenOrders.set([]);
      this.backendWatchlistInstrumentOptions.set([]);
      this.dashboardWidgets.set(null);
      this.portfolioId.set(null);
      this.loadState.set('error');
    }
  }

  async setWatchlistMembership(symbol: string, watchlistId: string, included: boolean): Promise<void> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const selectedInstrument = this.backendWatchlistInstrumentOptions().find(
      (instrument) => instrument.symbol.trim().toUpperCase() === normalizedSymbol,
    );

    if (!selectedInstrument) {
      return;
    }

    const watchlist = this.watchlists().find((entry) => entry.id === watchlistId);
    if (!watchlist) {
      return;
    }

    const existingSymbols = new Set(watchlist?.symbols ?? []);
    const portfolioId = this.portfolioId();
    if (!portfolioId) {
      return;
    }

    if (included) {
      if (existingSymbols.has(selectedInstrument.symbol)) {
        return;
      }

      await this.watchlistApiService.addItem(portfolioId, watchlistId, {
        instrumentId: selectedInstrument.instrumentId,
      });
      await this.refreshWatchlists();
      return;
    }

    if (!existingSymbols.has(selectedInstrument.symbol)) {
      return;
    }

    const watchlists = await this.watchlistApiService.list(portfolioId);
    const listItemId = watchlists
      .find((entry) => entry.watchlistId === watchlistId)
      ?.items.find((item) => item.instrumentId === selectedInstrument.instrumentId)?.listItemId;

    if (!listItemId) {
      return;
    }

    await this.watchlistApiService.removeItem(portfolioId, watchlistId, listItemId);
    await this.refreshWatchlists();
  }

  async createWatchlist(watchlistName: string): Promise<void> {
    const portfolioId = this.portfolioId();
    if (!portfolioId) {
      return;
    }

    await this.watchlistApiService.createWatchlist(portfolioId, { watchlistName });
    await this.refreshWatchlists();
  }

  async renameWatchlist(watchlistId: string, watchlistName: string): Promise<void> {
    const portfolioId = this.portfolioId();
    if (!portfolioId) {
      return;
    }

    await this.watchlistApiService.updateWatchlist(portfolioId, watchlistId, { watchlistName });
    await this.refreshWatchlists();
  }

  async deleteWatchlist(watchlistId: string): Promise<void> {
    const portfolioId = this.portfolioId();
    if (!portfolioId) {
      return;
    }

    await this.watchlistApiService.deleteWatchlist(portfolioId, watchlistId);
    await this.refreshWatchlists();
  }

  async setDashboardWidgets(dashboardWidgets: readonly string[]): Promise<void> {
    const portfolioId = this.portfolioId();
    if (!portfolioId) {
      return;
    }

    this.dashboardWidgets.set([...dashboardWidgets]);
    const syncedWidgets = await this.dashboardPreferencesSyncService.persistWidgets(
      portfolioId,
      dashboardWidgets,
    );
    this.dashboardWidgets.set([...syncedWidgets]);
  }

  private async refreshWatchlists(): Promise<void> {
    const portfolioId = this.portfolioId();
    if (!portfolioId) {
      this.watchlists.set([]);
      this.activeWatchlistId.set('');
      return;
    }

    const watchlists = await this.watchlistApiService.list(portfolioId);
    const instrumentById = new Map(
      this.backendWatchlistInstrumentOptions().map((instrument) => [
        instrument.instrumentId,
        instrument.symbol,
      ]),
    );

    const mappedWatchlists = watchlists.map((watchlist) => ({
      id: watchlist.watchlistId,
      name: watchlist.watchlistName,
      symbols: watchlist.items
        .map((item) => instrumentById.get(item.instrumentId) ?? null)
        .filter((symbol): symbol is string => symbol !== null),
    }));

    const previousActiveId = this.activeWatchlistId();
    this.watchlists.set(mappedWatchlists);
    const stillActive = mappedWatchlists.some((watchlist) => watchlist.id === previousActiveId);
    this.activeWatchlistId.set(stillActive ? previousActiveId : (mappedWatchlists[0]?.id ?? ''));
  }
}
