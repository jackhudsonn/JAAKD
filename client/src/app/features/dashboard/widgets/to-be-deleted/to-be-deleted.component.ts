import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import {
  WidgetCardComponent,
  WidgetStatus,
} from '../../../../shared/components/widget-card/widget-card.component';

@Component({
  selector: 'app-to-be-deleted-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  templateUrl: './to-be-deleted.component.html',
  styleUrl: './to-be-deleted.component.css',
})
export class ToBeDeletedWidgetComponent implements OnInit, OnDestroy {
  private loadTimer?: ReturnType<typeof setTimeout>;

  status = signal<WidgetStatus>('loading');

  ngOnInit() {
    this.load();
  }

  ngOnDestroy() {
    clearTimeout(this.loadTimer);
  }

  onRetry() {
    this.status.set('loading');
    this.load();
  }

  private load() {
    // Simulates an async fetch for a data source that does not exist.
    this.loadTimer = setTimeout(() => this.status.set('error'), 800);
  }
}
