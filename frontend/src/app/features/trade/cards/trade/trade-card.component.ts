import { Component, OnDestroy, OnInit, computed, inject, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { ScrollableListComponent } from '@shared/components/scrollable-list/scrollable-list.component';
import { DisplaySymbolPipe } from '@shared/pipes/display-symbol.pipe';
import { startCycleTimer } from '@shared/utils/cycle-timer';
import { isFlatChange } from '@shared/utils/format-percentage-change';
import { formatCurrency } from '@shared/utils/display-format';
import { InstrumentType } from '@core/models';
import {
  TRADE_MARKET_DATA_PORT,
  TradeMarketAsset,
} from '@features/trade/services/trade-market-data.port';

interface TickerRow {
  asset: TradeMarketAsset;
  price: number;
  changePct: number;
  flat: boolean;
}

type InstrumentFilter = InstrumentType | 'all';

const INSTRUMENT_OPTIONS: { id: InstrumentFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'equity', label: 'Equities' },
  { id: 'etf', label: 'ETFs' },
];

@Component({
  selector: 'app-trade-card',
  standalone: true,
  imports: [
    WidgetCardComponent,
    ScrollableListComponent,
    FormsModule,
    DecimalPipe,
    DisplaySymbolPipe,
  ],
  templateUrl: './trade-card.component.html',
  styleUrl: './trade-card.component.css',
})
export class TradeCardComponent implements OnInit, OnDestroy {
  private readonly marketData = inject(TRADE_MARKET_DATA_PORT);
  readonly marketListMinHeight = '325px';
  readonly marketListMaxHeight = '325px';

  selectSymbol = output<string>();

  instrumentOptions = INSTRUMENT_OPTIONS;
  readonly formatCurrency = formatCurrency;
  instrument = signal<InstrumentFilter>('all');
  search = signal('');

  private priceTick = signal(0);
  private stopTicking?: () => void;

  filteredTickers = computed<TickerRow[]>(() => {
    this.priceTick();
    const query = this.search().trim().toLowerCase();

    return this.marketData
      .listAssets()
      .filter((asset) => this.instrument() === 'all' || asset.instrumentType === this.instrument())
      .filter(
        (asset) =>
          !query ||
          asset.symbol.toLowerCase().includes(query) ||
          asset.name.toLowerCase().includes(query),
      )
      .map((asset) => {
        const price = this.marketData.getPrice(asset.symbol);
        const changePct = ((price - asset.basePrice) / asset.basePrice) * 100;
        return { asset, price, changePct, flat: isFlatChange(changePct) };
      });
  });

  trackByTicker = (row: TickerRow) => row.asset.symbol;

  ngOnInit() {
    this.stopTicking = startCycleTimer(1, 1000, () => this.priceTick.update((tick) => tick + 1));
  }

  ngOnDestroy() {
    this.stopTicking?.();
  }

  setInstrument(type: InstrumentFilter) {
    this.instrument.set(type);
  }

  onSearchChange(value: string) {
    this.search.set(value);
  }
}
