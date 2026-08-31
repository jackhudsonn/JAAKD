import { Component, OnInit, signal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../../core/services/supabase.service';
@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  user = signal<User | null>(null);
  displayName = signal<string | null>(null);

  constructor(
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit() {
    const { data } = await this.supabaseService.getSession();
    await this.setSessionUser(data.session?.user ?? null);
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
    const metadataName = [metadataFirstName, metadataLastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    this.displayName.set(data?.full_name?.trim() || metadataName || null);
  }

  get metadata() {
    return this.user()?.user_metadata ?? {};
  }
}
