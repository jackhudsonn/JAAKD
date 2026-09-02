import { Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormCardComponent } from '../../../shared/components/form-card/form-card.component';
import { PaymentMethod, Withdrawal } from '../../../core/models';

@Component({
  selector: 'app-withdrawal-form',
  standalone: true,
  imports: [FormsModule, FormCardComponent],
  templateUrl: './withdrawal-form.component.html',
  styleUrl: './withdrawal-form.component.css',
})
export class WithdrawalFormComponent {
  amount: number | null = null;
  method: PaymentMethod = 'bank_transfer';
  error = signal('');

  submitted = output<Withdrawal>();

  submit() {
    if (!this.amount || this.amount <= 0) {
      this.error.set('Enter an amount greater than zero.');
      return;
    }

    this.error.set('');
    // TODO: call TransactionService.withdraw(...) instead of just emitting locally.
    this.submitted.emit({ amount: this.amount, method: this.method });
    this.amount = null;
  }
}
