import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { InstrumentResponse, OrderLogResponse, WatchlistItemResponse } from '@core/models/api.models';
import { Holding, Order } from '@core/models';
import { WATCHLIST_CONSTRAINTS } from '@core/mocks/watchlist.mock';
import { HoldingApiService } from '@core/services/holding-api.service';
import { InstrumentApiService } from '@core/services/instrument-api.service';
import { OrderLogApiService } from '@core/services/order-log-api.service';
import { PortfolioApiService } from '@core/services/portfolio-api.service';
import { WatchlistApiService } from '@core/services/watchlist-api.service';
import {
  toCash,
  toHoldings,
  toLatestPriceBySymbol,
  toOrders,
  toWatchlist,
} from '@features/dashboard/services/dashboard-backend.mappers';
import { TradePlaceOrderRequest } from './trade-order-engine.service';
import { TradeStatePort, TradeWatchlist } from './trade-state.port';

export type TradeLoadState = 'loading' | 'ready' | 'error';

@Injectable({
  providedIn: 'root',
})
export class BackendTradeStateService implements TradeStatePort {
  readonly accountCash = signal(0);
  readonly holdings = signal<Holding[]>([]);
  readonly orders = signal<Order[]>([]);
  readonly watchlists = signal<TradeWatchlist[]>([]);
  readonly maxWatchlistHoldings = WATCHLIST_CONSTRAINTS.maxHoldingsPerWatchlist;

  readonly backendDataMode = true;
  readonly loadState = signal<TradeLoadState>('loading');

  readonly instrumentsData = signal<InstrumentResponse[]>([]);
  readonly orderLogsData = signal<OrderLogResponse[]>([]);
  readonly latestPriceBySymbolData = signal<Map<string, number>>(new Map());
  readonly watchlistItemsData = signal<WatchlistItemResponse[]>([]);

  private readonly portfolioId = signal<string | null>(null);

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
    this.watchlists.set([]);

    try {
      await this.refresh();

      this.loadState.set('ready');
    } catch (error) {
      console.error('BackendTradeStateService.load failed', error);
      this.portfolioId.set(null);
      this.instrumentsData.set([]);
      this.orderLogsData.set([]);
      this.watchlistItemsData.set([]);
      this.latestPriceBySymbolData.set(new Map());
      this.accountCash.set(0);
      this.holdings.set([]);
      this.orders.set([]);
      this.watchlists.set([]);
      this.loadState.set('error');
    }
  }

  async submitOrder(request: TradePlaceOrderRequest): Promise<void> {
    const instrument = this.findInstrumentBySymbol(request.symbol);
    const portfolioId = this.portfolioId();

    if (!instrument || !portfolioId) {
      return;
    }

    const orderId = crypto.randomUUID();

    await this.orderLogApiService.submit({
      orderId,
      portfolioId,
      instrumentId: instrument.instrumentId,
      side: request.type === 'buy' ? 'BUY' : 'SELL',
      quantity: request.quantity,
    });

    await this.refresh();

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const order = this.orders().find((entry) => entry.id === orderId);
      if (order && (order.status === 'filled' || order.status === 'cancelled' || order.status === 'rejected')) {
        return;
      }

      await this.delay(1000);
      await this.refresh();
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    try {
      await this.orderLogApiService.cancel(orderId);
      await this.refresh();
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        await this.refresh();
        return;
      }

      throw error;
    }
  }

  async setWatchlistMembership(symbol: string, included: boolean): Promise<void> {
    const instrument = this.findInstrumentBySymbol(symbol);
    const portfolioId = this.portfolioId();

    if (!instrument || !portfolioId) {
      return;
    }

    if (included) {
      await this.watchlistApiService.add({
        portfolioId,
        instrumentId: instrument.instrumentId,
        name: 'Watchlist',
      });
      await this.refresh();
      return;
    }

    const existingItem = this.watchlistItemsData().find(
      (item) => item.instrumentId === instrument.instrumentId,
    );

    if (!existingItem) {
      return;
    }

    await this.watchlistApiService.remove(existingItem.listItemId);
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    const portfolio = await this.portfolioApiService.ensureDefault();

    const [holdings, instruments, orderLogs, watchlistItems] = await Promise.all([
      this.holdingApiService.listByPortfolio(portfolio.portfolioId),
      this.instrumentApiService.list(),
      this.orderLogApiService.listByPortfolio(portfolio.portfolioId),
      this.watchlistApiService.listByPortfolio(portfolio.portfolioId),
    ]);

    this.portfolioId.set(portfolio.portfolioId);
    this.instrumentsData.set(instruments);
    this.orderLogsData.set(orderLogs);
    this.watchlistItemsData.set(watchlistItems);
    this.latestPriceBySymbolData.set(toLatestPriceBySymbol(orderLogs, instruments));

    this.accountCash.set(toCash(holdings, instruments));
    this.holdings.set(
      toHoldings(holdings, instruments, orderLogs, {
        isKnownSymbol: () => false,
        getPrice: () => 0,
      }),
    );
    this.orders.set(toOrders(orderLogs, instruments));
    this.watchlists.set([toWatchlist(watchlistItems, instruments)]);
  }

  private findInstrumentBySymbol(symbol: string): InstrumentResponse | undefined {
    const normalized = symbol.trim().toUpperCase();
    return this.instrumentsData().find(
      (instrument) => instrument.ticker.trim().toUpperCase() === normalized,
    );
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }
}
