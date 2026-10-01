import * as bcrypt from 'bcrypt';
import { generateKeyPairSync } from 'crypto';
import * as jwt from 'jsonwebtoken';

import { AuthRepository, AuthUserRow } from './auth.repository';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const jwtIssuer = 'http://jaakd-auth:3000';
  const jwtKeyId = 'key-test-1';

  let authRepository: jest.Mocked<AuthRepository>;
  let authService: AuthService;
  let jwtPrivateKey: string;
  let jwtPublicKey: string;

  beforeEach(() => {
    const keyPair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: {
        format: 'pem',
        type: 'pkcs8',
      },
      publicKeyEncoding: {
        format: 'pem',
        type: 'spki',
      },
    });

    jwtPrivateKey = keyPair.privateKey;
    jwtPublicKey = keyPair.publicKey;

    process.env.JWT_PRIVATE_KEY = jwtPrivateKey;
    delete process.env.JWT_PRIVATE_KEY_PATH;
    process.env.JWT_ISSUER = jwtIssuer;
    process.env.JWT_KEY_ID = jwtKeyId;

    authRepository = {
      findUserByEmail: jest.fn(),
      createUser: jest.fn(),
      updateRefreshTokenByUserId: jest.fn(),
      findUserByRefreshTokenHash: jest.fn(),
      findUserById: jest.fn(),
      clearRefreshTokenByHash: jest.fn(),
      updatePasswordHashAndClearRefreshToken: jest.fn(),
    } as unknown as jest.Mocked<AuthRepository>;

    authService = new AuthService(authRepository);
  });

  afterEach(() => {
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PRIVATE_KEY_PATH;
    delete process.env.JWT_ISSUER;
    delete process.env.JWT_KEY_ID;
  });

  it('login happy path returns JWT and refresh token', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    const row: AuthUserRow = {
      userId: '11111111-1111-1111-1111-111111111111',
      email: 'client@example.com',
      passwordHash,
      roles: ['CLIENT'],
      refreshToken: null,
    };

    authRepository.findUserByEmail.mockResolvedValue(row);
    authRepository.updateRefreshTokenByUserId.mockResolvedValue();

    const response = await authService.login({
      email: 'client@example.com',
      password: 'password123',
    });

    const decoded = jwt.verify(response.accessToken, jwtPublicKey, {
      algorithms: ['RS256'],
      issuer: jwtIssuer,
    }) as jwt.JwtPayload;
    expect(decoded.sub).toBe(row.userId);
    expect(decoded.email).toBe(row.email);
    expect(decoded.roles).toEqual(['CLIENT']);

    const decodedComplete = jwt.decode(response.accessToken, { complete: true }) as jwt.Jwt | null;
    expect(decodedComplete?.header.kid).toBe(jwtKeyId);

    expect(response.refreshToken).toMatch(/^[a-f0-9]{64}$/);
    expect(authRepository.updateRefreshTokenByUserId).toHaveBeenCalledTimes(1);

    const [, storedRefreshHash] = authRepository.updateRefreshTokenByUserId.mock.calls[0];
    expect(storedRefreshHash).not.toBe(response.refreshToken);
    expect(storedRefreshHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('login wrong password rejects with expected 401 message', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    const row: AuthUserRow = {
      userId: '11111111-1111-1111-1111-111111111111',
      email: 'client@example.com',
      passwordHash,
      roles: ['CLIENT'],
      refreshToken: null,
    };

    authRepository.findUserByEmail.mockResolvedValue(row);

    await expect(
      authService.login({ email: 'client@example.com', password: 'wrong-password' }),
    ).rejects.toThrow('invalid email or password');
  });

  it('register normalizes email and stores password hash only', async () => {
    authRepository.findUserByEmail.mockResolvedValue(null);
    authRepository.createUser.mockResolvedValue({
      userId: '22222222-2222-2222-2222-222222222222',
      email: 'a@x.com',
    });

    const response = await authService.register({
      email: '  A@x.com ',
      password: 'password123',
    });

    expect(response.email).toBe('a@x.com');
    expect(authRepository.findUserByEmail).toHaveBeenCalledWith('a@x.com');

    const createArgs = authRepository.createUser.mock.calls[0];
    expect(createArgs[0]).toBe('a@x.com');
    expect(createArgs[1]).not.toBe('password123');
    expect(createArgs[1].startsWith('$2')).toBe(true);
  });

  it('refresh with unknown token rejects with expected message', async () => {
    authRepository.findUserByRefreshTokenHash.mockResolvedValue(null);

    await expect(
      authService.refresh({ refreshToken: 'unknown-token' }),
    ).rejects.toThrow('invalid or expired refresh token');
  });

  it('logout with unknown token rejects with expected message', async () => {
    authRepository.clearRefreshTokenByHash.mockResolvedValue(0);

    await expect(
      authService.logout({ refreshToken: 'unknown-token' }),
    ).rejects.toThrow('invalid or expired refresh token');
  });

  it('change-password updates hash and clears refresh token', async () => {
    const currentPasswordHash = await bcrypt.hash('oldpassword1', 10);
    const row: AuthUserRow = {
      userId: '33333333-3333-3333-3333-333333333333',
      email: 'client@example.com',
      passwordHash: currentPasswordHash,
      roles: ['CLIENT'],
      refreshToken: 'hashed-token',
    };

    const accessToken = jwt.sign(
      { sub: row.userId, email: row.email, roles: ['CLIENT'] },
      jwtPrivateKey,
      { algorithm: 'RS256', keyid: jwtKeyId, issuer: jwtIssuer, expiresIn: '15m' },
    );

    authRepository.findUserById.mockResolvedValue(row);
    authRepository.updatePasswordHashAndClearRefreshToken.mockResolvedValue();

    const response = await authService.changePassword(`Bearer ${accessToken}`, {
      currentPassword: 'oldpassword1',
      newPassword: 'newpassword1',
    });

    expect(response.changed).toBe(true);
    expect(authRepository.updatePasswordHashAndClearRefreshToken).toHaveBeenCalledTimes(1);
    const updateArgs = authRepository.updatePasswordHashAndClearRefreshToken.mock.calls[0];
    expect(updateArgs[0]).toBe(row.userId);
    expect(updateArgs[1]).not.toBe('newpassword1');
    expect(updateArgs[1].startsWith('$2')).toBe(true);
  });

  it('change-password with wrong current password returns same 401 message', async () => {
    const currentPasswordHash = await bcrypt.hash('oldpassword1', 10);
    const row: AuthUserRow = {
      userId: '33333333-3333-3333-3333-333333333333',
      email: 'client@example.com',
      passwordHash: currentPasswordHash,
      roles: ['CLIENT'],
      refreshToken: 'hashed-token',
    };

    const accessToken = jwt.sign(
      { sub: row.userId, email: row.email, roles: ['CLIENT'] },
      jwtPrivateKey,
      { algorithm: 'RS256', keyid: jwtKeyId, issuer: jwtIssuer, expiresIn: '15m' },
    );

    authRepository.findUserById.mockResolvedValue(row);

    await expect(
      authService.changePassword(`Bearer ${accessToken}`, {
        currentPassword: 'wrongpassword1',
        newPassword: 'newpassword1',
      }),
    ).rejects.toThrow('invalid email or password');
  });
});
