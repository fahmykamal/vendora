import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { setupApplication } from './setup.js';

const app = await NestFactory.create(AppModule);
setupApplication(app);
app.enableShutdownHooks();
await app.listen(app.get(ConfigService).getOrThrow<number>('PORT'), '0.0.0.0');
