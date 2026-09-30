import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { ChangePasswordRequestDto } from './dto/change-password-request.dto';
import { ChangePasswordResponseDto } from './dto/change-password-response.dto';
import { AuthService } from './auth.service';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { LogoutRequestDto } from './dto/logout-request.dto';
import { LogoutResponseDto } from './dto/logout-response.dto';
import { RefreshRequestDto } from './dto/refresh-request.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';
import { RegisterRequestDto } from './dto/register-request.dto';
import { RegisterResponseDto } from './dto/register-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiCreatedResponse({ type: RegisterResponseDto })
  async register(@Body() body: RegisterRequestDto): Promise<RegisterResponseDto> {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LoginResponseDto })
  async login(@Body() body: LoginRequestDto): Promise<LoginResponseDto> {
    return this.authService.login(body);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: RefreshResponseDto })
  async refresh(@Body() body: RefreshRequestDto): Promise<RefreshResponseDto> {
    return this.authService.refresh(body);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LogoutResponseDto })
  async logout(@Body() body: LogoutRequestDto): Promise<LogoutResponseDto> {
    return this.authService.logout(body);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ChangePasswordResponseDto })
  async changePassword(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: ChangePasswordRequestDto,
  ): Promise<ChangePasswordResponseDto> {
    return this.authService.changePassword(authorizationHeader, body);
  }
}
