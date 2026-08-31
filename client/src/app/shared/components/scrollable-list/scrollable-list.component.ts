import { Component, TemplateRef, contentChild, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

/**
 * Shared scrollable list shell used by any dashboard widget (or future
 * non-dashboard UI) that needs a fixed-height, scrollable set of rows —
 * e.g. Open Orders, Watchlist, future trade history / alerts / notifications.
 *
 * Standardizes:
 * - Container height or vertical space fill, and scroll behaviour.
 * - The empty state message that shows before there is data to display.
 * - The base row container look (background, radius, padding, hover state).
 *
 * Each row's *inner* content is still fully up to the consumer via the
 * projected `<ng-template>`, so different widgets can lay out their row
 * content (flex vs. grid, extra buttons, etc.) however they need to.
 *
 * Usage:
 * ```html
 * <app-scrollable-list [items]="orders()" emptyMessage="No open orders.">
 *   <ng-template let-order>
 *     <div class="order-info">{{ order.symbol }}</div>
 *   </ng-template>
 * </app-scrollable-list>
 * ```
 */
@Component({
  selector: 'app-scrollable-list',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './scrollable-list.component.html',
  styleUrl: './scrollable-list.component.css',
})
export class ScrollableListComponent<T> {
  items = input.required<readonly T[]>();
  emptyMessage = input('Nothing to display.');

  // Identity function used for @for's track expression. Defaults to
  // returning the item itself; pass e.g. `(order) => order.id` for objects
  // that might be recreated (rather than mutated) between renders.
  trackBy = input<(item: T) => unknown>((item) => item);

  rowTemplate = contentChild.required(TemplateRef);
}
