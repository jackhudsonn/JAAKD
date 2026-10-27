import { Injectable, computed, inject, signal } from '@angular/core';
import { InstrumentType } from '@core/models';
import type { CashCurrency } from '@core/models/api.models';
import {
  DASHBOARD_STATE_PORT,
  DashboardWatchlistInstrumentOption,
} from '@features/dashboard/services/dashboard-state.port';
import { ToastService } from '@shared/components/toast/toast.service';

export interface DashboardWatchlistAssetSummary {
  symbol: string;
  name: string;
  currency: CashCurrency;
  price: number | null;
  changePct: number | null;
}

export interface DashboardWatchlistSearchRow {
  asset: DashboardWatchlistInstrumentOption;
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
  private readonly state = inject(DASHBOARD_STATE_PORT);
  private readonly toastService = inject(ToastService);

  private readonly watchlists = this.state.watchlists;
  private readonly activeWatchlistId = this.state.activeWatchlistId;

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

    const sourceAssets = this.state.backendWatchlistInstrumentOptions?.() ?? [];

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
        const quote = this.state.liveQuotes?.().get(asset.symbol.toUpperCase());
        return {
          asset,
          price: quote?.price ?? null,
          changePct: quote?.changePct ?? null,
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

    const asset = this.state
      .backendWatchlistInstrumentOptions?.()
      .find((instrument) => instrument.symbol.toUpperCase() === symbol.toUpperCase());
    if (!asset) {
      return null;
    }

    const quote = this.state.liveQuotes?.().get(symbol.toUpperCase());
    return {
      symbol,
      name: asset.name,
      currency: asset.currency,
      price: quote?.price ?? null,
      changePct: quote?.changePct ?? null,
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

    try {
      if (!this.state.createWatchlist) {
        throw new Error('Watchlist creation is unavailable.');
      }

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

    try {
      if (!this.state.deleteWatchlist) {
        throw new Error('Watchlist deletion is unavailable.');
      }

      await this.state.deleteWatchlist(activeId);
      this.activeWatchlistId.set(this.watchlists()[0]?.id ?? '');
      this.toastService.success(`Deleted watchlist "${activeWatchlistName}".`);
      this.closeWatchlistDialog();
    } catch (error) {
      this.toastService.error(this.toErrorMessage(error, 'Failed to delete watchlist.'));
    }
  }

  async addSymbolToActiveWatchlist(symbol: string): Promise<void> {
    const active = this.activeWatchlist();
    if (!active) {
      this.toastService.error('Select a watchlist first.');
      return;
    }

    this.closeWatchlistSearchPopup();
    try {
      if (!this.state.setWatchlistMembership) {
        throw new Error('Watchlist updates are unavailable.');
      }

      await this.state.setWatchlistMembership(symbol, active.id, true);
      this.toastService.success(`Added ${symbol} to "${active.name}".`);
    } catch (error) {
      this.toastService.error(
        this.toErrorMessage(error, `Failed to add ${symbol} to "${active.name}".`),
      );
    }
  }

  async removeSelectedWatchlistAsset(): Promise<void> {
    const selected = this.selectedWatchlistAsset();
    const active = this.activeWatchlist();
    if (!selected || !active) {
      return;
    }

    this.closeWatchlistAssetPopup();
    try {
      if (!this.state.setWatchlistMembership) {
        throw new Error('Watchlist updates are unavailable.');
      }

      await this.state.setWatchlistMembership(selected.symbol, active.id, false);
      this.toastService.success(`Removed ${selected.symbol} from "${active.name}".`);
    } catch (error) {
      this.toastService.error(
        this.toErrorMessage(error, `Failed to remove ${selected.symbol} from "${active.name}".`),
      );
    }
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

    try {
      if (!this.state.renameWatchlist) {
        throw new Error('Watchlist updates are unavailable.');
      }

      await this.state.renameWatchlist(active.id, trimmedName);
      this.toastService.success(`Renamed watchlist to "${trimmedName}".`);
      this.closeWatchlistDialog();
    } catch (error) {
      this.toastService.error(this.toErrorMessage(error, 'Failed to rename watchlist.'));
    }
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
