import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '@core/services/supabase.service';
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
  user = signal<User | null>(null);
  displayName = signal<string | null>(null);
  marketTicker: MarketTickerItem[] = [];
  tickerLoopItems: MarketTickerItem[] = [];

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private marketTickerService: MarketTickerService,
  ) {}

  async ngOnInit() {
    this.marketTicker = this.marketTickerService.getTickerItems();

    this.tickerLoopItems = [...this.marketTicker, ...this.marketTicker];
    const { data } = await this.supabaseService.getSession();
    await this.setSessionUser(data.session?.user ?? null);

    this.supabaseService.onAuthStateChange((_event: string, session: any) => {
      void this.setSessionUser(session?.user ?? null);
    });
  }

  async setSessionUser(user: User | null) {
    this.user.set(user);

    if (!user) {
      this.displayName.set(null);
      return;
    }

    const metadataFirstName = user.user_metadata?.['first_name'];

    const metadataLastName = user.user_metadata?.['last_name'];

    const metadataName = [metadataFirstName, metadataLastName].filter(Boolean).join(' ').trim();

    // Show Auth metadata name immediately.
    this.displayName.set(metadataName || null);

    // Then confirm/override with the DB profile.
    const { data } = await this.supabaseService.getProfile(user.id);

    const profileName = [data?.firstName, data?.lastName].filter(Boolean).join(' ').trim();

    if (profileName) {
      this.displayName.set(profileName);
    }
  }

  async logout() {
    const { error } = await this.supabaseService.signOut();
    if (error) {
      return;
    }
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