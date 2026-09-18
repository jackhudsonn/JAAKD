import { Component, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { MOCK_STATE, getAsset, getMockPrice } from '../../../../core/mocks/mock-data';
import { AllocationAssetSelection } from '../../widgets/allocation-by-asset/allocation-by-asset.component';

interface WatchlistAssetSummary {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
}

@Component({
  selector: 'app-dashboard-overlays',
  standalone: true,
  imports: [ModalComponent, DecimalPipe],
  templateUrl: './dashboard-overlays.component.html',
  styleUrl: './dashboard-overlays.component.css',
})
export class DashboardOverlaysComponent {
  private readonly watchlists = MOCK_STATE.watchlists;
  private readonly activeWatchlistId = MOCK_STATE.activeWatchlistId;

  protected readonly watchlistDialogMode = signal<'create' | 'delete' | null>(null);
  protected readonly watchlistNameDraft = signal('');
  protected readonly watchlistDialogError = signal<string | null>(null);
  protected readonly selectedWatchlistSymbol = signal<string | null>(null);
  protected readonly selectedAllocationAsset = signal<AllocationAssetSelection | null>(null);

  protected readonly canDeleteActive = computed(() => this.watchlists().length > 1);

  protected readonly activeWatchlist = computed(
    () => this.watchlists().find((watchlist) => watchlist.id === this.activeWatchlistId()) ?? null,
  );

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
  }

  requestDeleteWatchlist() {
    if (!this.canDeleteActive()) {
      return;
    }

    this.watchlistDialogError.set(null);
    this.watchlistDialogMode.set('delete');
  }

  requestWatchlistAsset(symbol: string) {
    this.selectedAllocationAsset.set(null);
    this.selectedWatchlistSymbol.set(symbol);
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

  protected onWatchlistNameInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.watchlistNameDraft.set(target.value);
    if (this.watchlistDialogError()) {
      this.watchlistDialogError.set(null);
    }
  }

  protected saveWatchlistName() {
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

  protected confirmDeleteWatchlist() {
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
}
