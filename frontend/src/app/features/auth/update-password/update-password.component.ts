import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ErrorResponse, toUserFacingErrorMessage } from '@core/models/profile.model';

@Component({
  selector: 'app-update-password',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './update-password.component.html',
  styleUrl: './update-password.component.css',
})
export class UpdatePasswordComponent {
  currentPassword = '';
  password = '';
  confirmPassword = '';

  showPassword = false;
  showConfirmPassword = false;

  message = signal('');
  loading = signal(false);

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  async updatePassword() {
    if (!this.currentPassword || !this.password || !this.confirmPassword) {
      this.message.set('Enter your current password and your new password.');
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

    try {
      await this.authService.changePassword(this.currentPassword, this.password);
      this.loading.set(false);
      this.message.set('Password updated successfully.');
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.loading.set(false);
      this.message.set(this.mapErrorToMessage(error));
    }
  }

  private mapErrorToMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Unable to update your password right now. Please try again.';
    }

    const response = error.error as Partial<ErrorResponse> | undefined;
    const detailedMessage = toUserFacingErrorMessage(response);
    if (detailedMessage) {
      return detailedMessage;
    }

    return 'Unable to update your password right now. Please try again.';
  }
}
