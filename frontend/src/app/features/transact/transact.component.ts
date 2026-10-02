import { Component, inject } from '@angular/core';
import { DepositFormComponent } from './deposit-form/deposit-form.component';
import { TransactionHistoryComponent } from './transaction-history/transaction-history.component';
import { CurrencyExchangeComponent } from './currency-exchange/currency-exchange.component';
import { Deposit, Withdrawal } from '@core/models';
import { ExchangeRequest, TransactFacadeService } from './services/transact-facade.service';

@Component({
  selector: 'app-transact',
  standalone: true,
  imports: [DepositFormComponent, CurrencyExchangeComponent, TransactionHistoryComponent],
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
