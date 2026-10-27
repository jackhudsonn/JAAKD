import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { isActiveOrderStatus } from '@core/constants/order-status.constants';
import {
  HoldingResponse,
  InstrumentResponse,
  OrderLogResponse,
  WatchlistResponse,
} from '@core/models/api.models';
import { Holding, Order } from '@core/models';
import { WATCHLIST_CONSTRAINTS } from '@core/constants/watchlist.constants';
import { HoldingApiService } from '@core/services/holding-api.service';
import { InstrumentApiService } from '@core/services/instrument-api.service';
import { OrderLogApiService } from '@core/services/order-log-api.service';
import { PortfolioApiService } from '@core/services/portfolio-api.service';
import { WatchlistApiService } from '@core/services/watchlist-api.service';
import { ToastService } from '@shared/components/toast/toast.service';
import {
  LiveQuote,
  toCash,
  toHoldings,
  toLatestPriceBySymbol,
  toLiveQuoteBySymbol,
  toOrders,
  toPriceResolver,
  toQuotePriceBySymbol,
  toQuoteSymbols,
  toWatchlists,
} from '@features/dashboard/services/dashboard-backend.mappers';
import { v4 as uuidv4 } from 'uuid';
import { TradePlaceOrderRequest } from './trade-order-engine.service';
import { TradeStatePort, TradeWatchlist } from './trade-state.port';

export type TradeLoadState = 'loading' | 'ready' | 'error';

@Injectable({
  providedIn: 'root',
})
export class BackendTradeStateService implements TradeStatePort {
  readonly accountCash = signal(0);
  readonly cashBalances = signal<Record<string, number>>({});
  readonly holdings = signal<Holding[]>([]);
  readonly orders = signal<Order[]>([]);
  readonly watchlists = signal<TradeWatchlist[]>([]);
  readonly maxWatchlistHoldings = WATCHLIST_CONSTRAINTS.maxHoldingsPerWatchlist;

  readonly backendDataMode = true;
  readonly loadState = signal<TradeLoadState>('loading');

  readonly instrumentsData = signal<InstrumentResponse[]>([]);
  readonly orderLogsData = signal<OrderLogResponse[]>([]);
  readonly latestPriceBySymbolData = signal<Map<string, number>>(new Map());
  readonly liveQuoteBySymbolData = signal<Map<string, LiveQuote>>(new Map());
  readonly watchlistsData = signal<WatchlistResponse[]>([]);

  private readonly portfolioId = signal<string | null>(null);
  private readonly quotePriceBySymbol = signal<Map<string, number>>(new Map());

  constructor(
    private portfolioApiService: PortfolioApiService,
    private holdingApiService: HoldingApiService,
    private instrumentApiService: InstrumentApiService,
    private orderLogApiService: OrderLogApiService,
    private watchlistApiService: WatchlistApiService,
    private toastService: ToastService,
  ) {}

