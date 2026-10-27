import { DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { AssetSummaryOverlayComponent } from '@shared/components/asset-summary-overlay/asset-summary-overlay.component';
import { AllocationAssetSelection } from '@features/dashboard/cards/allocation-by-asset/allocation-by-asset.component';
import { formatCurrency } from '@shared/utils/display-format';

@Component({
  selector: 'app-allocation-asset-overlay',
  standalone: true,
  imports: [AssetSummaryOverlayComponent, DecimalPipe],
  templateUrl: './allocation-asset-overlay.component.html',
  styleUrl: './allocation-asset-overlay.component.css',
})
export class AllocationAssetOverlayComponent {
  readonly formatCurrency = formatCurrency;

  asset = input<AllocationAssetSelection | null>(null);

  closed = output<void>();
  tradeRequested = output<void>();
}
