import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { PaymentMethod, Withdrawal } from '@core/models';
import { PaymentMethodsStore } from '../../payment/services/payment-methods.store';

@Component({
  selector: 'app-withdrawal-form',
  standalone: true,
  imports: [FormsModule, WidgetCardComponent, ModalComponent],
  templateUrl: './withdrawal-form.component.html',
  styleUrl: './withdrawal-form.component.css',
})
export class WithdrawalFormComponent {
  private static readonly ADD_METHOD_OPTION_VALUE = '__add_method__';

  private readonly paymentMethodsStore = inject(PaymentMethodsStore);
  private readonly router = inject(Router);

  amount: number | null = null;
  selectedMethodId = '';
  error = signal('');
  pendingWithdrawal = signal<Withdrawal | null>(null);

  paymentOptions = this.paymentMethodsStore.transactOptions;
  hasPaymentOptions = computed(() => this.paymentOptions().length > 0);

  submitted = output<Withdrawal>();

  onMethodSelectionChange() {
    if (this.selectedMethodId !== WithdrawalFormComponent.ADD_METHOD_OPTION_VALUE) {
      return;
    }

    void this.router.navigateByUrl('/payment-methods');

    const options = this.paymentOptions();
    this.selectedMethodId = options.length > 0 ? options[0].id : '';
  }

  submit() {
    if (!this.hasPaymentOptions()) {
      this.error.set('Select Add + from Payment Method to create one first.');
      return;
    }

    if (!this.amount || this.amount <= 0) {
      this.error.set('Enter an amount greater than zero.');
      return;
    }

    const selectedMethod = this.resolveSelectedMethod();
    if (!selectedMethod) {
      this.error.set('Select a payment method.');
      return;
    }

    this.error.set('');

    this.pendingWithdrawal.set({
      amount: this.amount,
      method: selectedMethod,
    });
  }

  confirmWithdrawal() {
    const pendingWithdrawal = this.pendingWithdrawal();
    if (!pendingWithdrawal) {
      return;
    }

    // Submission handling lives in the feature-level transact facade.
    this.submitted.emit(pendingWithdrawal);
    this.pendingWithdrawal.set(null);
    this.amount = null;
  }

  cancelWithdrawal() {
    this.pendingWithdrawal.set(null);
  }

  private resolveSelectedMethod(): PaymentMethod | null {
    const options = this.paymentOptions();
    if (options.length === 0) {
      return null;
    }

    if (this.selectedMethodId === WithdrawalFormComponent.ADD_METHOD_OPTION_VALUE) {
      return null;
    }

    if (!this.selectedMethodId) {
      this.selectedMethodId = options[0].id;
      return options[0].method;
    }

    const selectedOption = options.find((option) => option.id === this.selectedMethodId);
    return selectedOption?.method ?? null;
  }
}
