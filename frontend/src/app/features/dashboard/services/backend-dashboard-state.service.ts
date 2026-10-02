import { Inject, Injectable, signal } from '@angular/core';
import {
  MOCK_RETURNS,
  MOCK_STATE,
  MockOrder,
  SharedWatchlist,
  WATCHLIST_CONSTRAINTS,
} from '@core/mocks/mock-data';
import { Holding, Order, Transaction } from '@core/models';
import { HoldingApiService } from '@core/services/holding-api.service';
import { InstrumentApiService } from '@core/services/instrument-api.service';
import { OrderLogApiService } from '@core/services/order-log-api.service';
import { PortfolioApiService } from '@core/services/portfolio-api.service';
import { DASHBOARD_MARKET_DATA_PORT, DashboardMarketDataPort } from './dashboard-market-data.port';
import { DashboardStatePort } from './dashboard-state.port';
import { toCash, toHoldings, toOpenOrders } from './dashboard-backend.mappers';

export type DashboardLoadState = 'loading' | 'ready' | 'error';

@Injectable({
  providedIn: 'root',
})
export class BackendDashboardStateService implements DashboardStatePort {
  readonly accountCash = signal(0);
  readonly holdings = signal<Holding[]>([]);
  readonly orders = signal<Order[]>([]);

  readonly transactions = signal<Transaction[]>([...MOCK_STATE.transactions()]);
  readonly watchlists = signal<SharedWatchlist[]>([...MOCK_STATE.watchlists()]);
  readonly activeWatchlistId = signal(MOCK_STATE.activeWatchlistId());
  readonly dashboardOpenOrders = signal<MockOrder[]>([...MOCK_STATE.dashboardOpenOrders()]);
  readonly returns = { ...MOCK_RETURNS, allTime: 0, daily: 0 };
  readonly watchlistConstraints = WATCHLIST_CONSTRAINTS;
  readonly backendDataMode = true;

  readonly loadState = signal<DashboardLoadState>('loading');

  constructor(
    private portfolioApiService: PortfolioApiService,
    private holdingApiService: HoldingApiService,
    private instrumentApiService: InstrumentApiService,
    private orderLogApiService: OrderLogApiService,
    @Inject(DASHBOARD_MARKET_DATA_PORT)
    private marketData: DashboardMarketDataPort,
  ) {}

  async load(): Promise<void> {
    this.loadState.set('loading');
    this.accountCash.set(0);
    this.holdings.set([]);
    this.orders.set([]);

    try {
      const portfolio = await this.portfolioApiService.ensureDefault();

      const [holdings, instruments, orderLogs] = await Promise.all([
        this.holdingApiService.listByPortfolio(portfolio.portfolioId),
        this.instrumentApiService.list(),
        this.orderLogApiService.listByPortfolio(portfolio.portfolioId),
      ]);

      this.accountCash.set(toCash(holdings, instruments));
      this.holdings.set(
        toHoldings(holdings, instruments, orderLogs, {
          isKnownSymbol: (symbol: string) => this.marketData.isKnownSymbol(symbol),
          getPrice: (symbol: string) => this.marketData.getPrice(symbol),
        }),
      );
      this.orders.set(toOpenOrders(orderLogs, instruments));
      this.loadState.set('ready');
    } catch {
      this.accountCash.set(0);
      this.holdings.set([]);
      this.orders.set([]);
      this.loadState.set('error');
    }
  }
}
