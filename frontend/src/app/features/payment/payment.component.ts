import { Component, signal } from '@angular/core';
import { AddMethodCardComponent } from './cards/add-method/add-method-card.component';
import { SavedMethodsCardComponent } from './cards/saved-methods/saved-methods-card.component';
import { StoredPaymentMethodType } from './services/payment-methods.store';

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
