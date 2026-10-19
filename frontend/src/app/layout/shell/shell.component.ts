import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ProfileService } from '@features/profile/services/profile.service';
import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { MarketTickerItem, MarketTickerService } from '@core/services/market-ticker.service';
import { NgTemplateOutlet } from '@angular/common';
import { formatPercentageChange } from '@shared/utils/format-percentage-change';
import { isAdminOrAuditor } from '@core/models/profile.model';
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
  marketTicker: MarketTickerItem[] = [];
  tickerLoopItems: MarketTickerItem[] = [];
  readonly formatChange = formatPercentageChange;

  constructor(
    protected authService: AuthService,
    private profileService: ProfileService,
    private router: Router,
    private marketTickerService: MarketTickerService,
  ) {}

  async ngOnInit() {
    this.marketTicker = this.marketTickerService.getTickerItems();

    this.tickerLoopItems = [...this.marketTicker, ...this.marketTicker];
    this.userEmail.set(this.authService.userEmail());

    try {
      const profile = await this.profileService.getCurrentProfile();
      const profileName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
      this.displayName.set(profileName || null);
      this.canAccessAuditor.set(isAdminOrAuditor(profile.userType));
    } catch {
      this.displayName.set(null);
      this.canAccessAuditor.set(false);
    }
  }

  async logout() {
    await this.authService.logout();
    await this.router.navigate(['/auth/login']);
  }
}
