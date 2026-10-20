import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import {
  CASH_CURRENCIES,
  CashConversionResponse,
  CashCurrency,
  HoldingResponse,
  InstrumentResponse,
  OrderLogResponse,
} from '@core/models/api.models';
import { Transaction } from '@core/models';
import { HoldingApiService } from '@core/services/holding-api.service';
import { InstrumentApiService } from '@core/services/instrument-api.service';
import { OrderLogApiService } from '@core/services/order-log-api.service';
import { PortfolioApiService } from '@core/services/portfolio-api.service';
import { toTransactions } from '@features/dashboard/services/dashboard-backend.mappers';
import { TransactStatePort } from './transact-state.port';

export type TransactLoadState = 'loading' | 'ready' | 'error';

@Injectable({
  providedIn: 'root',
})
export class BackendTransactStateService implements TransactStatePort {
  readonly transactions = signal<Transaction[]>([]);
  readonly backendDataMode = true;
  readonly loadState = signal<TransactLoadState>('loading');
  readonly cashBalances = signal<Record<string, number>>({});
  readonly cashCurrencies = computed(() =>
    this.instrumentsData()
      .filter((instrument) => instrument.instrumentClass === 'CASH')
      .map((instrument) => instrument.ticker as CashCurrency)
      .sort((a, b) => CASH_CURRENCIES.indexOf(a) - CASH_CURRENCIES.indexOf(b)),
  );
  private readonly portfolioId = signal<string | null>(null);
  private readonly instrumentsData = signal<InstrumentResponse[]>([]);
  private readonly orderLogsData = signal<OrderLogResponse[]>([]);

  constructor(
    private portfolioApiService: PortfolioApiService,
    private holdingApiService: HoldingApiService,
    private instrumentApiService: InstrumentApiService,
    private orderLogApiService: OrderLogApiService,
  ) {}

  async load(): Promise<void> {
    this.loadState.set('loading');
    this.transactions.set([]);

    try {
      await this.refresh();
      this.loadState.set('ready');
    } catch (error) {
      console.error('BackendTransactStateService.load failed', error);
      this.portfolioId.set(null);
      this.instrumentsData.set([]);
      this.orderLogsData.set([]);
      this.transactions.set([]);
      this.loadState.set('error');
      this.cashBalances.set({});
    }
  }

  async submitCashMovement(
    side: 'DEPOSIT' | 'WITHDRAW',
    amount: number,
    currency: CashCurrency = 'USD',
  ): Promise<void> {
    const portfolioId = this.portfolioId();
    const cashInstrument = this.instrumentsData().find(
      (instrument) => instrument.instrumentClass === 'CASH' && instrument.ticker === currency,
    );

    if (!portfolioId || !cashInstrument) {
      return;
    }

    const orderId = crypto.randomUUID();

    await this.orderLogApiService.submit({
      orderId,
      portfolioId,
      instrumentId: cashInstrument.instrumentId,
      side,
      quantity: amount,
    });

    await this.refresh();

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const transaction = this.transactions().find((entry) => entry.id === orderId);
      if (
        transaction &&
        (transaction.status === 'completed' ||
          transaction.status === 'failed' ||
          transaction.status === 'cancelled')
      ) {
        if (transaction.status === 'failed') {
          throw new Error(this.resolveFailureReason(orderId, side));
        }

        return;
      }

      await this.delay(1000);
      await this.refresh();
    }
  }

  async convertCash(
    fromCurrency: CashCurrency,
    toCurrency: CashCurrency,
    amount: number,
  ): Promise<CashConversionResponse> {
    const portfolioId = this.portfolioId();
    if (!portfolioId) {
      throw new Error('Your portfolio is not loaded yet. Try again.');
    }

    let result: CashConversionResponse;
    try {
      result = await this.holdingApiService.convertCash(portfolioId, {
        sourceCurrency: fromCurrency,
        targetCurrency: toCurrency,
        sourceAmount: amount,
      });
    } catch (error) {
      if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
        throw new Error(error.error.message);
      }
      throw new Error('The exchange could not be completed.');
    }

    await this.refresh();
    return result;
  }
  private async refresh(): Promise<void> {
    const portfolio = await this.portfolioApiService.ensureDefault();
    const [holdings, instruments, orderLogs] = await Promise.all([
      this.holdingApiService.listByPortfolio(portfolio.portfolioId),
      this.instrumentApiService.list(),
      this.orderLogApiService.listByPortfolio(portfolio.portfolioId),
    ]);

    this.portfolioId.set(portfolio.portfolioId);
    this.instrumentsData.set(instruments);
    this.orderLogsData.set(orderLogs);
    this.cashBalances.set(this.toCashBalances(holdings, instruments));
    this.transactions.set(toTransactions(orderLogs));
  }

  private toCashBalances(
    holdings: HoldingResponse[],
    instruments: InstrumentResponse[],
  ): Record<string, number> {
    const cashTickerById = new Map(
      instruments
        .filter((instrument) => instrument.instrumentClass === 'CASH')
        .map((instrument) => [instrument.instrumentId, instrument.ticker]),
    );
    const balances: Record<string, number> = {};

    for (const holding of holdings) {
      const ticker = cashTickerById.get(holding.instrumentID);
      if (ticker) {
        balances[ticker] = holding.currentQuantity;
      }
    }

    return balances;
  }

  private resolveFailureReason(orderId: string, side: 'DEPOSIT' | 'WITHDRAW'): string {
    const latestForOrder = this.orderLogsData()
      .filter((row) => row.orderId === orderId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    const reasonFromMetadata = this.extractFailureMessage(latestForOrder?.metadata ?? null);
    if (reasonFromMetadata) {
      return reasonFromMetadata;
    }

    if (side === 'WITHDRAW') {
      return 'Withdrawal failed. Not enough cash.';
    }

    return 'Deposit failed.';
  }

  private extractFailureMessage(metadata: string | null): string | null {
    if (!metadata) {
      return null;
    }

    for (const key of ['rejectionReason=', 'failureReason=']) {
      const start = metadata.indexOf(key);
      if (start < 0) {
        continue;
      }

      const valueStart = start + key.length;
      const separator = metadata.indexOf(' | ', valueStart);
      const rawValue =
        separator >= 0 ? metadata.slice(valueStart, separator) : metadata.slice(valueStart);
      const trimmedValue = rawValue.trim();

      if (trimmedValue.length > 0) {
        return trimmedValue;
      }
    }

    return null;
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }
}
