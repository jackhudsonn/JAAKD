import { Component, input, output } from '@angular/core';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { formatLabel } from '../../../shared/utils/format-label';
import { Order } from '../../../core/models';

@Component({
  selector: 'app-order-details-popup',
  standalone: true,
  imports: [ModalComponent, StatusBadgeComponent, DatePipe, DecimalPipe, TitleCasePipe],
  templateUrl: './order-details-popup.component.html',
  styleUrl: './order-details-popup.component.css',
})
export class OrderDetailsPopupComponent {
  order = input.required<Order>();

  closed = output<void>();
  cancel = output<string>();

  formatLabel = formatLabel;
}
