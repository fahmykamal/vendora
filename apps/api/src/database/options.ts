import type { DataSourceOptions } from 'typeorm';
import { join } from 'node:path';

export function databaseOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    // PostgreSQL 17 provides gen_random_uuid() without an extension.
    uuidExtension: 'pgcrypto',
    installExtensions: false,
    url,
    entities: [join(import.meta.dirname, '../**/*.entity.js')],
    migrations: [join(import.meta.dirname, 'migrations/*.js')],
    synchronize: false,
    migrationsRun: false,
    migrationsTransactionMode: 'all',
    connectTimeoutMS: 5000,
    extra: { connectionTimeoutMillis: 5000, statement_timeout: 5000 },
  };
}
