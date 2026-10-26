import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ORDER_STATUS } from '@core/constants/order-status.constants';
import { Transaction } from '@core/models';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { formatLabel } from '@shared/utils/format-label';

@Component({
  selector: 'app-transaction-details-popup',
  standalone: true,
  imports: [ModalComponent, StatusBadgeComponent, CurrencyPipe, DatePipe],
  templateUrl: './transaction-details-popup.component.html',
  styleUrl: './transaction-details-popup.component.css',
})
export class TransactionDetailsPopupComponent {
  transaction = input.required<Transaction>();
  cancelling = input(false);

  closed = output<void>();
  cancel = output<string>();

  readonly formatLabel = formatLabel;

  canCancelTransaction() {
    return this.transaction().status === ORDER_STATUS.PENDING;
  }
}
