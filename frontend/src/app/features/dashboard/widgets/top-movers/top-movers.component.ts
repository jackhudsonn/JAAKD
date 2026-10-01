import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { startCycleTimer } from '@shared/utils/cycle-timer';
import { DASHBOARD_MARKET_DATA_PORT } from '@features/dashboard/services/dashboard-market-data.port';

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
  private readonly marketData = inject(DASHBOARD_MARKET_DATA_PORT);

  private stopCycle?: () => void;

  // TODO: replace with a market-wide movers endpoint scoped to holdings/watchlist.
  private readonly winners = this.marketData.getTopWinners();
  private readonly losers = this.marketData.getTopLosers();

  activeIndex = signal(0);
  fading = signal(false);

  get activeMode() {
    return MODES[this.activeIndex()];
  }

  get activeMovers() {
    return this.activeMode.positive ? this.winners : this.losers;
  }

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
