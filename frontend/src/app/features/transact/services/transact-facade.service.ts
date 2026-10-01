import { Injectable, inject } from '@angular/core';
import { Deposit, Withdrawal } from '@core/models';
import { TransactOperationsService } from './transact-operations.service';
import { TRANSACT_STATE_PORT } from './transact-state.port';

@Injectable({
  providedIn: 'root',
})
export class TransactFacadeService {
  private readonly state = inject(TRANSACT_STATE_PORT);
  private readonly operations = inject(TransactOperationsService);

  readonly transactions = this.state.transactions.asReadonly();

  submitDeposit(deposit: Deposit) {
    this.operations.deposit(deposit.amount, deposit.method);
  }

  submitWithdrawal(withdrawal: Withdrawal) {
    this.operations.withdraw(withdrawal.amount, withdrawal.method);
  }
}
