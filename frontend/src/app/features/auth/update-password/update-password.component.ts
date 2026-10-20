import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ErrorResponse, toUserFacingErrorMessage } from '@core/models/profile.model';
import { ToastService } from '@shared/components/toast/toast.service';

@Component({
  selector: 'app-update-password',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './update-password.component.html',
  styleUrl: './update-password.component.css',
})
export class UpdatePasswordComponent {
  private readonly toastService = inject(ToastService);

  currentPassword = '';
  password = '';
  confirmPassword = '';

  showPassword = false;
  showConfirmPassword = false;

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
      this.toastService.error('Enter your current password and your new password.');
      return;
    }

    if (this.password.length < 6) {
      this.toastService.error('Password must be at least 6 characters.');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.toastService.error('Passwords do not match.');
      return;
    }

    this.loading.set(true);

    try {
      await this.authService.changePassword(this.currentPassword, this.password);
      this.loading.set(false);
      this.toastService.success('Password updated successfully.');
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.loading.set(false);
      this.toastService.error(this.mapErrorToMessage(error));
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
