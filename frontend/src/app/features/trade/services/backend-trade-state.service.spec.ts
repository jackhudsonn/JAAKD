import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { HoldingApiService } from '@core/services/holding-api.service';
import { InstrumentApiService } from '@core/services/instrument-api.service';
import { OrderLogApiService } from '@core/services/order-log-api.service';
import { PortfolioApiService } from '@core/services/portfolio-api.service';
import { WatchlistApiService } from '@core/services/watchlist-api.service';
import { BackendTradeStateService } from './backend-trade-state.service';

describe('BackendTradeStateService', () => {
  const portfolio = { portfolioId: 'portfolio-1', portfolioName: 'Main' };
  const instruments = [
    {
      instrumentId: 'inst-cash',
      ticker: 'USD',
      market: 'CASH',
      name: 'US Dollar',
      instrumentClass: 'CASH' as const,
      logoUrl: null,
      description: null,
    },
    {
      instrumentId: 'inst-aapl',
      ticker: 'AAPL',
      market: 'NASDAQ',
      name: 'Apple',
      instrumentClass: 'EQUITY' as const,
      logoUrl: null,
      description: null,
    },
  ];

  const holdings = [
    {
      holdingID: 'holding-1',
      portfolioID: portfolio.portfolioId,
      instrumentID: 'inst-cash',
      currentQuantity: 5000,
      cumulativeRealizedPnl: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      holdingID: 'holding-2',
      portfolioID: portfolio.portfolioId,
      instrumentID: 'inst-aapl',
      currentQuantity: 2,
      cumulativeRealizedPnl: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  let orderLogs = [
    {
      logOrderId: 'log-1',
      orderId: 'ord-1',
      portfolioId: portfolio.portfolioId,
      instrumentId: 'inst-aapl',
      side: 'BUY' as const,
      quantity: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      metadata: null,
      status: 'EXECUTED' as const,
      executionPrice: 100,
      quotedPrice: 99,
    },
  ];

  let watchlistItems = [
    {
      listItemId: 'wl-1',
      portfolioId: portfolio.portfolioId,
      instrumentId: 'inst-aapl',
      name: 'Watchlist',
    },
  ];

  const portfolioApiService = {
    ensureDefault: vi.fn(async () => portfolio),
  };
  const holdingApiService = {
    listByPortfolio: vi.fn(async () => holdings),
  };
  const instrumentApiService = {
    list: vi.fn(async () => instruments),
  };
  const orderLogApiService = {
    listByPortfolio: vi.fn(async () => orderLogs),
    submit: vi.fn(async () => orderLogs[0]),
    cancel: vi.fn(async () => orderLogs[0]),
  };
  const watchlistApiService = {
    listByPortfolio: vi.fn(async () => watchlistItems),
    add: vi.fn(async () => watchlistItems[0]),
    remove: vi.fn(async () => undefined),
  };

  let service: BackendTradeStateService;

  beforeEach(() => {
    orderLogs = [
      {
        logOrderId: 'log-1',
        orderId: 'ord-1',
        portfolioId: portfolio.portfolioId,
        instrumentId: 'inst-aapl',
        side: 'BUY',
        quantity: 1,
        timestamp: '2026-01-01T00:00:00.000Z',
        metadata: null,
        status: 'EXECUTED',
        executionPrice: 100,
        quotedPrice: 99,
      },
    ];
    watchlistItems = [
      {
        listItemId: 'wl-1',
        portfolioId: portfolio.portfolioId,
        instrumentId: 'inst-aapl',
        name: 'Watchlist',
      },
    ];

    vi.restoreAllMocks();
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        BackendTradeStateService,
        { provide: PortfolioApiService, useValue: portfolioApiService },
        { provide: HoldingApiService, useValue: holdingApiService },
        { provide: InstrumentApiService, useValue: instrumentApiService },
        { provide: OrderLogApiService, useValue: orderLogApiService },
        { provide: WatchlistApiService, useValue: watchlistApiService },
      ],
    });

    service = TestBed.inject(BackendTradeStateService);
  });

  it('loads backend trade state and maps cash, holdings, orders, watchlist', async () => {
    await service.load();

    expect(service.loadState()).toBe('ready');
    expect(service.accountCash()).toBe(5000);
    expect(service.holdings()).toHaveLength(1);
    expect(service.orders()).toHaveLength(1);
    expect(service.watchlists()).toEqual([{ id: 'watchlist', name: 'Watchlist', symbols: ['AAPL'] }]);
    expect(service.latestPriceBySymbolData().get('AAPL')).toBe(100);
  });

  it('sets error state and clears mapped signals when load fails', async () => {
    instrumentApiService.list.mockRejectedValueOnce(new Error('boom'));

    await service.load();

    expect(service.loadState()).toBe('error');
    expect(service.accountCash()).toBe(0);
    expect(service.holdings()).toEqual([]);
    expect(service.orders()).toEqual([]);
    expect(service.watchlists()).toEqual([]);
    expect(service.latestPriceBySymbolData().size).toBe(0);
  });

  it('submits BUY order and reloads mapped state', async () => {
    const randomUuidSpy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('11111111-1111-1111-1111-111111111111');
    orderLogApiService.submit.mockImplementationOnce(async () => {
      orderLogs = [
        {
          logOrderId: 'log-submitted',
          orderId: '11111111-1111-1111-1111-111111111111',
          portfolioId: portfolio.portfolioId,
          instrumentId: 'inst-aapl',
          side: 'BUY',
          quantity: 3,
          timestamp: '2026-01-01T01:00:00.000Z',
          metadata: null,
          status: 'EXECUTED',
          executionPrice: 120,
          quotedPrice: 119,
        },
      ];

      return orderLogs[0];
    });

    await service.load();
    expect(service.loadState()).toBe('ready');
    await service.submitOrder({ symbol: 'AAPL', kind: 'market', type: 'buy', quantity: 3 });

    expect(orderLogApiService.submit).toHaveBeenCalledWith({
      orderId: '11111111-1111-1111-1111-111111111111',
      portfolioId: portfolio.portfolioId,
      instrumentId: 'inst-aapl',
      side: 'BUY',
      quantity: 3,
    });
    expect(service.orders().some((order) => order.id === '11111111-1111-1111-1111-111111111111')).toBe(
      true,
    );
    expect(service.loadState()).toBe('ready');

    randomUuidSpy.mockRestore();
  });

  it('handles cancel conflict (409) by reloading and not throwing', async () => {
    orderLogApiService.cancel.mockRejectedValueOnce(new HttpErrorResponse({ status: 409 }));

    await service.load();
    expect(service.loadState()).toBe('ready');

    await expect(service.cancelOrder('ord-1')).resolves.toBeUndefined();
    expect(orderLogApiService.cancel).toHaveBeenCalledWith('ord-1');
    expect(service.loadState()).toBe('ready');
  });

  it('adds and removes watchlist membership through API calls', async () => {
    await service.load();
    expect(service.loadState()).toBe('ready');

    await service.setWatchlistMembership('AAPL', true);
    expect(watchlistApiService.add).toHaveBeenCalledWith({
      portfolioId: portfolio.portfolioId,
      instrumentId: 'inst-aapl',
      name: 'Watchlist',
    });
    expect(service.loadState()).toBe('ready');

    await service.setWatchlistMembership('AAPL', false);
    expect(watchlistApiService.remove).toHaveBeenCalledWith('wl-1');
    expect(service.loadState()).toBe('ready');
  });
});
