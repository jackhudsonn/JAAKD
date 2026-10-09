import { Injectable, inject } from '@angular/core';
import { Deposit, Withdrawal } from '@core/models';
import { TransactOperationsService } from './transact-operations.service';
import { TRANSACT_STATE_PORT } from './transact-state.port';

export interface ExchangeRequest {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
}

@Injectable({
  providedIn: 'root',
})
export class TransactFacadeService {
  private readonly state = inject(TRANSACT_STATE_PORT);
  private readonly operations = inject(TransactOperationsService);

  readonly transactions = this.state.transactions.asReadonly();
  readonly backendDataMode = this.state.backendDataMode ?? false;
  readonly loadState = this.state.loadState;

  async load(): Promise<void> {
    await this.state.load?.();
  }

  async submitDeposit(deposit: Deposit): Promise<void> {
    await this.operations.deposit(deposit.amount, deposit.method);
  }

  async submitWithdrawal(withdrawal: Withdrawal): Promise<void> {
    await this.operations.withdraw(withdrawal.amount, withdrawal.method);
  }

  async submitExchange(request: ExchangeRequest): Promise<void> {
    await this.operations.exchange(
      request.amount,
      request.fromCurrency,
      request.toCurrency,
      'bank_transfer',
    );
  }
}
