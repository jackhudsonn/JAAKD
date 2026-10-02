import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { output } from '@angular/core';
import { ExchangeRequest } from '../services/transact-facade.service';

type SupportedCurrency = 'USD' | 'EUR' | 'INR';

@Component({
  selector: 'app-currency-exchange',
  standalone: true,
  imports: [FormsModule, DecimalPipe, WidgetCardComponent, ModalComponent],
  templateUrl: './currency-exchange.component.html',
  styleUrl: './currency-exchange.component.css',
})
export class CurrencyExchangeComponent {
  // TODO: Fetch supported currencies from backend instead of hardcoding frontend options.
  readonly currencies: readonly SupportedCurrency[] = ['USD', 'EUR', 'INR'];

  // Mock conversion rates relative to one USD.
  private readonly ratesByUsd: Record<SupportedCurrency, number> = {
    USD: 1,
    EUR: 0.92,
    INR: 83.2,
  };

  amount = signal<number | null>(100);
  fromCurrency = signal<SupportedCurrency>('USD');
  toCurrency = signal<SupportedCurrency>('EUR');
  pendingExchange = signal<ExchangeRequest | null>(null);

  exchangeSubmitted = output<ExchangeRequest>();

  convertedAmount = computed(() => {
    const value = this.amount();
    if (!value || value <= 0) {
      return 0;
    }

    const fromRate = this.ratesByUsd[this.fromCurrency()];
    const toRate = this.ratesByUsd[this.toCurrency()];

    const amountInUsd = value / fromRate;
    return amountInUsd * toRate;
  });

  quoteRate = computed(() => {
    const fromRate = this.ratesByUsd[this.fromCurrency()];
    const toRate = this.ratesByUsd[this.toCurrency()];
    return toRate / fromRate;
  });

  requestExchange() {
    const currentAmount = this.amount();
    if (!currentAmount || currentAmount <= 0) {
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
