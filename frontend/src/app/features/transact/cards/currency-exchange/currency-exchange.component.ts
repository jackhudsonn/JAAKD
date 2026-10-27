import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { output } from '@angular/core';
import { ExchangeRequest } from '@features/transact/services/transact-facade.service';
import { CASH_CURRENCIES, CashCurrency } from '@core/models/api.models';
import { ConfirmActionsComponent } from '../../components/confirm-actions/confirm-actions.component';
import { InstrumentApiService } from '@core/services/instrument-api.service';
import { invertRate, toFxSymbol, toPositiveRate, toReceiveAmount } from '@core/utils/cash-fx';

@Component({
  selector: 'app-currency-exchange',
  standalone: true,
  imports: [FormsModule, DecimalPipe, WidgetCardComponent, ModalComponent, ConfirmActionsComponent],
  templateUrl: './currency-exchange.component.html',
  styleUrl: './currency-exchange.component.css',
})
export class CurrencyExchangeComponent {
  private readonly instrumentApi = inject(InstrumentApiService);

  currencies = input<readonly CashCurrency[]>(CASH_CURRENCIES);
  private liveRateRequestId = 0;

  amount = signal<number | null>(0.0);
  fromCurrency = signal<CashCurrency>('USD');
  toCurrency = signal<CashCurrency>('EUR');
  pendingExchange = signal<ExchangeRequest | null>(null);

  exchangeSubmitted = output<ExchangeRequest>();

  balances = input<Record<string, number>>({});
  submitting = input(false);

  fromBalance = computed(() => this.balances()[this.fromCurrency()] ?? 0);
  sameCurrency = computed(() => this.fromCurrency() === this.toCurrency());

  liveRate = signal<number | null>(null);
  liveRateState = signal<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  liveReceiveAmount = computed(() => toReceiveAmount(this.amount(), this.liveRate()));

  constructor() {
    effect(() => {
      const from = this.fromCurrency();
      const to = this.toCurrency();

      if (from === to) {
        this.liveRateRequestId++;
        this.liveRate.set(null);
        this.liveRateState.set('idle');
        return;
      }

      void this.loadLiveRate(from, to);
    });
  }

  private async loadLiveRate(from: CashCurrency, to: CashCurrency) {
    const requestId = ++this.liveRateRequestId;
    this.liveRate.set(null);
    this.liveRateState.set('loading');

    const rate =
      (await this.fetchRate(toFxSymbol(from, to))) ??
      invertRate(await this.fetchRate(toFxSymbol(to, from)));

    // A newer currency choice started its own request; drop this stale result.
    if (requestId !== this.liveRateRequestId) {
      return;
    }

    this.liveRate.set(rate);
    this.liveRateState.set(rate === null ? 'unavailable' : 'ready');
  }

  private async fetchRate(symbol: string): Promise<number | null> {
    try {
      const quotes = await this.instrumentApi.getQuotes([symbol]);
      return toPositiveRate(quotes.find((quote) => quote.symbol === symbol) ?? quotes[0]);
    } catch (error) {
      console.error(`CurrencyExchangeComponent quote for ${symbol} failed`, error);
      return null;
    }
  }

  requestExchange() {
    const currentAmount = this.amount();
    if (!currentAmount || currentAmount <= 0) {
      return;
    }

    if (this.submitting()) {
      return;
    }

    if (this.sameCurrency()) {
      return;
    }

    this.pendingExchange.set({
      amount: currentAmount,
      fromCurrency: this.fromCurrency(),
      toCurrency: this.toCurrency(),
    });
  }

  confirmExchange() {
    const pendingExchange = this.pendingExchange();
    if (!pendingExchange) {
      return;
    }

    this.exchangeSubmitted.emit(pendingExchange);
    this.pendingExchange.set(null);
  }

  cancelExchange() {
    this.pendingExchange.set(null);
  }
}
