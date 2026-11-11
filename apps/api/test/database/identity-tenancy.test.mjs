import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { DataSource } from 'typeorm';
import { databaseOptions } from '../../dist/database/options.js';
import { validateEnvironment } from '../../dist/config/environment.js';
import { IdentityTenancy1794441600000 } from '../../dist/database/migrations/1794441600000-IdentityTenancy.js';
import { Authentication1794528000000 } from '../../dist/database/migrations/1794528000000-Authentication.js';
import { User } from '../../dist/identity/user.entity.js';
import { Vendor } from '../../dist/vendors/vendor.entity.js';
import { Branch } from '../../dist/vendors/branch.entity.js';
import { VendorMembership } from '../../dist/vendors/vendor-membership.entity.js';

test('identity and tenancy schema on real PostgreSQL', async (t) => {
  const env = validateEnvironment(process.env);
  const schema = `test_identity_${randomUUID().replaceAll('-', '')}`;
  const options = databaseOptions(env.DATABASE_URL);
  const admin = new DataSource({ ...options, entities: [], migrations: [] });
  let database;
  await admin.initialize();
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    database = new DataSource({
      ...options,
      schema,
      extra: { ...options.extra, options: `-c search_path=${schema}` },
    });
    await database.initialize();
    const runner = database.createQueryRunner();
    await runner.connect();
    try {
      const migration = new IdentityTenancy1794441600000();
      await migration.up(runner);
      const authentication = new Authentication1794528000000();
      await authentication.up(runner);
      await authentication.down(runner);
      await migration.down(runner);
      const [removed] = await runner.query(
        "SELECT to_regclass('users') AS name",
      );
      assert.equal(removed.name, null);
      await migration.up(runner);
      await authentication.up(runner);
    } finally {
      await runner.release();
    }

    await t.test('entity metadata matches the migrated schema', async () => {
      const changes = await database.driver.createSchemaBuilder().log();
      assert.deepEqual(
        changes.upQueries.map((query) => query.query),
        [],
      );
    });

    const users = database.getRepository(User);
    const vendors = database.getRepository(Vendor);
    const memberships = database.getRepository(VendorMembership);
    const branches = database.getRepository(Branch);
    const user = await users.save(
      users.create({
        email: 'owner@example.test',
        passwordHash: 'test-only-placeholder',
      }),
    );
    const vendorA = await vendors.save(vendors.create({ name: 'Vendor A' }));
    const vendorB = await vendors.save(vendors.create({ name: 'Vendor B' }));

    await t.test(
      'password hashes are excluded from ordinary user queries',
      async () => {
        const found = await users.findOneByOrFail({ id: user.id });
        assert.equal(found.passwordHash, undefined);
        const withHash = await users
          .createQueryBuilder('user')
          .addSelect('user.passwordHash')
          .where('user.id = :id', { id: user.id })
          .getOneOrFail();
        assert.equal(withHash.passwordHash, 'test-only-placeholder');
      },
    );
    await t.test('email is unique and must be normalized', async () => {
      await assert.rejects(
        users.insert({ email: user.email, passwordHash: 'test' }),
        (error) => error.driverError?.code === '23505',
      );
      for (const email of ['OWNER@example.test', ' owner@example.test ', '']) {
        await assert.rejects(
          users.insert({ email, passwordHash: 'test' }),
          (error) => error.driverError?.code === '23514',
        );
      }
    });
    await t.test(
      'one user can hold different roles in multiple vendors',
      async () => {
        await memberships.insert({
          userId: user.id,
          vendorId: vendorA.id,
          role: 'owner',
        });
        await memberships.insert({
          userId: user.id,
          vendorId: vendorB.id,
          role: 'cashier',
        });
        const rows = await memberships.findBy({ userId: user.id });
        assert.equal(rows.length, 2);
        assert.equal(
          rows.find((row) => row.vendorId === vendorA.id).role,
          'owner',
        );
        assert.equal(
          rows.find((row) => row.vendorId === vendorB.id).role,
          'cashier',
        );
      },
    );
    await t.test(
      'duplicate memberships and unsupported roles are rejected',
      async () => {
        await assert.rejects(
          memberships.insert({
            userId: user.id,
            vendorId: vendorA.id,
            role: 'manager',
          }),
          (error) => error.driverError?.code === '23505',
        );
        await assert.rejects(
          database.query(
            'UPDATE vendor_memberships SET role = $1 WHERE user_id = $2',
            ['platform_admin', user.id],
          ),
          (error) => error.driverError?.code === '23514',
        );
      },
    );
    await t.test('memberships require existing users and vendors', async () => {
      await assert.rejects(
        memberships.insert({
          userId: randomUUID(),
          vendorId: vendorA.id,
          role: 'cashier',
        }),
        (error) => error.driverError?.code === '23503',
      );
      await assert.rejects(
        memberships.insert({
          userId: user.id,
          vendorId: randomUUID(),
          role: 'cashier',
        }),
        (error) => error.driverError?.code === '23503',
      );
    });
    await t.test(
      'branches belong to an existing vendor and permit future expansion',
      async () => {
        await branches.insert([
          { name: 'Main', vendorId: vendorA.id },
          { name: 'Second', vendorId: vendorA.id },
        ]);
        assert.equal(await branches.countBy({ vendorId: vendorA.id }), 2);
        assert.equal(await branches.countBy({ vendorId: vendorB.id }), 0);
        await assert.rejects(
          branches.insert({ name: 'Orphan', vendorId: randomUUID() }),
          (error) => error.driverError?.code === '23503',
        );
      },
    );
    await t.test(
      'referenced users and vendors cannot be accidentally deleted',
      async () => {
        await assert.rejects(
          users.delete(user.id),
          (error) => error.driverError?.code === '23503',
        );
        await assert.rejects(
          vendors.delete(vendorA.id),
          (error) => error.driverError?.code === '23503',
        );
      },
    );
  } finally {
    if (database?.isInitialized) await database.destroy();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.destroy();
  }
});
