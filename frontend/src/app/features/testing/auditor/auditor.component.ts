import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  HoldingResponse,
  InstrumentResponse,
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
import { InstrumentApiService } from '@core/services/instrument-api.service';

interface OrderSummary {
  orderId: string;
  status: OrderStatus;
  timestamp: string;
  executionPrice: number;
  instrumentId: string;
  userId: string | null;
}

interface RequestDiagnostics {
  action: string;
  endpoint: string;
  params: Record<string, string | number | undefined>;
  statusCode: number | null;
  rowsLoaded: number | null;
  happenedAt: string;
}

interface OptionItem {
  id: string;
  label: string;
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
  private readonly instrumentApi = inject(InstrumentApiService);

  readonly pageSize = 25;

  readonly users = signal<AuditUserSearchResponse[]>([]);
  readonly instruments = signal<InstrumentResponse[]>([]);
  readonly portfolios = signal<PortfolioResponse[]>([]);
  readonly holdings = signal<HoldingResponse[]>([]);
  readonly orderRows = signal<OrderLogResponse[]>([]);

  readonly positionLots = signal<PositionLotResponse[]>([]);
  readonly lotMatches = signal<LotMatchResponse[]>([]);
  readonly holdingOrderLogs = signal<OrderLogResponse[]>([]);
  readonly selectedOrderLogs = signal<OrderLogResponse[]>([]);

  readonly userInput = signal('');
  readonly instrumentInput = signal('');
  readonly portfolioInput = signal('');
  readonly fromDate = signal('');
  readonly toDate = signal('');

  readonly selectedUserId = signal<string | null>(null);
  readonly selectedInstrumentId = signal<string | null>(null);
  readonly selectedPortfolioId = signal<string | null>(null);
  readonly selectedHoldingId = signal<string | null>(null);
  readonly selectedOrderId = signal<string | null>(null);

  readonly ordersPage = signal(0);
  readonly holdingsPage = signal(0);

  readonly ordersMeta = signal({ totalElements: 0, totalPages: 0, hasNext: false });
  readonly holdingsMeta = signal({ totalElements: 0, totalPages: 0, hasNext: false });

  readonly loading = signal(false);
  readonly loadingDetails = signal(false);
  readonly loadingInstruments = signal(false);

  readonly statusMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly lastRequest = signal<RequestDiagnostics | null>(null);

  readonly userOptions = computed<OptionItem[]>(() => this.users().map((user) => ({
    id: user.userId,
    label: this.formatUserOption(user),
  })));

  readonly instrumentOptions = computed<OptionItem[]>(() => this.instruments().map((instrument) => ({
    id: instrument.instrumentId,
    label: this.formatInstrumentOption(instrument),
  })));

  readonly portfolioOptions = computed<OptionItem[]>(() => this.portfolios().map((portfolio) => ({
    id: portfolio.portfolioId,
    label: this.formatPortfolioOption(portfolio),
  })));

