import { Component, input, output } from '@angular/core';
import { StoredPaymentMethodType } from '@features/payment/services/payment-methods.store';

@Component({
  selector: 'app-payment-method-tabs',
  standalone: true,
  templateUrl: './payment-method-tabs.component.html',
  styleUrl: './payment-method-tabs.component.css',
})
export class PaymentMethodTabsComponent {
  activeType = input.required<StoredPaymentMethodType>();

  typeChanged = output<StoredPaymentMethodType>();

  setType(type: StoredPaymentMethodType) {
    this.typeChanged.emit(type);
  }
}
