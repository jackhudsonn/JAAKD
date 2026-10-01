import { Injectable } from '@angular/core';
import { addMockTransaction } from '@core/mocks/mock-data';
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
}
