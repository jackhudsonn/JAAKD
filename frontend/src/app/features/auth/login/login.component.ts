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
  showPassword = false;
  message = signal('');

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
  ) {}
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  async login() {
    if (!this.email || !this.password) {
      this.message.set('Enter your email and password.');
      return;
    }

    const { error } = await this.supabaseService.signIn(this.email, this.password);

    if (error) {
      this.message.set('Email or password is incorrect. Don’t have an account? Create one below.');
      return;
    }

    this.message.set('');
    await this.router.navigate(['/dashboard']);
  }
}
