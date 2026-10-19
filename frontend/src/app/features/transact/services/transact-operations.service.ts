import { Injectable, inject } from '@angular/core';
import { addMockExchangeTransaction, addMockTransaction } from '@core/mocks/state.mock';
import { PaymentMethod } from '@core/models';
import { CashConversionResponse, CashCurrency } from '@core/models/api.models';
import { TRANSACT_STATE_PORT } from './transact-state.port';

@Injectable({
  providedIn: 'root',
})
export class TransactOperationsService {
  private readonly state = inject(TRANSACT_STATE_PORT);

  async deposit(amount: number, method: PaymentMethod, currency = 'USD'): Promise<void> {
    if (this.state.backendDataMode && this.state.submitCashMovement) {
      await this.state.submitCashMovement('DEPOSIT', amount, currency);
      return;
    }

    addMockTransaction('deposit', amount, method);
  }

  async withdraw(amount: number, method: PaymentMethod, currency = 'USD'): Promise<void> {
    if (this.state.backendDataMode && this.state.submitCashMovement) {
      await this.state.submitCashMovement('WITHDRAW', amount, currency);
      return;
    }

    addMockTransaction('withdrawal', amount, method);
  }

  async exchange(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    method: PaymentMethod,
  ): Promise<CashConversionResponse | null> {
    if (this.state.backendDataMode && this.state.convertCash) {
      return this.state.convertCash(
        fromCurrency as CashCurrency,
        toCurrency as CashCurrency,
        amount,
      );
    }

    addMockExchangeTransaction(amount, `${fromCurrency} → ${toCurrency}`, method);
    return null;
  }
}
