import { Component, OnDestroy, OnInit, computed, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WidgetCardComponent } from '../../../shared/components/widget-card/widget-card.component';
import { ScrollableListComponent } from '../../../shared/components/scrollable-list/scrollable-list.component';
import { startCycleTimer } from '../../../shared/utils/cycle-timer';
import { InstrumentType } from '../../../core/models';
import { MOCK_ASSETS, MockAsset, getMockPrice } from '../mock-data';

interface TickerRow {
  asset: MockAsset;
  price: number;
  changePct: number;
}

const INSTRUMENT_TABS: { id: InstrumentType; label: string }[] = [
  { id: 'crypto', label: 'Crypto' },
  { id: 'stock', label: 'Stocks' },
  { id: 'bond', label: 'Bonds' },
];

@Component({
  selector: 'app-trade-card',
  standalone: true,
  imports: [WidgetCardComponent, ScrollableListComponent, FormsModule, DecimalPipe],
  templateUrl: './trade-card.component.html',
  styleUrl: './trade-card.component.css',
})
export class TradeCardComponent implements OnInit, OnDestroy {
  selectSymbol = output<string>();

  instrumentTabs = INSTRUMENT_TABS;
  instrument = signal<InstrumentType>('crypto');
  search = signal('');

  private priceTick = signal(0);
  private stopTicking?: () => void;

  filteredTickers = computed<TickerRow[]>(() => {
    this.priceTick();
    const query = this.search().trim().toLowerCase();

    return MOCK_ASSETS.filter((asset) => asset.instrumentType === this.instrument())
      .filter(
        (asset) =>
          !query ||
          asset.symbol.toLowerCase().includes(query) ||
          asset.name.toLowerCase().includes(query),
      )
      .map((asset) => {
        const price = getMockPrice(asset.symbol);
        return { asset, price, changePct: ((price - asset.basePrice) / asset.basePrice) * 100 };
      });
  });

  trackByTicker = (row: TickerRow) => row.asset.symbol;

  ngOnInit() {
    this.stopTicking = startCycleTimer(1, 1000, () => this.priceTick.update((tick) => tick + 1));
  }

  ngOnDestroy() {
    this.stopTicking?.();
  }

  setInstrument(type: InstrumentType) {
    this.instrument.set(type);
  }

  onSearchChange(value: string) {
    this.search.set(value);
  }
}
