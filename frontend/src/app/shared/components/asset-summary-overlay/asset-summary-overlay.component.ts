import { Component, input, output } from '@angular/core';
import { ModalComponent } from '@shared/components/modal/modal.component';
import {
  AssetSummary,
  AssetSummaryComponent,
} from '@shared/components/asset-summary/asset-summary.component';
import { DisplaySymbolPipe } from '@shared/pipes/display-symbol.pipe';

@Component({
  selector: 'app-asset-summary-overlay',
  standalone: true,
  imports: [ModalComponent, AssetSummaryComponent, DisplaySymbolPipe],
  templateUrl: './asset-summary-overlay.component.html',
  styleUrl: './asset-summary-overlay.component.css',
})
export class AssetSummaryOverlayComponent {
  asset = input<AssetSummary | null>(null);
  title = input<string | null>(null);

  closed = output<void>();
}
