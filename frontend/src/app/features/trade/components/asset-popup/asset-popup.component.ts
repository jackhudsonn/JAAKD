import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { InstrumentCandleResponse } from '@core/models/api.models';
import { InstrumentApiService } from '@core/services/instrument-api.service';
import { ModalComponent } from '@shared/components/modal/modal.component';
import {
  LineChartComponent,
  LineChartPoint,
} from '@shared/components/line-chart/line-chart.component';
import { DisplaySymbolPipe } from '@shared/pipes/display-symbol.pipe';
import { ToastService } from '@shared/components/toast/toast.service';
import {
  OrderFormComponent,
  OrderFormSubmit,
} from '@features/trade/components/order-form/order-form.component';
import { TRADE_MARKET_DATA_PORT } from '@features/trade/services/trade-market-data.port';
import { isFlatChange } from '@shared/utils/format-percentage-change';
import { formatCurrency } from '@shared/utils/display-format';
import { REPORTING_CURRENCY } from '@core/models/api.models';

export type AssetOrderPlaced = OrderFormSubmit & { symbol: string };

export interface AssetPopupWatchlistOption {
  id: string;
  name: string;
  symbolCount: number;
  containsSymbol: boolean;
  canAdd: boolean;
  disabledReason: string | null;
}

export interface AssetSetWatchlistMembershipRequest {
  symbol: string;
  watchlistId: string;
  included: boolean;
}

export type AssetPriceInterval = '1W' | '1M' | '1Y' | 'YTD' | 'ALL';

export const ASSET_PRICE_INTERVALS: AssetPriceInterval[] = ['1W', '1M', '1Y', 'YTD', 'ALL'];

function shiftUtcDate(date: Date, years: number, months: number) {
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCFullYear(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDay));
}

export function assetPriceRangeFor(
  interval: AssetPriceInterval,
  today = new Date(),
): { from: string; to: string } {
  const to = today.toISOString().slice(0, 10);
  const start = new Date(`${to}T00:00:00Z`);

  switch (interval) {
    case '1W':
      start.setUTCDate(start.getUTCDate() - 7);
      break;
    case '1M':
      shiftUtcDate(start, 0, -1);
      break;
    case '1Y':
      shiftUtcDate(start, -1, 0);
      break;
    case 'YTD':
      start.setUTCMonth(0, 1);
      break;
    case 'ALL':
      shiftUtcDate(start, -5, 0);
      break;
  }

  return { from: start.toISOString().slice(0, 10), to };
}

