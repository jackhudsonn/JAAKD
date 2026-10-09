import { Component, OnDestroy, OnInit, computed, inject, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { ScrollableListComponent } from '@shared/components/scrollable-list/scrollable-list.component';
import { startCycleTimer } from '@shared/utils/cycle-timer';
import { DASHBOARD_MARKET_DATA_PORT } from '@features/dashboard/services/dashboard-market-data.port';
import { DASHBOARD_STATE_PORT } from '@features/dashboard/services/dashboard-state.port';

interface WatchlistRow {
  symbol: string;
  name: string;
  price: number | null;
  changePct: number | null;
}

@Component({
  selector: 'app-watchlist-widget',
  standalone: true,
  imports: [WidgetCardComponent, ScrollableListComponent, DecimalPipe],
  templateUrl: './watchlist.component.html',
  styleUrl: './watchlist.component.css',
})
export class WatchlistWidgetComponent implements OnInit, OnDestroy {
  private readonly marketData = inject(DASHBOARD_MARKET_DATA_PORT);
  private readonly state = inject(DASHBOARD_STATE_PORT);

  readonly watchlistListMinHeight = '255px';
  readonly watchlistListMaxHeight = '255px';

  watchlists = this.state.watchlists;
  activeWatchlistId = this.state.activeWatchlistId;
  readonly backendDataMode = this.state.backendDataMode ?? false;

  createWatchlistRequested = output<void>();
  editWatchlistRequested = output<void>();
  assetSelected = output<string>();
  addAssetRequested = output<void>();

  readonly maxWatchlistHoldings = this.state.watchlistConstraints.maxHoldingsPerWatchlist;

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

    return symbols.map((symbol): WatchlistRow | null => {
      const asset = this.marketData.getAsset(symbol);

      if (!asset && this.backendDataMode) {
        return {
          symbol,
          name: symbol,
          price: null,
          changePct: null,
        };
      }

      if (!asset) {
        return null;
      }

      const price = this.marketData.getPrice(symbol);
      const hasBasePrice = asset.basePrice > 0;
      return {
        symbol,
        name: asset.name,
        price,
        changePct: hasBasePrice ? ((price - asset.basePrice) / asset.basePrice) * 100 : null,
      };
    }).filter((row): row is WatchlistRow => row !== null);
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
