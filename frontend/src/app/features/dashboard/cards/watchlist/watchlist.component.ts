import { Component, computed, inject, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { CashCurrency } from '@core/models/api.models';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { ScrollableListComponent } from '@shared/components/scrollable-list/scrollable-list.component';
import { DisplaySymbolPipe } from '@shared/pipes/display-symbol.pipe';
import { formatCurrency } from '@shared/utils/display-format';
import { DASHBOARD_STATE_PORT } from '@features/dashboard/services/dashboard-state.port';

interface WatchlistRow {
  symbol: string;
  name: string;
  currency: CashCurrency;
  price: number | null;
  changePct: number | null;
}

@Component({
  selector: 'app-watchlist-widget',
  standalone: true,
  imports: [WidgetCardComponent, ScrollableListComponent, DecimalPipe, DisplaySymbolPipe],
  templateUrl: './watchlist.component.html',
  styleUrl: './watchlist.component.css',
})
export class WatchlistWidgetComponent {
  private readonly state = inject(DASHBOARD_STATE_PORT);

  readonly watchlistListMinHeight = '255px';
  readonly watchlistListMaxHeight = '255px';

  watchlists = this.state.watchlists;
  activeWatchlistId = this.state.activeWatchlistId;
  private readonly liveQuotes = this.state.liveQuotes;

  createWatchlistRequested = output<void>();
  editWatchlistRequested = output<void>();
  assetSelected = output<string>();
  addAssetRequested = output<void>();

  readonly maxWatchlistHoldings = this.state.watchlistConstraints.maxHoldingsPerWatchlist;
  readonly formatCurrency = formatCurrency;

  watchlistOptions = computed(() =>
    this.watchlists().map((watchlist) => ({ id: watchlist.id, name: watchlist.name })),
  );

  activeWatchlist = computed(
    () => this.watchlists().find((watchlist) => watchlist.id === this.activeWatchlistId()) ?? null,
  );

  activeWatchlistSymbolCount = computed(() => this.activeWatchlist()?.symbols.length ?? 0);

  canAddSymbolToActive = computed(
    () =>
      this.maxWatchlistHoldings === null ||
      this.activeWatchlistSymbolCount() < this.maxWatchlistHoldings,
  );

  rows = computed<WatchlistRow[]>(() => {
    const active = this.activeWatchlist();
    const symbols = active?.symbols ?? [];

    return symbols
      .map((symbol): WatchlistRow | null => {
        const instrument = this.state
          .backendWatchlistInstrumentOptions?.()
          .find((entry) => entry.symbol.toUpperCase() === symbol.toUpperCase());
        const quote = this.liveQuotes?.().get(symbol.toUpperCase());
        const currency = instrument?.currency ?? quote?.currency;
        if (!instrument || !currency) {
          return null;
        }

        return {
          symbol,
          name: instrument.name,
          currency,
          price: quote?.price ?? null,
          changePct: quote?.changePct ?? null,
        };
      })
      .filter((row): row is WatchlistRow => row !== null);
  });

  trackBySymbol = (row: WatchlistRow) => row.symbol;

  onWatchlistChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (!this.watchlists().some((watchlist) => watchlist.id === target.value)) {
      return;
    }
    this.activeWatchlistId.set(target.value);
  }

  requestCreateWatchlist() {
    this.createWatchlistRequested.emit();
  }

  requestEditWatchlist() {
    this.editWatchlistRequested.emit();
  }

  requestAssetDetails(symbol: string) {
    this.assetSelected.emit(symbol);
  }

  requestAddAsset() {
    if (!this.canAddSymbolToActive()) {
      return;
    }

    this.addAssetRequested.emit();
  }
}
