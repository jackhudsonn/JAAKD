import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../../core/services/supabase.service';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent implements OnInit {
  user = signal<User | null>(null);
  displayName = signal<string | null>(null);

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
  ) {}

  async ngOnInit() {
    const { data } = await this.supabaseService.getSession();
    await this.setSessionUser(data.session?.user ?? null);

    this.supabaseService.onAuthStateChange((_event: string, session: any) => {
      void this.setSessionUser(session?.user ?? null);
    });
  }

  async setSessionUser(user: User | null) {
    this.user.set(user);
    this.displayName.set(null);

    if (!user) {
      return;
    }

    const { data } = await this.supabaseService.getProfile(user.id);
    const metadataFirstName = user.user_metadata?.['first_name'];
    const metadataLastName = user.user_metadata?.['last_name'];
    const metadataName = [metadataFirstName, metadataLastName].filter(Boolean).join(' ').trim();

    // Build display name from DB profile or auth metadata
    const profileName = [data?.firstName, data?.lastName].filter(Boolean).join(' ').trim();
    this.displayName.set(profileName || metadataName || null);
  }

  async logout() {
    const { error } = await this.supabaseService.signOut();
    if (error) {
      return;
    }
    await this.router.navigate(['/auth/login']);
  }
}
