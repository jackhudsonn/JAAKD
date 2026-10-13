import { Injectable, inject } from '@angular/core';
import { addMockExchangeTransaction, addMockTransaction } from '@core/mocks/state.mock';
import { PaymentMethod } from '@core/models';
import { TRANSACT_STATE_PORT } from './transact-state.port';

@Injectable({
  providedIn: 'root',
})
export class TransactOperationsService {
  private readonly state = inject(TRANSACT_STATE_PORT);

  async deposit(amount: number, method: PaymentMethod): Promise<void> {
    if (this.state.backendDataMode && this.state.submitCashMovement) {
      await this.state.submitCashMovement('DEPOSIT', amount);
      return;
    }

    addMockTransaction('deposit', amount, method);
  }

  async withdraw(amount: number, method: PaymentMethod): Promise<void> {
    if (this.state.backendDataMode && this.state.submitCashMovement) {
      await this.state.submitCashMovement('WITHDRAW', amount);
      return;
    }

    addMockTransaction('withdrawal', amount, method);
  }

  async exchange(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    method: PaymentMethod,
  ): Promise<void> {
    addMockExchangeTransaction(amount, `${fromCurrency} → ${toCurrency}`, method);
  }
}
