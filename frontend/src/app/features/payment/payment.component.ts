import { Component, computed, inject } from '@angular/core';
import { AddMethodCardComponent } from './cards/add-method/add-method-card.component';
import { PaymentMethodsStore } from './services/payment-methods.store';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [AddMethodCardComponent],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.css',
})
export class PaymentComponent {
  private readonly paymentMethodsStore = inject(PaymentMethodsStore);

  readonly loadState = this.paymentMethodsStore.loadState;
  readonly loadError = this.paymentMethodsStore.loadError;
  readonly loadFailed = computed(() => this.loadState() === 'error');

  constructor() {
    void this.paymentMethodsStore.load();
  }
}
