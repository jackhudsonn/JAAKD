import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WidgetCardComponent } from '../../../shared/components/widget-card/widget-card.component';
import { ScrollableListComponent } from '../../../shared/components/scrollable-list/scrollable-list.component';
import { startCycleTimer } from '../../../shared/utils/cycle-timer';
import { getAsset, getMockPrice } from '../mock-data';

interface WatchlistRow {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
}

@Component({
  selector: 'app-watchlist-card',
  standalone: true,
  imports: [WidgetCardComponent, ScrollableListComponent, DecimalPipe],
  templateUrl: './watchlist-card.component.html',
  styleUrl: './watchlist-card.component.css',
})
export class WatchlistCardComponent implements OnInit, OnDestroy {
  symbols = input.required<readonly string[]>();

  selectSymbol = output<string>();

  private priceTick = signal(0);
  private stopTicking?: () => void;

  // TODO: replace changePct with a real MarketQuote once live quotes exist —
  // for now it's just the mock price's drift from the seeded base price.
  rows = computed<WatchlistRow[]>(() => {
    this.priceTick();

    return this.symbols().flatMap((symbol) => {
      const asset = getAsset(symbol);
      if (!asset) {
        return [];
      }

      const price = getMockPrice(symbol);
      return [
        {
          symbol,
          name: asset.name,
          price,
          changePct: ((price - asset.basePrice) / asset.basePrice) * 100,
        },
      ];
    });
  });

  trackBySymbol = (row: WatchlistRow) => row.symbol;

  ngOnInit() {
    this.stopTicking = startCycleTimer(1, 1000, () => this.priceTick.update((tick) => tick + 1));
  }

  ngOnDestroy() {
    this.stopTicking?.();
  }
}
