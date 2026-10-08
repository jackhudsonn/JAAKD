import { Injectable } from '@angular/core';
import { addMockExchangeTransaction, addMockTransaction } from '@core/mocks/state.mock';
import { PaymentMethod } from '@core/models';

@Injectable({
  providedIn: 'root',
})
export class TransactOperationsService {
  deposit(amount: number, method: PaymentMethod) {
    addMockTransaction('deposit', amount, method);
  }

  withdraw(amount: number, method: PaymentMethod) {
    addMockTransaction('withdrawal', amount, method);
  }

  exchange(amount: number, fromCurrency: string, toCurrency: string, method: PaymentMethod) {
    addMockExchangeTransaction(amount, `${fromCurrency} → ${toCurrency}`, method);
  }
}
