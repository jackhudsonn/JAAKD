import { Injectable, inject } from '@angular/core';
import { ORDER_STATUS } from '@core/constants/order-status.constants';
import { Deposit, Withdrawal } from '@core/models';
import { CashConversionResponse, CashCurrency } from '@core/models/api.models';
import { TransactOperationsService } from './transact-operations.service';
import { TRANSACT_STATE_PORT } from './transact-state.port';

export interface ExchangeRequest {
  amount: number;
  fromCurrency: CashCurrency;
  toCurrency: CashCurrency;
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
  readonly cashBalances = this.state.cashBalances;
  readonly cashCurrencies = this.state.cashCurrencies;

  async load(): Promise<void> {
    await this.state.load?.();
  }

  async submitDeposit(deposit: Deposit): Promise<void> {
    await this.operations.deposit(deposit.amount, deposit.currency);
  }

  async submitWithdrawal(withdrawal: Withdrawal): Promise<void> {
    await this.operations.withdraw(withdrawal.amount, withdrawal.currency);
  }

  submitExchange(request: ExchangeRequest): Promise<CashConversionResponse | null> {
    return this.operations.exchange(request.amount, request.fromCurrency, request.toCurrency);
  }

  async cancelTransaction(transactionId: string): Promise<void> {
    const transaction = this.transactions().find((entry) => entry.id === transactionId);
    if (!transaction) {
      throw new Error('Transaction not found.');
    }

    if (transaction.status !== ORDER_STATUS.PENDING) {
      throw new Error('Only pending transactions can be cancelled.');
    }

    if (!this.state.cancelTransaction) {
      throw new Error('Transaction cancellation is unavailable.');
    }

    await this.state.cancelTransaction(transactionId);
  }
}
