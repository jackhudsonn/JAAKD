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
import { CandleChartComponent } from '@shared/components/candle-chart/candle-chart.component';
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

/**
 * Asset details popup opened from the Trade card or ticker search.
 */
@Component({
  selector: 'app-asset-popup',
  standalone: true,
  imports: [
    ModalComponent,
    OrderFormComponent,
    CandleChartComponent,
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
      const requestId = ++this.candleRequestId;
      this.candles.set([]);

      if (!instrumentId) {
        this.candleState.set('ready');
        return;
      }

      this.candleState.set('loading');
      void this.loadCandles(instrumentId, requestId);
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

  private async loadCandles(instrumentId: string, requestId: number) {
    try {
      const candles = await this.instrumentApi.getCandles(instrumentId);
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