  readonly orderSummaries = computed<OrderSummary[]>(() => {
    const grouped = new Map<string, OrderLogResponse[]>();
    for (const row of this.orderRows()) {
      const rows = grouped.get(row.orderId) ?? [];
      rows.push(row);
      grouped.set(row.orderId, rows);
    }

    return [...grouped.entries()]
      .map(([orderId, rows]) => {
        const latest = rows.reduce((acc, current) => (
          new Date(current.timestamp).getTime() > new Date(acc.timestamp).getTime() ? current : acc
        ));

        return {
          orderId,
          status: latest.status,
          timestamp: latest.timestamp,
          executionPrice: latest.executionPrice,
          instrumentId: latest.instrumentId,
          userId: this.selectedUserId(),
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  });

  constructor() {
    void this.initialize();
  }

  async initialize() {
    await Promise.all([this.loadInstruments(), this.loadUsers()]);
    await this.refreshSummaries();
  }

  async loadInstruments() {
    this.loadingInstruments.set(true);

    try {
      const instruments = await this.instrumentApi.list();
      this.instruments.set(instruments);
    } catch {
      this.instruments.set([]);
    } finally {
      this.loadingInstruments.set(false);
    }
  }

  async loadUsers() {
    const result = await this.auditApi.searchUsers(undefined, { page: 0, size: 100 });
    this.users.set(result.content);
  }

  async applyFilters() {
    this.resolveSelectionInputs();
    this.ordersPage.set(0);
    this.holdingsPage.set(0);
    this.selectedOrderId.set(null);
    this.selectedOrderLogs.set([]);
    this.clearHoldingDetails();

    await this.loadPortfoliosForUser();
    await this.refreshSummaries();
  }

  async clearFilters() {
    this.userInput.set('');
    this.instrumentInput.set('');
    this.portfolioInput.set('');
    this.fromDate.set('');
    this.toDate.set('');
    this.selectedUserId.set(null);
    this.selectedInstrumentId.set(null);
    this.selectedPortfolioId.set(null);
    this.ordersPage.set(0);
    this.holdingsPage.set(0);
    this.portfolios.set([]);
    this.selectedOrderId.set(null);
    this.selectedOrderLogs.set([]);
    this.clearHoldingDetails();
    await this.refreshSummaries();
  }

  async refreshSummaries() {
    this.clearMessages();
    this.loading.set(true);

    try {
      const [ordersPage, holdingsPage] = await Promise.all([
        this.auditApi.searchOrderLogs({
          userId: this.selectedUserId() ?? undefined,
          fromDate: this.fromDate() || undefined,
          toDate: this.toDate() || undefined,
          instrumentId: this.selectedInstrumentId() ?? undefined,
          page: this.ordersPage(),
          size: this.pageSize,
        }),
        this.selectedUserId()
          ? this.auditApi.listUserHoldings(this.selectedUserId()!, {
            portfolioId: this.selectedPortfolioId() ?? undefined,
            instrumentId: this.selectedInstrumentId() ?? undefined,
            page: this.holdingsPage(),
            size: this.pageSize,
          })
          : this.auditApi.listHoldings({
            instrumentId: this.selectedInstrumentId() ?? undefined,
            page: this.holdingsPage(),
            size: this.pageSize,
          }),
      ]);

      this.orderRows.set(ordersPage.content);
      this.holdings.set(holdingsPage.content);
      this.ordersMeta.set({
        totalElements: ordersPage.totalElements,
        totalPages: ordersPage.totalPages,
        hasNext: ordersPage.hasNext,
      });
      this.holdingsMeta.set({
        totalElements: holdingsPage.totalElements,
        totalPages: holdingsPage.totalPages,
        hasNext: holdingsPage.hasNext,
      });

      this.recordRequest('refreshSummaries', '/api/audit/order-logs + /api/audit/holdings', {
        userId: this.selectedUserId() ?? undefined,
        portfolioId: this.selectedPortfolioId() ?? undefined,
        instrumentId: this.selectedInstrumentId() ?? undefined,
        fromDate: this.fromDate() || undefined,
        toDate: this.toDate() || undefined,
        ordersPage: this.ordersPage(),
        holdingsPage: this.holdingsPage(),
      }, 200, ordersPage.content.length + holdingsPage.content.length);

      this.statusMessage.set(`Loaded ${ordersPage.content.length} order rows and ${holdingsPage.content.length} holdings.`);
    } catch (error) {
      this.recordRequest('refreshSummaries', '/api/audit/order-logs + /api/audit/holdings', {}, this.resolveStatusCode(error), null);
      this.handleError(error, 'Failed to load auditor summaries.');
    } finally {
      this.loading.set(false);
    }
  }

  async goToOrdersPage(nextPage: number) {
    if (nextPage < 0) {
      return;
    }

    this.ordersPage.set(nextPage);
    await this.refreshSummaries();
  }

  async goToHoldingsPage(nextPage: number) {
    if (nextPage < 0) {
      return;
    }

    this.holdingsPage.set(nextPage);
    await this.refreshSummaries();
  }

  selectOrder(orderId: string) {
    this.selectedOrderId.set(orderId);
    const rows = this.orderRows()
      .filter((row) => row.orderId === orderId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    this.selectedOrderLogs.set(rows);
  }

  async selectHolding(holdingId: string) {
    this.selectedHoldingId.set(holdingId);
    this.selectedOrderId.set(null);
    this.selectedOrderLogs.set([]);

    this.clearMessages();
    this.loadingDetails.set(true);

    const fromDate = this.fromDate() || undefined;
    const toDate = this.toDate() || undefined;

    try {
      const [orderLogsPage, lotsPage, matchesPage] = await Promise.all([
        this.auditApi.listHoldingOrderLogs(holdingId, {
          fromDate,
          toDate,
          page: 0,
          size: this.pageSize,
        }),
        this.auditApi.listHoldingPositionLots(holdingId, { page: 0, size: this.pageSize }),
        this.auditApi.listHoldingLotMatches(holdingId, { page: 0, size: this.pageSize }),
      ]);

      this.holdingOrderLogs.set(orderLogsPage.content);
      this.positionLots.set(lotsPage.content);
      this.lotMatches.set(matchesPage.content);
      this.recordRequest(
        'selectHolding',
        '/api/audit/holdings/{holdingId}/order-logs + lots + matches',
        {
          holdingId,
          fromDate,
          toDate,
        },
        200,
        orderLogsPage.content.length + lotsPage.content.length + matchesPage.content.length,
      );
      this.statusMessage.set(
        `Loaded ${orderLogsPage.content.length} order logs, ${lotsPage.content.length} position lots, and ${matchesPage.content.length} lot matches.`,
      );
    } catch (error) {
      this.recordRequest(
        'selectHolding',
        '/api/audit/holdings/{holdingId}/order-logs + lots + matches',
        {
          holdingId,
          fromDate,
          toDate,
        },
        this.resolveStatusCode(error),
        null,
      );
      this.handleError(error, 'Failed to load holding details.');
    } finally {
      this.loadingDetails.set(false);
    }
  }

  getInstrumentName(instrumentId: string): string {
    const instrument = this.instruments().find((item) => item.instrumentId === instrumentId);
    return instrument ? `${instrument.ticker} (${instrument.name})` : instrumentId;
  }

  getHoldingDisplayUser(_holding: HoldingResponse): string {
    return this.selectedUserId() ?? 'All users';
  }

  formatInstrumentOption(instrument: InstrumentResponse): string {
    return `${instrument.ticker} - ${instrument.name} (${instrument.instrumentClass})`;
  }

  formatUserOption(user: AuditUserSearchResponse): string {
    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    return fullName ? `${user.email} (${fullName})` : user.email;
  }

  formatPortfolioOption(portfolio: PortfolioResponse): string {
    return `${portfolio.portfolioName} (${portfolio.portfolioId})`;
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

  private clearHoldingDetails() {
    this.selectedHoldingId.set(null);
    this.holdingOrderLogs.set([]);
    this.positionLots.set([]);
    this.lotMatches.set([]);
  }

  private async loadPortfoliosForUser() {
    const userId = this.selectedUserId();
    if (!userId) {
      this.portfolios.set([]);
      this.selectedPortfolioId.set(null);
      this.portfolioInput.set('');
      return;
    }

    const portfolios = await this.auditApi.listUserPortfolios(userId, { page: 0, size: 100 });
    this.portfolios.set(portfolios.content);
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

  private resolveSelectionInputs() {
    this.selectedUserId.set(this.findOptionId(this.userInput(), this.userOptions()));
    this.selectedInstrumentId.set(this.findOptionId(this.instrumentInput(), this.instrumentOptions()));

    const portfolioId = this.findOptionId(this.portfolioInput(), this.portfolioOptions());
    this.selectedPortfolioId.set(this.selectedUserId() ? portfolioId : null);

    if (!this.selectedUserId()) {
      this.portfolioInput.set('');
      this.selectedPortfolioId.set(null);
    }
  }

  private findOptionId(value: string, options: OptionItem[]): string | null {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const exact = options.find((option) => (
      option.label.toLowerCase() === normalized || option.id.toLowerCase() === normalized
    ));

    return exact?.id ?? null;
  }

  private resolveErrorMessage(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse)) {
      return null;
    }

    const details = this.extractErrorDetails(error.error);
    if (error.status === 503 && details?.type && details?.hint) {
      return `Database error (${details.type}): ${details.hint}`;
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

  private extractErrorDetails(payload: unknown): { type?: string; hint?: string } | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const details = (payload as { details?: unknown }).details;
    if (!details || typeof details !== 'object') {
      return null;
    }

    const typedDetails = details as { type?: unknown; hint?: unknown };
    return {
      type: typeof typedDetails.type === 'string' ? typedDetails.type : undefined,
      hint: typeof typedDetails.hint === 'string' ? typedDetails.hint : undefined,
    };
  }
}
