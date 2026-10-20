import { TestBed } from '@angular/core/testing';
import { HoldingApiService } from '@core/services/holding-api.service';
import { InstrumentApiService } from '@core/services/instrument-api.service';
import { OrderLogApiService } from '@core/services/order-log-api.service';
import { PortfolioApiService } from '@core/services/portfolio-api.service';
import { PreferencesApiService } from '@core/services/preferences-api.service';
import { WatchlistApiService } from '@core/services/watchlist-api.service';
import { BackendDashboardStateService } from './backend-dashboard-state.service';

describe('BackendDashboardStateService', () => {
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
    {
      instrumentId: 'inst-vod',
      ticker: 'VOD',
      market: 'LSE',
      name: 'Vodafone',
      instrumentClass: 'EQUITY' as const,
      logoUrl: null,
      description: null,
    },
  ];

  const holdings = [
    {
      holdingID: 'holding-cash',
      portfolioID: portfolio.portfolioId,
      instrumentID: 'inst-cash',
      currentQuantity: 5000,
      cumulativeRealizedPnl: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      holdingID: 'holding-aapl',
      portfolioID: portfolio.portfolioId,
      instrumentID: 'inst-aapl',
      currentQuantity: 2,
      cumulativeRealizedPnl: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  const orderLogs = [
    {
      logOrderId: 'log-1',
      orderId: 'ord-open',
      portfolioId: portfolio.portfolioId,
      instrumentId: 'inst-aapl',
      side: 'BUY' as const,
      quantity: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      metadata: null,
      status: 'ACCEPTED' as const,
      executionPrice: 0,
      quotedPrice: 101,
    },
    {
      logOrderId: 'log-2',
      orderId: 'ord-deposit',
      portfolioId: portfolio.portfolioId,
      instrumentId: 'inst-cash',
      side: 'DEPOSIT' as const,
      quantity: 5000,
      timestamp: '2026-01-01T00:01:00.000Z',
      metadata: null,
      status: 'EXECUTED' as const,
      executionPrice: 0,
      quotedPrice: null,
    },
  ];

  const watchlists = [
    {
      watchlistId: 'watchlist-1',
      watchlistName: 'My Watchlist',
      items: [{ listItemId: 'wl-1', watchlistId: 'watchlist-1', instrumentId: 'inst-aapl' }],
    },
  ];

  const preferences = {
    preferenceId: 'pref-1',
    portfolioId: portfolio.portfolioId,
    dashboardWidgets: ['performance-graph', 'watchlist', 'portfolio-value', 'allocation-by-asset'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const portfolioApiService = {
    ensureDefault: vi.fn(async () => portfolio),
  };

  const holdingApiService = {
    listByPortfolio: vi.fn(async () => holdings),
  };

  const instrumentApiService = {
    list: vi.fn(async () => instruments),
    getQuotes: vi.fn(async () => []),
  };

  const orderLogApiService = {
    listByPortfolio: vi.fn(async () => orderLogs),
  };

  const watchlistApiService = {
    list: vi.fn(async () => watchlists),
    createWatchlist: vi.fn(async () => watchlists[0]),
    updateWatchlist: vi.fn(async () => watchlists[0]),
    deleteWatchlist: vi.fn(async () => undefined),
    addItem: vi.fn(async () => watchlists[0].items[0]),
    removeItem: vi.fn(async () => undefined),
  };

  const preferencesApiService = {
    getByPortfolio: vi.fn(async () => preferences),
    updateByPortfolio: vi.fn(async () => preferences),
  };

  let service: BackendDashboardStateService;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    sessionStorage.clear();

    portfolioApiService.ensureDefault.mockImplementation(async () => portfolio);
    holdingApiService.listByPortfolio.mockImplementation(async () => holdings);
    instrumentApiService.list.mockImplementation(async () => instruments);
    orderLogApiService.listByPortfolio.mockImplementation(async () => orderLogs);
    watchlistApiService.list.mockImplementation(async () => watchlists);
    preferencesApiService.getByPortfolio.mockImplementation(async () => preferences);
    preferencesApiService.updateByPortfolio.mockImplementation(async () => preferences);

    TestBed.configureTestingModule({
      providers: [
        BackendDashboardStateService,
        { provide: PortfolioApiService, useValue: portfolioApiService },
        { provide: HoldingApiService, useValue: holdingApiService },
        { provide: InstrumentApiService, useValue: instrumentApiService },
        { provide: OrderLogApiService, useValue: orderLogApiService },
        { provide: WatchlistApiService, useValue: watchlistApiService },
        { provide: PreferencesApiService, useValue: preferencesApiService },
      ],
    });

    service = TestBed.inject(BackendDashboardStateService);
  });

  it('loads backend dashboard cash, holdings, orders, transactions, and watchlist', async () => {
    await service.load();

    expect(service.loadState()).toBe('ready');
    expect(service.accountCash()).toBe(5000);
    expect(service.holdings()).toHaveLength(1);
    expect(service.holdings()[0]?.symbol).toBe('AAPL');
    expect(service.orders()).toHaveLength(1);
    expect(service.orders()[0]?.id).toBe('ord-open');

    expect(service.transactions()).toEqual([
      {
        id: 'ord-deposit',
        type: 'deposit',
        amount: 5000,
        method: 'bank_transfer',
        status: 'completed',
        createdAt: '2026-01-01T00:01:00.000Z',
      },
    ]);

    expect(service.watchlists()).toEqual([{ id: 'watchlist-1', name: 'My Watchlist', symbols: ['AAPL'] }]);
    expect(service.activeWatchlistId()).toBe('watchlist-1');
    expect(service.dashboardOpenOrders()).toEqual([]);
    expect(service.dashboardWidgets()).toEqual(preferences.dashboardWidgets);
    expect(service.backendWatchlistInstrumentOptions()).toEqual([
      {
        instrumentId: 'inst-aapl',
        symbol: 'AAPL',
        name: 'Apple',
        instrumentType: 'stock',
      },
      {
        instrumentId: 'inst-vod',
        symbol: 'VOD',
        name: 'Vodafone',
        instrumentType: 'stock',
      },
    ]);
  });

  it('sets loadState to error and clears fields when load fails', async () => {
    instrumentApiService.list.mockRejectedValueOnce(new Error('boom'));

    await service.load();

    expect(service.loadState()).toBe('error');
    expect(service.accountCash()).toBe(0);
    expect(service.holdings()).toEqual([]);
    expect(service.orders()).toEqual([]);
    expect(service.transactions()).toEqual([]);
    expect(service.watchlists()).toEqual([]);
    expect(service.activeWatchlistId()).toBe('');
    expect(service.dashboardOpenOrders()).toEqual([]);
    expect(service.dashboardWidgets()).toBeNull();
    expect(service.backendWatchlistInstrumentOptions()).toEqual([]);
  });

  it('adds and removes backend watchlist membership through watchlist API and reloads state', async () => {
    await service.load();

    await service.setWatchlistMembership('VOD', 'watchlist-1', true);
    expect(watchlistApiService.addItem).toHaveBeenCalledWith('watchlist-1', {
      instrumentId: 'inst-vod',
    });

    await service.setWatchlistMembership('AAPL', 'watchlist-1', false);
    expect(watchlistApiService.removeItem).toHaveBeenCalledWith('watchlist-1', 'wl-1');
    expect(service.loadState()).toBe('ready');
  });

  it('persists dashboard widgets to backend preferences and updates local signal', async () => {
    await service.load();

    const updatedPreferences = {
      ...preferences,
      dashboardWidgets: ['watchlist', 'portfolio-value', 'performance-graph'],
    };
    preferencesApiService.updateByPortfolio.mockResolvedValueOnce(updatedPreferences);

    await service.setDashboardWidgets(['watchlist', 'portfolio-value', 'performance-graph']);

    expect(preferencesApiService.updateByPortfolio).toHaveBeenCalledWith(portfolio.portfolioId, {
      dashboardWidgets: ['watchlist', 'portfolio-value', 'performance-graph'],
    });
    expect(service.dashboardWidgets()).toEqual(updatedPreferences.dashboardWidgets);
  });
});
