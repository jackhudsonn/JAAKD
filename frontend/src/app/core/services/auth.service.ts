import { Injectable, computed, signal } from '@angular/core';
import { HttpContext, HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@environments/environment.local';
import { AUTH_FLOW } from '@core/http/auth-flow.token';
import { DASHBOARD_PREFERENCES_CACHE_PREFIX } from '@core/constants/dashboard-preferences.constants';
import {
  ChallengeResponse,
  LoginResult,
  RegisterRequest,
  RegistrationResponse,
  RegistrationResult,
} from '@core/models/auth.model';

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

  async register(request: RegisterRequest): Promise<RegistrationResult> {
    const registration = await firstValueFrom(
      this.httpClient.post<RegistrationResponse>(
        `${environment.apiUrl}/api/auth/register`,
        request,
        { context: this.credentialFlow },
      ),
    );

    return {
      status:
        registration.status === 'CONFIRMATION_REQUIRED' ? 'confirmation_required' : 'registered',
      email: registration.email,
      registrationId: registration.registrationId,
    };
  }

  async confirmRegistration(registrationId: string, code: string): Promise<boolean> {
    const response = await firstValueFrom(
      this.httpClient.post<SessionResponse>(
        `${environment.apiUrl}/api/auth/register/confirm`,
        { registrationId, code },
        { context: this.credentialFlow, observe: 'response' },
      ),
    );

    if (response.status === 200 && response.body?.email) {
      this.emailSignal.set(response.body.email);
      return true;
    }

    return false;
  }

  async resendConfirmation(registrationId: string): Promise<void> {
    await firstValueFrom(
      this.httpClient.post(
        `${environment.apiUrl}/api/auth/register/resend`,
        { registrationId },
        { context: this.credentialFlow },
      ),
    );
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const response = await firstValueFrom(
      this.httpClient.post<SessionResponse | ChallengeResponse>(
        `${environment.apiUrl}/api/auth/login`,
        { email, password },
        { context: this.credentialFlow, observe: 'response' },
      ),
    );

    const body = response.body;
    if (response.status === 202 && body) {
      const challenge = body as ChallengeResponse;
      return {
        status: 'challenge',
        challenge: challenge.challenge,
        continuation: challenge.continuation,
      };
    }

    if (!body || !('email' in body)) {
      throw new Error('Login returned no session.');
    }

    this.emailSignal.set(body.email);
    return { status: 'authenticated', email: body.email };
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.httpClient.post(`${environment.apiUrl}/api/auth/logout`, null, {
          context: this.credentialFlow,
        }),
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
        this.httpClient.get<SessionResponse>(`${environment.apiUrl}/api/auth/session`, {
          context: this.credentialFlow,
        }),
      );
      this.emailSignal.set(response.email);
      return true;
    } catch {
      this.emailSignal.set(null);
      return false;
    }
  }

  clearSession(): void {
    this.emailSignal.set(null);
    this.clearDashboardPreferencesSessionCache();
  }

  private clearDashboardPreferencesSessionCache(): void {
    try {
      if (typeof globalThis === 'undefined' || !('sessionStorage' in globalThis)) {
        return;
      }

      const keysToDelete: string[] = [];

      for (let i = 0; i < globalThis.sessionStorage.length; i++) {
        const key = globalThis.sessionStorage.key(i);
        if (key?.startsWith(DASHBOARD_PREFERENCES_CACHE_PREFIX)) {
          keysToDelete.push(key);
        }
      }

      for (const key of keysToDelete) {
        globalThis.sessionStorage.removeItem(key);
      }
    } catch {
      // Best effort cleanup; avoid throwing during logout/session expiry.
    }
  }
}
