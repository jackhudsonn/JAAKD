import { TestBed } from '@angular/core/testing';
import { OrderLogResponse } from '@core/models/api.models';
import { InstrumentApiService } from '@core/services/instrument-api.service';
import { OrderLogApiService } from '@core/services/order-log-api.service';
import { PortfolioApiService } from '@core/services/portfolio-api.service';
import { BackendTransactStateService } from './backend-transact-state.service';

describe('BackendTransactStateService', () => {
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

  let orderLogs: OrderLogResponse[] = [
    {
      logOrderId: 'log-1',
      orderId: 'dep-1',
      portfolioId: portfolio.portfolioId,
      instrumentId: 'inst-cash',
      side: 'DEPOSIT' as const,
      quantity: 5000,
      timestamp: '2026-01-01T00:00:00.000Z',
      metadata: null,
      status: 'EXECUTED' as const,
      executionPrice: 0,
      quotedPrice: null,
    },
  ];

  const portfolioApiService = {
    ensureDefault: vi.fn(async () => portfolio),
  };

  const instrumentApiService = {
    list: vi.fn(async () => instruments),
  };

  const orderLogApiService = {
    listByPortfolio: vi.fn(async () => orderLogs),
    submit: vi.fn(async () => orderLogs[0]),
  };

  let service: BackendTransactStateService;

  beforeEach(() => {
    orderLogs = [
      {
        logOrderId: 'log-1',
        orderId: 'dep-1',
        portfolioId: portfolio.portfolioId,
        instrumentId: 'inst-cash',
        side: 'DEPOSIT',
        quantity: 5000,
        timestamp: '2026-01-01T00:00:00.000Z',
        metadata: null,
        status: 'EXECUTED',
        executionPrice: 0,
        quotedPrice: null,
      },
    ];

    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();

    portfolioApiService.ensureDefault.mockImplementation(async () => portfolio);
    instrumentApiService.list.mockImplementation(async () => instruments);
    orderLogApiService.listByPortfolio.mockImplementation(async () => orderLogs);
    orderLogApiService.submit.mockImplementation(async () => orderLogs[0]);

    TestBed.configureTestingModule({
      providers: [
        BackendTransactStateService,
        { provide: PortfolioApiService, useValue: portfolioApiService },
        { provide: InstrumentApiService, useValue: instrumentApiService },
        { provide: OrderLogApiService, useValue: orderLogApiService },
      ],
    });

    service = TestBed.inject(BackendTransactStateService);
  });

  it('loads backend transact state and maps transactions', async () => {
    await service.load();

    expect(service.loadState()).toBe('ready');
    expect(service.transactions()).toEqual([
      {
        id: 'dep-1',
        type: 'deposit',
        amount: 5000,
        method: 'bank_transfer',
        status: 'completed',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('sets error state and clears transactions when load fails', async () => {
    instrumentApiService.list.mockRejectedValueOnce(new Error('boom'));

    await service.load();

    expect(service.loadState()).toBe('error');
    expect(service.transactions()).toEqual([]);
  });

  it('submits DEPOSIT cash movement through order logs', async () => {
    const randomUuidSpy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('11111111-1111-1111-1111-111111111111');

    orderLogApiService.submit.mockImplementationOnce(async () => {
      orderLogs = [
        {
          logOrderId: 'log-deposit',
          orderId: '11111111-1111-1111-1111-111111111111',
          portfolioId: portfolio.portfolioId,
          instrumentId: 'inst-cash',
          side: 'DEPOSIT',
          quantity: 300,
          timestamp: '2026-01-01T01:00:00.000Z',
          metadata: null,
          status: 'EXECUTED',
          executionPrice: 0,
          quotedPrice: null,
        },
      ];

      return orderLogs[0];
    });

    await service.load();
    await service.submitCashMovement('DEPOSIT', 300);

    expect(orderLogApiService.submit).toHaveBeenCalledWith({
      orderId: '11111111-1111-1111-1111-111111111111',
      portfolioId: portfolio.portfolioId,
      instrumentId: 'inst-cash',
      side: 'DEPOSIT',
      quantity: 300,
    });
    expect(
      service.transactions().some((transaction) => transaction.id === '11111111-1111-1111-1111-111111111111'),
    ).toBe(true);

    randomUuidSpy.mockRestore();
  });

  it('polls until withdrawal reaches terminal status', async () => {
    vi.useFakeTimers();

    const randomUuidSpy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('22222222-2222-2222-2222-222222222222');

    let pollCount = 0;

    orderLogApiService.submit.mockImplementationOnce(async () => {
      orderLogs = [
        {
          logOrderId: 'log-withdraw-pending',
          orderId: '22222222-2222-2222-2222-222222222222',
          portfolioId: portfolio.portfolioId,
          instrumentId: 'inst-cash',
          side: 'WITHDRAW',
          quantity: 200,
          timestamp: '2026-01-01T02:00:00.000Z',
          metadata: null,
          status: 'PENDING',
          executionPrice: 0,
          quotedPrice: null,
        },
      ];

      return orderLogs[0];
    });

    orderLogApiService.listByPortfolio.mockImplementation(async () => {
      if (pollCount >= 2) {
        orderLogs = [
          {
            logOrderId: 'log-withdraw-executed',
            orderId: '22222222-2222-2222-2222-222222222222',
            portfolioId: portfolio.portfolioId,
            instrumentId: 'inst-cash',
            side: 'WITHDRAW',
            quantity: 200,
            timestamp: '2026-01-01T02:00:01.000Z',
            metadata: null,
            status: 'EXECUTED',
            executionPrice: 0,
            quotedPrice: null,
          },
        ];
      }

      pollCount += 1;
      return orderLogs;
    });

    await service.load();

    const movementPromise = service.submitCashMovement('WITHDRAW', 200);
    await vi.advanceTimersByTimeAsync(1000);
    await movementPromise;

    expect(service.transactions()[0]?.status).toBe('completed');

    randomUuidSpy.mockRestore();
  });

  it('stops polling silently when status stays pending', async () => {
    vi.useFakeTimers();

    const randomUuidSpy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('33333333-3333-3333-3333-333333333333');

    orderLogApiService.submit.mockImplementationOnce(async () => {
      orderLogs = [
        {
          logOrderId: 'log-withdraw-pending',
          orderId: '33333333-3333-3333-3333-333333333333',
          portfolioId: portfolio.portfolioId,
          instrumentId: 'inst-cash',
          side: 'WITHDRAW',
          quantity: 200,
          timestamp: '2026-01-01T03:00:00.000Z',
          metadata: null,
          status: 'PENDING',
          executionPrice: 0,
          quotedPrice: null,
        },
      ];

      return orderLogs[0];
    });

    await service.load();

    const movementPromise = service.submitCashMovement('WITHDRAW', 200);
    await vi.advanceTimersByTimeAsync(30000);

    await expect(movementPromise).resolves.toBeUndefined();
    expect(
      service.transactions().find((transaction) => transaction.id === '33333333-3333-3333-3333-333333333333')
        ?.status,
    ).toBe('pending');

    randomUuidSpy.mockRestore();
  });
});
