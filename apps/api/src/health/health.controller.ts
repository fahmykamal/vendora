import { Public } from '../identity/auth.guard.js';
import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DataSource } from 'typeorm';

@Public()
@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(@Inject(DataSource) private readonly database: DataSource) {}

  @Get('live')
  @ApiOkResponse({ description: 'API process is alive' })
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOkResponse({
    description: 'Database is reachable and migrations are applied',
  })
  @ApiServiceUnavailableResponse({
    description: 'Database unavailable or migrations pending',
  })
  async ready() {
    try {
      await this.database.query('SELECT 1');
      if (await this.database.showMigrations())
        throw new Error('Pending migrations');
      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unavailable',
      });
    }
  }
}
