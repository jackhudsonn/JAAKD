import { Injectable, inject } from '@angular/core';
import { CashConversionResponse, CashCurrency } from '@core/models/api.models';
import { TRANSACT_STATE_PORT } from './transact-state.port';

@Injectable({
  providedIn: 'root',
})
export class TransactOperationsService {
  private readonly state = inject(TRANSACT_STATE_PORT);

  async deposit(amount: number, currency: CashCurrency = 'USD'): Promise<void> {
    if (!this.state.submitCashMovement) {
      throw new Error('Deposits are unavailable.');
    }

    await this.state.submitCashMovement('DEPOSIT', amount, currency);
  }

  async withdraw(amount: number, currency: CashCurrency = 'USD'): Promise<void> {
    if (!this.state.submitCashMovement) {
      throw new Error('Withdrawals are unavailable.');
    }

    await this.state.submitCashMovement('WITHDRAW', amount, currency);
  }

  async exchange(
    amount: number,
    fromCurrency: CashCurrency,
    toCurrency: CashCurrency,
  ): Promise<CashConversionResponse | null> {
    if (!this.state.convertCash) {
      throw new Error('Currency conversion is unavailable.');
    }

    return this.state.convertCash(fromCurrency, toCurrency, amount);
  }
}