export function toPriceChartLabel(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

export function toAveragePricePoints(candles: InstrumentCandleResponse[]): LineChartPoint[] {
  return candles.map((candle) => ({
    label: toPriceChartLabel(candle.date),
    value: (candle.open + candle.high + candle.low + candle.close) / 4,
  }));
}

/**
 * Asset details popup opened from the Trade card or ticker search.
 */
@Component({
  selector: 'app-asset-popup',
  standalone: true,
  imports: [
    ModalComponent,
    OrderFormComponent,
    LineChartComponent,
    DecimalPipe,
    TitleCasePipe,
    DisplaySymbolPipe,
  ],
  templateUrl: './asset-popup.component.html',
  styleUrl: './asset-popup.component.css',
})
export class AssetPopupComponent {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly marketData = inject(TRADE_MARKET_DATA_PORT);
  private readonly instrumentApi = inject(InstrumentApiService);
  private readonly toastService = inject(ToastService);

  symbol = input.required<string>();
  ownedQuantity = input(0);
  accountCash = input(0);
  watchlists = input<readonly AssetPopupWatchlistOption[]>([]);
  maxWatchlistHoldings = input<number | null>(null);

  closed = output<void>();
  orderPlaced = output<AssetOrderPlaced>();
  setWatchlistMembership = output<AssetSetWatchlistMembershipRequest>();

  watchlistDropdownOpen = signal(false);
  activeView = signal<'analysis' | 'trade'>('analysis');
  candles = signal<InstrumentCandleResponse[]>([]);
  averagePricePoints = computed(() => toAveragePricePoints(this.candles()));
  priceIntervals = ASSET_PRICE_INTERVALS;
  selectedPriceInterval = signal<AssetPriceInterval>('1M');
  candleState = signal<'loading' | 'ready' | 'error'>('loading');
  readonly formatCurrency = formatCurrency;
  readonly fallbackCurrency = REPORTING_CURRENCY;

  private readonly reportedUnavailableData = new Set<string>();
  private candleRequestId = 0;

  asset = computed(() => this.marketData.getAsset(this.symbol()));
  currentPrice = computed(() => this.marketData.getPrice(this.symbol()));
  watchlistMembershipCount = computed(
    () => this.watchlists().filter((watchlist) => watchlist.containsSymbol).length,
  );
  hasPriceChange = computed(() => {
    const basePrice = this.asset()?.basePrice;
    return this.currentPrice() !== null && basePrice != null && basePrice > 0;
  });
  changeAmount = computed(() => {
    const price = this.currentPrice();
    const basePrice = this.asset()?.basePrice;
    return price !== null && basePrice != null ? price - basePrice : 0;
  });
  changePct = computed(() => {
    const basePrice = this.asset()?.basePrice;
    return this.hasPriceChange() && basePrice != null ? (this.changeAmount() / basePrice) * 100 : 0;
  });
  isPositive = computed(() => this.changeAmount() >= 0);
  // Flat only when both shown values round to 0.00; a cheap asset can move
  // under a cent and still change by a visible percent.
  isFlat = computed(() => isFlatChange(this.changeAmount()) && isFlatChange(this.changePct()));

  constructor() {
    effect(() => {
      const instrumentId = this.asset()?.instrumentId;
      const interval = this.selectedPriceInterval();
      const requestId = ++this.candleRequestId;
      this.candles.set([]);

      if (!instrumentId) {
        this.candleState.set('ready');
        return;
      }

      this.candleState.set('loading');
      void this.loadCandles(instrumentId, requestId, interval);
    });

    effect(() => {
      const symbol = this.symbol();
      const price = this.currentPrice();

      if (price === null) {
        this.notifyUnavailableDataOnce(`price:${symbol}`, `${symbol} price is unavailable.`);
      }
    });

    effect(() => {
      this.symbol();
      this.watchlistDropdownOpen.set(false);
      this.activeView.set('analysis');
    });
  }

  private async loadCandles(instrumentId: string, requestId: number, interval: AssetPriceInterval) {
    try {
      const { from, to } = assetPriceRangeFor(interval);
      const candles = await this.instrumentApi.getCandles(instrumentId, from, to);
      if (requestId !== this.candleRequestId) {
        return;
      }

      this.candles.set(candles);
      this.candleState.set('ready');
    } catch {
      if (requestId === this.candleRequestId) {
        this.candleState.set('error');
      }
    }
  }

  selectPriceInterval(interval: AssetPriceInterval) {
    this.selectedPriceInterval.set(interval);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (this.watchlistDropdownOpen() && !this.elementRef.nativeElement.contains(target)) {
      this.watchlistDropdownOpen.set(false);
    }
  }

  onOrderPlaced(request: OrderFormSubmit) {
    const placed: AssetOrderPlaced = { symbol: this.symbol(), ...request };
    this.orderPlaced.emit(placed);
    this.closed.emit();
  }

  openTradeView() {
    this.watchlistDropdownOpen.set(false);
    this.activeView.set('trade');
  }

  openAnalysisView() {
    this.activeView.set('analysis');
  }

  private notifyUnavailableDataOnce(key: string, message: string) {
    if (this.reportedUnavailableData.has(key)) {
      return;
    }

    this.reportedUnavailableData.add(key);
    this.toastService.error(message);
  }

  toggleWatchlistDropdown() {
    this.watchlistDropdownOpen.update((open) => !open);
  }

  isOptionDisabled(option: AssetPopupWatchlistOption) {
    return !option.containsSymbol && !option.canAdd;
  }

  onWatchlistOptionChange(option: AssetPopupWatchlistOption, includeInWatchlist: boolean) {
    if (includeInWatchlist && !option.canAdd) {
      return;
    }

    this.setWatchlistMembership.emit({
      symbol: this.symbol(),
      watchlistId: option.id,
      included: includeInWatchlist,
    });
  }
}
