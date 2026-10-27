import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { AuditorComponent } from './auditor.component';
import { ToastService } from '@shared/components/toast/toast.service';
import {
  AuditApiService,
  AuditHoldingResponse,
  AuditOrderLogResponse,
  AuditOrderLogSearchRequest,
  AuditPageResponse,
  AuditPaging,
} from '@core/services/audit-api.service';
import { InstrumentApiService } from '@core/services/instrument-api.service';
import { InstrumentResponse, PortfolioResponse } from '@core/models/api.models';

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

function orderLog(overrides: Partial<AuditOrderLogResponse> = {}): AuditOrderLogResponse {
  return {
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
    ownerUserId: 'user-1',
    ownerFirstName: 'Ada',
    ownerLastName: 'Lovelace',
    ...overrides,
  };
}

describe('AuditorComponent', () => {
  let fixture: ComponentFixture<AuditorComponent>;
  let component: AuditorComponent;

  const auditApiService = {
    searchUsers: vi.fn<(query?: string, paging?: AuditPaging) => Promise<AuditPageResponse<any>>>(
      async () => page([]),
    ),
    searchOrderLogs: vi.fn<
      (request: AuditOrderLogSearchRequest) => Promise<AuditPageResponse<AuditOrderLogResponse>>
    >(async () => page([])),
    listUserPortfolios: vi.fn<
      (userId: string, paging?: AuditPaging) => Promise<AuditPageResponse<PortfolioResponse>>
    >(async () => page([])),
    listHoldings: vi.fn<
      (
        options?: AuditPaging & { userId?: string; portfolioId?: string; instrumentId?: string },
      ) => Promise<AuditPageResponse<AuditHoldingResponse>>
    >(async () => page([])),
    listUserHoldings: vi.fn<
      (
        userId: string,
        options?: AuditPaging & { portfolioId?: string; instrumentId?: string },
      ) => Promise<AuditPageResponse<AuditHoldingResponse>>
    >(async () => page([])),
    listHoldingOrderLogs: vi.fn<
      (
        holdingId: string,
        options?: AuditPaging & { fromDate?: string; toDate?: string },
      ) => Promise<AuditPageResponse<AuditOrderLogResponse>>
    >(async () => page([])),
    listHoldingPositionLots: vi.fn<
      (holdingId: string, paging?: AuditPaging) => Promise<AuditPageResponse<any>>
    >(async () => page([])),
    listHoldingLotMatches: vi.fn<
      (holdingId: string, paging?: AuditPaging) => Promise<AuditPageResponse<any>>
    >(async () => page([])),
  };

  const instrumentApiService = {
    list: vi.fn<() => Promise<InstrumentResponse[]>>(async () => []),
  };

  const toastService = {
    success: vi.fn<(text: string) => number>(() => 1),
    error: vi.fn<(text: string) => number>(() => 1),
  };

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [AuditorComponent],
      providers: [
        { provide: AuditApiService, useValue: auditApiService },
        { provide: InstrumentApiService, useValue: instrumentApiService },
        { provide: ToastService, useValue: toastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads users and summaries during initialization', async () => {
    auditApiService.searchUsers.mockResolvedValueOnce(
      page([{ userId: 'u1', email: 'a@b.com', username: null, firstName: null, lastName: null }]),
    );
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
      {
        userId: 'user-1',
        email: 'auditor@example.com',
        username: null,
        firstName: 'Audit',
        lastName: 'User',
      },
    ]);
    component.instruments.set([
      {
        instrumentId: 'instrument-1',
        ticker: 'AAPL',
        market: 'NASDAQ',
        name: 'Apple Inc',
        instrumentClass: 'EQUITY',
        tradingCurrency: 'USD',
        logoUrl: null,
        description: null,
      },
    ]);

    auditApiService.listUserPortfolios.mockResolvedValueOnce(
      page([{ portfolioId: 'portfolio-1', portfolioName: 'Main' }]),
    );
    auditApiService.searchOrderLogs.mockResolvedValueOnce(page([]));
    auditApiService.listUserHoldings.mockResolvedValueOnce(page([]));

    component.userInput.set('auditor@example.com (Audit User)');
    component.instrumentInput.set('AAPL - Apple Inc (EQUITY)');
    component.fromDate.set('2026-10-01');
    component.toDate.set('2026-10-14');

    await component.applyFilters();

    expect(auditApiService.listUserPortfolios).toHaveBeenCalledWith('user-1', {
      page: 0,
      size: 100,
    });
    expect(auditApiService.searchOrderLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        instrumentId: 'instrument-1',
        fromDate: '2026-10-01',
        toDate: '2026-10-14',
      }),
    );
    expect(auditApiService.listUserHoldings).toHaveBeenCalled();
  });

  it('loads three detail cards when selecting a holding', async () => {
    auditApiService.listHoldingOrderLogs.mockResolvedValueOnce(
      page([
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
          ownerUserId: 'user-1',
          ownerFirstName: 'Ada',
          ownerLastName: 'Lovelace',
        },
      ]),
    );
    auditApiService.listHoldingPositionLots.mockResolvedValueOnce(
      page([
        {
          positionLotId: 'lot-1',
          holdingId: 'holding-1',
          sourceBuyLogOrderId: 'buy-log-1',
          openedAt: '2026-10-14T00:00:00Z',
          originalQuantity: 1,
          remainingQuantity: 1,
          unitCost: 100,
        },
      ]),
    );
    auditApiService.listHoldingLotMatches.mockResolvedValueOnce(
      page([
        {
          lotMatchId: 'match-1',
          sellLogOrderId: 'sell-1',
          positionLotId: 'lot-1',
          matchedQuantity: 1,
          sellUnitPrice: 101,
          realizedPnlAmount: 1,
          matchedAt: '2026-10-14T00:00:00Z',
        },
      ]),
    );

    await component.selectHolding('holding-1');

    expect(auditApiService.listHoldingOrderLogs).toHaveBeenCalledWith(
      'holding-1',
      expect.objectContaining({ page: 0, size: 20 }),
    );
    expect(auditApiService.listHoldingPositionLots).toHaveBeenCalledWith('holding-1', {
      page: 0,
      size: 20,
    });
    expect(auditApiService.listHoldingLotMatches).toHaveBeenCalledWith('holding-1', {
      page: 0,
      size: 20,
    });
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
        ownerUserId: 'user-1',
        ownerFirstName: 'Ada',
        ownerLastName: 'Lovelace',
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
        ownerUserId: 'user-1',
        ownerFirstName: 'Ada',
        ownerLastName: 'Lovelace',
      },
    ]);

    const summaries = component.orderSummaries();

    expect(summaries).toHaveLength(1);
    expect(summaries[0].orderId).toBe('order-1');
    expect(summaries[0].status).toBe('EXECUTED');
    expect(summaries[0].executionPrice).toBe(100);
    expect(summaries[0].ownerName).toBe('Ada Lovelace');
  });

  it('formats owner names from first and last name, falling back to user id', () => {
    expect(
      component.formatOwnerName({
        ownerUserId: 'user-1',
        ownerFirstName: 'Ada',
        ownerLastName: 'Lovelace',
      }),
    ).toBe('Ada Lovelace');
    expect(
      component.formatOwnerName({
        ownerUserId: 'user-1',
        ownerFirstName: null,
        ownerLastName: null,
      }),
    ).toBe('user-1');
    expect(
      component.formatOwnerName({ ownerUserId: null, ownerFirstName: null, ownerLastName: null }),
    ).toBe('Unknown');
  });

  it('shows only the backend message for 503 errors', async () => {
    auditApiService.searchOrderLogs.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 503,
        error: {
          message: 'The service is temporarily unavailable. Please try again later.',
          details: {
            cause: 'function upper(bytea) does not exist',
          },
        },
      }),
    );
    auditApiService.listHoldings.mockResolvedValueOnce(page([]));

    await component.refreshSummaries();

    expect(toastService.error).toHaveBeenLastCalledWith(
      'The service is temporarily unavailable. Please try again later.',
    );
  });

  it('shows a success toast after loading summaries', async () => {
    auditApiService.searchOrderLogs.mockResolvedValueOnce(page([orderLog()]));
    auditApiService.listHoldings.mockResolvedValueOnce(page([]));

    await component.refreshSummaries();

    expect(toastService.success).toHaveBeenLastCalledWith('Loaded 1 order rows and 0 holdings.');
  });

  it('shows a success toast after loading holding details', async () => {
    await component.selectHolding('holding-1');

    expect(toastService.success).toHaveBeenLastCalledWith(
      'Loaded 0 order logs, 0 position lots, and 0 lot matches.',
    );
  });

  it('shows the fallback error toast when the error has no message', async () => {
    auditApiService.listHoldingOrderLogs.mockRejectedValueOnce(new Error('network down'));

    await component.selectHolding('holding-1');

    expect(toastService.error).toHaveBeenLastCalledWith('Failed to load holding details.');
  });

  it('shows the quoted price next to the execution price, rounded to the cent', () => {
    component.selectedOrderId.set('order-1');
    component.selectedOrderLogs.set([
      orderLog({ executionPrice: 100.456, quotedPrice: 99.5 }),
      orderLog({ logOrderId: 'log-2', status: 'SUBMITTED', quotedPrice: null }),
    ]);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const lifecycleTable = [...element.querySelectorAll('section.panel')]
      .find((panel) => panel.querySelector('h2')?.textContent?.includes('Order Lifecycle Logs'))!
      .querySelector('table')!;
    const headers = [...lifecycleTable.querySelectorAll('th')].map((th) => th.textContent?.trim());
    const rows = [...lifecycleTable.querySelectorAll('tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent?.trim()),
    );

    const executionIndex = headers.indexOf('Execution Price');
    expect(headers[executionIndex + 1]).toBe('Quoted Price');
    expect(rows[0][executionIndex]).toBe('100.46');
    expect(rows[0][executionIndex + 1]).toBe('99.50');
    expect(rows[1][executionIndex + 1]).toBe('N/A');
  });
});
