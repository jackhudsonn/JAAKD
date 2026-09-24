import { Component, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { InstrumentType } from '@core/models';
import { ScrollableListComponent } from '@shared/components/scrollable-list/scrollable-list.component';
import {
  MOCK_ASSETS,
  MOCK_STATE,
  MockAsset,
  WATCHLIST_CONSTRAINTS,
  getAsset,
  getMockPrice,
} from '@core/mocks/mock-data';
import { AllocationAssetSelection } from '@features/dashboard/widgets/allocation-by-asset/allocation-by-asset.component';

interface WatchlistAssetSummary {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
}

interface WatchlistSearchRow {
  asset: MockAsset;
  price: number;
  changePct: number;
}

type InstrumentFilter = InstrumentType | 'all';

const INSTRUMENT_OPTIONS: { id: InstrumentFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'stock', label: 'Stocks' },
  { id: 'bond', label: 'Bonds' },
];

@Component({
  selector: 'app-dashboard-overlays',
  standalone: true,
  imports: [ModalComponent, DecimalPipe, FormsModule, ScrollableListComponent],
  templateUrl: './dashboard-overlays.component.html',
  styleUrl: './dashboard-overlays.component.css',
})
export class DashboardOverlaysComponent {
  private readonly watchlists = MOCK_STATE.watchlists;
  private readonly activeWatchlistId = MOCK_STATE.activeWatchlistId;

  protected readonly watchlistDialogMode = signal<'create' | 'edit' | null>(null);
  protected readonly watchlistNameDraft = signal('');
  protected readonly watchlistDialogError = signal<string | null>(null);
  protected readonly watchlistSearchOpen = signal(false);
  protected readonly watchlistSearch = signal('');
  protected readonly watchlistSearchInstrument = signal<InstrumentFilter>('all');
  protected readonly watchlistSearchError = signal<string | null>(null);
  protected readonly selectedWatchlistSymbol = signal<string | null>(null);
  protected readonly selectedAllocationAsset = signal<AllocationAssetSelection | null>(null);

  protected readonly instrumentOptions = INSTRUMENT_OPTIONS;
  protected readonly maxWatchlists = WATCHLIST_CONSTRAINTS.maxWatchlists;
  protected readonly maxHoldingsPerWatchlist = WATCHLIST_CONSTRAINTS.maxHoldingsPerWatchlist;

  protected readonly canDeleteActive = computed(
    () => this.watchlists().length > WATCHLIST_CONSTRAINTS.minWatchlists,
  );
  protected readonly canCreateWatchlist = computed(
    () => this.watchlists().length < this.maxWatchlists,
  );

  protected readonly activeWatchlist = computed(
    () => this.watchlists().find((watchlist) => watchlist.id === this.activeWatchlistId()) ?? null,
  );

  protected readonly activeWatchlistSymbolCount = computed(
    () => this.activeWatchlist()?.symbols.length ?? 0,
  );

  protected readonly activeWatchlistHasCapacity = computed(
    () => this.activeWatchlistSymbolCount() < this.maxHoldingsPerWatchlist,
  );

  protected readonly watchlistSearchRows = computed<WatchlistSearchRow[]>(() => {
    const active = this.activeWatchlist();
    if (!active || !this.activeWatchlistHasCapacity()) {
      return [];
    }

    const selectedInstrument = this.watchlistSearchInstrument();
    const query = this.watchlistSearch().trim().toLowerCase();
    const activeSymbols = new Set(active.symbols);

    return MOCK_ASSETS.filter(
      (asset) => selectedInstrument === 'all' || asset.instrumentType === selectedInstrument,
    )
      .filter((asset) => !activeSymbols.has(asset.symbol))
      .filter(
        (asset) =>
          !query ||
          asset.symbol.toLowerCase().includes(query) ||
          asset.name.toLowerCase().includes(query),
      )
      .map((asset) => {
        const price = getMockPrice(asset.symbol);
        return {
          asset,
          price,
          changePct: ((price - asset.basePrice) / asset.basePrice) * 100,
        };
      });
  });

  protected readonly watchlistSearchEmptyMessage = computed(() => {
    if (!this.activeWatchlistHasCapacity()) {
      return `This watchlist already has ${this.maxHoldingsPerWatchlist} items.`;
    }

    if (this.watchlistSearch().trim()) {
      return 'No tickers match your search.';
    }

    return 'No remaining tickers to add.';
  });

  protected readonly selectedWatchlistAsset = computed<WatchlistAssetSummary | null>(() => {
    const symbol = this.selectedWatchlistSymbol();
    if (!symbol) {
      return null;
    }

    const asset = getAsset(symbol);
    if (!asset) {
      return null;
    }

    const price = getMockPrice(symbol);
    return {
      symbol,
      name: asset.name,
      price,
      changePct: ((price - asset.basePrice) / asset.basePrice) * 100,
    };
  });

  constructor(private readonly router: Router) {}

  requestCreateWatchlist() {
    this.watchlistNameDraft.set('');
    this.watchlistDialogError.set(null);
    this.watchlistDialogMode.set('create');

    if (!this.canCreateWatchlist()) {
      this.watchlistDialogError.set(`You can create up to ${this.maxWatchlists} watchlists.`);
    }
  }

  requestEditWatchlist() {
    const active = this.activeWatchlist();
    if (!active) {
      return;
    }

    this.watchlistNameDraft.set(active.name);
    this.watchlistDialogError.set(null);
    this.watchlistDialogMode.set('edit');
  }