  async load(): Promise<void> {
    this.loadState.set('loading');
    this.accountCash.set(0);
    this.cashBalances.set({});
    this.holdings.set([]);
    this.orders.set([]);
    this.watchlists.set([]);

    try {
      await this.refresh(true);

      this.loadState.set('ready');
    } catch (error) {
      console.error('BackendTradeStateService.load failed', error);
      this.portfolioId.set(null);
      this.instrumentsData.set([]);
      this.orderLogsData.set([]);
      this.watchlistsData.set([]);
      this.latestPriceBySymbolData.set(new Map());
      this.quotePriceBySymbol.set(new Map());
      this.liveQuoteBySymbolData.set(new Map());
      this.accountCash.set(0);
      this.cashBalances.set({});
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

    const orderId = uuidv4();

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
      if (order && !isActiveOrderStatus(order.status)) {
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

  getOrderHistory(orderId: string): OrderLogResponse[] {
    return this.orderLogsData()
      .filter((log) => log.orderId === orderId)
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime() ||
          a.logOrderId.localeCompare(b.logOrderId),
      );
  }

  async setWatchlistMembership(
    symbol: string,
    watchlistId: string,
    included: boolean,
  ): Promise<void> {
    const instrument = this.findInstrumentBySymbol(symbol);
    const portfolioId = this.portfolioId();
    if (!instrument || !portfolioId) {
      return;
    }

    if (included) {
      await this.watchlistApiService.addItem(portfolioId, watchlistId, {
        instrumentId: instrument.instrumentId,
      });
      await this.refresh();
      return;
    }

    const existingItem = this.watchlistsData()
      .find((watchlist) => watchlist.watchlistId === watchlistId)
      ?.items.find((item) => item.instrumentId === instrument.instrumentId);

    if (!existingItem) {
      return;
    }

    await this.watchlistApiService.removeItem(portfolioId, watchlistId, existingItem.listItemId);
    await this.refresh();
  }

  async createWatchlist(watchlistName: string): Promise<void> {
    const portfolioId = this.portfolioId();
    if (!portfolioId) {
      return;
    }

    await this.watchlistApiService.createWatchlist(portfolioId, { watchlistName });
    await this.refresh();
  }

  async renameWatchlist(watchlistId: string, watchlistName: string): Promise<void> {
    const portfolioId = this.portfolioId();
    if (!portfolioId) {
      return;
    }

    await this.watchlistApiService.updateWatchlist(portfolioId, watchlistId, { watchlistName });
    await this.refresh();
  }

  async deleteWatchlist(watchlistId: string): Promise<void> {
    const portfolioId = this.portfolioId();
    if (!portfolioId) {
      return;
    }

    await this.watchlistApiService.deleteWatchlist(portfolioId, watchlistId);
    await this.refresh();
  }
  private async loadQuotes(instruments: InstrumentResponse[]): Promise<void> {
    try {
      const quoteSymbols = toQuoteSymbols(instruments);
      const quotes = await this.instrumentApiService.getQuotes(quoteSymbols);
      const prices = toQuotePriceBySymbol(quotes);
      if (quoteSymbols.length > 0 && prices.size === 0) {
        this.toastService.error('Market prices are currently unavailable.');
      }
      this.quotePriceBySymbol.set(prices);
      this.liveQuoteBySymbolData.set(toLiveQuoteBySymbol(quotes));
    } catch (error) {
      console.error('BackendTradeStateService.loadQuotes failed', error);
      this.toastService.error('Market prices are currently unavailable.');
      this.quotePriceBySymbol.set(new Map());
      this.liveQuoteBySymbolData.set(new Map());
    }
  }

  private async refresh(includeQuotes = false): Promise<void> {
    const portfolio = await this.portfolioApiService.ensureDefault();

    const [holdings, instruments, orderLogs, watchlists] = await Promise.all([
      this.holdingApiService.listByPortfolio(portfolio.portfolioId),
      this.instrumentApiService.list(),
      this.orderLogApiService.listByPortfolio(portfolio.portfolioId),
      this.watchlistApiService.list(portfolio.portfolioId),
    ]);

    if (includeQuotes) {
      await this.loadQuotes(instruments);
    }

    this.portfolioId.set(portfolio.portfolioId);
    this.instrumentsData.set(instruments);
    this.orderLogsData.set(orderLogs);
    this.watchlistsData.set(watchlists);
    this.latestPriceBySymbolData.set(
      new Map([...toLatestPriceBySymbol(orderLogs, instruments), ...this.quotePriceBySymbol()]),
    );
    this.accountCash.set(toCash(holdings, instruments));
    this.cashBalances.set(this.toCashBalances(holdings, instruments));
    this.holdings.set(
      toHoldings(holdings, instruments, orderLogs, toPriceResolver(this.quotePriceBySymbol())),
    );
    this.orders.set(toOrders(orderLogs, instruments));
    this.watchlists.set(toWatchlists(watchlists, instruments));
  }

  private findInstrumentBySymbol(symbol: string): InstrumentResponse | undefined {
    const normalized = symbol.trim().toUpperCase();
    return this.instrumentsData().find(
      (instrument) => instrument.ticker.trim().toUpperCase() === normalized,
    );
  }

  private toCashBalances(
    holdings: ReadonlyArray<HoldingResponse>,
    instruments: ReadonlyArray<InstrumentResponse>,
  ): Record<string, number> {
    const cashTickerById = new Map(
      instruments
        .filter((instrument) => instrument.instrumentClass === 'CASH')
        .map((instrument) => [instrument.instrumentId, instrument.ticker]),
    );
    const balances: Record<string, number> = {};

    for (const holding of holdings) {
      const ticker = cashTickerById.get(holding.instrumentID);
      if (ticker) {
        balances[ticker] = holding.currentQuantity;
      }
    }

    return balances;
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }
}
