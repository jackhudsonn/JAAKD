import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { AuditorComponent } from './auditor.component';
import {
  AuditApiService,
  AuditOrderLogSearchRequest,
  AuditPageResponse,
  AuditPaging,
} from '@core/services/audit-api.service';
import { InstrumentApiService } from '@core/services/instrument-api.service';
import {
  HoldingResponse,
  InstrumentResponse,
  OrderLogResponse,
  PortfolioResponse,
} from '@core/models/api.models';

function page<T>(content: T[]): AuditPageResponse<T> {
  return {
    content,
    page: 0,
    size: 25,
    totalElements: content.length,
    totalPages: 1,
    hasNext: false,
  };
}

describe('AuditorComponent', () => {
  let component: AuditorComponent;

  const auditApiService = {
    searchUsers: vi.fn<(query?: string, paging?: AuditPaging) => Promise<AuditPageResponse<any>>>(
      async () => page([]),
    ),
    searchOrderLogs: vi.fn<(request: AuditOrderLogSearchRequest) => Promise<AuditPageResponse<OrderLogResponse>>>(
      async () => page([]),
    ),
    listUserPortfolios: vi.fn<(userId: string, paging?: AuditPaging) => Promise<AuditPageResponse<PortfolioResponse>>>(
      async () => page([]),
    ),
    listHoldings: vi.fn<(options?: AuditPaging & { userId?: string; portfolioId?: string; instrumentId?: string }) => Promise<AuditPageResponse<HoldingResponse>>>(
      async () => page([]),
    ),
    listUserHoldings: vi.fn<(userId: string, options?: AuditPaging & { portfolioId?: string; instrumentId?: string }) => Promise<AuditPageResponse<HoldingResponse>>>(
      async () => page([]),
    ),
    listHoldingOrderLogs: vi.fn<(holdingId: string, options?: AuditPaging & { fromDate?: string; toDate?: string }) => Promise<AuditPageResponse<OrderLogResponse>>>(
      async () => page([]),
    ),
    listHoldingPositionLots: vi.fn<(holdingId: string, paging?: AuditPaging) => Promise<AuditPageResponse<any>>>(
      async () => page([]),
    ),
    listHoldingLotMatches: vi.fn<(holdingId: string, paging?: AuditPaging) => Promise<AuditPageResponse<any>>>(
      async () => page([]),
    ),
  };

  const instrumentApiService = {
    list: vi.fn<() => Promise<InstrumentResponse[]>>(async () => []),
  };

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

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

  it('loads users and summaries during initialization', async () => {
    auditApiService.searchUsers.mockResolvedValueOnce(page([{ userId: 'u1', email: 'a@b.com', username: null, firstName: null, lastName: null }]));
    auditApiService.searchOrderLogs.mockResolvedValueOnce(page([]));
    auditApiService.listHoldings.mockResolvedValueOnce(page([]));

    await component.initialize();

    expect(auditApiService.searchUsers).toHaveBeenCalledWith(undefined, { page: 0, size: 100 });
    expect(auditApiService.searchOrderLogs).toHaveBeenCalled();
    expect(auditApiService.listHoldings).toHaveBeenCalled();
    expect(component.users()).toHaveLength(1);
  });

  it('applies unified filters and uses user-scoped holdings when user is selected', async () => {
    component.users.set([
      { userId: 'user-1', email: 'auditor@example.com', username: null, firstName: 'Audit', lastName: 'User' },
    ]);
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
    ]);

    auditApiService.listUserPortfolios.mockResolvedValueOnce(page([{ portfolioId: 'portfolio-1', portfolioName: 'Main' }]));
    auditApiService.searchOrderLogs.mockResolvedValueOnce(page([]));
    auditApiService.listUserHoldings.mockResolvedValueOnce(page([]));

    component.userInput.set('auditor@example.com (Audit User)');
    component.instrumentInput.set('AAPL - Apple Inc (EQUITY)');
    component.fromDate.set('2026-10-01');
    component.toDate.set('2026-10-14');

    await component.applyFilters();

    expect(auditApiService.listUserPortfolios).toHaveBeenCalledWith('user-1', { page: 0, size: 100 });
    expect(auditApiService.searchOrderLogs).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      instrumentId: 'instrument-1',
      fromDate: '2026-10-01',
      toDate: '2026-10-14',
    }));
    expect(auditApiService.listUserHoldings).toHaveBeenCalled();
  });

  it('loads three detail cards when selecting a holding', async () => {
    auditApiService.listHoldingOrderLogs.mockResolvedValueOnce(page([
      {
        logOrderId: 'log-1',
        orderId: 'order-1',
        portfolioId: 'portfolio-1',
        instrumentId: 'instrument-1',
        side: 'BUY',
        quantity: 1,
        timestamp: '2026-10-14T10:00:00Z',
        metadata: null,
        status: 'EXECUTED',
        executionPrice: 100,
        quotedPrice: 99,
      },
    ]));
    auditApiService.listHoldingPositionLots.mockResolvedValueOnce(page([
      {
        positionLotId: 'lot-1',
        holdingId: 'holding-1',
        sourceBuyLogOrderId: 'buy-log-1',
        openedAt: '2026-10-14T00:00:00Z',
        originalQuantity: 1,
        remainingQuantity: 1,
        unitCost: 100,
      },
    ]));
    auditApiService.listHoldingLotMatches.mockResolvedValueOnce(page([
      {
        lotMatchId: 'match-1',
        sellLogOrderId: 'sell-1',
        positionLotId: 'lot-1',
        matchedQuantity: 1,
        sellUnitPrice: 101,
        realizedPnlAmount: 1,
        matchedAt: '2026-10-14T00:00:00Z',
      },
    ]));

    await component.selectHolding('holding-1');

    expect(auditApiService.listHoldingOrderLogs).toHaveBeenCalledWith('holding-1', expect.objectContaining({ page: 0, size: 25 }));
    expect(auditApiService.listHoldingPositionLots).toHaveBeenCalledWith('holding-1', { page: 0, size: 25 });
    expect(auditApiService.listHoldingLotMatches).toHaveBeenCalledWith('holding-1', { page: 0, size: 25 });
    expect(component.holdingOrderLogs()).toHaveLength(1);
    expect(component.positionLots()).toHaveLength(1);
    expect(component.lotMatches()).toHaveLength(1);
  });

  it('builds order summaries from loaded rows', () => {
    component.orderRows.set([
      {
        logOrderId: 'log-1',
        orderId: 'order-1',
        portfolioId: 'portfolio-1',
        instrumentId: 'instrument-1',
        side: 'BUY',
        quantity: 1,
        timestamp: '2026-10-14T10:00:00Z',
        metadata: null,
        status: 'SUBMITTED',
        executionPrice: 0,
        quotedPrice: 99,
      },
      {
        logOrderId: 'log-2',
        orderId: 'order-1',
        portfolioId: 'portfolio-1',
        instrumentId: 'instrument-1',
        side: 'BUY',
        quantity: 1,
        timestamp: '2026-10-14T10:10:00Z',
        metadata: null,
        status: 'EXECUTED',
        executionPrice: 100,
        quotedPrice: 99,
      },
    ]);

    const summaries = component.orderSummaries();

    expect(summaries).toHaveLength(1);
    expect(summaries[0].orderId).toBe('order-1');
    expect(summaries[0].status).toBe('EXECUTED');
    expect(summaries[0].executionPrice).toBe(100);
  });

  it('shows backend 503 diagnostic details when provided', async () => {
    auditApiService.searchOrderLogs.mockRejectedValueOnce(new HttpErrorResponse({
      status: 503,
      error: {
        message: 'Database error',
        details: {
          type: 'db_schema_mismatch',
          hint: 'Convert affected columns to TEXT.',
          cause: 'function upper(bytea) does not exist',
        },
      },
    }));
    auditApiService.listHoldings.mockResolvedValueOnce(page([]));

    await component.refreshSummaries();

    expect(component.errorMessage()).toContain('Database error (db_schema_mismatch): Convert affected columns to TEXT. Cause: function upper(bytea) does not exist');
  });
});
