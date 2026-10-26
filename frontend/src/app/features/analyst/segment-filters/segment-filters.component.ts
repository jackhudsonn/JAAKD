import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AGE_BANDS, AgeBand, SegmentFilter } from '@core/models/analytics.models';
import { AnalyticsApiService } from '@core/services/analytics-api.service';

// Country and age band dropdowns, shared by the Instruments and Portfolios tabs. The countries come from the
// API, so the list only offers countries that have retail portfolios.
@Component({
  selector: 'app-segment-filters',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="form-field">
      <label [for]="idPrefix() + '-country'">Country</label>
      <select
        [id]="idPrefix() + '-country'"
        [ngModel]="value().country ?? ''"
        (ngModelChange)="update({ country: $event || undefined })"
      >
        <option value="">All countries</option>
        @for (country of countries(); track country) {
          <option [value]="country">{{ country }}</option>
        }
      </select>
    </div>

    <div class="form-field">
      <label [for]="idPrefix() + '-age-band'">Age band</label>
      <select
        [id]="idPrefix() + '-age-band'"
        [ngModel]="value().ageBand ?? ''"
        (ngModelChange)="update({ ageBand: $event || undefined })"
      >
        <option value="">All ages</option>
        @for (band of ageBands; track band) {
          <option [value]="band">{{ band }}</option>
        }
      </select>
    </div>
  `,
  styles: [
    `
      /* No box of its own, so the two fields sit in the parent's filter row like its other fields. */
      :host {
        display: contents;
      }

      .form-field {
        min-width: 160px;
        margin-bottom: 0;
      }
    `,
  ],
})
export class SegmentFiltersComponent implements OnInit {
  private readonly analyticsApi = inject(AnalyticsApiService);

  value = input.required<SegmentFilter>();
  // Keeps the ids unique when two of these are on one page.
  idPrefix = input('segment');
  valueChange = output<SegmentFilter>();

  readonly ageBands = AGE_BANDS;
  readonly countries = signal<string[]>([]);

  async ngOnInit() {
    try {
      this.countries.set(await this.analyticsApi.getCountries());
    } catch {
      // The dropdown just stays at "All countries"; the page shows its own error if the API is down.
    }
  }

  update(change: { country?: string; ageBand?: AgeBand }) {
    this.valueChange.emit({ ...this.value(), ...change });
  }
}
