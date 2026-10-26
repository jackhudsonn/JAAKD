import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ORDER_STATUS } from '@core/constants/order-status.constants';
import { Order, Transaction } from '@core/models';
import { DASHBOARD_STATE_PORT } from '@features/dashboard/services/dashboard-state.port';
import { ScrollableListComponent } from '@shared/components/scrollable-list/scrollable-list.component';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { formatLabel } from '@shared/utils/format-label';

type PendingOrderRow =
  | { kind: 'trade'; id: string; createdAt: string; order: Order }
  | { kind: 'transaction'; id: string; createdAt: string; transaction: Transaction };

@Component({
  selector: 'app-open-orders-widget',
  standalone: true,
  imports: [WidgetCardComponent, ScrollableListComponent, CurrencyPipe, DatePipe, TitleCasePipe],
  templateUrl: './open-orders.component.html',
  styleUrl: './open-orders.component.css',
})
export class OpenOrdersWidgetComponent {
  private readonly dashboardState = inject(DASHBOARD_STATE_PORT);
  private readonly router = inject(Router);

  readonly formatLabel = formatLabel;

  readonly rows = computed(() => {
    const trades = this.dashboardState
      .orders()
      .filter((order) => order.status === ORDER_STATUS.PENDING)
      .map((order): PendingOrderRow => ({
        kind: 'trade',
        id: order.id,
        createdAt: order.createdAt,
        order,
      }));
    const transactions = this.dashboardState
      .transactions()
      .filter((transaction) => transaction.status === ORDER_STATUS.PENDING)
      .map((transaction): PendingOrderRow => ({
        kind: 'transaction',
        id: transaction.id,
        createdAt: transaction.createdAt,
        transaction,
      }));

    return [...trades, ...transactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  });

  readonly trackById = (row: PendingOrderRow) => row.id;

  openOrder(row: PendingOrderRow) {
    if (row.kind === 'trade') {
      void this.router.navigate(['/trade'], { queryParams: { orderId: row.id } });
      return;
    }

    void this.router.navigate(['/transact'], { queryParams: { transactionId: row.id } });
  }
}
