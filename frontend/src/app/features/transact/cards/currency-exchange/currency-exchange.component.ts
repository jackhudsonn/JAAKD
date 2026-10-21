import { Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { output } from '@angular/core';
import { ExchangeRequest } from '@features/transact/services/transact-facade.service';
import { CASH_CURRENCIES, CashCurrency } from '@core/models/api.models';
import { ConfirmActionsComponent } from '../../components/confirm-actions/confirm-actions.component';

@Component({
  selector: 'app-currency-exchange',
  standalone: true,
  imports: [FormsModule, DecimalPipe, WidgetCardComponent, ModalComponent, ConfirmActionsComponent],
  templateUrl: './currency-exchange.component.html',
  styleUrl: './currency-exchange.component.css',
})
export class CurrencyExchangeComponent {
  currencies = input<readonly CashCurrency[]>(CASH_CURRENCIES);

  // Mock conversion rates relative to one USD.
  private readonly ratesByUsd: Record<CashCurrency, number> = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    INR: 83.2,
  };

  amount = signal<number | null>(0.0);
  fromCurrency = signal<CashCurrency>('USD');
  toCurrency = signal<CashCurrency>('EUR');
  pendingExchange = signal<ExchangeRequest | null>(null);

  exchangeSubmitted = output<ExchangeRequest>();

  backendDataMode = input(false);
  balances = input<Record<string, number>>({});
  submitting = input(false);

  fromBalance = computed(() => this.balances()[this.fromCurrency()] ?? 0);
  sameCurrency = computed(() => this.fromCurrency() === this.toCurrency());

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
