import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from './services/supabase.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  email = '';
  password = '';
  message = signal('');
  user = signal<User | null>(null);

  constructor(
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit() {
    const { data } =
      await this.supabaseService.getSession();

    this.user.set(
      data.session?.user ?? null
    );

    this.supabaseService.onAuthStateChange(
      (_event: string, session: any) => {
        this.user.set(
          session?.user ?? null
        );
      }
    );
  }

  async login() {
    const { error } =
      await this.supabaseService.signIn(
        this.email,
        this.password
      );

    if (error) {
      this.message.set(error.message);
      return;
    }

    this.message.set('');
  }

  async signUp() {
    const { data, error } =
      await this.supabaseService.signUp(
        this.email,
        this.password
      );

    if (error) {
      this.message.set(error.message);
      return;
    }

    if (data.session) {
      this.message.set('');
    } else {
      this.message.set(
        'Account created. Check your email to confirm your account.'
      );
    }
  }

  async logout() {
    const { error } =
      await this.supabaseService.signOut();

    if (error) {
      this.message.set(error.message);
      return;
    }

    this.email = '';
    this.password = '';
    this.message.set('');
  }
}
