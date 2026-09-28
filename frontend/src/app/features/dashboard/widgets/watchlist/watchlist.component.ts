import { Component, OnDestroy, OnInit, computed, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { ScrollableListComponent } from '@shared/components/scrollable-list/scrollable-list.component';
import { startCycleTimer } from '@shared/utils/cycle-timer';
import { MOCK_STATE, WATCHLIST_CONSTRAINTS, getAsset, getMockPrice } from '@core/mocks/mock-data';

interface WatchlistRow {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
}

@Component({
  selector: 'app-watchlist-widget',
  standalone: true,
  imports: [WidgetCardComponent, ScrollableListComponent, DecimalPipe],
  templateUrl: './watchlist.component.html',
  styleUrl: './watchlist.component.css',
})
export class WatchlistWidgetComponent implements OnInit, OnDestroy {
  watchlists = MOCK_STATE.watchlists;
  activeWatchlistId = MOCK_STATE.activeWatchlistId;

  createWatchlistRequested = output<void>();
  editWatchlistRequested = output<void>();
  assetSelected = output<string>();
  addAssetRequested = output<void>();

  readonly maxWatchlistHoldings = WATCHLIST_CONSTRAINTS.maxHoldingsPerWatchlist;

  private priceTick = signal(0);
  private stopTicking?: () => void;

  watchlistOptions = computed(() =>
    this.watchlists().map((watchlist) => ({ id: watchlist.id, name: watchlist.name })),
  );

  activeWatchlist = computed(
    () => this.watchlists().find((watchlist) => watchlist.id === this.activeWatchlistId()) ?? null,
  );

  activeWatchlistSymbolCount = computed(() => this.activeWatchlist()?.symbols.length ?? 0);

  canAddSymbolToActive = computed(
    () => this.activeWatchlistSymbolCount() < this.maxWatchlistHoldings,
  );

  rows = computed<WatchlistRow[]>(() => {
    this.priceTick();

    const active = this.activeWatchlist();
    const symbols = active?.symbols ?? [];

    return symbols.flatMap((symbol) => {
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

  ngOnInit() {
    this.stopTicking = startCycleTimer(1, 1000, () => this.priceTick.update((tick) => tick + 1));
  }

  ngOnDestroy() {
    this.stopTicking?.();
  }
}
