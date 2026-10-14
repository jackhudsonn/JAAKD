import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  HoldingResponse,
  InstrumentClass,
  OrderLogResponse,
  OrderStatus,
  PortfolioResponse,
} from '@core/models/api.models';
import {
  AuditApiService,
  AuditUserSearchResponse,
  LotMatchResponse,
  PositionLotResponse,
} from '@core/services/audit-api.service';

interface LifecycleOrder {
  orderId: string;
  rows: OrderLogResponse[];
  latestStatus: OrderStatus;
  latestTimestamp: string;
}

interface RequestDiagnostics {
  action: string;
  endpoint: string;
  params: Record<string, string | number | undefined>;
  statusCode: number | null;
  rowsLoaded: number | null;
  happenedAt: string;
}

@Component({
  selector: 'app-auditor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auditor.component.html',
  styleUrl: './auditor.component.css',
})
export class AuditorComponent {
  private readonly auditApi = inject(AuditApiService);

  readonly users = signal<AuditUserSearchResponse[]>([]);
  readonly portfolios = signal<PortfolioResponse[]>([]);
  readonly holdings = signal<HoldingResponse[]>([]);
  readonly positionLots = signal<PositionLotResponse[]>([]);
  readonly lotMatches = signal<LotMatchResponse[]>([]);
  readonly orderLogs = signal<OrderLogResponse[]>([]);

  readonly selectedUserId = signal('');
  readonly selectedPortfolioId = signal('');
  readonly selectedHoldingId = signal('');

  readonly loadingUsers = signal(false);
  readonly loadingDrilldown = signal(false);
  readonly loadingOrderLogs = signal(false);

  readonly statusMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly lastRequest = signal<RequestDiagnostics | null>(null);

  readonly showRawOrderRows = signal(false);

  readonly userSearchForm = signal({
    query: '',
    page: 0,
    size: 25,
  });

  readonly drilldownForm = signal({
    page: 0,
    size: 25,
  });

  readonly orderLogForm = signal({
    date: this.todayString(),
    userId: '',
    status: '' as '' | OrderStatus,
    ticker: '',
    instrumentType: '' as '' | InstrumentClass,
    page: 0,
    size: 25,
  });

  readonly selectedUser = computed(() =>
    this.users().find((user) => user.userId === this.selectedUserId()) ?? null,
  );

  readonly lifecycleOrders = computed<LifecycleOrder[]>(() => {
    const grouped = new Map<string, OrderLogResponse[]>();

    for (const row of this.orderLogs()) {
      const current = grouped.get(row.orderId);
      if (current) {
        current.push(row);
      } else {
        grouped.set(row.orderId, [row]);
      }
    }

    return [...grouped.entries()]
      .map(([orderId, rows]) => {
        const ascRows = [...rows].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        const latest = ascRows[ascRows.length - 1];

        return {
          orderId,
          rows: ascRows,
          latestStatus: latest.status,
          latestTimestamp: latest.timestamp,
        };
      })
      .sort((a, b) => new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime());
  });

  async searchUsers() {
    const form = this.userSearchForm();
    const query = form.query.trim();

    if (!query) {
      this.errorMessage.set('Query is required for user search.');
      return;
    }

    if (!this.validatePaging(form.page, form.size)) {
      return;
    }

    this.clearMessages();
    this.loadingUsers.set(true);

    try {
      const users = await this.auditApi.searchUsers(query, { page: form.page, size: form.size });
      this.users.set(users);
      this.recordRequest('searchUsers', '/api/audit/users', {
        query,
        page: form.page,
        size: form.size,
      }, 200, users.length);
      this.statusMessage.set(`Loaded ${users.length} users.`);

      if (!users.some((user) => user.userId === this.selectedUserId())) {
        this.resetDrilldownState();
      }
    } catch (error) {
      this.recordRequest('searchUsers', '/api/audit/users', {
        query,
        page: form.page,
        size: form.size,
      }, this.resolveStatusCode(error), null);
      this.handleError(error, 'Failed to search users.');
    } finally {
      this.loadingUsers.set(false);
    }
  }

  async selectUser(userId: string) {
    this.selectedUserId.set(userId);
    this.selectedPortfolioId.set('');
    this.selectedHoldingId.set('');
    this.positionLots.set([]);
    this.lotMatches.set([]);

    await this.loadUserDrilldown();
  }

