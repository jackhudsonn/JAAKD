import { Component, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WidgetCardComponent } from '../../../../shared/components/widget-card/widget-card.component';
import { ScrollableListComponent } from '../../../../shared/components/scrollable-list/scrollable-list.component';
import { MOCK_WATCHLIST, MockWatchlistItem } from '../../mock-data';

@Component({
  selector: 'app-watchlist-widget',
  standalone: true,
  imports: [WidgetCardComponent, ScrollableListComponent, DecimalPipe, FormsModule],
  templateUrl: './watchlist.component.html',
  styleUrl: './watchlist.component.css',
})
export class WatchlistWidgetComponent {
  // TODO: replace with a saved watchlist endpoint + live MarketQuote stream per symbol.
  items = signal<MockWatchlistItem[]>([...MOCK_WATCHLIST]);

  newSymbol = signal('');

  trackBySymbol = (item: MockWatchlistItem) => item.symbol;

  addTicker() {
    const symbol = this.newSymbol().trim().toUpperCase();
    if (!symbol || this.items().some((item) => item.symbol === symbol)) {
      return;
    }

    // MOCK ONLY: fabricates a placeholder quote so the UI has something to render.
    // TODO: call MarketService.search(symbol) / addToWatchlist(symbol) and use the
    // real quote returned by the API instead of these random values.
    this.items.update((items) => [
      ...items,
      { symbol, price: Math.random() * 500, changePct: (Math.random() - 0.5) * 10 },
    ]);
    this.newSymbol.set('');
  }

  removeTicker(symbol: string) {
    // TODO: call the real "remove from watchlist" endpoint.
    this.items.update((items) => items.filter((item) => item.symbol !== symbol));
  }
}
