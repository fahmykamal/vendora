import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PasswordHasher } from '@nestjs/authentication';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { AuthController } from './auth.controller.js';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
  controllers: [AuthController],
  providers: [
    { provide: PasswordHasher, useFactory: () => new PasswordHasher() },
    AuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class IdentityModule {}
