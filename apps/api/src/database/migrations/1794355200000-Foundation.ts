import type { MigrationInterface, QueryRunner } from 'typeorm';

// Infrastructure marker only; domain tables arrive with identity and tenancy.
export class Foundation1794355200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE foundation_metadata (
      key text PRIMARY KEY,
      value text NOT NULL
    )`);
    await queryRunner.query(
      `INSERT INTO foundation_metadata (key, value) VALUES ('schema_version', '1')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE foundation_metadata');
  }
}
