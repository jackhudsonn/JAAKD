import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { ScrollableListComponent } from '@shared/components/scrollable-list/scrollable-list.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { startCycleTimer } from '@shared/utils/cycle-timer';
import { Order } from '@core/models';
import { MARKET_ORDER_PENDING_MS } from '@core/mocks/mock-data';

type SortKey = 'createdAt' | 'symbol' | 'status';
type SortDirection = 'asc' | 'desc';

/**
 * Combined Orders card: open and completed/cancelled orders share a single
 * sortable, scrollable list. Open orders (pending/open) stay selectable —
 * clicking opens the Order Details popup — and show a live pending-fill
 * countdown; history rows are read-only.
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
export class OrdersCardComponent implements OnInit, OnDestroy {
  openOrders = input.required<readonly Order[]>();
  historyOrders = input.required<readonly Order[]>();

  selectOrder = output<string>();

  private tick = signal(0);
  private stopTicking?: () => void;

  private sortKey = signal<SortKey>('createdAt');
  private sortDirection = signal<SortDirection>('desc');

  // Recomputed every second so the pending-market-order countdown stays live.
  rows = computed(() => {
    this.tick();
    const now = Date.now();

    const key = this.sortKey();
    const factor = this.sortDirection() === 'asc' ? 1 : -1;

    const sorted = [...this.openOrders(), ...this.historyOrders()].sort((a, b) => {
      if (key === 'createdAt') {
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * factor;
      }

      return a[key].localeCompare(b[key]) * factor;
    });

    return sorted.map((order) => ({
      order,
      isOpen: order.status === 'pending' || order.status === 'open',
      secondsRemaining:
        order.status === 'pending'
          ? Math.max(
              0,
              Math.ceil(
                (MARKET_ORDER_PENDING_MS - (now - new Date(order.createdAt).getTime())) / 1000,
              ),
            )
          : null,
    }));
  });

  trackByRow = (row: { order: Order }) => row.order.id;

  ngOnInit() {
    this.stopTicking = startCycleTimer(1, 1000, () => this.tick.update((value) => value + 1));
  }

  ngOnDestroy() {
    this.stopTicking?.();
  }

  setSort(key: SortKey) {
    if (this.sortKey() === key) {
      this.sortDirection.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }

    this.sortKey.set(key);
    this.sortDirection.set('desc');
  }

  sortIndicator(key: SortKey): string {
    if (this.sortKey() !== key) {
      return '';
    }

    return this.sortDirection() === 'asc' ? '▲' : '▼';
  }
}
