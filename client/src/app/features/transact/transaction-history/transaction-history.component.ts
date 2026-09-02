import { Component, computed, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ScrollableListComponent } from '../../../shared/components/scrollable-list/scrollable-list.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { formatLabel } from '../../../shared/utils/format-label';
import { Transaction, TransactionStatus, TransactionType } from '../../../core/models';

type SortKey = 'createdAt' | 'type' | 'amount' | 'status';
type SortDirection = 'asc' | 'desc';

/**
 * Reusable, sortable/filterable transaction table. Renders rows through
 * the shared scrollable-list so its scroll/empty-state behaviour matches
 * other tabular data (e.g. a future orders table on the trade page).
 */
@Component({
  selector: 'app-transaction-history',
  standalone: true,
  imports: [ScrollableListComponent, StatusBadgeComponent, DatePipe, DecimalPipe],
  templateUrl: './transaction-history.component.html',
  styleUrl: './transaction-history.component.css',
})
export class TransactionHistoryComponent {
  transactions = input.required<readonly Transaction[]>();

  typeFilter = signal<TransactionType | 'all'>('all');
  statusFilter = signal<TransactionStatus | 'all'>('all');

  private sortKey = signal<SortKey>('createdAt');
  private sortDirection = signal<SortDirection>('desc');

  formatLabel = formatLabel;
  trackById = (transaction: Transaction) => transaction.id;

  rows = computed(() => {
    const type = this.typeFilter();
    const status = this.statusFilter();

    const filtered = this.transactions().filter(
      (transaction) =>
        (type === 'all' || transaction.type === type) &&
        (status === 'all' || transaction.status === status),
    );

    const key = this.sortKey();
    const factor = this.sortDirection() === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      if (key === 'amount') {
        return (a.amount - b.amount) * factor;
      }

      if (key === 'createdAt') {
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * factor;
      }

      return a[key].localeCompare(b[key]) * factor;
    });
  });

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

  onTypeFilterChange(event: Event) {
    this.typeFilter.set((event.target as HTMLSelectElement).value as TransactionType | 'all');
  }

  onStatusFilterChange(event: Event) {
    this.statusFilter.set((event.target as HTMLSelectElement).value as TransactionStatus | 'all');
  }
}
