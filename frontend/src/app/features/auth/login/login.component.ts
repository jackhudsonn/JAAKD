import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ErrorResponse, toUserFacingErrorMessage } from '@core/models/profile.model';

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
    private authService: AuthService,
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

    try {
      await this.authService.login(this.email, this.password);
      this.message.set('');
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.message.set(this.mapErrorToMessage(error));
    }
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
