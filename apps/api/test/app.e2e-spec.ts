import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppController } from '../src/app.controller.js';
import { AppService } from '../src/app.service.js';
import { HealthController } from '../src/health/health.controller.js';
import { setupApplication } from '../src/setup.js';

describe('HTTP foundation (database mocked)', () => {
  let app: INestApplication;
  const database = { query: vi.fn(), showMigrations: vi.fn() };
  beforeEach(async () => {
    database.query.mockReset().mockResolvedValue([]);
    database.showMigrations.mockReset().mockResolvedValue(false);
    const fixture = await Test.createTestingModule({
      controllers: [AppController, HealthController],
      providers: [AppService, { provide: DataSource, useValue: database }],
    }).compile();
    app = fixture.createNestApplication();
    setupApplication(app);
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });
  it('versions API routes', async () => {
    await request(app.getHttpServer())
      .get('/api/v1')
      .expect(200, 'Hello World!');
    await request(app.getHttpServer()).get('/').expect(404);
  });
  it('keeps liveness independent of the database', async () => {
    await request(app.getHttpServer())
      .get('/api/health/live')
      .expect(200, { status: 'ok' });
    expect(database.query).not.toHaveBeenCalled();
  });
  it('reports database readiness', async () => {
    await request(app.getHttpServer()).get('/api/health/ready').expect(200);
    expect(database.query).toHaveBeenCalledWith('SELECT 1');
  });
  it('returns 503 without exposing connection errors', async () => {
    database.query.mockRejectedValue(new Error('secret credentials'));
    const response = await request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(503);
    expect(response.text).not.toContain('secret credentials');
  });
  it('returns 503 for pending migrations', async () => {
    database.showMigrations.mockResolvedValue(true);
    await request(app.getHttpServer()).get('/api/health/ready').expect(503);
  });
  it('publishes versioned OpenAPI paths', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(response.body.paths).toHaveProperty('/api/v1');
    expect(response.body.paths).toHaveProperty('/api/health/ready');
  });
});
