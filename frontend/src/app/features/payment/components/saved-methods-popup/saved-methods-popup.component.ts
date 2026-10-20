import { TitleCasePipe } from '@angular/common';
import { Component, inject, output, signal } from '@angular/core';
import {
  PaymentMethodsStore,
  StoredBankPaymentMethod,
} from '@features/payment/services/payment-methods.store';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { ScrollableListComponent } from '@shared/components/scrollable-list/scrollable-list.component';
import { ToastService } from '@shared/components/toast/toast.service';

@Component({
  selector: 'app-saved-methods-popup',
  standalone: true,
  imports: [ModalComponent, ScrollableListComponent, TitleCasePipe],
  templateUrl: './saved-methods-popup.component.html',
  styleUrl: './saved-methods-popup.component.css',
})
export class SavedMethodsPopupComponent {
  private readonly paymentMethodsStore = inject(PaymentMethodsStore);
  private readonly toastService = inject(ToastService);

  readonly methods = this.paymentMethodsStore.methods;
  readonly removingMethodId = signal<string | null>(null);

  readonly closed = output<void>();

  close() {
    this.closed.emit();
  }

  async removeMethod(methodId: string) {
    this.removingMethodId.set(methodId);

    try {
      await this.paymentMethodsStore.removeMethod(methodId);
      this.toastService.success('Payment method removed.');
    } catch (error) {
      this.toastService.error(
        error instanceof Error ? error.message : 'Unable to remove payment method.',
      );
    } finally {
      this.removingMethodId.set(null);
    }
  }

  trackByMethodId(method: StoredBankPaymentMethod): string {
    return method.id;
  }
}
