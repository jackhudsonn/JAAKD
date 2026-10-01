import { Injectable, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TradeFacadeService } from './trade-facade.service';

@Injectable({
  providedIn: 'root',
})
export class TradeDeepLinkService {
  private readonly router = inject(Router);
  private readonly tradeFacade = inject(TradeFacadeService);

  subscribeToSymbolQueryParam(
    route: ActivatedRoute,
    onSymbol: (symbol: string) => void,
  ): Subscription {
    return route.queryParamMap.subscribe((queryParams) => {
      const rawSymbol = queryParams.get('symbol');
      if (!rawSymbol) {
        return;
      }

      const symbol = rawSymbol.trim().toUpperCase();
      if (!this.tradeFacade.isKnownAssetSymbol(symbol)) {
        return;
      }

      onSymbol(symbol);

      // Consume the deep-link param so refresh/back doesn't reopen unexpectedly.
      void this.router.navigate([], {
        relativeTo: route,
        queryParams: { symbol: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }
}
