import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { RegistrationContinuationService } from '@core/services/registration-continuation.service';
import { ErrorResponse, toUserFacingErrorMessage } from '@core/models/profile.model';
import { ToastService } from '@shared/components/toast/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly toastService = inject(ToastService);

  email = '';
  password = '';
  showPassword = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private registrationContinuation: RegistrationContinuationService,
    route: ActivatedRoute,
  ) {
    this.email = route.snapshot.queryParamMap.get('email') ?? '';
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  async login() {
    if (!this.email || !this.password) {
      this.toastService.error('Enter your email and password.');
      return;
    }

    try {
      const result = await this.authService.login(this.email, this.password);

      if (result.status === 'challenge') {
        this.toastService.error(
          'Additional verification is required before you can sign in. Please contact support.',
        );
        return;
      }

      this.toastService.success('Signed in successfully.');
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      if (this.isEmailNotConfirmed(error)) {
        const registrationId = this.registrationContinuation.peek(this.email);
        if (registrationId) {
          this.toastService.error('Confirm your email address before signing in.');
          await this.router.navigate(['/auth/confirm'], {
            queryParams: { registrationId, email: this.email },
          });
          return;
        }

        this.toastService.error(
          'This email has a pending registration. Register again to claim it.',
        );
        await this.router.navigate(['/auth/register'], {
          queryParams: { email: this.email },
        });
        return;
      }

      this.toastService.error(this.mapErrorToMessage(error));
    }
  }

  private isEmailNotConfirmed(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse) || error.status !== 403) {
      return false;
    }

    const response = error.error as Partial<ErrorResponse> | undefined;
    return response?.details?.['code'] === 'EMAIL_NOT_CONFIRMED';
  }

  private mapErrorToMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Unable to sign in right now. Please try again.';
    }

    const response = error.error as Partial<ErrorResponse> | undefined;
    const detailedMessage = toUserFacingErrorMessage(response);
    if (detailedMessage) {
      return detailedMessage;
    }

    return 'Email or password is incorrect. Please try again.';
  }
}