  async loadUserDrilldown() {
    const userId = this.selectedUserId();
    if (!userId) {
      this.errorMessage.set('Select a user to load portfolios and holdings.');
      return;
    }

    const paging = this.drilldownForm();
    if (!this.validatePaging(paging.page, paging.size)) {
      return;
    }

    this.clearMessages();
    this.loadingDrilldown.set(true);

    try {
      const [portfolios, holdings] = await Promise.all([
        this.auditApi.listUserPortfolios(userId, { page: paging.page, size: paging.size }),
        this.auditApi.listUserHoldings(userId, {
          portfolioId: this.selectedPortfolioId() || undefined,
          page: paging.page,
          size: paging.size,
        }),
      ]);

      this.portfolios.set(portfolios);
      this.holdings.set(holdings);
      this.recordRequest(
        'loadUserDrilldown',
        '/api/audit/users/{userId}/portfolios + /api/audit/users/{userId}/holdings',
        {
          userId,
          portfolioId: this.selectedPortfolioId() || undefined,
          page: paging.page,
          size: paging.size,
        },
        200,
        portfolios.length + holdings.length,
      );
      this.statusMessage.set(
        `Loaded ${portfolios.length} portfolios and ${holdings.length} holdings for selected user.`,
      );

      if (!holdings.some((holding) => this.getHoldingId(holding) === this.selectedHoldingId())) {
        this.selectedHoldingId.set('');
        this.positionLots.set([]);
        this.lotMatches.set([]);
      }
    } catch (error) {
      this.recordRequest(
        'loadUserDrilldown',
        '/api/audit/users/{userId}/portfolios + /api/audit/users/{userId}/holdings',
        {
          userId,
          portfolioId: this.selectedPortfolioId() || undefined,
          page: paging.page,
          size: paging.size,
        },
        this.resolveStatusCode(error),
        null,
      );
      this.handleError(error, 'Failed to load user drilldown data.');
    } finally {
      this.loadingDrilldown.set(false);
    }
  }

  async onPortfolioFilterChange(portfolioId: string) {
    this.selectedPortfolioId.set(portfolioId);
    this.selectedHoldingId.set('');
    this.positionLots.set([]);
    this.lotMatches.set([]);

    await this.loadUserDrilldown();
  }

  async selectHolding(holdingId: string) {
    this.selectedHoldingId.set(holdingId);

    const paging = this.drilldownForm();
    if (!this.validatePaging(paging.page, paging.size)) {
      return;
    }

    this.clearMessages();
    this.loadingDrilldown.set(true);

    try {
      const [positionLots, lotMatches] = await Promise.all([
        this.auditApi.listHoldingPositionLots(holdingId, { page: paging.page, size: paging.size }),
        this.auditApi.listHoldingLotMatches(holdingId, { page: paging.page, size: paging.size }),
      ]);

      this.positionLots.set(positionLots);
      this.lotMatches.set(lotMatches);
      this.recordRequest(
        'selectHolding',
        '/api/audit/holdings/{holdingId}/position-lots + /api/audit/holdings/{holdingId}/lot-matches',
        {
          holdingId,
          page: paging.page,
          size: paging.size,
        },
        200,
        positionLots.length + lotMatches.length,
      );
      this.statusMessage.set(
        `Loaded ${positionLots.length} position lots and ${lotMatches.length} lot matches for holding.`,
      );
    } catch (error) {
      this.recordRequest(
        'selectHolding',
        '/api/audit/holdings/{holdingId}/position-lots + /api/audit/holdings/{holdingId}/lot-matches',
        {
          holdingId,
          page: paging.page,
          size: paging.size,
        },
        this.resolveStatusCode(error),
        null,
      );
      this.handleError(error, 'Failed to load holding details.');
    } finally {
      this.loadingDrilldown.set(false);
    }
  }

