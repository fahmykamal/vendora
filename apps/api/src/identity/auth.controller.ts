import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { CredentialsDto } from './auth.dto.js';
import { CurrentIdentity, Public } from './auth.guard.js';
import type { Identity } from './auth.guard.js';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Register and receive a 24-hour bearer token' })
  register(@Body() input: CredentialsDto) {
    return this.auth.register(input);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Sign in and receive a new 24-hour bearer token' })
  login(@Body() input: CredentialsDto) {
    return this.auth.login(input);
  }

  @Get('me')
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  me(@CurrentIdentity() identity: Identity) {
    return identity.user;
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  async logout(@CurrentIdentity() identity: Identity) {
    await this.auth.logout(identity.sessionId);
  }
}
