import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  email = '';
  password = '';
  message = signal('');

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
  ) {}

  async login() {
    const { error } = await this.supabaseService.signIn(this.email, this.password);

    if (error) {
      this.message.set(error.message);
      return;
    }

    this.message.set('');
    await this.router.navigate(['/dashboard']);
  }

  async signUp() {
    const { data, error } = await this.supabaseService.signUp(this.email, this.password);

    if (error) {
      this.message.set(error.message);
      return;
    }

    if (data.session) {
      this.message.set('');
      await this.router.navigate(['/dashboard']);
    } else {
      this.message.set('Account created. Check your email to confirm your account.');
    }
  }
}
