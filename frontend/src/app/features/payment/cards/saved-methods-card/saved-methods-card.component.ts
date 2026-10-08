import { Component, computed, inject, input, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import {
  PaymentMethodsStore,
  StoredPaymentMethodType,
} from '@features/payment/services/payment-methods.store';

@Component({
  selector: 'app-saved-methods-card',
  standalone: true,
  imports: [TitleCasePipe],
  templateUrl: './saved-methods-card.component.html',
  styleUrl: './saved-methods-card.component.css',
})
export class SavedMethodsCardComponent {
  activeType = input.required<StoredPaymentMethodType>();

  private readonly paymentMethodsStore = inject(PaymentMethodsStore);

  private readonly methods = this.paymentMethodsStore.methods;

  statusMessage = signal('');

  activeMethods = computed(() =>
    this.methods().filter((method) => method.type === this.activeType()),
  );

  setDefault(methodId: string) {
    this.paymentMethodsStore.setDefault(methodId);
    this.statusMessage.set('Default payment method updated.');
  }

  removeMethod(methodId: string) {
    this.paymentMethodsStore.removeMethod(methodId);
    this.statusMessage.set('Payment method removed.');
  }

  formatMethodType(type: StoredPaymentMethodType): string {
    if (type === 'bank') {
      return 'Bank Account';
    }

    if (type === 'debit_card') {
      return 'Debit Card';
    }

    return 'Crypto Wallet';
  }
}
