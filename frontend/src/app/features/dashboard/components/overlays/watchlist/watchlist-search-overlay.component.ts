import { Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { ScrollableListComponent } from '@shared/components/scrollable-list/scrollable-list.component';
import {
  DashboardInstrumentFilter,
  DashboardInstrumentOption,
  DashboardWatchlistSearchRow,
} from './dashboard-watchlist-overlay.facade';

@Component({
  selector: 'app-watchlist-search-overlay',
  standalone: true,
  imports: [ModalComponent, ScrollableListComponent, FormsModule, DecimalPipe],
  templateUrl: './watchlist-search-overlay.component.html',
  styleUrl: './watchlist-search-overlay.component.css',
})
export class WatchlistSearchOverlayComponent {
  watchlistSearchOpen = input(false);
  watchlistSearch = input('');
  watchlistSearchInstrument = input<DashboardInstrumentFilter>('all');
  instrumentOptions = input<readonly DashboardInstrumentOption[]>([]);
  activeWatchlistSymbolCount = input(0);
  maxHoldingsPerWatchlist = input(0);
  watchlistSearchError = input<string | null>(null);
  activeWatchlistHasCapacity = input(false);
  watchlistSearchRows = input<readonly DashboardWatchlistSearchRow[]>([]);
  watchlistSearchEmptyMessage = input('');

  closeWatchlistSearchPopup = output<void>();
  watchlistSearchChange = output<string>();
  watchlistInstrumentFilterChange = output<DashboardInstrumentFilter>();
  addSymbolToActiveWatchlist = output<string>();

  protected readonly trackByWatchlistSearchSymbol = (row: DashboardWatchlistSearchRow) => row.asset.symbol;
}
