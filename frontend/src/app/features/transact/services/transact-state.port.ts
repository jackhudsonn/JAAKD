import { InjectionToken, Signal, WritableSignal } from '@angular/core';
import { MOCK_STATE } from '@core/mocks/state.mock';
import { Transaction } from '@core/models';

export interface TransactStatePort {
  readonly transactions: WritableSignal<Transaction[]>;
  readonly backendDataMode?: boolean;
  readonly loadState?: Signal<'loading' | 'ready' | 'error'>;
  load?(): Promise<void>;
  submitCashMovement?(side: 'DEPOSIT' | 'WITHDRAW', amount: number): Promise<void>;
}

export const TRANSACT_STATE_PORT = new InjectionToken<TransactStatePort>('TRANSACT_STATE_PORT', {
  providedIn: 'root',
  factory: () => ({
    transactions: MOCK_STATE.transactions,
  }),
});
