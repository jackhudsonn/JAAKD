import { Injectable, computed, inject, signal } from '@angular/core';
import { InstrumentType } from '@core/models';
import {
  DASHBOARD_MARKET_DATA_PORT,
  DashboardMarketAsset,
} from '@features/dashboard/services/dashboard-market-data.port';
import { DASHBOARD_STATE_PORT } from '@features/dashboard/services/dashboard-state.port';
import { ToastService } from '@shared/components/toast/toast.service';

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
  { id: 'equity', label: 'Equities' },
  { id: 'etf', label: 'ETFs' },
];

const WATCHLIST_NAME_PATTERN = /^[A-Za-z0-9' -]+$/;

@Injectable({
  providedIn: 'root',
})
export class DashboardWatchlistOverlayFacade {
  private readonly marketData = inject(DASHBOARD_MARKET_DATA_PORT);
  private readonly state = inject(DASHBOARD_STATE_PORT);
  private readonly toastService = inject(ToastService);

  private readonly watchlists = this.state.watchlists;
  private readonly activeWatchlistId = this.state.activeWatchlistId;
  private readonly backendDataMode = this.state.backendDataMode ?? false;

  readonly watchlistDialogMode = signal<'create' | 'edit' | null>(null);
  readonly watchlistNameDraft = signal('');
  readonly watchlistSearchOpen = signal(false);
  readonly watchlistSearch = signal('');
  readonly watchlistSearchInstrument = signal<DashboardInstrumentFilter>('all');
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
    () =>
      this.maxHoldingsPerWatchlist === null ||
      this.activeWatchlistSymbolCount() < this.maxHoldingsPerWatchlist,
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
        if (this.backendDataMode) {
          const quote = this.state.liveQuotes?.().get(asset.symbol.toUpperCase());
          return {
            asset,
            price: quote?.price ?? null,
            changePct: quote?.changePct ?? null,
          };
        }

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

    const asset = this.backendDataMode ? undefined : this.marketData.getAsset(symbol);
    if (!asset && this.backendDataMode) {
      const quote = this.state.liveQuotes?.().get(symbol.toUpperCase());
      return {
        symbol,
        name: symbol,
        price: quote?.price ?? null,
        changePct: quote?.changePct ?? null,
      };
    }

    if (!asset) {
      return null;
    }

    const price = this.marketData.getPrice(symbol);
    const changePct =
      asset.basePrice > 0 ? ((price - asset.basePrice) / asset.basePrice) * 100 : null;
    return {
      symbol,
      name: asset.name,
      price,
      changePct,
    };
  });

  requestCreateWatchlist() {
    this.watchlistNameDraft.set('');
    this.watchlistDialogMode.set('create');

    if (!this.canCreateWatchlist()) {
      this.toastService.error(`You can create up to ${this.maxWatchlists} watchlists.`);
    }
  }

  requestEditWatchlist() {
    const active = this.activeWatchlist();
    if (!active) {
      return;
    }

    this.watchlistNameDraft.set(active.name);
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
    this.watchlistSearchOpen.set(true);
  }

  closeWatchlistDialog() {
    this.watchlistDialogMode.set(null);
    this.watchlistNameDraft.set('');
  }

  closeWatchlistSearchPopup() {
    this.watchlistSearchOpen.set(false);
    this.watchlistSearch.set('');
    this.watchlistSearchInstrument.set('all');
  }

  onWatchlistNameInput(value: string) {
    this.watchlistNameDraft.set(value);
  }

  onWatchlistSearchChange(value: string) {
    this.watchlistSearch.set(value);
  }

  setWatchlistInstrumentFilter(type: DashboardInstrumentFilter) {
    this.watchlistSearchInstrument.set(type);
  }

  async saveWatchlistName() {
    if (this.watchlistDialogMode() === 'edit') {
      await this.saveEditedWatchlistName();
      return;
    }

    if (this.watchlistDialogMode() !== 'create') {
      return;
    }

    if (!this.canCreateWatchlist()) {
      this.toastService.error(`You can create up to ${this.maxWatchlists} watchlists.`);
      return;
    }

    const trimmedName = this.validateWatchlistName(this.watchlistNameDraft());
    if (!trimmedName) {
      return;
    }

    if (this.isWatchlistNameTaken(trimmedName)) {
      this.toastService.error('A watchlist with that name already exists.');
      return;
    }

    if (this.backendDataMode && this.state.createWatchlist) {
      try {
        await this.state.createWatchlist(trimmedName);
        const newestWatchlist = this.watchlists().at(-1);
        if (newestWatchlist) {
          this.activeWatchlistId.set(newestWatchlist.id);
        }
        this.toastService.success(`Created watchlist "${trimmedName}".`);
        this.closeWatchlistDialog();
      } catch (error) {
        this.toastService.error(this.toErrorMessage(error, 'Failed to create watchlist.'));
      }
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
    this.toastService.success(`Created watchlist "${trimmedName}".`);
    this.closeWatchlistDialog();
  }

  async confirmDeleteWatchlist() {
    const currentWatchlists = this.watchlists();
    if (currentWatchlists.length <= this.state.watchlistConstraints.minWatchlists) {
      return;
    }

    const activeId = this.activeWatchlistId();
    const activeWatchlistName = this.activeWatchlist()?.name ?? 'watchlist';
    const activeIndex = currentWatchlists.findIndex((watchlist) => watchlist.id === activeId);
    if (activeIndex < 0) {
      return;
    }

    if (this.backendDataMode && this.state.deleteWatchlist) {
      try {
        await this.state.deleteWatchlist(activeId);
        const refreshed = this.watchlists();
        const nextActive = refreshed[0];
        this.activeWatchlistId.set(nextActive?.id ?? '');
        this.toastService.success(`Deleted watchlist "${activeWatchlistName}".`);
        this.closeWatchlistDialog();
      } catch (error) {
        this.toastService.error(this.toErrorMessage(error, 'Failed to delete watchlist.'));
      }
      return;
    }

    const nextActive =
      currentWatchlists[activeIndex + 1] ??
      currentWatchlists[activeIndex - 1] ??
      currentWatchlists[0];

    this.watchlists.set(currentWatchlists.filter((watchlist) => watchlist.id !== activeId));
    this.activeWatchlistId.set(nextActive.id);
    this.toastService.success(`Deleted watchlist "${activeWatchlistName}".`);
    this.closeWatchlistDialog();
  }

  async addSymbolToActiveWatchlist(symbol: string): Promise<void> {
    const active = this.activeWatchlist();
    if (!active) {
      this.toastService.error('Select a watchlist first.');
      return;
    }

    if (this.backendDataMode && this.state.setWatchlistMembership) {
      this.closeWatchlistSearchPopup();
      try {
        await this.state.setWatchlistMembership(symbol, active.id, true);
        this.toastService.success(`Added ${symbol} to "${active.name}".`);
      } catch (error) {
        this.toastService.error(
          this.toErrorMessage(error, `Failed to add ${symbol} to "${active.name}".`),
        );
      }
      return;
    }

    if (active.symbols.includes(symbol)) {
      this.toastService.error(`${symbol} is already in this watchlist.`);
      return;
    }

    if (
      this.maxHoldingsPerWatchlist !== null &&
      active.symbols.length >= this.maxHoldingsPerWatchlist
    ) {
      this.toastService.error(
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
    this.toastService.success(`Added ${symbol} to "${active.name}".`);
    this.closeWatchlistSearchPopup();
  }

  async removeSelectedWatchlistAsset(): Promise<void> {
    const selected = this.selectedWatchlistAsset();
    const active = this.activeWatchlist();
    if (!selected || !active) {
      return;
    }

    if (this.backendDataMode && this.state.setWatchlistMembership) {
      this.closeWatchlistAssetPopup();
      try {
        await this.state.setWatchlistMembership(selected.symbol, active.id, false);
        this.toastService.success(`Removed ${selected.symbol} from "${active.name}".`);
      } catch (error) {
        this.toastService.error(
          this.toErrorMessage(error, `Failed to remove ${selected.symbol} from "${active.name}".`),
        );
      }
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

    this.toastService.success(`Removed ${selected.symbol} from "${active.name}".`);
    this.closeWatchlistAssetPopup();
  }

  closeWatchlistAssetPopup() {
    this.selectedWatchlistSymbol.set(null);
  }

  private isWatchlistNameTaken(name: string) {
    const normalizedName = name.trim();
    return this.watchlists().some((watchlist) => watchlist.name.trim() === normalizedName);
  }

  private async saveEditedWatchlistName() {
    const active = this.activeWatchlist();
    if (!active) {
      this.toastService.error('Select a watchlist first.');
      return;
    }

    const trimmedName = this.validateWatchlistName(this.watchlistNameDraft());
    if (!trimmedName) {
      return;
    }

    const duplicateExists = this.watchlists().some(
      (watchlist) => watchlist.id !== active.id && watchlist.name.trim() === trimmedName,
    );

    if (duplicateExists) {
      this.toastService.error('A watchlist with that name already exists.');
      return;
    }

    if (this.backendDataMode && this.state.renameWatchlist) {
      try {
        await this.state.renameWatchlist(active.id, trimmedName);
        this.toastService.success(`Renamed watchlist to "${trimmedName}".`);
        this.closeWatchlistDialog();
      } catch (error) {
        this.toastService.error(this.toErrorMessage(error, 'Failed to rename watchlist.'));
      }
      return;
    }

    this.watchlists.update((current) =>
      current.map((watchlist) =>
        watchlist.id === active.id ? { ...watchlist, name: trimmedName } : watchlist,
      ),
    );

    this.toastService.success(`Renamed watchlist to "${trimmedName}".`);
    this.closeWatchlistDialog();
  }

  private validateWatchlistName(rawName: string): string | null {
    const trimmedName = rawName.trim();
    if (!trimmedName) {
      this.toastService.error('Watchlist name is required.');
      return null;
    }

    if (trimmedName.length < 3 || trimmedName.length > 20) {
      this.toastService.error('Watchlist name must be between 3 and 20 characters.');
      return null;
    }

    if (!WATCHLIST_NAME_PATTERN.test(trimmedName)) {
      this.toastService.error(
        'Watchlist name can contain letters, numbers, spaces, apostrophes, and hyphens.',
      );
      return null;
    }

    return trimmedName;
  }

  private toErrorMessage(error: unknown, fallbackMessage: string): string {
    if (
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      typeof (error as { error?: unknown }).error === 'object' &&
      (error as { error?: { message?: unknown } }).error &&
      typeof (error as { error?: { message?: unknown } }).error?.message === 'string'
    ) {
      const message = (error as { error: { message: string } }).error.message.trim();
      if (message.length > 0) {
        return message;
      }
    }

    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    return fallbackMessage;
  }
}
