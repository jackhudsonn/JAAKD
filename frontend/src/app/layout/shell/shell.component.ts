import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ProfileService } from '@core/services/profile.service';
import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { MarketTickerItem, MarketTickerService } from '@core/services/market-ticker.service';
import { NgTemplateOutlet } from '@angular/common';
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
  marketTicker: MarketTickerItem[] = [];
  tickerLoopItems: MarketTickerItem[] = [];

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
      this.userEmail.set(profile.email);
    } catch {
      this.displayName.set(null);
    }
  }

  async logout() {
    await this.authService.logout();
    await this.router.navigate(['/auth/login']);
  }

  formatChange(changePct: number): string {
    if (changePct > 0) {
      return `+${changePct}% ↑`;
    }

    if (changePct < 0) {
      return `${changePct}% ↓`;
    }

    return `${changePct}%`;
  }
}
