import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MoveFundsFormComponent } from './cards/move-funds-card/move-funds.component';
import { TransactionHistoryComponent } from './cards/transaction-history-card/transaction-history.component';
import { CurrencyExchangeComponent } from './cards/currency-exchange-card/currency-exchange.component';
import { Deposit, Withdrawal } from '@core/models';
import { ExchangeRequest, TransactFacadeService } from '@features/transact/services/transact-facade.service';
import { TRANSACT_STATE_PORT } from './services/transact-state.port';
import { BackendTransactStateService } from './services/backend-transact-state.service';
import { TransactOperationsService } from './services/transact-operations.service';

@Component({
  selector: 'app-transact',
  standalone: true,
  providers: [
    BackendTransactStateService,
    TransactFacadeService,
    TransactOperationsService,
    { provide: TRANSACT_STATE_PORT, useExisting: BackendTransactStateService },
  ],
  imports: [MoveFundsFormComponent, CurrencyExchangeComponent, TransactionHistoryComponent],
  templateUrl: './transact.component.html',
  styleUrl: './transact.component.css',
})
export class TransactComponent implements OnInit {
  private readonly transactFacade = inject(TransactFacadeService);

  transactions = this.transactFacade.transactions;
  readonly backendDataMode = this.transactFacade.backendDataMode;
  readonly loadState = computed(() => this.transactFacade.loadState?.() ?? 'ready');
  readonly actionError = signal('');
  readonly submittingAction = signal(false);

  ngOnInit() {
    void this.transactFacade.load();
  }

  async onDeposit(deposit: Deposit) {
    this.actionError.set('');
    this.submittingAction.set(true);

    try {
      await this.transactFacade.submitDeposit(deposit);
    } catch (error) {
      this.actionError.set(this.toActionErrorMessage(error));
    } finally {
      this.submittingAction.set(false);
    }
  }

  async onWithdrawal(withdrawal: Withdrawal) {
    this.actionError.set('');
    this.submittingAction.set(true);

    try {
      await this.transactFacade.submitWithdrawal(withdrawal);
    } catch (error) {
      this.actionError.set(this.toActionErrorMessage(error));
    } finally {
      this.submittingAction.set(false);
    }
  }

  onExchange(request: ExchangeRequest) {
    void this.transactFacade.submitExchange(request);
  }

  retryLoad() {
    void this.transactFacade.load();
  }

  private toActionErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    return 'The cash movement could not be completed.';
  }
}
