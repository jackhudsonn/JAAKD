import { TitleCasePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { PaymentMethodsStore } from '@features/payment/services/payment-methods.store';

@Component({
  selector: 'app-saved-methods-card',
  standalone: true,
  imports: [TitleCasePipe],
  templateUrl: './saved-methods-card.component.html',
  styleUrl: './saved-methods-card.component.css',
})
export class SavedMethodsCardComponent {
  private readonly paymentMethodsStore = inject(PaymentMethodsStore);

  methods = this.paymentMethodsStore.methods;
  removingMethodId = signal<string | null>(null);

  statusMessage = signal('');

  async removeMethod(methodId: string) {
    this.removingMethodId.set(methodId);

    try {
      await this.paymentMethodsStore.removeMethod(methodId);
      this.statusMessage.set('Payment method removed.');
    } catch (error) {
      this.statusMessage.set(error instanceof Error ? error.message : 'Unable to remove payment method.');
    } finally {
      this.removingMethodId.set(null);
    }
  }
}
