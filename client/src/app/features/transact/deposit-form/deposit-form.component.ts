import { Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormCardComponent } from '../../../shared/components/form-card/form-card.component';
import { Deposit, PaymentMethod } from '../../../core/models';

@Component({
  selector: 'app-deposit-form',
  standalone: true,
  imports: [FormsModule, FormCardComponent],
  templateUrl: './deposit-form.component.html',
  styleUrl: './deposit-form.component.css',
})
export class DepositFormComponent {
  amount: number | null = null;
  method: PaymentMethod = 'bank_transfer';
  error = signal('');

  submitted = output<Deposit>();

  submit() {
    if (!this.amount || this.amount <= 0) {
      this.error.set('Enter an amount greater than zero.');
      return;
    }

    this.error.set('');
    // TODO: call TransactionService.deposit(...) instead of just emitting locally.
    this.submitted.emit({ amount: this.amount, method: this.method });
    this.amount = null;
  }
}
