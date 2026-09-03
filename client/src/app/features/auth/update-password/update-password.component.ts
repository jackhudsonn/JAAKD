import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-update-password',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './update-password.component.html',
  styleUrl: './update-password.component.css',
})
export class UpdatePasswordComponent {
  password = '';
  confirmPassword = '';

  showPassword = false;
  showConfirmPassword = false;

  message = signal('');
  loading = signal(false);

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
  ) {}

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  async updatePassword() {
    if (!this.password || !this.confirmPassword) {
      this.message.set('Enter and confirm your new password.');
      return;
    }

    if (this.password.length < 6) {
      this.message.set('Password must be at least 6 characters.');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.message.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);
    this.message.set('');

    const { error } = await this.supabaseService.updatePassword(this.password);

    this.loading.set(false);

    if (error) {
      this.message.set(error.message);
      return;
    }

    this.message.set('Password updated successfully.');

    await this.router.navigate(['/dashboard']);
  }
}
