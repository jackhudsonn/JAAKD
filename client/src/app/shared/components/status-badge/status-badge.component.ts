import { Component, computed, input } from '@angular/core';
import { formatLabel } from '../../utils/format-label';

// Covers both transaction and order lifecycle states so the badge can be
// reused across the transact and trade pages.
export type StatusBadgeStatus =
  | 'pending'
  | 'completed'
  | 'filled'
  | 'partially_filled'
  | 'cancelled'
  | 'failed';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.css',
})
export class StatusBadgeComponent {
  status = input.required<StatusBadgeStatus>();

  label = computed(() => formatLabel(this.status()));
}
