import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@environments/environment.local';

interface RegisterRequest {
  email: string;
  password: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RefreshRequest {
  refreshToken: string;
}

interface LogoutRequest {
  refreshToken: string;
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

interface RefreshResponse {
  accessToken: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  iat: number;
  exp: number;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly refreshTokenStorageKey = 'jaakd.refreshToken';
  private readonly accessTokenSignal = signal<string | null>(null);

  readonly accessToken = this.accessTokenSignal.asReadonly();
  readonly jwtPayload = computed(() => this.decodeAccessToken(this.accessTokenSignal()));
  readonly isLoggedIn = computed(() => this.accessTokenSignal() !== null);
  readonly userEmail = computed(() => this.jwtPayload()?.email ?? null);

  constructor(private httpClient: HttpClient) {}

  async register(email: string, password: string): Promise<void> {
    const body: RegisterRequest = { email, password };
    await firstValueFrom(this.httpClient.post(`${environment.authUrl}/auth/register`, body));
  }

  async login(email: string, password: string): Promise<void> {
    const body: LoginRequest = { email, password };
    const response = await firstValueFrom(
      this.httpClient.post<LoginResponse>(`${environment.authUrl}/auth/login`, body),
    );

    this.accessTokenSignal.set(response.accessToken);
    sessionStorage.setItem(this.refreshTokenStorageKey, response.refreshToken);
  }

  async refresh(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return false;
    }

    try {
      const body: RefreshRequest = { refreshToken };
      const response = await firstValueFrom(
        this.httpClient.post<RefreshResponse>(`${environment.authUrl}/auth/refresh`, body),
      );
      this.accessTokenSignal.set(response.accessToken);
      return true;
    } catch {
      this.clearTokens();
      return false;
    }
  }

  async logout(): Promise<void> {
    const refreshToken = this.getRefreshToken();

    try {
      if (refreshToken) {
        const body: LogoutRequest = { refreshToken };
        await firstValueFrom(this.httpClient.post(`${environment.authUrl}/auth/logout`, body));
      }
    } finally {
      this.clearTokens();
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const body: ChangePasswordRequest = { currentPassword, newPassword };
    await firstValueFrom(this.httpClient.post(`${environment.authUrl}/auth/change-password`, body));
  }

  getAccessToken(): string | null {
    return this.accessTokenSignal();
  }

  hasRefreshToken(): boolean {
    return this.getRefreshToken() !== null;
  }

  private getRefreshToken(): string | null {
    return sessionStorage.getItem(this.refreshTokenStorageKey);
  }

  private clearTokens(): void {
    this.accessTokenSignal.set(null);
    sessionStorage.removeItem(this.refreshTokenStorageKey);
  }

  private decodeAccessToken(token: string | null): JwtPayload | null {
    if (!token) {
      return null;
    }

    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      return null;
    }

    try {
      const payload = tokenParts[1];
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      const decoded = atob(padded);
      return JSON.parse(decoded) as JwtPayload;
    } catch {
      return null;
    }
  }
}
