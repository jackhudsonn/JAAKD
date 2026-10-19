import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MoveFundsFormComponent } from './cards/move-funds/move-funds.component';
import { TransactionHistoryComponent } from './cards/transaction-history/transaction-history.component';
import { CurrencyExchangeComponent } from './cards/currency-exchange/currency-exchange.component';
import { Deposit, Withdrawal } from '@core/models';
import {
  ExchangeRequest,
  TransactFacadeService,
} from '@features/transact/services/transact-facade.service';
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
  readonly exchangeMessage = signal('');
  readonly exchangeError = signal('');
  readonly cashBalances = computed(() => this.transactFacade.cashBalances?.() ?? {});

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

  async onExchange(request: ExchangeRequest) {
    this.exchangeMessage.set('');
    this.exchangeError.set('');
    this.submittingAction.set(true);

    try {
      const result = await this.transactFacade.submitExchange(request);
      if (result) {
        this.exchangeMessage.set(
          `Exchanged ${result.sourceAmount} ${result.sourceCurrency} for ` +
            `${result.targetAmount.toFixed(2)} ${result.targetCurrency} ` +
            `(1 ${result.sourceCurrency} = ${result.conversionRate} ${result.targetCurrency}).`,
        );
      }
    } catch (error) {
      this.exchangeError.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'The exchange could not be completed.',
      );
    } finally {
      this.submittingAction.set(false);
    }
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
