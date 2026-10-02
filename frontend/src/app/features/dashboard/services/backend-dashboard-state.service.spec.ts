import { describe, expect, it, vi } from 'vitest';
import { BackendDashboardStateService } from './backend-dashboard-state.service';
import { PortfolioApiService } from '@core/services/portfolio-api.service';
import { HoldingApiService } from '@core/services/holding-api.service';
import { InstrumentApiService } from '@core/services/instrument-api.service';
import { OrderLogApiService } from '@core/services/order-log-api.service';
import { DashboardMarketDataPort } from './dashboard-market-data.port';

const createService = () => {
  const portfolioApiService = {
    ensureDefault: vi.fn(),
  } as unknown as PortfolioApiService;

  const holdingApiService = {
    listByPortfolio: vi.fn(),
  } as unknown as HoldingApiService;

  const instrumentApiService = {
    list: vi.fn(),
  } as unknown as InstrumentApiService;

  const orderLogApiService = {
    listByPortfolio: vi.fn(),
  } as unknown as OrderLogApiService;

  const marketData = {
    isKnownSymbol: vi.fn(),
    getPrice: vi.fn(),
  } as unknown as DashboardMarketDataPort;

  const service = new BackendDashboardStateService(
    portfolioApiService,
    holdingApiService,
    instrumentApiService,
    orderLogApiService,
    marketData,
  );

  return {
    service,
    portfolioApiService,
    holdingApiService,
    instrumentApiService,
    orderLogApiService,
    marketData,
  };
};

describe('BackendDashboardStateService', () => {
  it('load sets backend-backed cash, holdings and open orders on success', async () => {
    const {
      service,
      portfolioApiService,
      holdingApiService,
      instrumentApiService,
      orderLogApiService,
      marketData,
    } = createService();

    (marketData.isKnownSymbol as ReturnType<typeof vi.fn>).mockImplementation(
      (symbol: string) => symbol === 'AAPL',
    );
    (marketData.getPrice as ReturnType<typeof vi.fn>).mockReturnValue(220);

    (portfolioApiService.ensureDefault as ReturnType<typeof vi.fn>).mockResolvedValue({
      portfolioId: 'p-1',
      portfolioName: 'Main',
    });

    (holdingApiService.listByPortfolio as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        holdingID: 'h-cash',
        portfolioID: 'p-1',
        instrumentID: 'i-cash',
        currentQuantity: 2500,
        cumulativeRealizedPnl: 0,
        updatedAt: '2026-10-01T00:00:00Z',
      },
      {
        holdingID: 'h-stock',
        portfolioID: 'p-1',
        instrumentID: 'i-stock',
        currentQuantity: 3,
        cumulativeRealizedPnl: 0,
        updatedAt: '2026-10-01T00:00:00Z',
      },
    ]);

    (instrumentApiService.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        instrumentId: 'i-cash',
        ticker: 'USD_CASH',
        market: 'CASH',
        name: 'US Dollar Cash',
        instrumentClass: 'USD',
        logoUrl: null,
        description: null,
      },
      {
        instrumentId: 'i-stock',
        ticker: 'AAPL',
        market: 'NASDAQ',
        name: 'Apple Inc.',
        instrumentClass: 'EQUITY',
        logoUrl: null,
        description: null,
      },
    ]);

    (orderLogApiService.listByPortfolio as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        logOrderId: 'l-1',
        orderId: 'o-1',
        portfolioId: 'p-1',
        instrumentId: 'i-stock',
        side: 'BUY',
        quantity: 2,
        timestamp: '2026-10-01T10:00:00Z',
        metadata: null,
        status: 'SUBMITTED',
        executionPrice: 0,
      },
      {
        logOrderId: 'l-2',
        orderId: 'o-1',
        portfolioId: 'p-1',
        instrumentId: 'i-stock',
        side: 'BUY',
        quantity: 2,
        timestamp: '2026-10-01T10:01:00Z',
        metadata: null,
        status: 'ACCEPTED',
        executionPrice: 0,
      },
    ]);

    await service.load();

    expect(service.loadState()).toBe('ready');
    expect(service.backendDataMode).toBe(true);
    expect(service.returns).toEqual({ allTime: 0, daily: 0 });
    expect(service.accountCash()).toBe(2500);
    expect(service.holdings()).toEqual([
      {
        symbol: 'AAPL',
        instrumentType: 'stock',
        quantity: 3,
        indicativePrice: 220,
        priceStatus: 'available',
      },
    ]);
    expect(service.orders()).toEqual([
      {
        id: 'o-1',
        symbol: 'AAPL',
        instrumentType: 'stock',
        kind: 'market',
        type: 'buy',
        quantity: 2,
        status: 'open',
        createdAt: '2026-10-01T10:00:00Z',
      },
    ]);
  });

  it('load sets error and clears backend-driven data when an API call fails', async () => {
    const { service, portfolioApiService } = createService();

    service.accountCash.set(99);
    service.holdings.set([{ symbol: 'OLD', instrumentType: 'stock', quantity: 1 }]);
    service.orders.set([
      {
        id: 'old-order',
        symbol: 'OLD',
        instrumentType: 'stock',
        kind: 'market',
        type: 'buy',
        quantity: 1,
        status: 'pending',
        createdAt: '2026-10-01T00:00:00Z',
      },
    ]);

    (portfolioApiService.ensureDefault as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('boom'),
    );

    await service.load();

    expect(service.loadState()).toBe('error');
    expect(service.accountCash()).toBe(0);
    expect(service.holdings()).toEqual([]);
    expect(service.orders()).toEqual([]);
  });
});
