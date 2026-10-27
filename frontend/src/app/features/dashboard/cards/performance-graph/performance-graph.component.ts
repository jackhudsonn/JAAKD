import { Component } from '@angular/core';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';

@Component({
  selector: 'app-performance-graph-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  templateUrl: './performance-graph.component.html',
  styleUrl: './performance-graph.component.css',
})
export class PerformanceGraphWidgetComponent {}
