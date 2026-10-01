import { Component, inject, signal } from '@angular/core';
import { DepositFormComponent } from './deposit-form/deposit-form.component';
import { WithdrawalFormComponent } from './withdrawal-form/withdrawal-form.component';
import { TransactionHistoryComponent } from './transaction-history/transaction-history.component';
import { Deposit, Withdrawal } from '@core/models';
import { TransactFacadeService } from './services/transact-facade.service';

type TransactTab = 'deposit' | 'withdrawal';

@Component({
  selector: 'app-transact',
  standalone: true,
  imports: [DepositFormComponent, WithdrawalFormComponent, TransactionHistoryComponent],
  templateUrl: './transact.component.html',
  styleUrl: './transact.component.css',
})
export class TransactComponent {
  private readonly transactFacade = inject(TransactFacadeService);

  // Drives which form is shown on mobile; both are always rendered on desktop.
  activeTab = signal<TransactTab>('deposit');

  // TODO: back this facade state with API reads instead of mock in-memory signals.
  transactions = this.transactFacade.transactions;

  setTab(tab: TransactTab) {
    this.activeTab.set(tab);
  }

  onDeposit(deposit: Deposit) {
    this.transactFacade.submitDeposit(deposit);
  }

  onWithdrawal(withdrawal: Withdrawal) {
    this.transactFacade.submitWithdrawal(withdrawal);
  }
}
