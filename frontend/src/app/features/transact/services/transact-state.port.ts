import { InjectionToken, WritableSignal } from '@angular/core';
import { MOCK_STATE } from '@core/mocks/mock-data';
import { Transaction } from '@core/models';

export interface TransactStatePort {
  readonly transactions: WritableSignal<Transaction[]>;
}

export const TRANSACT_STATE_PORT = new InjectionToken<TransactStatePort>('TRANSACT_STATE_PORT', {
  providedIn: 'root',
  factory: () => ({
    transactions: MOCK_STATE.transactions,
  }),
});
