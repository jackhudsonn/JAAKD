import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { Deposit, PaymentMethod, Withdrawal } from '@core/models';
import { PaymentMethodsStore } from '@features/payment/services/payment-methods.store';
import { ConfirmActionsComponent } from '../../components/confirm-actions/confirm-actions.component';

type FundsAction = 'deposit' | 'withdrawal';

interface PendingFundsAction {
  action: FundsAction;
  amount: number;
  method: PaymentMethod;
  currency: string;
}

@Component({
  selector: 'app-move-funds-form',
  standalone: true,
  imports: [FormsModule, WidgetCardComponent, ModalComponent, ConfirmActionsComponent],
  templateUrl: './move-funds.component.html',
  styleUrl: './move-funds.component.css',
})
export class MoveFundsFormComponent implements OnInit {
  private static readonly ADD_METHOD_OPTION_VALUE = '__add_method__';

  private readonly paymentMethodsStore = inject(PaymentMethodsStore);
  private readonly router = inject(Router);

  amount: number | null = null;
  selectedCurrency: 'USD' | 'EUR' | 'GBP' | 'INR' = 'USD';
  selectedMethodId = '';
  error = signal('');
  pendingAction = signal<PendingFundsAction | null>(null);
  backendDataMode = input(false);
  submitting = input(false);
  backendError = input('');

  paymentOptions = this.paymentMethodsStore.transactOptions;
  hasPaymentOptions = computed(() => this.paymentOptions().length > 0);

  depositSubmitted = output<Deposit>();
  withdrawalSubmitted = output<Withdrawal>();

  async ngOnInit(): Promise<void> {
    await this.paymentMethodsStore.load();
  }

  onMethodSelectionChange() {
    if (this.selectedMethodId !== MoveFundsFormComponent.ADD_METHOD_OPTION_VALUE) {
      return;
    }

    void this.router.navigateByUrl('/payment-methods');

    const options = this.paymentOptions();
    this.selectedMethodId = options.length > 0 ? options[0].id : '';
  }

  submit(action: FundsAction) {
    if (this.submitting()) {
      return;
    }

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

    this.pendingAction.set({
      action,
      amount: this.amount,
      method: selectedMethod,
      currency: this.selectedCurrency,
    });
  }

  confirmAction() {
    if (this.submitting()) {
      return;
    }

    const pendingAction = this.pendingAction();
    if (!pendingAction) {
      return;
    }

    if (pendingAction.action === 'deposit') {
      this.depositSubmitted.emit({
        amount: pendingAction.amount,
        method: pendingAction.method,
        currency: pendingAction.currency,
      });
    } else {
      this.withdrawalSubmitted.emit({
        amount: pendingAction.amount,
        method: pendingAction.method,
        currency: pendingAction.currency,
      });
    }

    this.pendingAction.set(null);
    this.amount = null;
  }

  cancelAction() {
    this.pendingAction.set(null);
  }

  private resolveSelectedMethod(): PaymentMethod | null {
    const options = this.paymentOptions();
    if (options.length === 0) {
      return null;
    }

    if (this.selectedMethodId === MoveFundsFormComponent.ADD_METHOD_OPTION_VALUE) {
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
