import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { AuthService } from './auth.service';

@ApiExcludeController()
@Controller('.well-known')
export class JwksController {
  constructor(private readonly authService: AuthService) {}

  @Get('jwks.json')
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
    return this.authService.getJwks();
  }
}