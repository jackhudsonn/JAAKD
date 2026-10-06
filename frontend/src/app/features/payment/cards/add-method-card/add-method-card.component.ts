import { Component, input, output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BankAccountType,
  PaymentMethodsStore,
  StoredPaymentMethodType,
} from '@features/payment/services/payment-methods.store';
import { PaymentMethodTabsComponent } from '../../components/payment-method-tabs/payment-method-tabs.component';

@Component({
  selector: 'app-add-method-card',
  standalone: true,
  imports: [FormsModule, PaymentMethodTabsComponent],
  templateUrl: './add-method-card.component.html',
  styleUrl: './add-method-card.component.css',
})
export class AddMethodCardComponent {
  activeType = input.required<StoredPaymentMethodType>();
  activeTypeChanged = output<StoredPaymentMethodType>();

  private readonly paymentMethodsStore = inject(PaymentMethodsStore);

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

  setType(type: StoredPaymentMethodType) {
    this.formError.set('');
    this.statusMessage.set('');
    this.activeTypeChanged.emit(type);
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
