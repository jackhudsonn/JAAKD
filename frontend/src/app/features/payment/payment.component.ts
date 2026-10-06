import { Component, signal } from '@angular/core';
import { StoredPaymentMethodType } from '@features/payment/services/payment-methods.store';
import { AddMethodCardComponent } from './cards/add-method-card/add-method-card.component';
import { SavedMethodsCardComponent } from './cards/saved-methods-card/saved-methods-card.component';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [AddMethodCardComponent, SavedMethodsCardComponent],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.css',
})
export class PaymentComponent {
  activeType = signal<StoredPaymentMethodType>('bank');

  setType(type: StoredPaymentMethodType) {
    this.activeType.set(type);
  }
}
