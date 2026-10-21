import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ErrorResponse, toUserFacingErrorMessage } from '@core/models/profile.model';
import { ToastService } from '@shared/components/toast/toast.service';

@Component({
  selector: 'app-confirm-registration',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './confirm-registration.component.html',
  styleUrl: './confirm-registration.component.css',
})
export class ConfirmRegistrationComponent {
  private readonly toastService = inject(ToastService);

  email = '';
  code = '';
  busy = false;
  resending = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    route: ActivatedRoute,
  ) {
    this.email = route.snapshot.queryParamMap.get('email') ?? '';
  }

  async confirm() {
    if (!this.email || !this.code) {
      this.toastService.error('Enter your email and the verification code.');
      return;
    }

    this.busy = true;
    try {
      const authenticated = await this.authService.confirmRegistration(this.email, this.code);
      if (authenticated) {
        this.toastService.success('Email confirmed. Welcome to JAAKD.');
        await this.router.navigate(['/dashboard']);
        return;
      }

      this.toastService.success('Email confirmed. Please sign in.');
      await this.router.navigate(['/auth/login'], {
        queryParams: { email: this.email },
      });
    } catch (error) {
      this.toastService.error(this.mapErrorToMessage(error));
    } finally {
      this.busy = false;
    }
  }

  async resend() {
    if (!this.email) {
      this.toastService.error('Enter the email address you registered with.');
      return;
    }

    this.resending = true;
    try {
      await this.authService.resendConfirmation(this.email);
      this.toastService.success('A new verification code has been sent.');
    } catch (error) {
      this.toastService.error(this.mapErrorToMessage(error));
    } finally {
      this.resending = false;
    }
  }

  private mapErrorToMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Unable to verify your email right now. Please try again.';
    }

    const response = error.error as Partial<ErrorResponse> | undefined;
    const detailedMessage = toUserFacingErrorMessage(response);
    if (detailedMessage) {
      return detailedMessage;
    }

    return 'Unable to verify your email right now. Please try again.';
  }
}
