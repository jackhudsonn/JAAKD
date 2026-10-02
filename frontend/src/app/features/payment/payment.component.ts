import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import {
  BankAccountType,
  PaymentMethodsStore,
  StoredPaymentMethodType,
} from './services/payment-methods.store';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [FormsModule, TitleCasePipe],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.css',
})
export class PaymentComponent {
  private readonly paymentMethodsStore = inject(PaymentMethodsStore);

  activeType = signal<StoredPaymentMethodType>('bank');
  methods = this.paymentMethodsStore.methods;
  formError = signal('');
  statusMessage = signal('');

  bankNickname = '';
  bankName = '';
  bankAccountType: BankAccountType = 'checking';
  bankRoutingNumber = '';
  bankAccountNumber = '';

  cardNickname = '';
  cardNumber = '';
  expMonth = '';
  expYear = '';

  cryptoNetwork = 'Ethereum';
  walletAddress = '';
  cryptoNickname = '';

  activeMethods = computed(() =>
    this.methods().filter((method) => method.type === this.activeType()),
  );

  setType(type: StoredPaymentMethodType) {
    this.activeType.set(type);
    this.formError.set('');
    this.statusMessage.set('');
  }

  addActiveMethod() {
    this.formError.set('');
    this.statusMessage.set('');

    if (this.activeType() === 'bank') {
      this.addBankAccount();
      return;
    }

    if (this.activeType() === 'debit_card') {
      this.addDebitCard();
      return;
    }

    this.addCryptoWallet();
  }

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

  private addBankAccount() {
    const nickname = this.bankNickname.trim();
    const bankName = this.bankName.trim();
    const routingDigits = this.bankRoutingNumber.replace(/\D/g, '');
    const accountDigits = this.bankAccountNumber.replace(/\D/g, '');

    if (!nickname || !bankName || routingDigits.length < 4 || accountDigits.length < 4) {
      this.formError.set(
        'Enter a nickname, bank name, and routing/account numbers (minimum 4 digits).',
      );
      return;
    }

    this.paymentMethodsStore.addBankAccount({
      nickname,
      bankName,
      accountType: this.bankAccountType,
      accountNumber: accountDigits,
      routingNumber: routingDigits,
    });

    this.bankNickname = '';
    this.bankName = '';
    this.bankRoutingNumber = '';
    this.bankAccountNumber = '';
    this.bankAccountType = 'checking';
    this.statusMessage.set('Bank account added.');
  }

  private addDebitCard() {
    const nickname = this.cardNickname.trim();
    const cardDigits = this.cardNumber.replace(/\D/g, '');
    const expMonth = this.expMonth.trim();
    const expYear = this.expYear.trim();

    const monthNumber = Number(expMonth);

    if (
      !nickname ||
      cardDigits.length < 12 ||
      Number.isNaN(monthNumber) ||
      monthNumber < 1 ||
      monthNumber > 12 ||
      expYear.length !== 4
    ) {
      this.formError.set('Enter a nickname, card number, and valid expiration date.');
      return;
    }

    this.paymentMethodsStore.addDebitCard({
      nickname,
      cardNumber: cardDigits,
      expMonth,
      expYear,
    });

    this.cardNickname = '';
    this.cardNumber = '';
    this.expMonth = '';
    this.expYear = '';
    this.statusMessage.set('Debit card added.');
  }

  private addCryptoWallet() {
    const nickname = this.cryptoNickname.trim();
    const walletAddress = this.walletAddress.trim();

    if (!nickname || walletAddress.length < 12) {
      this.formError.set('Enter a nickname and wallet address with at least 12 characters.');
      return;
    }

    this.paymentMethodsStore.addCryptoWallet({
      nickname,
      network: this.cryptoNetwork,
      walletAddress,
    });

    this.walletAddress = '';
    this.cryptoNickname = '';
    this.cryptoNetwork = 'Ethereum';
    this.statusMessage.set('Crypto wallet added.');
  }
}
