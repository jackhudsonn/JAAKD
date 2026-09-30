import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

export type AuthUserRow = {
  userId: string;
  email: string;
  passwordHash: string;
  roles: string[];
  refreshToken: string | null;
};

@Injectable()
export class AuthRepository {
  constructor(private readonly pool: Pool) {}

  async findUserByEmail(email: string): Promise<AuthUserRow | null> {
    const result = await this.pool.query(
      `SELECT
         "userID" AS "userId",
         email,
         "passwordHash" AS "passwordHash",
         roles,
         "refreshToken" AS "refreshToken"
       FROM users
       WHERE email = $1`,
      [email],
    );

    return result.rowCount ? (result.rows[0] as AuthUserRow) : null;
  }

  async createUser(email: string, passwordHash: string): Promise<{ userId: string; email: string }> {
    const result = await this.pool.query(
      `INSERT INTO users ("userID", email, "passwordHash")
       VALUES (gen_random_uuid(), $1, $2)
       RETURNING "userID" AS "userId", email`,
      [email, passwordHash],
    );

    return result.rows[0] as { userId: string; email: string };
  }

  async updateRefreshTokenByUserId(userId: string, refreshTokenHash: string | null): Promise<void> {
    await this.pool.query(
      `UPDATE users
       SET "refreshToken" = $1
       WHERE "userID" = $2`,
      [refreshTokenHash, userId],
    );
  }

  async findUserByRefreshTokenHash(refreshTokenHash: string): Promise<AuthUserRow | null> {
    const result = await this.pool.query(
      `SELECT
         "userID" AS "userId",
         email,
         "passwordHash" AS "passwordHash",
         roles,
         "refreshToken" AS "refreshToken"
       FROM users
       WHERE "refreshToken" = $1`,
      [refreshTokenHash],
    );

    return result.rowCount ? (result.rows[0] as AuthUserRow) : null;
  }

  async findUserById(userId: string): Promise<AuthUserRow | null> {
    const result = await this.pool.query(
      `SELECT
         "userID" AS "userId",
         email,
         "passwordHash" AS "passwordHash",
         roles,
         "refreshToken" AS "refreshToken"
       FROM users
       WHERE "userID" = $1`,
      [userId],
    );

    return result.rowCount ? (result.rows[0] as AuthUserRow) : null;
  }

  async clearRefreshTokenByHash(refreshTokenHash: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE users
       SET "refreshToken" = NULL
       WHERE "refreshToken" = $1`,
      [refreshTokenHash],
    );

    return result.rowCount ?? 0;
  }

  async updatePasswordHashAndClearRefreshToken(userId: string, passwordHash: string): Promise<void> {
    await this.pool.query(
      `UPDATE users
       SET "passwordHash" = $1,
           "refreshToken" = NULL
       WHERE "userID" = $2`,
      [passwordHash, userId],
    );
  }
}
