import { Component, signal } from '@angular/core';
import { DepositFormComponent } from './deposit-form/deposit-form.component';
import { WithdrawalFormComponent } from './withdrawal-form/withdrawal-form.component';
import { TransactionHistoryComponent } from './transaction-history/transaction-history.component';
import { addMockTransaction, MOCK_STATE } from '@core/mocks/mock-data';
import { Deposit, PaymentMethod, Withdrawal } from '@core/models';

type TransactTab = 'deposit' | 'withdrawal';

@Component({
  selector: 'app-transact',
  standalone: true,
  imports: [DepositFormComponent, WithdrawalFormComponent, TransactionHistoryComponent],
  templateUrl: './transact.component.html',
  styleUrl: './transact.component.css',
})
export class TransactComponent {
  // Drives which form is shown on mobile; both are always rendered on desktop.
  activeTab = signal<TransactTab>('deposit');

  // TODO: replace with TransactionService.getHistory() and re-fetch after each submission.
  transactions = MOCK_STATE.transactions;

  setTab(tab: TransactTab) {
    this.activeTab.set(tab);
  }

  onDeposit(deposit: Deposit) {
    this.addTransaction('deposit', deposit.amount, deposit.method);
  }

  onWithdrawal(withdrawal: Withdrawal) {
    this.addTransaction('withdrawal', withdrawal.amount, withdrawal.method);
  }

  private addTransaction(type: TransactTab, amount: number, method: PaymentMethod) {
    // TODO: replace helper call with real service mutation + server response.
    addMockTransaction(type, amount, method);
  }
}
