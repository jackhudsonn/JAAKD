import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { AuditorComponent } from './auditor.component';
import {
  AuditApiService,
  AuditOrderLogSearchRequest,
  AuditPaging,
} from '@core/services/audit-api.service';
import { InstrumentApiService } from '@core/services/instrument-api.service';
import {
  OrderLogResponse,
  PortfolioResponse,
  HoldingResponse,
  InstrumentResponse,
} from '@core/models/api.models';

describe('AuditorComponent', () => {
  let component: AuditorComponent;
  const auditApiService = {
    searchUsers: vi.fn<
      (query: string, paging?: AuditPaging) => Promise<Array<{ userId: string; email: string; username: string | null; firstName: string | null; lastName: string | null }>>
    >(async () => []),
    searchOrderLogs: vi.fn<(request: AuditOrderLogSearchRequest) => Promise<OrderLogResponse[]>>(
      async () => [],
    ),
    listUserPortfolios: vi.fn<(userId: string, paging?: AuditPaging) => Promise<PortfolioResponse[]>>(
      async () => [],
    ),
    listUserHoldings: vi.fn<
      (userId: string, options?: AuditPaging & { portfolioId?: string }) => Promise<HoldingResponse[]>
    >(async () => []),
    listHoldingPositionLots: vi.fn<(holdingId: string, paging?: AuditPaging) => Promise<any[]>>(
      async () => [],
    ),
    listHoldingLotMatches: vi.fn<(holdingId: string, paging?: AuditPaging) => Promise<any[]>>(
      async () => [],
    ),
  };

  const instrumentApiService = {
    list: vi.fn<() => Promise<InstrumentResponse[]>>(async () => []),
  };

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    auditApiService.searchUsers.mockImplementation(async () => []);
    auditApiService.searchOrderLogs.mockImplementation(async () => []);
    auditApiService.listUserPortfolios.mockImplementation(async () => []);
    auditApiService.listUserHoldings.mockImplementation(async () => []);
    auditApiService.listHoldingPositionLots.mockImplementation(async () => []);
    auditApiService.listHoldingLotMatches.mockImplementation(async () => []);
    instrumentApiService.list.mockImplementation(async () => []);

    await TestBed.configureTestingModule({
      imports: [AuditorComponent],
      providers: [
        { provide: AuditApiService, useValue: auditApiService },
        { provide: InstrumentApiService, useValue: instrumentApiService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AuditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads instruments on init for instrument picker', async () => {
    instrumentApiService.list.mockResolvedValueOnce([
      {
        instrumentId: 'instrument-1',
        ticker: 'AAPL',
        market: 'NASDAQ',
        name: 'Apple Inc',
        instrumentClass: 'EQUITY',
        logoUrl: null,
        description: null,
      },
    ]);

    await component.loadInstruments();

    expect(instrumentApiService.list).toHaveBeenCalled();
    expect(component.instruments()).toHaveLength(1);
    expect(component.instruments()[0].ticker).toBe('AAPL');
  });

  it('filters instruments by ticker or name for the instrument picker', async () => {
    component.instruments.set([
      {
        instrumentId: 'instrument-1',
        ticker: 'AAPL',
        market: 'NASDAQ',
        name: 'Apple Inc',
        instrumentClass: 'EQUITY',
        logoUrl: null,
        description: null,
      },
      {
        instrumentId: 'instrument-2',
        ticker: 'MSFT',
        market: 'NASDAQ',
        name: 'Microsoft Corp',
        instrumentClass: 'EQUITY',
        logoUrl: null,
        description: null,
      },
    ]);

    component.instrumentPickerQuery.set('app');
    expect(component.filteredInstruments()).toHaveLength(1);
    expect(component.filteredInstruments()[0].ticker).toBe('AAPL');

    component.instrumentPickerQuery.set('soft');
    expect(component.filteredInstruments()).toHaveLength(1);
    expect(component.filteredInstruments()[0].ticker).toBe('MSFT');
  });

  it('requires non-empty query for user search', async () => {
    component.userSearchForm.set({ query: '   ', page: 0, size: 25 });

    await component.searchUsers();

    expect(component.errorMessage()).toBe('Query is required for user search.');
    expect(auditApiService.searchUsers).not.toHaveBeenCalled();
  });

  it('allows order-log search without date', async () => {
    component.orderLogForm.set({
      ...component.orderLogForm(),
      date: '',
      page: 0,
      size: 25,
    });

    await component.searchOrderLogs();

    expect(auditApiService.searchOrderLogs).toHaveBeenCalledWith({
      date: undefined,
      userId: undefined,
      status: undefined,
      ticker: undefined,
      instrumentId: undefined,
      instrumentType: undefined,
      page: 0,
      size: 25,
    });
  });

  it('passes instrumentId filter for order-log search', async () => {
    component.orderLogForm.set({
      ...component.orderLogForm(),
      date: '2026-10-14',
      instrumentId: ' instrument-123 ',
      page: 0,
      size: 25,
    });

    await component.searchOrderLogs();

    expect(auditApiService.searchOrderLogs).toHaveBeenCalledWith({
      date: '2026-10-14',
      userId: undefined,
      status: undefined,
      ticker: undefined,
      instrumentId: 'instrument-123',
      instrumentType: undefined,
      page: 0,
      size: 25,
    });
  });

  it('clears dependent drilldown state when selecting a new user', async () => {
    auditApiService.listUserPortfolios.mockResolvedValueOnce([
      { portfolioId: 'portfolio-1', portfolioName: 'Primary' },
    ]);
    auditApiService.listUserHoldings.mockResolvedValueOnce([
      {
        holdingID: 'holding-1',
        portfolioID: 'portfolio-1',
        instrumentID: 'instrument-1',
        currentQuantity: 10,
        cumulativeRealizedPnl: 0,
        updatedAt: '2026-10-14T00:00:00Z',
      },
    ]);

    component.selectedPortfolioId.set('old-portfolio');
    component.selectedHoldingId.set('old-holding');
    component.positionLots.set([
      {
        positionLotId: 'lot-1',
        holdingId: 'old-holding',
        sourceBuyLogOrderId: 'buy-log-1',
        openedAt: '2026-10-14T00:00:00Z',
        originalQuantity: 5,
        remainingQuantity: 3,
        unitCost: 10,
      },
    ]);
    component.lotMatches.set([
      {
        lotMatchId: 'match-1',
        sellLogOrderId: 'sell-log-1',
        positionLotId: 'lot-1',
        matchedQuantity: 2,
        sellUnitPrice: 11,
        realizedPnlAmount: 2,
        matchedAt: '2026-10-14T00:00:00Z',
      },
    ]);

    await component.selectUser('user-1');

    expect(component.selectedUserId()).toBe('user-1');
    expect(component.selectedPortfolioId()).toBe('');
    expect(component.selectedHoldingId()).toBe('');
    expect(component.positionLots()).toEqual([]);
    expect(component.lotMatches()).toEqual([]);
    expect(component.portfolios()).toHaveLength(1);
    expect(component.holdings()).toHaveLength(1);
  });

  it('groups order logs by order id and sorts each group by timestamp ascending', () => {
    component.orderLogs.set([
      {
        logOrderId: 'log-2',
        orderId: 'order-a',
        portfolioId: 'portfolio-1',
        instrumentId: 'instrument-1',
        side: 'BUY',
        quantity: 2,
        timestamp: '2026-10-14T10:10:00Z',
        metadata: null,
        status: 'EXECUTED',
        executionPrice: 100,
        quotedPrice: 99,
      },
      {
        logOrderId: 'log-1',
        orderId: 'order-a',
        portfolioId: 'portfolio-1',
        instrumentId: 'instrument-1',
        side: 'BUY',
        quantity: 2,
        timestamp: '2026-10-14T10:00:00Z',
        metadata: null,
        status: 'SUBMITTED',
        executionPrice: 0,
        quotedPrice: 99,
      },
      {
        logOrderId: 'log-3',
        orderId: 'order-b',
        portfolioId: 'portfolio-1',
        instrumentId: 'instrument-2',
        side: 'SELL',
        quantity: 1,
        timestamp: '2026-10-14T10:20:00Z',
        metadata: null,
        status: 'ACCEPTED',
        executionPrice: 0,
        quotedPrice: null,
      },
    ]);

    const groups = component.lifecycleOrders();

    expect(groups).toHaveLength(2);
    expect(groups[0].orderId).toBe('order-b');
    expect(groups[1].orderId).toBe('order-a');
    expect(groups[1].rows.map((row) => row.logOrderId)).toEqual(['log-1', 'log-2']);
    expect(groups[1].latestStatus).toBe('EXECUTED');
  });

  it('records diagnostics after successful user search', async () => {
    auditApiService.searchUsers.mockResolvedValueOnce([
      {
        userId: 'user-1',
        email: 'auditor@example.com',
        username: 'auditor',
        firstName: 'Audit',
        lastName: 'User',
      },
    ]);

    component.userSearchForm.set({ query: 'auditor', page: 1, size: 10 });
    await component.searchUsers();

    const diagnostics = component.lastRequest();
    expect(diagnostics).not.toBeNull();
    expect(diagnostics?.action).toBe('searchUsers');
    expect(diagnostics?.endpoint).toBe('/api/audit/users');
    expect(diagnostics?.statusCode).toBe(200);
    expect(diagnostics?.rowsLoaded).toBe(1);
    expect(diagnostics?.params).toEqual({ query: 'auditor', page: 1, size: 10 });
  });

  it('records diagnostics status code when order-log search fails', async () => {
    auditApiService.searchOrderLogs.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 403,
        error: { message: 'Admin or auditor user type is required' },
      }),
    );

    component.orderLogForm.set({
      ...component.orderLogForm(),
      date: '2026-10-14',
      userId: '',
      status: '',
      ticker: '',
      instrumentId: '',
      instrumentType: '',
      page: 0,
      size: 25,
    });

    await component.searchOrderLogs();

    const diagnostics = component.lastRequest();
    expect(diagnostics).not.toBeNull();
    expect(diagnostics?.action).toBe('searchOrderLogs');
    expect(diagnostics?.endpoint).toBe('/api/audit/order-logs');
    expect(diagnostics?.statusCode).toBe(403);
    expect(diagnostics?.rowsLoaded).toBeNull();
    expect(component.errorMessage()).toBe('Admin or auditor user type is required');
  });
});
