import { DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { DisplaySymbolPipe } from '@shared/pipes/display-symbol.pipe';
import { AllocationAssetSelection } from '@features/dashboard/cards/allocation-by-asset/allocation-by-asset.component';
import { formatCurrency } from '@shared/utils/display-format';

@Component({
  selector: 'app-allocation-asset-overlay',
  standalone: true,
  imports: [ModalComponent, DecimalPipe, DisplaySymbolPipe],
  templateUrl: './allocation-asset-overlay.component.html',
  styleUrl: './allocation-asset-overlay.component.css',
})
export class AllocationAssetOverlayComponent {
  readonly formatCurrency = formatCurrency;

  asset = input<AllocationAssetSelection | null>(null);

  closed = output<void>();
  tradeRequested = output<void>();
}
