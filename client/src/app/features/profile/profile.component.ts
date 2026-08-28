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

  constructor(
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit() {
    const { data } = await this.supabaseService.getSession();
    this.user.set(data.session?.user ?? null);
  }

  get metadata() {
    return this.user()?.user_metadata ?? {};
  }
}
