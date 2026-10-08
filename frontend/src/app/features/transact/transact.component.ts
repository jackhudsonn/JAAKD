import { Component, inject } from '@angular/core';
import { MoveFundsFormComponent } from './cards/move-funds-card/move-funds.component';
import { TransactionHistoryComponent } from './cards/transaction-history-card/transaction-history.component';
import { CurrencyExchangeComponent } from './cards/currency-exchange-card/currency-exchange.component';
import { Deposit, Withdrawal } from '@core/models';
import { ExchangeRequest, TransactFacadeService } from '@features/transact/services/transact-facade.service';

@Component({
  selector: 'app-transact',
  standalone: true,
  imports: [MoveFundsFormComponent, CurrencyExchangeComponent, TransactionHistoryComponent],
  templateUrl: './transact.component.html',
  styleUrl: './transact.component.css',
})
export class TransactComponent {
  private readonly transactFacade = inject(TransactFacadeService);

  // TODO: back this facade state with API reads instead of mock in-memory signals.
  transactions = this.transactFacade.transactions;

  onDeposit(deposit: Deposit) {
    this.transactFacade.submitDeposit(deposit);
  }

  onWithdrawal(withdrawal: Withdrawal) {
    this.transactFacade.submitWithdrawal(withdrawal);
  }

  onExchange(request: ExchangeRequest) {
    this.transactFacade.submitExchange(request);
  }
}
