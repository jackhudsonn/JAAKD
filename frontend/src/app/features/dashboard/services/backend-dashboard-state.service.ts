import { Injectable, signal } from '@angular/core';
import { WATCHLIST_CONSTRAINTS } from '@core/constants/watchlist.constants';
import { Holding, Order, SharedWatchlist, Transaction } from '@core/models';
import { PortfolioPerformancePoint, QuoteResponse } from '@core/models/api.models';
import { HoldingApiService } from '@core/services/holding-api.service';
import { CashFxService } from '@core/services/cash-fx.service';
import { InstrumentApiService } from '@core/services/instrument-api.service';
import { OrderLogApiService } from '@core/services/order-log-api.service';
import { PortfolioApiService } from '@core/services/portfolio-api.service';
import { WatchlistApiService } from '@core/services/watchlist-api.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { CashRatesByUsd, USD_RATES_BY_USD } from '@core/utils/cash-fx';
import { DashboardPreferencesSyncService } from './dashboard-preferences-sync.service';
import { DashboardStatePort, DashboardWatchlistInstrumentOption } from './dashboard-state.port';
import {
  LiveQuote,
  toCash,
  toCashBalances,
  toHoldings,
  toLiveQuoteBySymbol,
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
  readonly backendWatchlistInstrumentOptions = signal<DashboardWatchlistInstrumentOption[]>([]);
  readonly dashboardWidgets = signal<readonly string[] | null>(null);
  readonly liveQuotes = signal<ReadonlyMap<string, LiveQuote>>(new Map());
  readonly cashRatesByUsd = signal<CashRatesByUsd>(USD_RATES_BY_USD);
  readonly performance = signal<PortfolioPerformancePoint[]>([]);
  readonly performanceLoadState = signal<'loading' | 'idle' | 'error'>('loading');
  readonly watchlistConstraints = WATCHLIST_CONSTRAINTS;

  readonly loadState = signal<DashboardLoadState>('loading');
  private readonly portfolioId = signal<string | null>(null);

  constructor(
    private portfolioApiService: PortfolioApiService,
    private holdingApiService: HoldingApiService,
    private instrumentApiService: InstrumentApiService,
    private orderLogApiService: OrderLogApiService,
    private watchlistApiService: WatchlistApiService,
    private dashboardPreferencesSyncService: DashboardPreferencesSyncService,
    private cashFxService: CashFxService,
    private toastService: ToastService,
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
    this.backendWatchlistInstrumentOptions.set([]);
    this.dashboardWidgets.set(null);
    this.liveQuotes.set(new Map());
    this.cashRatesByUsd.set(USD_RATES_BY_USD);
    this.performance.set([]);
    this.performanceLoadState.set('loading');
    this.portfolioId.set(null);
    let performanceStarted = false;

    try {
      const portfolio = await this.portfolioApiService.ensureDefault();
      // Not awaited: the series is the slowest call, and the rest of the dashboard should not wait for it.
      void this.loadPerformance(portfolio.portfolioId);
      performanceStarted = true;

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

      let quotes: QuoteResponse[] = [];
      const quoteSymbols = toQuoteSymbols(instruments);
      let quoteLoadFailed = false;
      try {
        quotes = await this.instrumentApiService.getQuotes(quoteSymbols);
      } catch (error) {
        quoteLoadFailed = true;
        console.error('BackendDashboardStateService quotes failed', error);
        this.toastService.error('Market prices are currently unavailable.');
      }
      const quotePrices = toQuotePriceBySymbol(quotes);
      if (!quoteLoadFailed && quoteSymbols.length > 0 && quotePrices.size === 0) {
        this.toastService.error('Market prices are currently unavailable.');
      }
      this.liveQuotes.set(toLiveQuoteBySymbol(quotes));
      this.cashRatesByUsd.set(await this.cashFxService.loadRatesByUsd());

      this.accountCash.set(toCash(holdings, instruments));
      this.cashBalances.set(toCashBalances(holdings, instruments));
      this.holdings.set(toHoldings(holdings, instruments, orderLogs, toPriceResolver(quotePrices)));
      this.orders.set(toOpenOrders(orderLogs, instruments));
      this.transactions.set(toTransactions(orderLogs, instruments));
      const mappedWatchlists = toWatchlists(watchlists, instruments);
      this.watchlists.set(mappedWatchlists);
      this.activeWatchlistId.set(mappedWatchlists[0]?.id ?? '');
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
              currency: instrument.tradingCurrency,
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
      this.backendWatchlistInstrumentOptions.set([]);
      this.dashboardWidgets.set(null);
      this.liveQuotes.set(new Map());
      this.cashRatesByUsd.set(USD_RATES_BY_USD);
      this.portfolioId.set(null);
      this.loadState.set('error');
      if (!performanceStarted) {
        this.performanceLoadState.set('error');
      }
    }
  }

  // Loaded once and shared, so the Performance graph and the Portfolio Value total use the same prices and rates.
  async loadPerformance(portfolioId = this.portfolioId()): Promise<void> {
    if (!portfolioId) {
      return;
    }

    this.performanceLoadState.set('loading');
    try {
      this.performance.set(await this.portfolioApiService.getPerformance(portfolioId));
      this.performanceLoadState.set('idle');
    } catch (error) {
      console.error('BackendDashboardStateService.loadPerformance failed', error);
      this.performanceLoadState.set('error');
    }
  }

  async setWatchlistMembership(
    symbol: string,
    watchlistId: string,
    included: boolean,
  ): Promise<void> {
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
