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
  instrumentClass: 'ETF' | 'EQUITY' | 'FX' | 'CASH' | 'CRYPTO';
  tradingCurrency: 'USD' | 'INR' | 'GBP' | 'EUR' | null;
  logoUrl: string | null;
  description: string | null;
}

interface OrderLogResponse {
  logOrderId: string;
  orderId: string;
  portfolioId: string;
  instrumentId: string;
  side: 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAW' | 'FX';
  quantity: number;
  timestamp: string;
  metadata: string | null;
  status: 'SUBMITTED' | 'PENDING' | 'CANCELLED' | 'ACCEPTED' | 'REJECTED' | 'EXECUTED' | 'FAILED';
  executionPrice: number;
  quotedPrice: number | null;
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
  statuses: {
    status: OrderLogResponse['status'];
    timestamp: string;
    quotedPrice: number | null;
    executionPrice: number;
  }[];
  latestStatus: OrderLogResponse['status'];
  latestTimestamp: string;
}

interface HoldingResponse {
  holdingID: string;
  portfolioID: string;
  instrumentID: string;
  currentQuantity: number;
  cumulativeRealizedPnl: number;
  updatedAt: string;
}

interface PositionLotResponse {
  positionLotId: string;
  holdingId: string;
  sourceBuyLogOrderId: string;
  openedAt: string;
  originalQuantity: number;
  remainingQuantity: number;
  unitCost: number;
}

interface LotMatchResponse {
  lotMatchId: string;
  sellLogOrderId: string;
  positionLotId: string;
  holdingId: string;
  matchedQuantity: number;
  sellUnitPrice: number;
  realizedPnlAmount: number;
  matchedAt: string;
}

interface CashConversionResponse {
  orderId: string;
  logOrderId: string;
  portfolioId: string;
  sourceCurrency: 'USD' | 'INR' | 'GBP' | 'EUR';
  targetCurrency: 'USD' | 'INR' | 'GBP' | 'EUR';
  sourceAmount: number;
  conversionRate: number;
  targetAmount: number;
  sourceBalanceAfter: number;
  targetBalanceAfter: number;
  metadata: string | null;
  convertedAt: string;
}

interface InstrumentQuote {
  symbol: string;
  price: number;
  bid: number | null;
  ask: number | null;
  asOf: string | null;
}

interface HoldingWithInstrument {
  holdingId: string;
  instrumentId: string;
  ticker: string;
  instrumentName: string;
  instrumentClass: string;
  quantity: number;
  realizedPnl: number;
  updatedAt: string;
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
  readonly holdings = signal<HoldingResponse[]>([]);
  readonly positionLotsByHolding = signal<Record<string, PositionLotResponse[]>>({});
  readonly lotMatchesByHolding = signal<Record<string, LotMatchResponse[]>>({});

  readonly selectedPortfolioId = signal('');
  readonly selectedInstrumentId = signal('');
  readonly selectedHoldingId = signal('');
  readonly selectedCashInstrumentId = signal('');

  readonly loading = signal(false);
  readonly submittingOrder = signal(false);
  readonly syncingInstrument = signal(false);
  readonly refreshingQuote = signal(false);
  readonly creatingPortfolio = signal(false);
  readonly depositingCash = signal(false);
  readonly addingWatchlist = signal(false);
  readonly convertingCash = signal(false);

  readonly autoRefresh = signal(true);
  readonly statusMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly quote = signal<InstrumentQuote | null>(null);
  readonly lastConversion = signal<CashConversionResponse | null>(null);

  readonly orderForm = signal({
    side: 'BUY' as OrderLogResponse['side'],
    quantity: 1,
    metadata: '',
    orderId: '',
  });

  readonly tickerLookupForm = signal({
    ticker: '',
  });

  readonly watchlistForm = signal({
    name: 'Kafka test watchlist item',
  });

  readonly portfolioForm = signal({
    portfolioName: 'Kafka Test Portfolio',
  });

  readonly depositForm = signal({
    amount: 1000,
    metadata: 'Initial cash deposit from Dev Testing page',
    orderId: '',
  });

