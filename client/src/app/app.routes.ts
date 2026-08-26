import { Routes } from '@angular/router';

import { Dashboard } from './dashboard/dashboard';
import { Transactions } from './transactions/transactions';
import { Analytics } from './analytics/analytics';

export const routes: Routes = [

  {
    path: '',
    component: Dashboard
  },

  {
    path: 'dashboard',
    component: Dashboard
  },

  {
    path: 'transactions',
    component: Transactions
  },

  {
    path: 'analytics',
    component: Analytics
  },

  {
    path: '**',
    redirectTo: ''
  }

];
