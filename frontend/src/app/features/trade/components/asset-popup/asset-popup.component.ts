import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { LineChartComponent } from '@shared/components/line-chart/line-chart.component';
import { OrderFormComponent, OrderFormSubmit } from '../order-form/order-form.component';
import { getAsset, getMockPrice, getMockPriceHistory } from '@core/mocks/mock-data';
import { startCycleTimer } from '@shared/utils/cycle-timer';

export type AssetOrderPlaced = OrderFormSubmit & { symbol: string };

/**
 * Asset Details popup (opened from the Trade card / ticker search) and
 * Chart popup (opened from the Watchlist card, via showChart) — the same
 * component so the buy/sell experience stays identical between the two.
 */
@Component({
  selector: 'app-asset-popup',
  standalone: true,
  imports: [ModalComponent, LineChartComponent, OrderFormComponent, DecimalPipe, TitleCasePipe],
  templateUrl: './asset-popup.component.html',
  styleUrl: './asset-popup.component.css',
})
export class AssetPopupComponent implements OnInit, OnDestroy {
  symbol = input.required<string>();
  showChart = input(false);
  ownedQuantity = input(0);
  accountCash = input(0);

  closed = output<void>();
  orderPlaced = output<AssetOrderPlaced>();

  confirmation = signal<AssetOrderPlaced | null>(null);

  private priceTick = signal(0);
  private stopTicking?: () => void;

  asset = computed(() => getAsset(this.symbol()));
  currentPrice = computed(() => {
    this.priceTick();
    return getMockPrice(this.symbol());
  });
  priceHistory = computed(() => (this.showChart() ? getMockPriceHistory(this.symbol()) : []));

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
}
