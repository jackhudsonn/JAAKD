import { Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { DashboardWatchlistAssetSummary } from './dashboard-watchlist-overlay.facade';

@Component({
  selector: 'app-watchlist-dialog-overlays',
  standalone: true,
  imports: [ModalComponent, DecimalPipe],
  templateUrl: './watchlist-dialog-overlays.component.html',
  styleUrl: './watchlist-dialog-overlays.component.css',
})
export class WatchlistDialogOverlaysComponent {
  watchlistDialogMode = input<'create' | 'edit' | null>(null);
  watchlistNameDraft = input('');
  watchlistDialogError = input<string | null>(null);
  canCreateWatchlist = input(false);
  canDeleteActive = input(false);
  maxWatchlists = input(0);
  maxHoldingsPerWatchlist = input(0);
  activeWatchlistName = input<string | null>(null);
  activeWatchlistSymbolCount = input(0);
  selectedWatchlistAsset = input<DashboardWatchlistAssetSummary | null>(null);

  closeWatchlistDialog = output<void>();
  watchlistNameChange = output<string>();
  saveWatchlistName = output<void>();
  confirmDeleteWatchlist = output<void>();
  closeWatchlistAssetPopup = output<void>();
  removeSelectedWatchlistAsset = output<void>();
  tradeSelectedWatchlistAsset = output<void>();

  onWatchlistNameInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.watchlistNameChange.emit(target.value);
  }
}
