import type { MigrationInterface, QueryRunner } from 'typeorm';

export class IdentityTenancy1794441600000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      email varchar(254) NOT NULL,
      password_hash text NOT NULL,
      CONSTRAINT users_email_unique UNIQUE (email),
      CONSTRAINT users_email_normalized CHECK (email = lower(btrim(email)) AND length(email) > 0)
    )`);
    await queryRunner.query(`CREATE TABLE vendors (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      name varchar(200) NOT NULL,
      CONSTRAINT vendors_name_not_blank CHECK (length(btrim(name)) > 0)
    )`);
    await queryRunner.query(`CREATE TABLE branches (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      vendor_id uuid NOT NULL,
      name varchar(200) NOT NULL,
      CONSTRAINT branches_vendor_fk FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT,
      CONSTRAINT branches_vendor_id_unique UNIQUE (vendor_id, id),
      CONSTRAINT branches_name_not_blank CHECK (length(btrim(name)) > 0)
    )`);
    await queryRunner.query(
      'CREATE INDEX branches_vendor_idx ON branches (vendor_id)',
    );
    await queryRunner.query(`CREATE TABLE vendor_memberships (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      vendor_id uuid NOT NULL,
      user_id uuid NOT NULL,
      role varchar(20) NOT NULL,
      CONSTRAINT memberships_vendor_fk FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT,
      CONSTRAINT memberships_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT memberships_vendor_user_unique UNIQUE (vendor_id, user_id),
      CONSTRAINT memberships_role_valid CHECK (role IN ('owner', 'manager', 'cashier'))
    )`);
    await queryRunner.query(
      'CREATE INDEX memberships_user_idx ON vendor_memberships (user_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE vendor_memberships');
    await queryRunner.query('DROP TABLE branches');
    await queryRunner.query('DROP TABLE vendors');
    await queryRunner.query('DROP TABLE users');
  }
}
