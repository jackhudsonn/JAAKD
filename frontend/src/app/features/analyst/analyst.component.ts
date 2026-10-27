import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AnalyticsMetaResponse } from '@core/models/analytics.models';
import { AnalyticsApiService } from '@core/services/analytics-api.service';
import { LoadState, loadStateFor } from './analyst-load-state';
import { LoadStateMessageComponent } from './load-state-message/load-state-message.component';

// Frame around every /analyst page: the "data as of" banner and the tab bar, with the active tab's page in
// the outlet below. Pages only render once /meta confirms there is a build to read.
@Component({
  selector: 'app-analyst',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, DatePipe, LoadStateMessageComponent],
  templateUrl: './analyst.component.html',
  styleUrl: './analyst.component.css',
})
export class AnalystComponent implements OnInit {
  private readonly analyticsApi = inject(AnalyticsApiService);

  readonly state = signal<LoadState>('loading');
  readonly meta = signal<AnalyticsMetaResponse | null>(null);

  ngOnInit() {
    void this.load();
  }

  async load() {
    this.state.set('loading');
    try {
      this.meta.set(await this.analyticsApi.getMeta());
      this.state.set('ready');
    } catch (error) {
      this.state.set(loadStateFor(error));
    }
  }
}