  requestWatchlistAsset(symbol: string) {
    this.watchlistSearchOpen.set(false);
    this.selectedAllocationAsset.set(null);
    this.selectedWatchlistSymbol.set(symbol);
  }

  requestAddWatchlistAsset() {
    if (!this.activeWatchlist()) {
      return;
    }

    this.selectedWatchlistSymbol.set(null);
    this.selectedAllocationAsset.set(null);
    this.watchlistSearch.set('');
    this.watchlistSearchInstrument.set('all');
    this.watchlistSearchError.set(null);
    this.watchlistSearchOpen.set(true);
  }

  requestAllocationAsset(asset: AllocationAssetSelection) {
    this.selectedWatchlistSymbol.set(null);
    this.selectedAllocationAsset.set(asset);
  }

  protected closeWatchlistDialog() {
    this.watchlistDialogMode.set(null);
    this.watchlistNameDraft.set('');
    this.watchlistDialogError.set(null);
  }

  protected closeWatchlistSearchPopup() {
    this.watchlistSearchOpen.set(false);
    this.watchlistSearch.set('');
    this.watchlistSearchInstrument.set('all');
    this.watchlistSearchError.set(null);
  }

  protected onWatchlistNameInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.watchlistNameDraft.set(target.value);
    if (this.watchlistDialogError()) {
      this.watchlistDialogError.set(null);
    }
  }

  protected onWatchlistSearchChange(value: string) {
    this.watchlistSearch.set(value);
    if (this.watchlistSearchError()) {
      this.watchlistSearchError.set(null);
    }
  }

  protected setWatchlistInstrumentFilter(type: InstrumentFilter) {
    this.watchlistSearchInstrument.set(type);
  }

  protected saveWatchlistName() {
    if (this.watchlistDialogMode() === 'edit') {
      this.saveEditedWatchlistName();
      return;
    }

    if (this.watchlistDialogMode() !== 'create') {
      return;
    }

    if (!this.canCreateWatchlist()) {
      this.watchlistDialogError.set(`You can create up to ${this.maxWatchlists} watchlists.`);
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

  protected confirmDeleteWatchlist() {
    const currentWatchlists = this.watchlists();
    if (currentWatchlists.length <= WATCHLIST_CONSTRAINTS.minWatchlists) {
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

  protected addSymbolToActiveWatchlist(symbol: string) {
    const active = this.activeWatchlist();
    if (!active) {
      this.watchlistSearchError.set('Select a watchlist first.');
      return;
    }

    if (active.symbols.includes(symbol)) {
      this.watchlistSearchError.set(`${symbol} is already in this watchlist.`);
      return;
    }

    if (active.symbols.length >= this.maxHoldingsPerWatchlist) {
      this.watchlistSearchError.set(
        `Each watchlist is limited to ${this.maxHoldingsPerWatchlist} items.`,
      );
      return;
    }

    this.watchlists.update((current) =>
      current.map((watchlist) =>
        watchlist.id === active.id
          ? { ...watchlist, symbols: [...watchlist.symbols, symbol] }
          : watchlist,
      ),
    );

    this.watchlistSearchError.set(null);
  }

  protected removeSelectedWatchlistAsset() {
    const selected = this.selectedWatchlistAsset();
    const active = this.activeWatchlist();
    if (!selected || !active) {
      return;
    }

    this.watchlists.update((current) =>
      current.map((watchlist) =>
        watchlist.id === active.id
          ? {
              ...watchlist,
              symbols: watchlist.symbols.filter((symbol) => symbol !== selected.symbol),
            }
          : watchlist,
      ),
    );

    this.closeWatchlistAssetPopup();
  }

  protected trackByWatchlistSearchSymbol = (row: WatchlistSearchRow) => row.asset.symbol;

  protected closeWatchlistAssetPopup() {
    this.selectedWatchlistSymbol.set(null);
  }

  protected openTradeForWatchlistSelectedAsset() {
    const selected = this.selectedWatchlistAsset();
    if (!selected) {
      return;
    }

    this.closeWatchlistAssetPopup();
    void this.router.navigate(['/trade'], { queryParams: { symbol: selected.symbol } });
  }

  protected closeAllocationAssetPopup() {
    this.selectedAllocationAsset.set(null);
  }

  protected openTradeForAllocationAsset() {
    const selected = this.selectedAllocationAsset();
    if (!selected) {
      return;
    }

    this.closeAllocationAssetPopup();
    void this.router.navigate(['/trade'], { queryParams: { symbol: selected.symbol } });
  }

  private isWatchlistNameTaken(name: string) {
    const normalizedName = name.trim().toLowerCase();
    return this.watchlists().some(
      (watchlist) => watchlist.name.trim().toLowerCase() === normalizedName,
    );
  }

  private saveEditedWatchlistName() {
    const active = this.activeWatchlist();
    if (!active) {
      this.watchlistDialogError.set('Select a watchlist first.');
      return;
    }

    const trimmedName = this.watchlistNameDraft().trim();
    if (!trimmedName) {
      this.watchlistDialogError.set('Watchlist name is required.');
      return;
    }

    const normalizedTrimmed = trimmedName.toLowerCase();
    const duplicateExists = this.watchlists().some(
      (watchlist) =>
        watchlist.id !== active.id && watchlist.name.trim().toLowerCase() === normalizedTrimmed,
    );

    if (duplicateExists) {
      this.watchlistDialogError.set('A watchlist with that name already exists.');
      return;
    }

    this.watchlists.update((current) =>
      current.map((watchlist) =>
        watchlist.id === active.id ? { ...watchlist, name: trimmedName } : watchlist,
      ),
    );

    this.closeWatchlistDialog();
  }
}
