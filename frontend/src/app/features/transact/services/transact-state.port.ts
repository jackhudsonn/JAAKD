import { InjectionToken, Signal, WritableSignal } from '@angular/core';
import { MOCK_STATE } from '@core/mocks/state.mock';
import { Transaction } from '@core/models';
import { CashConversionResponse, CashCurrency } from '@core/models/api.models';

export interface TransactStatePort {
  readonly transactions: WritableSignal<Transaction[]>;
  readonly backendDataMode?: boolean;
  readonly loadState?: Signal<'loading' | 'ready' | 'error'>;
  readonly cashBalances?: Signal<Record<string, number>>;
  readonly cashCurrencies?: Signal<readonly CashCurrency[]>;
  load?(): Promise<void>;
  submitCashMovement?(
    side: 'DEPOSIT' | 'WITHDRAW',
    amount: number,
    currency?: CashCurrency,
  ): Promise<void>;
  cancelTransaction?(transactionId: string): Promise<void>;
  convertCash?(
    fromCurrency: CashCurrency,
    toCurrency: CashCurrency,
    amount: number,
  ): Promise<CashConversionResponse>;
}

export const TRANSACT_STATE_PORT = new InjectionToken<TransactStatePort>('TRANSACT_STATE_PORT', {
  providedIn: 'root',
  factory: () => ({
    transactions: MOCK_STATE.transactions,
  }),
});
