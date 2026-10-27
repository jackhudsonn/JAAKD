import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminOnlyGuard } from './core/guards/admin-only.guard';
import { adminOrAuditorGuard } from './core/guards/admin-or-auditor.guard';
import { analystOrAdminGuard } from './core/guards/analyst-or-admin.guard';
import { tradingAccessGuard } from './core/guards/trading-access.guard';
import { ShellComponent } from './layout/shell/shell.component';
import { AuthShellComponent } from './layout/auth-shell/auth-shell.component';

export const routes: Routes = [
  {
    path: 'auth',
    component: AuthShellComponent,
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login/login.component').then((m) => m.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
      },
      {
        path: 'confirm',
        loadComponent: () =>
          import('./features/auth/confirm/confirm-registration.component').then(
            (m) => m.ConfirmRegistrationComponent,
          ),
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      {
        path: 'update-password',
        loadComponent: () =>
          import('./features/auth/update-password/update-password.component').then(
            (m) => m.UpdatePasswordComponent,
          ),
      },
    ],
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        canActivate: [tradingAccessGuard],
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'transact',
        canActivate: [tradingAccessGuard],
        loadComponent: () =>
          import('./features/transact/transact.component').then((m) => m.TransactComponent),
      },
      {
        path: 'trade',
        canActivate: [tradingAccessGuard],
        loadComponent: () =>
          import('./features/trade/trade.component').then((m) => m.TradeComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'testing/order-lifecycle',
        canActivate: [adminOnlyGuard],
        loadComponent: () =>
          import('./features/testing/order-lifecycle-lab/order-lifecycle-lab.component').then(
            (m) => m.OrderLifecycleLabComponent,
          ),
      },
      {
        path: 'testing/auditor',
        canActivate: [adminOrAuditorGuard],
        loadComponent: () =>
          import('./features/testing/auditor/auditor.component').then((m) => m.AuditorComponent),
      },
      {
        path: 'analyst',
        canActivate: [analystOrAdminGuard],
        loadChildren: () =>
          import('./features/analyst/analyst.routes').then((m) => m.ANALYST_ROUTES),
      },
      {
        path: 'payment-methods',
        canActivate: [tradingAccessGuard],
        loadComponent: () =>
          import('./features/payment/payment.component').then((m) => m.PaymentComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
