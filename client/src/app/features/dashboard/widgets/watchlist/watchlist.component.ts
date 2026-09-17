import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { WidgetCardComponent } from '../../../../shared/components/widget-card/widget-card.component';
import { ScrollableListComponent } from '../../../../shared/components/scrollable-list/scrollable-list.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { startCycleTimer } from '../../../../shared/utils/cycle-timer';
import { MOCK_STATE, getAsset, getMockPrice } from '../../../../core/mocks/mock-data';

interface WatchlistRow {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
}

@Component({
  selector: 'app-watchlist-widget',
  standalone: true,
  imports: [WidgetCardComponent, ScrollableListComponent, DecimalPipe, ModalComponent],
  templateUrl: './watchlist.component.html',
  styleUrl: './watchlist.component.css',
})
export class WatchlistWidgetComponent implements OnInit, OnDestroy {
  watchlists = MOCK_STATE.watchlists;
  activeWatchlistId = MOCK_STATE.activeWatchlistId;

  private priceTick = signal(0);
  private stopTicking?: () => void;

  watchlistDialogMode = signal<'create' | 'delete' | null>(null);
  watchlistNameDraft = signal('');
  watchlistDialogError = signal<string | null>(null);
  selectedSymbol = signal<string | null>(null);

  constructor(private readonly router: Router) {}

  watchlistOptions = computed(() =>
    this.watchlists().map((watchlist) => ({ id: watchlist.id, name: watchlist.name })),
  );

  canDeleteActive = computed(() => this.watchlists().length > 1);

  activeWatchlist = computed(
    () => this.watchlists().find((watchlist) => watchlist.id === this.activeWatchlistId()) ?? null,
  );

  rows = computed<WatchlistRow[]>(() => {
    this.priceTick();

    const active = this.watchlists().find(
      (watchlist) => watchlist.id === this.activeWatchlistId(),
    );
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

  selectedRow = computed(() => {
    const symbol = this.selectedSymbol();
    if (!symbol) {
      return null;
    }

    return this.rows().find((row) => row.symbol === symbol) ?? null;
  });

  trackBySymbol = (row: WatchlistRow) => row.symbol;

  onWatchlistChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (!this.watchlists().some((watchlist) => watchlist.id === target.value)) {
      return;
    }
    this.activeWatchlistId.set(target.value);
  }

  createWatchlist() {
    this.watchlistNameDraft.set('');
    this.watchlistDialogError.set(null);
    this.watchlistDialogMode.set('create');
  }

  deleteActiveWatchlist() {
    if (this.watchlists().length <= 1) {
      return;
    }

    this.watchlistDialogError.set(null);
    this.watchlistDialogMode.set('delete');
  }

  closeWatchlistDialog() {
    this.watchlistDialogMode.set(null);
    this.watchlistNameDraft.set('');
    this.watchlistDialogError.set(null);
  }

  onWatchlistNameInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.watchlistNameDraft.set(target.value);
    if (this.watchlistDialogError()) {
      this.watchlistDialogError.set(null);
    }
  }

  saveWatchlistName() {
    if (this.watchlistDialogMode() !== 'create') {
      return;
    }

    const trimmedName = this.watchlistNameDraft().trim();
    if (!trimmedName) {
      this.watchlistDialogError.set('Watchlist name is required.');
      return;
    }

    if (this.isWatchlistNameTaken(trimmedName)) {
      this.watchlistDialogError.set('A watchlist with that name already exists.');
      return;
    }

    const baseId = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const idSeed = baseId || 'watchlist';
    const id = `${idSeed}-${Date.now()}`;

    this.watchlists.update((current) => [...current, { id, name: trimmedName, symbols: [] }]);
    this.activeWatchlistId.set(id);
    this.closeWatchlistDialog();
  }

  confirmDeleteWatchlist() {
    const currentWatchlists = this.watchlists();
    if (currentWatchlists.length <= 1) {
      return;
    }

    const activeId = this.activeWatchlistId();
    const activeIndex = currentWatchlists.findIndex((watchlist) => watchlist.id === activeId);
    if (activeIndex < 0) {
      return;
    }

    const nextActive =
      currentWatchlists[activeIndex + 1] ??
      currentWatchlists[activeIndex - 1] ??
      currentWatchlists[0];

    this.watchlists.set(currentWatchlists.filter((watchlist) => watchlist.id !== activeId));
    this.activeWatchlistId.set(nextActive.id);
    this.closeWatchlistDialog();
  }

  private isWatchlistNameTaken(name: string) {
    const normalizedName = name.trim().toLowerCase();
    return this.watchlists().some(
      (watchlist) => watchlist.name.trim().toLowerCase() === normalizedName,
    );
  }

  openAssetInfo(symbol: string) {
    this.selectedSymbol.set(symbol);
  }

  closeAssetInfo() {
    this.selectedSymbol.set(null);
  }

  openTradeForSelectedSymbol() {
    const symbol = this.selectedSymbol();
    if (!symbol) {
      return;
    }

    this.closeAssetInfo();
    void this.router.navigate(['/trade'], { queryParams: { symbol } });
  }

  ngOnInit() {
    this.stopTicking = startCycleTimer(1, 1000, () => this.priceTick.update((tick) => tick + 1));
  }

  ngOnDestroy() {
    this.stopTicking?.();
  }
}
