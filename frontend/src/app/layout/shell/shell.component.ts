import { Component, OnInit, computed, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ProfileService } from '@features/profile/services/profile.service';
import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { MarketTickerItem, MarketTickerService } from '@core/services/market-ticker.service';
import { NgTemplateOutlet } from '@angular/common';
import { formatCurrency } from '@shared/utils/display-format';
import { formatPercentageChange } from '@shared/utils/format-percentage-change';
import { USER_TYPE, isAdminOrAuditor, isAnalystOrAdmin } from '@core/models/profile.model';

const TICKER_SECONDS_PER_ITEM = 3.5;

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, NgTemplateOutlet],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent implements OnInit {
  userEmail = signal<string | null>(null);
  displayName = signal<string | null>(null);
  canAccessAuditor = signal(false);
  canAccessAnalyst = signal(false);
  // Analysts only use the analyst view, so their navbar shows nothing else.
  analystOnly = signal(false);
  tickerLoopItems = signal<MarketTickerItem[]>([]);
  tickerLoaded = signal(false);
  readonly tickerDuration = computed(
    () => `${this.tickerLoopItems().length * TICKER_SECONDS_PER_ITEM}s`,
  );
  readonly formatChange = formatPercentageChange;
  readonly formatCurrency = formatCurrency;

  constructor(
    protected authService: AuthService,
    private profileService: ProfileService,
    private router: Router,
    private marketTickerService: MarketTickerService,
  ) {}

  async ngOnInit() {
    void this.loadMarketTicker();
    this.userEmail.set(this.authService.userEmail());

    try {
      const profile = await this.profileService.getCurrentProfile();
      const profileName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
      this.displayName.set(profileName || null);
      this.canAccessAuditor.set(isAdminOrAuditor(profile.userType));
      this.canAccessAnalyst.set(isAnalystOrAdmin(profile.userType));
      this.analystOnly.set(profile.userType === USER_TYPE.ANALYST);
    } catch {
      this.displayName.set(null);
      this.canAccessAuditor.set(false);
      this.canAccessAnalyst.set(false);
      this.analystOnly.set(false);
    }
  }

  private async loadMarketTicker() {
    try {
      const items = await this.marketTickerService.getTickerItems();
      this.tickerLoopItems.set([...items, ...items]);
    } catch (error) {
      console.error('ShellComponent market ticker failed', error);
      this.tickerLoopItems.set([]);
    }
    this.tickerLoaded.set(true);
  }

  async logout() {
    await this.authService.logout();
    await this.router.navigate(['/auth/login']);
  }
}
