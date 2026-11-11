import { Public } from './identity/auth.guard.js';
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@Public()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
