import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AllocationAssetSelection } from '@features/dashboard/widgets/allocation-by-asset/allocation-by-asset.component';
import { AllocationAssetOverlayComponent } from './allocation-by-asset/allocation-asset-overlay.component';
import { DashboardWatchlistOverlayFacade } from './watchlist/dashboard-watchlist-overlay.facade';
import { WatchlistDialogOverlaysComponent } from './watchlist/watchlist-dialog-overlays.component';
import { WatchlistSearchOverlayComponent } from './watchlist/watchlist-search-overlay.component';

@Component({
  selector: 'app-dashboard-overlays',
  standalone: true,
  imports: [
    WatchlistDialogOverlaysComponent,
    WatchlistSearchOverlayComponent,
    AllocationAssetOverlayComponent,
  ],
  templateUrl: './dashboard-overlays.component.html',
})
export class DashboardOverlaysComponent {
  protected readonly watchlistFacade = inject(DashboardWatchlistOverlayFacade);
  protected readonly selectedAllocationAsset = signal<AllocationAssetSelection | null>(null);

  constructor(private readonly router: Router) {}

  requestCreateWatchlist() {
    this.watchlistFacade.requestCreateWatchlist();
  }

  requestEditWatchlist() {
    this.watchlistFacade.requestEditWatchlist();
  }

  requestWatchlistAsset(symbol: string) {
    this.watchlistFacade.requestWatchlistAsset(symbol);
    this.selectedAllocationAsset.set(null);
  }

  requestAddWatchlistAsset() {
    this.selectedAllocationAsset.set(null);
    this.watchlistFacade.requestAddWatchlistAsset();
  }

  requestAllocationAsset(asset: AllocationAssetSelection) {
    this.watchlistFacade.closeWatchlistAssetPopup();
    this.selectedAllocationAsset.set(asset);
  }

  protected closeWatchlistDialog() {
    this.watchlistFacade.closeWatchlistDialog();
  }

  protected closeWatchlistSearchPopup() {
    this.watchlistFacade.closeWatchlistSearchPopup();
  }

  protected onWatchlistNameInput(value: string) {
    this.watchlistFacade.onWatchlistNameInput(value);
  }

  protected onWatchlistSearchChange(value: string) {
    this.watchlistFacade.onWatchlistSearchChange(value);
  }

  protected setWatchlistInstrumentFilter(type: Parameters<DashboardWatchlistOverlayFacade['setWatchlistInstrumentFilter']>[0]) {
    this.watchlistFacade.setWatchlistInstrumentFilter(type);
  }

  protected saveWatchlistName() {
    this.watchlistFacade.saveWatchlistName();
  }

  protected confirmDeleteWatchlist() {
    this.watchlistFacade.confirmDeleteWatchlist();
  }

  protected addSymbolToActiveWatchlist(symbol: string) {
    void this.watchlistFacade.addSymbolToActiveWatchlist(symbol);
  }

  protected removeSelectedWatchlistAsset() {
    void this.watchlistFacade.removeSelectedWatchlistAsset();
  }

  protected closeWatchlistAssetPopup() {
    this.watchlistFacade.closeWatchlistAssetPopup();
  }

  protected openTradeForWatchlistSelectedAsset() {
    const selected = this.watchlistFacade.selectedWatchlistAsset();
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
}