  async searchOrderLogs() {
    const form = this.orderLogForm();

    if (!form.date) {
      this.errorMessage.set('Date is required for order-log search.');
      return;
    }

    if (!this.validatePaging(form.page, form.size)) {
      return;
    }

    this.clearMessages();
    this.loadingOrderLogs.set(true);

    try {
      const orderLogs = await this.auditApi.searchOrderLogs({
        date: form.date,
        userId: form.userId.trim() || undefined,
        status: form.status || undefined,
        ticker: form.ticker.trim() || undefined,
        instrumentType: form.instrumentType || undefined,
        page: form.page,
        size: form.size,
      });

      this.orderLogs.set(orderLogs);
      this.recordRequest('searchOrderLogs', '/api/audit/order-logs', {
        date: form.date,
        userId: form.userId.trim() || undefined,
        status: form.status || undefined,
        ticker: form.ticker.trim() || undefined,
        instrumentType: form.instrumentType || undefined,
        page: form.page,
        size: form.size,
      }, 200, orderLogs.length);
      this.statusMessage.set(`Loaded ${orderLogs.length} order-log rows.`);
    } catch (error) {
      this.recordRequest('searchOrderLogs', '/api/audit/order-logs', {
        date: form.date,
        userId: form.userId.trim() || undefined,
        status: form.status || undefined,
        ticker: form.ticker.trim() || undefined,
        instrumentType: form.instrumentType || undefined,
        page: form.page,
        size: form.size,
      }, this.resolveStatusCode(error), null);
      this.handleError(error, 'Failed to search order logs.');
    } finally {
      this.loadingOrderLogs.set(false);
    }
  }

  toggleRawOrderRows() {
    this.showRawOrderRows.update((value) => !value);
  }

  getHoldingId(holding: HoldingResponse): string {
    return holding.holdingID;
  }

  getPortfolioId(holding: HoldingResponse): string {
    return holding.portfolioID;
  }

  getInstrumentId(holding: HoldingResponse): string {
    return holding.instrumentID;
  }

  getPositionLotId(lot: PositionLotResponse): string {
    return lot.positionLotId ?? lot.positionLotID ?? 'UNKNOWN';
  }

  getPositionLotHoldingId(lot: PositionLotResponse): string {
    return lot.holdingId ?? lot.holdingID ?? 'UNKNOWN';
  }

  getPositionLotBuyLogId(lot: PositionLotResponse): string {
    return lot.sourceBuyLogOrderId ?? lot.sourceBuyLogOrderID ?? 'UNKNOWN';
  }

  getLotMatchId(match: LotMatchResponse): string {
    return match.lotMatchId ?? match.lotMatchID ?? 'UNKNOWN';
  }

  getLotMatchPositionLotId(match: LotMatchResponse): string {
    return match.positionLotId ?? match.positionLotID ?? 'UNKNOWN';
  }

  getLotMatchSellLogId(match: LotMatchResponse): string {
    return match.sellLogOrderId ?? match.sellLogOrderID ?? 'UNKNOWN';
  }

  private resetDrilldownState() {
    this.selectedUserId.set('');
    this.selectedPortfolioId.set('');
    this.selectedHoldingId.set('');
    this.portfolios.set([]);
    this.holdings.set([]);
    this.positionLots.set([]);
    this.lotMatches.set([]);
  }

  private validatePaging(page: number, size: number): boolean {
    if (!Number.isInteger(page) || page < 0) {
      this.errorMessage.set('Page must be an integer greater than or equal to 0.');
      return false;
    }

    if (!Number.isInteger(size) || size < 1 || size > 100) {
      this.errorMessage.set('Size must be an integer between 1 and 100.');
      return false;
    }

    return true;
  }

  private clearMessages() {
    this.statusMessage.set(null);
    this.errorMessage.set(null);
  }

  private handleError(error: unknown, fallbackMessage: string) {
    const resolvedMessage = this.resolveErrorMessage(error);
    this.errorMessage.set(resolvedMessage || fallbackMessage);
  }

  private resolveStatusCode(error: unknown): number | null {
    if (!(error instanceof HttpErrorResponse)) {
      return null;
    }

    return error.status || null;
  }

  private recordRequest(
    action: string,
    endpoint: string,
    params: Record<string, string | number | undefined>,
    statusCode: number | null,
    rowsLoaded: number | null,
  ) {
    this.lastRequest.set({
      action,
      endpoint,
      params,
      statusCode,
      rowsLoaded,
      happenedAt: new Date().toISOString(),
    });
  }

  private resolveErrorMessage(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse)) {
      return null;
    }

    if (typeof error.error === 'object' && error.error?.message) {
      return String(error.error.message);
    }

    if (typeof error.error === 'string' && error.error.trim()) {
      return error.error;
    }

    if (error.status === 403) {
      return 'Forbidden: admin or auditor access is required for audit endpoints.';
    }

    if (error.status === 401) {
      return 'Unauthorized: sign in before using audit endpoints.';
    }

    return error.message || null;
  }

  private todayString(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }
}
