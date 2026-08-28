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
  styleUrl: './shell.component.css'
})
export class ShellComponent implements OnInit {
  user = signal<User | null>(null);

  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    const { data } = await this.supabaseService.getSession();
    this.user.set(data.session?.user ?? null);

    this.supabaseService.onAuthStateChange((_event: string, session: any) => {
      this.user.set(session?.user ?? null);
    });
  }

  async logout() {
    const { error } = await this.supabaseService.signOut();
    if (error) { return; }
    await this.router.navigate(['/auth/login']);
  }
}
