import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash, createPublicKey, randomBytes } from 'crypto';
import { readFileSync } from 'fs';
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
  private readonly jwtPrivateKey: string;
  private readonly jwtPublicKey: string;
  private readonly jwtIssuer: string;
  private readonly jwtKeyId: string;
  private readonly jwks: {
    keys: Array<{
      kty: 'RSA';
      use: 'sig';
      alg: 'RS256';
      kid: string;
      n: string;
      e: string;
    }>;
  };

  constructor(private readonly authRepository: AuthRepository) {
    const jwtIssuer = process.env.JWT_ISSUER?.trim();
    const jwtKeyId = process.env.JWT_KEY_ID?.trim() || 'key-1';
    const jwtPrivateKeyPath = process.env.JWT_PRIVATE_KEY_PATH?.trim();
    let jwtPrivateKey = process.env.JWT_PRIVATE_KEY?.trim();

    if (!jwtIssuer) {
      throw new Error('JWT_ISSUER is required');
    }

    if (!jwtPrivateKey && !jwtPrivateKeyPath) {
      throw new Error('JWT_PRIVATE_KEY_PATH or JWT_PRIVATE_KEY is required');
    }

    if (!jwtPrivateKey && jwtPrivateKeyPath) {
      jwtPrivateKey = readFileSync(jwtPrivateKeyPath, 'utf8').trim();
    }

    if (!jwtPrivateKey) {
      throw new Error('JWT private key is empty');
    }

    if (jwtPrivateKey.includes('\\n')) {
      jwtPrivateKey = jwtPrivateKey.replace(/\\n/g, '\n');
    }

    let publicJwk: JsonWebKey;
    let jwtPublicKey: string;
    try {
      const publicKey = createPublicKey(jwtPrivateKey);
      publicJwk = publicKey.export({ format: 'jwk' }) as JsonWebKey;
      jwtPublicKey = publicKey.export({ format: 'pem', type: 'spki' }).toString();
    } catch {
      throw new Error('Failed to load RSA private key');
    }

    if (publicJwk.kty !== 'RSA' || !publicJwk.n || !publicJwk.e) {
      throw new Error('JWT private key must be RSA');
    }

    this.jwtPrivateKey = jwtPrivateKey;
    this.jwtPublicKey = jwtPublicKey;
    this.jwtIssuer = jwtIssuer;
    this.jwtKeyId = jwtKeyId;
    this.jwks = {
      keys: [
        {
          kty: 'RSA',
          use: 'sig',
          alg: 'RS256',
          kid: this.jwtKeyId,
          n: publicJwk.n,
          e: publicJwk.e,
        },
      ],
    };
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

  getJwks(): {
    keys: Array<{
      kty: 'RSA';
      use: 'sig';
      alg: 'RS256';
      kid: string;
      n: string;
      e: string;
    }>;
  } {
    return this.jwks;
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
      this.jwtPrivateKey,
      {
        algorithm: 'RS256',
        keyid: this.jwtKeyId,
        issuer: this.jwtIssuer,
        expiresIn: '15m',
      },
    );
  }

  private extractUserIdFromAuthorizationHeader(authorizationHeader: string | undefined): string {
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('invalid or expired access token');
    }

    const token = authorizationHeader.substring('Bearer '.length).trim();

    try {
      const decoded = jwt.verify(token, this.jwtPublicKey, {
        algorithms: ['RS256'],
        issuer: this.jwtIssuer,
      }) as jwt.JwtPayload;
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
