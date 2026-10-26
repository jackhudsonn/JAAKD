import { Component, computed, input, output } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ORDER_STATUS } from '@core/constants/order-status.constants';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { ScrollableListComponent } from '@shared/components/scrollable-list/scrollable-list.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { Order } from '@core/models';

@Component({
  selector: 'app-trade-history',
  standalone: true,
  imports: [
    WidgetCardComponent,
    ScrollableListComponent,
    StatusBadgeComponent,
    DatePipe,
    TitleCasePipe,
  ],
  templateUrl: './trade-history.component.html',
  styleUrl: './trade-history.component.css',
})
export class TradeHistoryComponent {
  orders = input.required<readonly Order[]>();

  selectOrder = output<string>();

  rows = computed(() => {
    const sorted = [...this.orders()].sort(
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

  trackById = (row: { order: Order }) => row.order.id;
}
