import { Module } from '@nestjs/common';
import { Pool } from 'pg';

import { AuthController } from './auth/auth.controller';
import { AuthRepository } from './auth/auth.repository';
import { AuthService } from './auth/auth.service';
import { createDbPool } from './auth/db';
import { JwksController } from './auth/jwks.controller';

@Module({
  controllers: [AuthController, JwksController],
  providers: [
    {
      provide: Pool,
      useFactory: createDbPool,
    },
    AuthRepository,
    AuthService,
  ],
})
export class AppModule {}
