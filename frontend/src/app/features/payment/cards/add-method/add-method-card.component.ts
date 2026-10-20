import { Component, inject, signal } from '@angular/core';
const ROUTING_NUMBER_LENGTH = 9;
const ACCOUNT_NUMBER_MIN_LENGTH = 4;
const ACCOUNT_NUMBER_MAX_LENGTH = 17;
import { FormsModule } from '@angular/forms';
import {
  BankAccountType,
  PaymentMethodsStore,
} from '@features/payment/services/payment-methods.store';
import { SavedMethodsPopupComponent } from '@features/payment/components/saved-methods-popup/saved-methods-popup.component';
import { ToastService } from '@shared/components/toast/toast.service';

@Component({
  selector: 'app-add-method-card',
  standalone: true,
  imports: [FormsModule, SavedMethodsPopupComponent],
  templateUrl: './add-method-card.component.html',
  styleUrl: './add-method-card.component.css',
})
export class AddMethodCardComponent {
  private readonly paymentMethodsStore = inject(PaymentMethodsStore);
  private readonly toastService = inject(ToastService);

  submitting = signal(false);
  showingSavedMethods = signal(false);

  bankNickname = '';
  bankAccountHolderName = '';
  bankName = '';
  bankAccountType: BankAccountType = 'checking';
  bankRoutingNumber = '';
  bankAccountNumber = '';

  async addMethod() {
    if (this.submitting()) {
      return;
    }

    await this.addBankAccount();
  }

  private async addBankAccount() {
    const nickname = this.bankNickname.trim();
    const accountHolderName = this.bankAccountHolderName.trim();
    const bankName = this.bankName.trim();
    const routingDigits = this.bankRoutingNumber.replace(/\D/g, '');
    const accountDigits = this.bankAccountNumber.replace(/\D/g, '');

    if (!nickname || !accountHolderName || !bankName) {
      this.toastService.error('Enter a nickname, account holder name, and bank name.');
      return;
    }

    if (routingDigits.length !== this.bankRoutingNumber.length || routingDigits.length !== ROUTING_NUMBER_LENGTH) {
      this.toastService.error(`Routing number must be exactly ${ROUTING_NUMBER_LENGTH} digits.`);
      return;
    }

    if (
      accountDigits.length !== this.bankAccountNumber.length ||
      accountDigits.length < ACCOUNT_NUMBER_MIN_LENGTH ||
      accountDigits.length > ACCOUNT_NUMBER_MAX_LENGTH
    ) {
      this.toastService.error(
        `Account number must be ${ACCOUNT_NUMBER_MIN_LENGTH} to ${ACCOUNT_NUMBER_MAX_LENGTH} digits.`,
      );
      return;
    }

    this.submitting.set(true);

    try {
      await this.paymentMethodsStore.addBankAccount({
        nickname,
        accountHolderName,
        bankName,
        accountType: this.bankAccountType,
        accountNumber: accountDigits,
        routingNumber: routingDigits,
      });

      this.bankNickname = '';
      this.bankAccountHolderName = '';
      this.bankName = '';
      this.bankRoutingNumber = '';
      this.bankAccountNumber = '';
      this.bankAccountType = 'checking';
      this.toastService.success('Bank account added.');
    } catch (error) {
      this.toastService.error(
        error instanceof Error ? error.message : 'Unable to add payment method.',
      );
    }

    this.submitting.set(false);
  }

  showSavedMethods() {
    this.showingSavedMethods.set(true);
  }

  closeSavedMethods() {
    this.showingSavedMethods.set(false);
  }
}
