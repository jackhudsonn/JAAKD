import { Injectable, computed, inject, signal } from '@angular/core';
import { InstrumentType } from '@core/models';
import {
  DASHBOARD_MARKET_DATA_PORT,
  DashboardMarketAsset,
} from '@features/dashboard/services/dashboard-market-data.port';
import { DASHBOARD_STATE_PORT } from '@features/dashboard/services/dashboard-state.port';

export interface DashboardWatchlistAssetSummary {
  symbol: string;
  name: string;
  price: number | null;
  changePct: number | null;
}

export interface DashboardWatchlistSearchRow {
  asset: DashboardMarketAsset;
  price: number | null;
  changePct: number | null;
}

export type DashboardInstrumentFilter = InstrumentType | 'all';

export interface DashboardInstrumentOption {
  id: DashboardInstrumentFilter;
  label: string;
}

const INSTRUMENT_OPTIONS: DashboardInstrumentOption[] = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'stock', label: 'Stocks' },
  { id: 'bond', label: 'Bonds' },
];

@Injectable({
  providedIn: 'root',
})
export class DashboardWatchlistOverlayFacade {
  private readonly marketData = inject(DASHBOARD_MARKET_DATA_PORT);
  private readonly state = inject(DASHBOARD_STATE_PORT);

  private readonly watchlists = this.state.watchlists;
  private readonly activeWatchlistId = this.state.activeWatchlistId;
  private readonly backendDataMode = this.state.backendDataMode ?? false;

  readonly watchlistDialogMode = signal<'create' | 'edit' | null>(null);
  readonly watchlistNameDraft = signal('');
  readonly watchlistDialogError = signal<string | null>(null);
  readonly watchlistSearchOpen = signal(false);
  readonly watchlistSearch = signal('');
  readonly watchlistSearchInstrument = signal<DashboardInstrumentFilter>('all');
  readonly watchlistSearchError = signal<string | null>(null);
  readonly selectedWatchlistSymbol = signal<string | null>(null);

  readonly instrumentOptions = INSTRUMENT_OPTIONS;
  readonly maxWatchlists = this.state.watchlistConstraints.maxWatchlists;
  readonly maxHoldingsPerWatchlist = this.state.watchlistConstraints.maxHoldingsPerWatchlist;

  readonly canDeleteActive = computed(
    () => this.watchlists().length > this.state.watchlistConstraints.minWatchlists,
  );
  readonly canCreateWatchlist = computed(() => this.watchlists().length < this.maxWatchlists);

  readonly activeWatchlist = computed(
    () => this.watchlists().find((watchlist) => watchlist.id === this.activeWatchlistId()) ?? null,
  );

  readonly activeWatchlistSymbolCount = computed(() => this.activeWatchlist()?.symbols.length ?? 0);

  readonly activeWatchlistHasCapacity = computed(
    () => this.activeWatchlistSymbolCount() < this.maxHoldingsPerWatchlist,
  );

  readonly watchlistSearchRows = computed<DashboardWatchlistSearchRow[]>(() => {
    const active = this.activeWatchlist();
    if (!active || !this.activeWatchlistHasCapacity()) {
      return [];
    }

    const selectedInstrument = this.watchlistSearchInstrument();
    const query = this.watchlistSearch().trim().toLowerCase();
    const activeSymbols = new Set(active.symbols);

    const sourceAssets: ReadonlyArray<DashboardMarketAsset> = this.backendDataMode
      ? (this.state.backendWatchlistInstrumentOptions?.() ?? []).map((instrument) => ({
          symbol: instrument.symbol,
          name: instrument.name,
          instrumentType: instrument.instrumentType,
          basePrice: 0,
        }))
      : this.marketData.listAssets();

    return sourceAssets
      .filter(
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
        const knownAsset = this.marketData.getAsset(asset.symbol);
        const numericPrice = knownAsset ? this.marketData.getPrice(asset.symbol) : null;
        const changePct =
          knownAsset && numericPrice !== null && knownAsset.basePrice > 0
            ? ((numericPrice - knownAsset.basePrice) / knownAsset.basePrice) * 100
            : null;

        return {
          asset,
          price: numericPrice,
          changePct,
        };
      });
  });

  readonly watchlistSearchEmptyMessage = computed(() => {
    if (!this.activeWatchlistHasCapacity()) {
      return `This watchlist already has ${this.maxHoldingsPerWatchlist} items.`;
    }

    if (this.watchlistSearch().trim()) {
      return 'No tickers match your search.';
    }

    return 'No remaining tickers to add.';
  });

  readonly selectedWatchlistAsset = computed<DashboardWatchlistAssetSummary | null>(() => {
    const symbol = this.selectedWatchlistSymbol();
    if (!symbol) {
      return null;
    }

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
    const changePct = asset.basePrice > 0 ? ((price - asset.basePrice) / asset.basePrice) * 100 : null;
    return {
      symbol,
      name: asset.name,
      price,
      changePct,
    };
  });

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
    this.selectedWatchlistSymbol.set(symbol);
  }

  requestAddWatchlistAsset() {
    if (!this.activeWatchlist()) {
      return;
    }

    this.selectedWatchlistSymbol.set(null);
    this.watchlistSearch.set('');
    this.watchlistSearchInstrument.set('all');
    this.watchlistSearchError.set(null);
    this.watchlistSearchOpen.set(true);
  }

  closeWatchlistDialog() {
    this.watchlistDialogMode.set(null);
    this.watchlistNameDraft.set('');
    this.watchlistDialogError.set(null);
  }

  closeWatchlistSearchPopup() {
    this.watchlistSearchOpen.set(false);
    this.watchlistSearch.set('');
    this.watchlistSearchInstrument.set('all');
    this.watchlistSearchError.set(null);
  }

  onWatchlistNameInput(value: string) {
    this.watchlistNameDraft.set(value);
    if (this.watchlistDialogError()) {
      this.watchlistDialogError.set(null);
    }
  }

  onWatchlistSearchChange(value: string) {
    this.watchlistSearch.set(value);
    if (this.watchlistSearchError()) {
      this.watchlistSearchError.set(null);
    }
  }

  setWatchlistInstrumentFilter(type: DashboardInstrumentFilter) {
    this.watchlistSearchInstrument.set(type);
  }

  saveWatchlistName() {
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

  confirmDeleteWatchlist() {
    const currentWatchlists = this.watchlists();
    if (currentWatchlists.length <= this.state.watchlistConstraints.minWatchlists) {
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

  async addSymbolToActiveWatchlist(symbol: string): Promise<void> {
    if (this.backendDataMode && this.state.setWatchlistMembership) {
      this.watchlistSearchError.set(null);
      await this.state.setWatchlistMembership(symbol, true);
      this.closeWatchlistSearchPopup();
      return;
    }

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

  async removeSelectedWatchlistAsset(): Promise<void> {
    const selected = this.selectedWatchlistAsset();
    const active = this.activeWatchlist();
    if (!selected || !active) {
      return;
    }

    if (this.backendDataMode && this.state.setWatchlistMembership) {
      await this.state.setWatchlistMembership(selected.symbol, false);
      this.closeWatchlistAssetPopup();
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

  closeWatchlistAssetPopup() {
    this.selectedWatchlistSymbol.set(null);
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
