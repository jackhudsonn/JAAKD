import { Component, computed, effect, inject } from '@angular/core';
import { AddMethodCardComponent } from './cards/add-method/add-method-card.component';
import { PaymentMethodsStore } from './services/payment-methods.store';
import { ToastService } from '@shared/components/toast/toast.service';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [AddMethodCardComponent],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.css',
})
export class PaymentComponent {
  private readonly paymentMethodsStore = inject(PaymentMethodsStore);
  private readonly toastService = inject(ToastService);

  readonly loadState = this.paymentMethodsStore.loadState;
  readonly loadError = this.paymentMethodsStore.loadError;
  readonly loadFailed = computed(() => this.loadState() === 'error');

  constructor() {
    effect(() => {
      if (this.loadFailed() && this.loadError().trim()) {
        this.toastService.error(this.loadError());
      }
    });

    void this.paymentMethodsStore.load();
  }
}
