import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import * as jwt from 'jsonwebtoken';

import { AuthRepository } from './auth.repository';
import { ChangePasswordRequestDto } from './dto/change-password-request.dto';
import { ChangePasswordResponseDto } from './dto/change-password-response.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { LogoutRequestDto } from './dto/logout-request.dto';
import { LogoutResponseDto } from './dto/logout-response.dto';
import { RefreshRequestDto } from './dto/refresh-request.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';
import { RegisterRequestDto } from './dto/register-request.dto';
import { RegisterResponseDto } from './dto/register-response.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;

  constructor(private readonly authRepository: AuthRepository) {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is required');
    }

    if (jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters');
    }

    this.jwtSecret = jwtSecret;
  }

  async register(body: RegisterRequestDto): Promise<RegisterResponseDto> {
    const normalizedEmail = this.normalizeEmail(body.email);
    const existingUser = await this.authRepository.findUserByEmail(normalizedEmail);

    if (existingUser) {
      this.logAuthEvent('register_conflict', normalizedEmail);
      throw new ConflictException('email already registered');
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const createdUser = await this.authRepository.createUser(normalizedEmail, passwordHash);

    this.logAuthEvent('register_success', createdUser.userId);

    return {
      userId: createdUser.userId,
      email: createdUser.email,
      registered: true,
    };
  }

  async login(body: LoginRequestDto): Promise<LoginResponseDto> {
    const normalizedEmail = this.normalizeEmail(body.email);
    const user = await this.authRepository.findUserByEmail(normalizedEmail);
    const passwordMatches = user ? await bcrypt.compare(body.password, user.passwordHash) : false;

    if (!user || !passwordMatches) {
      this.logAuthEvent('login_failed', normalizedEmail);
      throw new UnauthorizedException('invalid email or password');
    }

    const accessToken = this.generateAccessToken(user.userId, user.email);
    const refreshToken = this.generateOpaqueToken();
    const refreshTokenHash = this.hashToken(refreshToken);

    await this.authRepository.updateRefreshTokenByUserId(user.userId, refreshTokenHash);

    this.logAuthEvent('login_success', user.userId);

    return {
      accessToken,
      refreshToken,
    };
  }

  async refresh(body: RefreshRequestDto): Promise<RefreshResponseDto> {
    const refreshTokenHash = this.hashToken(body.refreshToken);
    const user = await this.authRepository.findUserByRefreshTokenHash(refreshTokenHash);

    if (!user) {
      this.logAuthEvent('refresh_failed', 'unknown-token');
      throw new UnauthorizedException('invalid or expired refresh token');
    }

    const accessToken = this.generateAccessToken(user.userId, user.email);
    this.logAuthEvent('refresh_success', user.userId);

    return {
      accessToken,
    };
  }

  async logout(body: LogoutRequestDto): Promise<LogoutResponseDto> {
    const refreshTokenHash = this.hashToken(body.refreshToken);
    const rowsCleared = await this.authRepository.clearRefreshTokenByHash(refreshTokenHash);

    if (rowsCleared === 0) {
      this.logAuthEvent('logout_failed', 'unknown-token');
      throw new UnauthorizedException('invalid or expired refresh token');
    }

    this.logAuthEvent('logout_success', 'refresh-token-cleared');

    return {
      loggedOut: true,
    };
  }

  async changePassword(
    authorizationHeader: string | undefined,
    body: ChangePasswordRequestDto,
  ): Promise<ChangePasswordResponseDto> {
    const userId = this.extractUserIdFromAuthorizationHeader(authorizationHeader);
    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      this.logAuthEvent('change_password_failed', userId);
      throw new UnauthorizedException('invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!passwordMatches) {
      this.logAuthEvent('change_password_failed', user.userId);
      throw new UnauthorizedException('invalid email or password');
    }

    const newPasswordHash = await bcrypt.hash(body.newPassword, 10);
    await this.authRepository.updatePasswordHashAndClearRefreshToken(user.userId, newPasswordHash);

    this.logAuthEvent('change_password_success', user.userId);

    return {
      changed: true,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private generateOpaqueToken(): string {
    return randomBytes(32).toString('hex');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateAccessToken(userId: string, email: string): string {
    return jwt.sign(
      { sub: userId, email, roles: ['CLIENT'] },
      this.jwtSecret,
      { algorithm: 'HS256', expiresIn: '15m' },
    );
  }

  private extractUserIdFromAuthorizationHeader(authorizationHeader: string | undefined): string {
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('invalid or expired access token');
    }

    const token = authorizationHeader.substring('Bearer '.length).trim();

    try {
      const decoded = jwt.verify(token, this.jwtSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      const subject = decoded.sub;

      if (!subject || typeof subject !== 'string') {
        throw new UnauthorizedException('invalid or expired access token');
      }

      return subject;
    } catch {
      throw new UnauthorizedException('invalid or expired access token');
    }
  }

  private logAuthEvent(event: string, userIdOrEmail: string): void {
    this.logger.log(`${event} ${userIdOrEmail}`);
  }
}
