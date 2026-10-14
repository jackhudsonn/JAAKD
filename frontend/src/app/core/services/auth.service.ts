import { Injectable, computed, signal } from '@angular/core';
import { HttpContext, HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@environments/environment.local';
import { AUTH_FLOW } from '@core/http/auth-flow.token';

interface SessionResponse {
  email: string;
}

// Session auth: the browser never holds a token. The backend sets an HttpOnly
// session cookie; this service only tracks the signed-in email and asks the
// backend whether a session exists.
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly emailSignal = signal<string | null>(null);
  private readonly credentialFlow = new HttpContext().set(AUTH_FLOW, true);

  readonly userEmail = this.emailSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.emailSignal() !== null);

  constructor(private httpClient: HttpClient) {}

  async register(email: string, password: string): Promise<void> {
    await firstValueFrom(
      this.httpClient.post(
        `${environment.apiUrl}/api/auth/register`,
        { email, password },
        { context: this.credentialFlow },
      ),
    );
  }

  async login(email: string, password: string): Promise<void> {
    const response = await firstValueFrom(
      this.httpClient.post<SessionResponse | null>(
        `${environment.apiUrl}/api/auth/login`,
        { email, password },
        { context: this.credentialFlow },
      ),
    );

    // Some proxies or adapters may omit the JSON body while still setting the
    // session cookie; fall back to the submitted email so login can continue.
    const normalizedEmail = email.trim().toLowerCase();
    const resolvedEmail =
      typeof response?.email === 'string' && response.email.trim().length > 0
        ? response.email
        : normalizedEmail;

    this.emailSignal.set(resolvedEmail);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.httpClient.post(`${environment.apiUrl}/api/auth/logout`, null, { context: this.credentialFlow }),
      );
    } finally {
      this.clearSession();
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(
      this.httpClient.post(
        `${environment.apiUrl}/api/auth/change-password`,
        { currentPassword, newPassword },
        { context: this.credentialFlow },
      ),
    );
  }

  // Confirms the session cookie is still valid and restores the signed-in email.
  async ensureSession(): Promise<boolean> {
    if (this.emailSignal()) {
      return true;
    }

    try {
      const response = await firstValueFrom(
        this.httpClient.get<SessionResponse | null>(`${environment.apiUrl}/api/auth/session`, {
          context: this.credentialFlow,
        }),
      );

      if (typeof response?.email !== 'string' || response.email.trim().length === 0) {
        this.emailSignal.set(null);
        return false;
      }

      this.emailSignal.set(response.email);
      return true;
    } catch {
      this.emailSignal.set(null);
      return false;
    }
  }

  clearSession(): void {
    this.emailSignal.set(null);
  }
}
