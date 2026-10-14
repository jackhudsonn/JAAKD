import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BankAccountType,
  PaymentMethodsStore,
} from '@features/payment/services/payment-methods.store';

@Component({
  selector: 'app-add-method-card',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './add-method-card.component.html',
  styleUrl: './add-method-card.component.css',
})
export class AddMethodCardComponent {
  private readonly paymentMethodsStore = inject(PaymentMethodsStore);

  formError = signal('');
  statusMessage = signal('');
  submitting = signal(false);

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

    this.formError.set('');
    this.statusMessage.set('');
    await this.addBankAccount();
  }

  private async addBankAccount() {
    const nickname = this.bankNickname.trim();
    const accountHolderName = this.bankAccountHolderName.trim();
    const bankName = this.bankName.trim();
    const routingDigits = this.bankRoutingNumber.replace(/\D/g, '');
    const accountDigits = this.bankAccountNumber.replace(/\D/g, '');

    if (!nickname || !accountHolderName || !bankName) {
      this.formError.set('Enter a nickname, account holder name, and bank name.');
      return;
    }

    if (routingDigits.length !== this.bankRoutingNumber.length || routingDigits.length !== 9) {
      this.formError.set('Routing number must be exactly 9 digits.');
      return;
    }

    if (
      accountDigits.length !== this.bankAccountNumber.length ||
      accountDigits.length < 4 ||
      accountDigits.length > 17
    ) {
      this.formError.set('Account number must be 4 to 17 digits.');
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
      this.statusMessage.set('Bank account added.');
    } catch (error) {
      this.formError.set(error instanceof Error ? error.message : 'Unable to add payment method.');
    } finally {
      this.submitting.set(false);
    }
  }
}
