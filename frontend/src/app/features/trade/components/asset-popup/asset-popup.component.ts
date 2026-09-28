import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { LineChartComponent } from '@shared/components/line-chart/line-chart.component';
import {
  OrderFormComponent,
  OrderFormSubmit,
} from '@features/trade/components/order-form/order-form.component';
import {
  ASSET_PERFORMANCE_INTERVALS,
  AssetPerformanceInterval,
  getAsset,
  getMockAssetPerformanceSeries,
  getMockPrice,
} from '@core/mocks/mock-data';
import { startCycleTimer } from '@shared/utils/cycle-timer';

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
 * Asset Details popup (opened from the Trade card / ticker search) and
 * Chart popup (opened from the Watchlist card, via showChart) — the same
 * component so the buy/sell experience stays identical between the two.
 */
@Component({
  selector: 'app-asset-popup',
  standalone: true,
  imports: [
    ModalComponent,
    LineChartComponent,
    OrderFormComponent,
    DecimalPipe,
    TitleCasePipe,
  ],
  templateUrl: './asset-popup.component.html',
  styleUrl: './asset-popup.component.css',
})
export class AssetPopupComponent implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  symbol = input.required<string>();
  showChart = input(false);
  ownedQuantity = input(0);
  accountCash = input(0);
  watchlists = input<readonly AssetPopupWatchlistOption[]>([]);
  maxWatchlistHoldings = input(40);

  closed = output<void>();
  orderPlaced = output<AssetOrderPlaced>();
  setWatchlistMembership = output<AssetSetWatchlistMembershipRequest>();

  confirmation = signal<AssetOrderPlaced | null>(null);
  watchlistDropdownOpen = signal(false);
  activeView = signal<'analysis' | 'trade'>('analysis');
  intervals = ASSET_PERFORMANCE_INTERVALS;
  selectedInterval = signal<AssetPerformanceInterval>('1D');

  private priceTick = signal(0);
  private stopTicking?: () => void;

  asset = computed(() => getAsset(this.symbol()));
  currentPrice = computed(() => {
    this.priceTick();
    return getMockPrice(this.symbol());
  });
  // TODO: replace getMockAssetPerformanceSeries with an API-backed call like
  // GET /assets/{symbol}/performance?interval={interval}.
  performanceSeries = computed(() =>
    getMockAssetPerformanceSeries(this.symbol(), this.selectedInterval()),
  );
  watchlistMembershipCount = computed(
    () => this.watchlists().filter((watchlist) => watchlist.containsSymbol).length,
  );
  startValue = computed(() => this.performanceSeries()[0]?.value ?? 0);
  endValue = computed(() => this.performanceSeries().at(-1)?.value ?? 0);
  highValue = computed(() => {
    const values = this.performanceSeries().map((point) => point.value);
    return values.length > 0 ? Math.max(...values) : 0;
  });
  lowValue = computed(() => {
    const values = this.performanceSeries().map((point) => point.value);
    return values.length > 0 ? Math.min(...values) : 0;
  });
  changeAmount = computed(() => this.endValue() - this.startValue());
  changePct = computed(() => {
    const start = this.startValue();
    return start === 0 ? 0 : (this.changeAmount() / start) * 100;
  });
  isPositive = computed(() => this.changeAmount() >= 0);

  constructor() {
    effect(() => {
      this.symbol();
      this.watchlistDropdownOpen.set(false);
      this.activeView.set('analysis');
      this.selectedInterval.set('1D');
      this.confirmation.set(null);
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (
      this.watchlistDropdownOpen() &&
      !this.elementRef.nativeElement.contains(event.target as Node)
    ) {
      this.watchlistDropdownOpen.set(false);
    }
  }

  ngOnInit() {
    // Keeps the displayed mock price (and chart, if shown) live while the popup is open.
    this.stopTicking = startCycleTimer(1, 1000, () => this.priceTick.update((tick) => tick + 1));
  }

  ngOnDestroy() {
    this.stopTicking?.();
  }

  onOrderPlaced(request: OrderFormSubmit) {
    const placed: AssetOrderPlaced = { symbol: this.symbol(), ...request };
    this.orderPlaced.emit(placed);
    this.confirmation.set(placed);
  }

  openTradeView() {
    this.watchlistDropdownOpen.set(false);
    this.activeView.set('trade');
  }

  openAnalysisView() {
    this.activeView.set('analysis');
  }

  selectInterval(interval: AssetPerformanceInterval) {
    this.selectedInterval.set(interval);
  }

  toggleWatchlistDropdown() {
    this.watchlistDropdownOpen.update((open) => !open);
  }

  isOptionDisabled(option: AssetPopupWatchlistOption) {
    return !option.containsSymbol && !option.canAdd;
  }

  onWatchlistOptionChange(option: AssetPopupWatchlistOption, event: Event) {
    const target = event.target as HTMLInputElement;
    const includeInWatchlist = target.checked;

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
