import { Component, computed, input, output } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ORDER_STATUS } from '@core/constants/order-status.constants';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { ScrollableListComponent } from '@shared/components/scrollable-list/scrollable-list.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { Order } from '@core/models';

/**
 * Combined Orders card: open and completed/cancelled orders share a single
 * newest-first, scrollable list. Open orders and rejected orders
 * stay selectable — clicking opens the Order Details popup.
 */
@Component({
  selector: 'app-orders-card',
  standalone: true,
  imports: [
    WidgetCardComponent,
    ScrollableListComponent,
    StatusBadgeComponent,
    DatePipe,
    TitleCasePipe,
  ],
  templateUrl: './orders-card.component.html',
  styleUrl: './orders-card.component.css',
})
export class OrdersCardComponent {
  openOrders = input.required<readonly Order[]>();
  historyOrders = input.required<readonly Order[]>();

  selectOrder = output<string>();

  rows = computed(() => {
    const sorted = [...this.openOrders(), ...this.historyOrders()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return sorted.map((order) => ({
      order,
      isSelectable:
        order.status === ORDER_STATUS.SUBMITTED ||
        order.status === ORDER_STATUS.PENDING ||
        order.status === ORDER_STATUS.ACCEPTED ||
        order.status === ORDER_STATUS.REJECTED ||
        order.status === ORDER_STATUS.FAILED,
    }));
  });

  trackByRow = (row: { order: Order }) => row.order.id;
}
