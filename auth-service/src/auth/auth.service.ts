import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';

import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { LogoutRequestDto } from './dto/logout-request.dto';
import { LogoutResponseDto } from './dto/logout-response.dto';
import { RefreshRequestDto } from './dto/refresh-request.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';
import { RegisterRequestDto } from './dto/register-request.dto';
import { RegisterResponseDto } from './dto/register-response.dto';

type InMemoryUser = {
  userId: string;
  email: string;
  password: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly usersByEmail = new Map<string, InMemoryUser>();
  private readonly refreshTokenToUserId = new Map<string, string>();

  register(body: RegisterRequestDto): RegisterResponseDto {
    const normalizedEmail = this.normalizeEmail(body.email);

    if (this.usersByEmail.has(normalizedEmail)) {
      this.logAuthEvent('register_conflict', normalizedEmail);
      throw new ConflictException('email already registered');
    }

    const userId = randomUUID();

    this.usersByEmail.set(normalizedEmail, {
      userId,
      email: normalizedEmail,
      password: body.password,
    });

    this.logAuthEvent('register_success', normalizedEmail);

    return {
      userId,
      email: normalizedEmail,
      registered: true,
    };
  }

  login(body: LoginRequestDto): LoginResponseDto {
    const normalizedEmail = this.normalizeEmail(body.email);
    const user = this.usersByEmail.get(normalizedEmail);

    if (!user || user.password !== body.password) {
      this.logAuthEvent('login_failed', normalizedEmail);
      throw new UnauthorizedException('invalid email or password');
    }

    const accessToken = this.generateOpaqueToken();
    const refreshToken = this.generateOpaqueToken();
    this.refreshTokenToUserId.set(refreshToken, user.userId);

    this.logAuthEvent('login_success', user.userId);

    return {
      accessToken,
      refreshToken,
    };
  }

  refresh(body: RefreshRequestDto): RefreshResponseDto {
    const userId = this.refreshTokenToUserId.get(body.refreshToken);

    if (!userId) {
      this.logAuthEvent('refresh_failed', 'unknown-token');
      throw new UnauthorizedException('invalid or expired refresh token');
    }

    const accessToken = this.generateOpaqueToken();
    this.logAuthEvent('refresh_success', userId);

    return {
      accessToken,
    };
  }

  logout(body: LogoutRequestDto): LogoutResponseDto {
    const userId = this.refreshTokenToUserId.get(body.refreshToken);

    if (!userId) {
      this.logAuthEvent('logout_failed', 'unknown-token');
      throw new UnauthorizedException('invalid or expired refresh token');
    }

    this.refreshTokenToUserId.delete(body.refreshToken);
    this.logAuthEvent('logout_success', userId);

    return {
      loggedOut: true,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private generateOpaqueToken(): string {
    return randomBytes(32).toString('hex');
  }

  private logAuthEvent(event: string, userIdOrEmail: string): void {
    this.logger.log(`${event} ${userIdOrEmail}`);
  }
}
