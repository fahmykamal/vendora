import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Authentication1794528000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE auth_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      user_id uuid NOT NULL,
      token_hash varchar(64) NOT NULL,
      expires_at timestamptz NOT NULL,
      CONSTRAINT auth_sessions_token_unique UNIQUE (token_hash),
      CONSTRAINT auth_sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await runner.query(
      'CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id)',
    );
    await runner.query(
      'CREATE INDEX auth_sessions_expiry_idx ON auth_sessions (expires_at)',
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE auth_sessions');
  }
}