  readonly cashConversionForm = signal({
    sourceCurrency: 'USD' as CashConversionResponse['sourceCurrency'],
    targetCurrency: 'INR' as CashConversionResponse['targetCurrency'],
    sourceAmount: 100,
    metadata: 'FX conversion from Dev Testing page',
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
          statuses: sorted.map((item) => ({
            status: item.status,
            timestamp: item.timestamp,
            quotedPrice: item.quotedPrice,
            executionPrice: item.executionPrice,
          })),
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

  readonly selectedInstrumentDetails = computed(() =>
    this.instruments().find((i) => i.instrumentId === this.selectedInstrumentId()) ?? null,
  );

  readonly selectedInstrumentTicker = computed(() => this.selectedInstrumentDetails()?.ticker ?? 'None');

  readonly selectedInstrumentName = computed(() => this.selectedInstrumentDetails()?.name ?? 'None');

  readonly cashInstruments = computed(() =>
    this.instruments().filter((instrument) => instrument.instrumentClass === 'CASH'),
  );

  readonly holdingsWithInstruments = computed<HoldingWithInstrument[]>(() => {
    const instrumentById = new Map(
      this.instruments().map((instrument) => [instrument.instrumentId, instrument]),
    );

    return this.holdings().map((holding) => {
      const instrument = instrumentById.get(holding.instrumentID);
      return {
        holdingId: holding.holdingID,
        instrumentId: holding.instrumentID,
        ticker: instrument?.ticker ?? 'UNKNOWN',
        instrumentName: instrument?.name ?? 'Unknown instrument',
        instrumentClass: instrument?.instrumentClass ?? 'UNKNOWN',
        quantity: holding.currentQuantity,
        realizedPnl: holding.cumulativeRealizedPnl,
        updatedAt: holding.updatedAt,
      };
    });
  });

  readonly selectedHolding = computed(() =>
    this.holdingsWithInstruments().find((row) => row.holdingId === this.selectedHoldingId()) ?? null,
  );

  readonly selectedHoldingLots = computed(() => this.positionLotsByHolding()[this.selectedHoldingId()] ?? []);

  readonly selectedHoldingMatches = computed(() => this.lotMatchesByHolding()[this.selectedHoldingId()] ?? []);

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
      await this.refreshQuote();
    } catch (error) {
      this.handleError(error, 'Could not initialize Dev Testing data.');
    } finally {
      this.loading.set(false);
    }
  }

