import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  firstName = '';
  lastName = '';
  email = '';
  password = '';
  showPassword = false;
  showConfirmPassword = false;
  confirmPassword = '';
  dob = '';
  city = '';
  state = '';
  country = '';
  zipCode = '';

  message = signal('');

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

  async signUp() {
    if (!this.firstName || !this.lastName || !this.email || !this.password) {
      this.message.set('Please complete all required fields.');
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

    const { data, error } = await this.supabaseService.signUp(this.email, this.password, {
      firstName: this.firstName,
      lastName: this.lastName,
      dob: this.dob,
      city: this.city,
      state: this.state,
      country: this.country,
      zipCode: this.zipCode,
    });

    if (error) {
      this.message.set(error.message);
      return;
    }

    if (data.session) {
      await this.router.navigate(['/dashboard']);
    } else {
      this.message.set('Account created. Check your email to confirm your account.');
    }
  }
}
