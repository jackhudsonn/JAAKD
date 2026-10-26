import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { startCycleTimer } from '@shared/utils/cycle-timer';
import { formatPercentageChange } from '@shared/utils/format-percentage-change';
import { DASHBOARD_STATE_PORT } from '@features/dashboard/services/dashboard-state.port';
import { toTopMovers } from './top-movers.util';

const MODES: { label: string; positive: boolean }[] = [
  { label: 'Top Winners', positive: true },
  { label: 'Top Losers', positive: false },
];

@Component({
  selector: 'app-top-movers-widget',
  standalone: true,
  imports: [WidgetCardComponent, DecimalPipe],
  templateUrl: './top-movers.component.html',
  styleUrl: './top-movers.component.css',
})
export class TopMoversWidgetComponent implements OnInit, OnDestroy {
  private readonly liveQuotes = inject(DASHBOARD_STATE_PORT).liveQuotes;
  private stopCycle?: () => void;
  readonly formatChange = formatPercentageChange;

  activeIndex = signal(0);
  fading = signal(false);

  get activeMode() {
    return MODES[this.activeIndex()];
  }

  activeMovers = computed(() =>
    toTopMovers(this.liveQuotes?.() ?? new Map(), MODES[this.activeIndex()].positive),
  );

  ngOnInit() {
    this.stopCycle = startCycleTimer(MODES.length, 4000, (index) => {
      this.fading.set(true);
      setTimeout(() => {
        this.activeIndex.set(index);
        this.fading.set(false);
      }, 250);
    });
  }

  ngOnDestroy() {
    this.stopCycle?.();
  }
}
