import { Injectable } from '@angular/core';
import { PreferencesApiService } from '@core/services/preferences-api.service';
import {
  DashboardPreferencesCacheEntry,
  DashboardPreferencesCacheService,
} from './dashboard-preferences-cache.service';

@Injectable({
  providedIn: 'root',
})
export class DashboardPreferencesSyncService {
  constructor(
    private preferencesApiService: PreferencesApiService,
    private dashboardPreferencesCacheService: DashboardPreferencesCacheService,
  ) {}

  async getInitialWidgets(portfolioId: string): Promise<readonly string[] | null> {
    const cached = this.dashboardPreferencesCacheService.read(portfolioId);
    if (cached) {
      return cached.dashboardWidgets;
    }

    const server = await this.preferencesApiService.getByPortfolio(portfolioId);
    this.dashboardPreferencesCacheService.writeClean(
      portfolioId,
      server.dashboardWidgets,
      server.updatedAt,
    );
    return server.dashboardWidgets;
  }

  async persistWidgets(
    portfolioId: string,
    dashboardWidgets: readonly string[],
  ): Promise<readonly string[]> {
    this.dashboardPreferencesCacheService.writeDirty(portfolioId, dashboardWidgets);

    try {
      const updated = await this.preferencesApiService.updateByPortfolio(portfolioId, {
        dashboardWidgets: [...dashboardWidgets],
      });

      this.dashboardPreferencesCacheService.writeClean(
        portfolioId,
        updated.dashboardWidgets,
        updated.updatedAt,
      );
      return updated.dashboardWidgets;
    } catch {
      // Keep local cache as dirty; it will be retried on next load and next toggle.
      return [...dashboardWidgets];
    }
  }

  async reconcile(
    portfolioId: string,
    applyWidgets: (dashboardWidgets: readonly string[]) => void,
  ): Promise<void> {
    const local = this.dashboardPreferencesCacheService.read(portfolioId);
    if (!local) {
      return;
    }

    if (local.dirty) {
      await this.syncLocalIfNeeded(portfolioId, local, applyWidgets);
      return;
    }

    if (!this.dashboardPreferencesCacheService.isStale(local)) {
      return;
    }

    try {
      const server = await this.preferencesApiService.getByPortfolio(portfolioId);
      const latestLocal = this.dashboardPreferencesCacheService.read(portfolioId) ?? local;

      const localSavedAt = latestLocal.savedAt;
      const serverSavedAt = this.dashboardPreferencesCacheService.toEpochMs(server.updatedAt);

      if (latestLocal.dirty && localSavedAt > serverSavedAt) {
        await this.syncLocalIfNeeded(portfolioId, latestLocal, applyWidgets);
        return;
      }

      if (serverSavedAt >= localSavedAt) {
        applyWidgets(server.dashboardWidgets);
        this.dashboardPreferencesCacheService.writeClean(
          portfolioId,
          server.dashboardWidgets,
          server.updatedAt,
        );
      }
    } catch {
      // Non-fatal: continue with cached widgets.
    }
  }

  private async syncLocalIfNeeded(
    portfolioId: string,
    local: DashboardPreferencesCacheEntry,
    applyWidgets: (dashboardWidgets: readonly string[]) => void,
  ): Promise<void> {
    if (!local.dirty) {
      return;
    }

    try {
      const updated = await this.preferencesApiService.updateByPortfolio(portfolioId, {
        dashboardWidgets: [...local.dashboardWidgets],
      });

      applyWidgets(updated.dashboardWidgets);
      this.dashboardPreferencesCacheService.writeClean(
        portfolioId,
        updated.dashboardWidgets,
        updated.updatedAt,
      );
    } catch {
      // Keep dirty cache for later retry.
    }
  }
}