import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '@environments/environment.local';

interface PortfolioResponse {
  portfolioId: string;
  portfolioName: string;
}

interface InstrumentResponse {
  instrumentId: string;
  ticker: string;
  market: string;
  name: string;
  instrumentClass: 'ETF' | 'EQUITY' | 'STOCK' | 'BOND' | 'CASH' | 'CRYPTO';
  logoUrl: string | null;
  description: string | null;
}

interface OrderLogResponse {
  logOrderId: string;
  orderId: string;
  portfolioId: string;
  instrumentId: string;
  side: 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAW';
  quantity: number;
  timestamp: string;
  metadata: string | null;
  status: 'SUBMITTED' | 'PENDING' | 'CANCELLED' | 'ACCEPTED' | 'REJECTED' | 'EXECUTED' | 'FAILED';
  executionPrice: number;
}

interface WatchlistItemResponse {
  listItemId: string;
  portfolioId: string;
  instrumentId: string;
  name: string | null;
}

interface LifecycleOrder {
  orderId: string;
  side: OrderLogResponse['side'];
  quantity: number;
  instrumentId: string;
  statuses: { status: OrderLogResponse['status']; timestamp: string }[];
  latestStatus: OrderLogResponse['status'];
  latestTimestamp: string;
}

@Component({
  selector: 'app-order-lifecycle-lab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-lifecycle-lab.component.html',
  styleUrl: './order-lifecycle-lab.component.css',
})
export class OrderLifecycleLabComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private refreshIntervalId: ReturnType<typeof setInterval> | null = null;

  readonly portfolios = signal<PortfolioResponse[]>([]);
  readonly instruments = signal<InstrumentResponse[]>([]);
  readonly orderLogs = signal<OrderLogResponse[]>([]);
  readonly watchlistItems = signal<WatchlistItemResponse[]>([]);

  readonly selectedPortfolioId = signal('');
  readonly selectedInstrumentId = signal('');

  readonly loading = signal(false);
  readonly submittingOrder = signal(false);
  readonly creatingInstrument = signal(false);
  readonly creatingPortfolio = signal(false);
  readonly depositingCash = signal(false);
  readonly addingWatchlist = signal(false);

  readonly autoRefresh = signal(true);
  readonly statusMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly orderForm = signal({
    side: 'BUY' as OrderLogResponse['side'],
    quantity: 1,
    metadata: '',
    orderId: '',
  });

  readonly instrumentForm = signal({
    ticker: '',
    market: 'NYSE',
    name: '',
    instrumentClass: 'EQUITY' as InstrumentResponse['instrumentClass'],
    description: '',
  });

  readonly watchlistForm = signal({
    name: 'Kafka test watchlist item',
  });

  readonly lifecycleOrders = computed<LifecycleOrder[]>(() => {
    const grouped = new Map<string, OrderLogResponse[]>();

    for (const row of this.orderLogs()) {
      const existing = grouped.get(row.orderId);
      if (existing) {
        existing.push(row);
      } else {
        grouped.set(row.orderId, [row]);
      }
    }

    return [...grouped.entries()]
      .map(([orderId, rows]) => {
        const sorted = [...rows].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        const latest = sorted[sorted.length - 1];

        return {
          orderId,
          side: latest.side,
          quantity: latest.quantity,
          instrumentId: latest.instrumentId,
          statuses: sorted.map((item) => ({ status: item.status, timestamp: item.timestamp })),
          latestStatus: latest.status,
          latestTimestamp: latest.timestamp,
        };
      })
      .sort((a, b) => new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime());
  });

  readonly selectedPortfolioName = computed(() => {
    const current = this.portfolios().find((p) => p.portfolioId === this.selectedPortfolioId());
    return current?.portfolioName ?? 'None';
  });

  readonly cashInstruments = computed(() =>
    this.instruments().filter(
      (instrument) =>
        instrument.instrumentClass === 'CASH'
    ),
  );

  readonly selectedCashInstrumentId = signal('');

  readonly portfolioForm = signal({
    portfolioName: 'Kafka Test Portfolio',
  });

  readonly depositForm = signal({
    amount: 1000,
    metadata: 'Initial cash deposit from lifecycle lab',
    orderId: '',
  });

  readonly selectedInstrumentTicker = computed(() => {
    const current = this.instruments().find((i) => i.instrumentId === this.selectedInstrumentId());
    return current?.ticker ?? 'None';
  });

  readonly selectedInstrumentName = computed(() => {
    const current = this.instruments().find((i) => i.instrumentId === this.selectedInstrumentId());
    return current?.name ?? 'None';
  });

  ngOnInit() {
    void this.bootstrapPage();
    this.startAutoRefresh();
  }

  ngOnDestroy() {
    this.stopAutoRefresh();
  }

  async bootstrapPage() {
    this.clearMessages();
    this.loading.set(true);

    try {
      await Promise.all([this.loadPortfolios(), this.loadInstruments()]);

      if (!this.selectedInstrumentId() && this.instruments().length > 0) {
        this.selectedInstrumentId.set(this.instruments()[0].instrumentId);
      }

      await this.refreshLifecycleData();
    } catch (error) {
      this.handleError(error, 'Could not initialize lifecycle lab data.');
    } finally {
      this.loading.set(false);
    }
  }

  async refreshLifecycleData() {
    if (!this.selectedPortfolioId()) {
      this.orderLogs.set([]);
      this.watchlistItems.set([]);
      return;
    }

    try {
      await Promise.all([this.loadOrderLogs(), this.loadWatchlistItems()]);
    } catch (error) {
      this.handleError(error, 'Unable to refresh lifecycle data.');
    }
  }

  async onPortfolioChange(value: string) {
    this.selectedPortfolioId.set(value);
    await this.refreshLifecycleData();
  }

  onInstrumentChange(value: string) {
    this.selectedInstrumentId.set(value);
  }

  toggleAutoRefresh() {
    this.autoRefresh.update((value) => !value);

    if (this.autoRefresh()) {
      this.startAutoRefresh();
      this.statusMessage.set('Auto refresh enabled.');
      return;
    }

    this.stopAutoRefresh();
    this.statusMessage.set('Auto refresh paused.');
  }

  async createInstrument() {
    const payload = this.instrumentForm();
    if (!payload.ticker.trim() || !payload.market.trim() || !payload.name.trim()) {
      this.errorMessage.set('Ticker, market, and name are required to create an instrument.');
      return;
    }

    this.clearMessages();
    this.creatingInstrument.set(true);

    try {
      await firstValueFrom(
        this.http.post<InstrumentResponse>(`${environment.apiUrl}/api/instruments`, {
          ticker: payload.ticker.trim().toUpperCase(),
          market: payload.market.trim().toUpperCase(),
          name: payload.name.trim(),
          instrumentClass: payload.instrumentClass,
          description: payload.description.trim() || null,
          logoUrl: null,
        }),
      );

      await this.loadInstruments();

      const created = this.instruments().find(
        (instrument) => instrument.ticker === payload.ticker.trim().toUpperCase(),
      );
      if (created) {
        this.selectedInstrumentId.set(created.instrumentId);
      }

      this.statusMessage.set('Instrument created. You can now use it for order and watchlist tests.');
      this.instrumentForm.set({
        ticker: '',
        market: payload.market,
        name: '',
        instrumentClass: payload.instrumentClass,
        description: '',
      });
    } catch (error) {
      this.handleError(error, 'Failed to create instrument.');
    } finally {
      this.creatingInstrument.set(false);
    }
  }

  async createPortfolio() {
    const portfolioName = this.portfolioForm().portfolioName.trim();
    if (!portfolioName) {
      this.errorMessage.set('Portfolio name is required.');
      return;
    }

    this.clearMessages();
    this.creatingPortfolio.set(true);

    try {
      const created = await firstValueFrom(
        this.http.post<PortfolioResponse>(`${environment.apiUrl}/api/portfolios`, {
          portfolioName,
        }),
      );

      await this.loadPortfolios();
      this.selectedPortfolioId.set(created.portfolioId);
      await this.refreshLifecycleData();

      this.statusMessage.set(`Created portfolio ${created.portfolioName}.`);
      this.portfolioForm.set({ portfolioName: 'Kafka Test Portfolio' });
    } catch (error) {
      this.handleError(error, 'Failed to create portfolio.');
    } finally {
      this.creatingPortfolio.set(false);
    }
  }

  async depositCash() {
    const portfolioId = this.selectedPortfolioId();
    const cashInstrumentId = this.resolveCashInstrumentId();
    const payload = this.depositForm();

    if (!portfolioId) {
      this.errorMessage.set('Select a portfolio before depositing cash.');
      return;
    }

    if (!cashInstrumentId) {
      this.errorMessage.set('No cash instrument found. Add/select a USD_CASH instrument first.');
      return;
    }

    if (payload.amount <= 0) {
      this.errorMessage.set('Deposit amount must be greater than 0.');
      return;
    }

    this.clearMessages();
    this.depositingCash.set(true);

    try {
      const orderId = payload.orderId.trim() || crypto.randomUUID();
      await firstValueFrom(
        this.http.post<OrderLogResponse>(`${environment.apiUrl}/api/order-logs`, {
          orderId,
          portfolioId,
          instrumentId: cashInstrumentId,
          side: 'DEPOSIT',
          quantity: payload.amount,
          metadata: payload.metadata.trim() || null,
          executionPrice: null,
        }),
      );

      this.depositForm.set({
        amount: payload.amount,
        metadata: payload.metadata,
        orderId,
      });

      await this.refreshLifecycleData();
      this.statusMessage.set(
        `Deposit submitted for order ${orderId}. Track SUBMITTED → PENDING → ACCEPTED/EXECUTED in timeline.`,
      );
    } catch (error) {
      this.handleError(error, 'Failed to submit cash deposit.');
    } finally {
      this.depositingCash.set(false);
    }
  }

  async placeOrderLog() {
    const portfolioId = this.selectedPortfolioId();
    const instrumentId = this.selectedInstrumentId();
    const payload = this.orderForm();

    if (!portfolioId) {
      this.errorMessage.set('Select a portfolio before placing a test order.');
      return;
    }

    if (!instrumentId) {
      this.errorMessage.set('Select an instrument before placing a test order.');
      return;
    }

    if (payload.quantity <= 0) {
      this.errorMessage.set('Quantity must be greater than 0.');
      return;
    }

    this.clearMessages();
    this.submittingOrder.set(true);

    try {
      const orderId = payload.orderId.trim() || crypto.randomUUID();

      await firstValueFrom(
        this.http.post<OrderLogResponse>(`${environment.apiUrl}/api/order-logs`, {
          orderId,
          portfolioId,
          instrumentId,
          side: payload.side,
          quantity: payload.quantity,
          metadata: payload.metadata.trim() || null,
          executionPrice: null,
        }),
      );

      this.orderForm.set({
        side: payload.side,
        quantity: payload.quantity,
        metadata: payload.metadata,
        orderId,
      });

      await this.refreshLifecycleData();

      this.statusMessage.set(
        `Submitted order ${orderId}. Watch the timeline for status transitions from Kafka consumers.`,
      );
    } catch (error) {
      this.handleError(error, 'Failed to submit order log.');
    } finally {
      this.submittingOrder.set(false);
    }
  }

  async addWatchlistItem() {
    const portfolioId = this.selectedPortfolioId();
    const instrumentId = this.selectedInstrumentId();

    if (!portfolioId) {
      this.errorMessage.set('Select a portfolio before adding a watchlist item.');
      return;
    }

    if (!instrumentId) {
      this.errorMessage.set('Select an instrument before adding a watchlist item.');
      return;
    }

    this.clearMessages();
    this.addingWatchlist.set(true);

    try {
      await firstValueFrom(
        this.http.post<WatchlistItemResponse>(`${environment.apiUrl}/api/watchlists`, {
          portfolioId,
          instrumentId,
          name: this.watchlistForm().name.trim() || null,
        }),
      );

      await this.loadWatchlistItems();
      this.statusMessage.set('Instrument added to watchlist for selected portfolio.');
    } catch (error) {
      this.handleError(error, 'Failed to add watchlist item.');
    } finally {
      this.addingWatchlist.set(false);
    }
  }

  async cancelOrder(orderId: string) {
    this.clearMessages();

    try {
      await firstValueFrom(
        this.http.post<OrderLogResponse>(`${environment.apiUrl}/api/order-logs/${orderId}/cancel`, {}),
      );

      await this.loadOrderLogs();
      this.statusMessage.set(`Cancellation submitted for order ${orderId}.`);
    } catch (error) {
      this.handleError(error, 'Failed to cancel order.');
    }
  }

  private async loadPortfolios() {
    const rows = await firstValueFrom(
      this.http.get<PortfolioResponse[]>(`${environment.apiUrl}/api/portfolios`),
    );

    this.portfolios.set(rows ?? []);

    if (!this.selectedPortfolioId() && rows && rows.length > 0) {
      this.selectedPortfolioId.set(rows[0].portfolioId);
    }
  }

  private async loadInstruments() {
    const rows = await firstValueFrom(
      this.http.get<InstrumentResponse[]>(`${environment.apiUrl}/api/instruments`),
    );

    this.instruments.set(rows ?? []);

    if (!this.selectedCashInstrumentId()) {
      const preferred =
        this.instruments().find((instrument) => instrument.ticker.toUpperCase() === 'USD_CASH') ??
        this.cashInstruments()[0];

      if (preferred) {
        this.selectedCashInstrumentId.set(preferred.instrumentId);
      }
    }
  }

  private async loadOrderLogs() {
    const portfolioId = this.selectedPortfolioId();
    if (!portfolioId) {
      this.orderLogs.set([]);
      return;
    }

    const rows = await firstValueFrom(
      this.http.get<OrderLogResponse[]>(`${environment.apiUrl}/api/order-logs/portfolio/${portfolioId}`),
    );

    const sorted = [...(rows ?? [])].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    this.orderLogs.set(sorted);
  }

  private async loadWatchlistItems() {
    const portfolioId = this.selectedPortfolioId();
    if (!portfolioId) {
      this.watchlistItems.set([]);
      return;
    }

    const rows = await firstValueFrom(
      this.http.get<WatchlistItemResponse[]>(
        `${environment.apiUrl}/api/watchlists/portfolio/${portfolioId}`,
      ),
    );

    this.watchlistItems.set(rows ?? []);
  }

  private startAutoRefresh() {
    if (this.refreshIntervalId !== null) {
      return;
    }

    this.refreshIntervalId = setInterval(() => {
      if (this.autoRefresh()) {
        void this.refreshLifecycleData();
      }
    }, 3000);
  }

  private stopAutoRefresh() {
    if (this.refreshIntervalId !== null) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
  }

  private clearMessages() {
    this.statusMessage.set(null);
    this.errorMessage.set(null);
  }

  private handleError(error: unknown, fallback: string) {
    const message = this.extractErrorMessage(error) ?? fallback;
    this.errorMessage.set(message);
  }

  private extractErrorMessage(error: unknown): string | null {
    if (!error || typeof error !== 'object') {
      return null;
    }

    const response = error as { error?: { message?: string }; message?: string };

    if (response.error?.message) {
      return response.error.message;
    }

    if (response.message) {
      return response.message;
    }

    return null;
  }

  private resolveCashInstrumentId(): string {
    const chosen = this.selectedCashInstrumentId();
    if (chosen) {
      return chosen;
    }

    const preferred =
      this.instruments().find((instrument) => instrument.ticker.toUpperCase() === 'USD_CASH') ??
      this.cashInstruments()[0];

    return preferred?.instrumentId ?? '';
  }
}
