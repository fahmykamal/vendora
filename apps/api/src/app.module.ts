import { IdentityModule } from './identity/identity.module.js';
import { VendorsModule } from './vendors/vendors.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { validateEnvironment } from './config/environment.js';
import { databaseOptions } from './database/options.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    IdentityModule,
    VendorsModule,
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...databaseOptions(config.getOrThrow<string>('DATABASE_URL')),
        retryAttempts: 3,
      }),
    }),
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
