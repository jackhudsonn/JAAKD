import { Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { AllocationAssetSelection } from '@features/dashboard/widgets/allocation-by-asset/allocation-by-asset.component';

@Component({
  selector: 'app-allocation-asset-overlay',
  standalone: true,
  imports: [ModalComponent, DecimalPipe],
  templateUrl: './allocation-asset-overlay.component.html',
  styleUrl: './allocation-asset-overlay.component.css',
})
export class AllocationAssetOverlayComponent {
  asset = input<AllocationAssetSelection | null>(null);

  closed = output<void>();
  tradeRequested = output<void>();
}
