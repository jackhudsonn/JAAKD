import { Injectable } from '@angular/core';
import { DASHBOARD_PREFERENCES_CACHE_PREFIX } from '@core/constants/dashboard-preferences.constants';

export interface DashboardPreferencesCacheEntry {
  version: 1;
  portfolioId: string;
  dashboardWidgets: string[];
  savedAt: number;
  dirty: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardPreferencesCacheService {
  private static readonly CACHE_VERSION = 1;
  private static readonly TTL_MS = 30 * 60 * 1000;
  
  read(portfolioId: string): DashboardPreferencesCacheEntry | null {
    const storage = this.getSessionStorage();
    if (!storage) {
      return null;
    }

    try {
      const raw = storage.getItem(this.cacheKey(portfolioId));
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<DashboardPreferencesCacheEntry>;
      if (
        parsed.version !== DashboardPreferencesCacheService.CACHE_VERSION ||
        parsed.portfolioId !== portfolioId ||
        !Array.isArray(parsed.dashboardWidgets) ||
        typeof parsed.savedAt !== 'number' ||
        typeof parsed.dirty !== 'boolean'
      ) {
        return null;
      }

      return {
        version: parsed.version,
        portfolioId: parsed.portfolioId,
        dashboardWidgets: parsed.dashboardWidgets.filter(
          (widget): widget is string => typeof widget === 'string',
        ),
        savedAt: parsed.savedAt,
        dirty: parsed.dirty,
      };
    } catch (error) {
      console.warn('DashboardPreferencesCacheService.read failed to parse cached preferences', {
        portfolioId,
        error,
      });
      return null;
    }
  }

  write(entry: DashboardPreferencesCacheEntry): void {
    const storage = this.getSessionStorage();
    if (!storage) {
      return;
    }

    try {
      storage.setItem(this.cacheKey(entry.portfolioId), JSON.stringify(entry));
    } catch (error) {
      console.warn('DashboardPreferencesCacheService.write failed to persist cache entry', {
        portfolioId: entry.portfolioId,
        error,
      });
      // Non-fatal: persistence is best effort.
    }
  }

  writeDirty(portfolioId: string, dashboardWidgets: readonly string[]): void {
    this.write({
      version: DashboardPreferencesCacheService.CACHE_VERSION,
      portfolioId,
      dashboardWidgets: [...dashboardWidgets],
      savedAt: Date.now(),
      dirty: true,
    });
  }

  writeClean(portfolioId: string, dashboardWidgets: readonly string[], updatedAt: string): void {
    this.write({
      version: DashboardPreferencesCacheService.CACHE_VERSION,
      portfolioId,
      dashboardWidgets: [...dashboardWidgets],
      savedAt: this.toEpochMs(updatedAt),
      dirty: false,
    });
  }

  isStale(entry: DashboardPreferencesCacheEntry): boolean {
    return Date.now() - entry.savedAt > DashboardPreferencesCacheService.TTL_MS;
  }

  toEpochMs(value: string): number {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }

  private cacheKey(portfolioId: string): string {
    return `${DashboardPreferencesCacheService.CACHE_PREFIX}${portfolioId}`;
  }

  private getSessionStorage(): Storage | null {
    try {
      if (typeof globalThis === 'undefined' || !('sessionStorage' in globalThis)) {
        return null;
      }

      return globalThis.sessionStorage;
    } catch (error) {
      console.warn('DashboardPreferencesCacheService.getSessionStorage unavailable', { error });
      return null;
    }
  }
}
