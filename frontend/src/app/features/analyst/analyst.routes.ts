import { Routes } from '@angular/router';
import { AnalystComponent } from './analyst.component';

// Child routes of /analyst. Every view has its own URL so analysts can share links.
export const ANALYST_ROUTES: Routes = [
  {
    path: '',
    component: AnalystComponent,
    children: [
      { path: '', redirectTo: 'instruments', pathMatch: 'full' },
      {
        path: 'instruments',
        loadComponent: () =>
          import('./instruments-tab/instruments-tab.component').then(
            (m) => m.InstrumentsTabComponent,
          ),
      },
      {
        path: 'instruments/:instrumentId',
        loadComponent: () =>
          import('./instrument-detail/instrument-detail.component').then(
            (m) => m.InstrumentDetailComponent,
          ),
      },
      {
        path: 'portfolios',
        loadComponent: () =>
          import('./portfolios-tab/portfolios-tab.component').then((m) => m.PortfoliosTabComponent),
      },
      {
        path: 'portfolios/:portfolioId',
        loadComponent: () =>
          import('./portfolio-detail/portfolio-detail.component').then(
            (m) => m.PortfolioDetailComponent,
          ),
      },
      {
        path: 'demographics',
        loadComponent: () =>
          import('./demographics-tab/demographics-tab.component').then(
            (m) => m.DemographicsTabComponent,
          ),
      },
      {
        path: 'holdings/:holdingId',
        loadComponent: () =>
          import('./holding-detail/holding-detail.component').then((m) => m.HoldingDetailComponent),
      },
    ],
  },
];
