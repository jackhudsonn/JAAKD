import { Injectable, inject } from '@angular/core';
import { PaymentMethod } from '@core/models';
import { CashConversionResponse, CashCurrency } from '@core/models/api.models';
import { TRANSACT_STATE_PORT } from './transact-state.port';

@Injectable({
  providedIn: 'root',
})
export class TransactOperationsService {
  private readonly state = inject(TRANSACT_STATE_PORT);

  async deposit(
    amount: number,
    _method: PaymentMethod,
    currency: CashCurrency = 'USD',
  ): Promise<void> {
    if (!this.state.submitCashMovement) {
      throw new Error('Cash movement submission is not configured.');
    }
    await this.state.submitCashMovement('DEPOSIT', amount, currency);
  }

  async withdraw(
    amount: number,
    _method: PaymentMethod,
    currency: CashCurrency = 'USD',
  ): Promise<void> {
    if (!this.state.submitCashMovement) {
      throw new Error('Cash movement submission is not configured.');
    }
    await this.state.submitCashMovement('WITHDRAW', amount, currency);
  }

  async exchange(
    amount: number,
    fromCurrency: CashCurrency,
    toCurrency: CashCurrency,
  ): Promise<CashConversionResponse | null> {
    if (!this.state.convertCash) {
      throw new Error('Cash conversion is not configured.');
    }
    return this.state.convertCash(fromCurrency, toCurrency, amount);
  }
}