  async refreshLifecycleData() {
    if (!this.selectedPortfolioId()) {
      this.orderLogs.set([]);
      this.watchlistItems.set([]);
      this.holdings.set([]);
      this.positionLotsByHolding.set({});
      this.lotMatchesByHolding.set({});
      this.selectedHoldingId.set('');
      return;
    }

    try {
      await Promise.all([this.loadOrderLogs(), this.loadWatchlistItems(), this.loadHoldings()]);
      await this.loadAllHoldingDetails();
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
    this.quote.set(null);
  }

  onHoldingChange(value: string) {
    this.selectedHoldingId.set(value);
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

  async syncInstrumentByTicker() {
    const ticker = this.tickerLookupForm().ticker.trim().toUpperCase();
    if (!ticker) {
      this.errorMessage.set('Ticker is required to fetch an instrument from API.');
      return;
    }

    this.clearMessages();
    this.syncingInstrument.set(true);

    try {
      let synced: InstrumentResponse;
      try {
        synced = await firstValueFrom(
          this.http.post<InstrumentResponse>(
            `${environment.apiUrl}/api/instruments/sync/${encodeURIComponent(ticker)}`,
            {},
          ),
        );
      } catch {
        synced = await firstValueFrom(
          this.http.get<InstrumentResponse>(
            `${environment.apiUrl}/api/instruments/ticker/${encodeURIComponent(ticker)}`,
          ),
        );
      }

      await this.loadInstruments();
      this.selectedInstrumentId.set(synced.instrumentId);
      await this.refreshQuote();
      this.statusMessage.set(`Instrument loaded for ticker ${ticker}.`);
    } catch (error) {
      this.handleError(error, 'Failed to fetch instrument by ticker.');
    } finally {
      this.syncingInstrument.set(false);
    }
  }

  async refreshQuote() {
    const instrument = this.selectedInstrumentDetails();
    if (!instrument) {
      this.quote.set(null);
      return;
    }

    this.clearMessages();
    this.refreshingQuote.set(true);

    try {
      const resolved = await this.resolveQuote(instrument.ticker);
      this.quote.set(resolved);
      this.statusMessage.set(`Quote refreshed for ${instrument.ticker}.`);
    } catch (error) {
      this.quote.set(null);
      this.handleError(
        error,
        'Unable to refresh quote data. Ensure the quote API endpoint is available for this environment.',
      );
    } finally {
      this.refreshingQuote.set(false);
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
      this.errorMessage.set('No cash instrument found. Add/select a cash instrument first.');
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
        `Deposit submitted for order ${orderId}. Track SUBMITTED to EXECUTED in timeline.`,
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
        `Submitted order ${orderId}. Watch timeline for quoted/executed price updates by Kafka stages.`,
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

  async convertCash() {
    const portfolioId = this.selectedPortfolioId();
    const form = this.cashConversionForm();

    if (!portfolioId) {
      this.errorMessage.set('Select a portfolio before converting cash.');
      return;
    }

    if (form.sourceCurrency === form.targetCurrency) {
      this.errorMessage.set('FROM and TO currencies must be different.');
      return;
    }

    if (form.sourceAmount <= 0) {
      this.errorMessage.set('Source amount must be greater than 0.');
      return;
    }

    this.clearMessages();
    this.convertingCash.set(true);

    try {
      const conversion = await firstValueFrom(
        this.http.post<CashConversionResponse>(
          `${environment.apiUrl}/api/holdings/portfolio/${portfolioId}/convert-cash`,
          {
            sourceCurrency: form.sourceCurrency,
            targetCurrency: form.targetCurrency,
            sourceAmount: form.sourceAmount,
            metadata: form.metadata.trim() || null,
          },
        ),
      );

      this.lastConversion.set(conversion);
      await this.refreshLifecycleData();
      this.statusMessage.set('FX conversion submitted and holdings refreshed.');
    } catch (error) {
      this.handleError(error, 'Failed to convert cash.');
    } finally {
      this.convertingCash.set(false);
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

  private async loadHoldings() {
    const portfolioId = this.selectedPortfolioId();
    if (!portfolioId) {
      this.holdings.set([]);
      this.selectedHoldingId.set('');
      return;
    }

    const rows = await firstValueFrom(
      this.http.get<HoldingResponse[]>(`${environment.apiUrl}/api/holdings/portfolio/${portfolioId}`),
    );

    this.holdings.set(rows ?? []);

    if (!this.selectedHoldingId() && this.holdings().length > 0) {
      this.selectedHoldingId.set(this.holdings()[0].holdingID);
    }

    const stillExists = this.holdings().some((row) => row.holdingID === this.selectedHoldingId());
    if (!stillExists) {
      this.selectedHoldingId.set(this.holdings()[0]?.holdingID ?? '');
    }
  }

  private async loadAllHoldingDetails() {
    const details = await Promise.all(
      this.holdings().map(async (holding) => {
        const [lots, matches] = await Promise.all([
          firstValueFrom(
            this.http.get<PositionLotResponse[]>(
              `${environment.apiUrl}/api/holdings/${holding.holdingID}/position-lots`,
            ),
          ),
          firstValueFrom(
            this.http.get<LotMatchResponse[]>(
              `${environment.apiUrl}/api/holdings/${holding.holdingID}/lot-matches`,
            ),
          ),
        ]);

        return {
          holdingId: holding.holdingID,
          lots: lots ?? [],
          matches: matches ?? [],
        };
      }),
    );

    const lotsByHolding: Record<string, PositionLotResponse[]> = {};
    const matchesByHolding: Record<string, LotMatchResponse[]> = {};

    for (const row of details) {
      lotsByHolding[row.holdingId] = row.lots;
      matchesByHolding[row.holdingId] = row.matches;
    }

    this.positionLotsByHolding.set(lotsByHolding);
    this.lotMatchesByHolding.set(matchesByHolding);
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

  private async resolveQuote(ticker: string): Promise<InstrumentQuote> {
    const trimmed = ticker.trim().toUpperCase();
    const candidates = [trimmed, `FX:${trimmed}`];

    for (const symbol of candidates) {
      const resolved = await this.tryResolveQuoteFromSymbol(symbol);
      if (resolved) {
        return resolved;
      }
    }

    throw new Error(`Quote API did not return price data for ${trimmed}.`);
  }

  private async tryResolveQuoteFromSymbol(symbol: string): Promise<InstrumentQuote | null> {
    const encoded = encodeURIComponent(symbol);

    const endpointCandidates = [
      `${environment.apiUrl}/api/quotes/${encoded}`,
      `${environment.apiUrl}/api/instruments/quotes/${encoded}`,
      `${environment.apiUrl}/quotes/${encoded}`,
      `${environment.apiUrl}/api/instruments/prices?name=${encoded}&at=${encodeURIComponent(new Date().toISOString())}`,
    ];

    for (const endpoint of endpointCandidates) {
      try {
        const payload = await firstValueFrom(this.http.get<unknown>(endpoint));
        const parsed = this.parseQuotePayload(payload, symbol);
        if (parsed) {
          return parsed;
        }
      } catch {
        // Try next candidate endpoint.
      }
    }

    return null;
  }

  private parseQuotePayload(payload: unknown, symbol: string): InstrumentQuote | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const root = payload as Record<string, unknown>;
    const data = root['data'] as Record<string, unknown> | undefined;
    const nested = root['quote'] as Record<string, unknown> | undefined;
    const dataNested = data?.['quote'] as Record<string, unknown> | undefined;
    const quoteCandidate = nested ?? dataNested ?? root;

    const price = this.readNumeric(quoteCandidate, 'price');

    if (price === null) {
      return null;
    }

    return {
      symbol,
      price,
      bid: this.readNumeric(quoteCandidate, 'bid'),
      ask: this.readNumeric(quoteCandidate, 'ask'),
      asOf: this.readString(quoteCandidate, 'asOf') ?? this.readString(quoteCandidate, 'quotedAt'),
    };
  }

  private readNumeric(source: Record<string, unknown>, key: string): number | null {
    const value = source[key];
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private readString(source: Record<string, unknown>, key: string): string | null {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
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
