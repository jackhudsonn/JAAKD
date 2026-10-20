import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MoveFundsFormComponent } from './cards/move-funds/move-funds.component';
import { TransactionHistoryComponent } from './cards/transaction-history/transaction-history.component';
import { CurrencyExchangeComponent } from './cards/currency-exchange/currency-exchange.component';
import { Deposit, Withdrawal } from '@core/models';
import { CASH_CURRENCIES } from '@core/models/api.models';
import {
  ExchangeRequest,
  TransactFacadeService,
} from '@features/transact/services/transact-facade.service';
import { TRANSACT_STATE_PORT } from './services/transact-state.port';
import { BackendTransactStateService } from './services/backend-transact-state.service';
import { TransactOperationsService } from './services/transact-operations.service';
import { ToastService } from '@shared/components/toast/toast.service';

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
  private readonly toastService = inject(ToastService);

  transactions = this.transactFacade.transactions;
  readonly backendDataMode = this.transactFacade.backendDataMode;
  readonly loadState = computed(() => this.transactFacade.loadState?.() ?? 'ready');
  readonly submittingAction = signal(false);
  readonly cashBalances = computed(() => this.transactFacade.cashBalances?.() ?? {});
  readonly currencies = computed(() => this.transactFacade.cashCurrencies?.() ?? CASH_CURRENCIES);

  ngOnInit() {
    void this.transactFacade.load();
  }

  async onDeposit(deposit: Deposit) {
    this.submittingAction.set(true);

    try {
      await this.transactFacade.submitDeposit(deposit);
      this.toastService.success(`Deposit submitted for ${deposit.amount} ${deposit.currency}.`);
    } catch (error) {
      this.toastService.error(this.toActionErrorMessage(error));
    } finally {
      this.submittingAction.set(false);
    }
  }

  async onWithdrawal(withdrawal: Withdrawal) {
    this.submittingAction.set(true);

    try {
      await this.transactFacade.submitWithdrawal(withdrawal);
      this.toastService.success(
        `Withdrawal submitted for ${withdrawal.amount} ${withdrawal.currency}.`,
      );
    } catch (error) {
      this.toastService.error(this.toActionErrorMessage(error));
    } finally {
      this.submittingAction.set(false);
    }
  }

  async onExchange(request: ExchangeRequest) {
    this.submittingAction.set(true);

    try {
      const result = await this.transactFacade.submitExchange(request);
      if (result) {
        this.toastService.success(
          `Exchanged ${result.sourceAmount} ${result.sourceCurrency} for ` +
            `${result.targetAmount.toFixed(2)} ${result.targetCurrency} ` +
            `(1 ${result.sourceCurrency} = ${result.conversionRate} ${result.targetCurrency}).`,
        );
      }
    } catch (error) {
      this.toastService.error(
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
