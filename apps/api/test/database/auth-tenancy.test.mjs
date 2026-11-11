import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../dist/app.module.js';
import { setupApplication } from '../../dist/setup.js';
import { databaseOptions } from '../../dist/database/options.js';
import { validateEnvironment } from '../../dist/config/environment.js';
import { AuthSession } from '../../dist/identity/auth-session.entity.js';
import { User } from '../../dist/identity/user.entity.js';
import { Vendor } from '../../dist/vendors/vendor.entity.js';
import { Branch } from '../../dist/vendors/branch.entity.js';
import { VendorMembership } from '../../dist/vendors/vendor-membership.entity.js';

test('authentication and tenant boundaries through real HTTP and PostgreSQL', async (t) => {
  const { DATABASE_URL } = validateEnvironment(process.env);
  const schema = `test_auth_${randomUUID().replaceAll('-', '')}`;
  const options = databaseOptions(DATABASE_URL);
  const admin = new DataSource({ ...options, entities: [], migrations: [] });
  let database;
  let app;
  await admin.initialize();
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    database = new DataSource({
      ...options,
      schema,
      extra: { ...options.extra, options: `-c search_path=${schema}` },
    });
    await database.initialize();
    await database.runMigrations();
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DataSource)
      .useValue(database)
      .compile();
    app = fixture.createNestApplication({ logger: false });
    setupApplication(app);
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const send = async (method, path, body, token) => {
      const headers = {};
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`${base}/api/v1${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      return {
        status: response.status,
        headers: response.headers,
        body: text ? JSON.parse(text) : undefined,
      };
    };
    const password = 'A long test password 2026!';
    let alice;
    let bob;
    let vendorA;
    let vendorB;

    await t.test(
      'foundation routes stay public and all migrations are applied',
      async () => {
        assert.equal(await database.showMigrations(), false);
        for (const path of [
          '/api/v1',
          '/api/health/live',
          '/api/health/ready',
          '/docs',
        ]) {
          assert.equal((await fetch(base + path)).status, 200);
        }
      },
    );
    await t.test(
      'registration normalizes email and stores only credential hashes',
      async () => {
        alice = await send('POST', '/auth/register', {
          email: ' Alice@Example.com ',
          password,
        });
        bob = await send('POST', '/auth/register', {
          email: 'bob@example.com',
          password,
        });
        assert.equal(alice.status, 201);
        assert.equal(bob.status, 201);
        assert.equal(alice.body.user.email, 'alice@example.com');
        assert.equal(alice.headers.get('cache-control'), 'no-store');
        assert.equal(alice.body.user.passwordHash, undefined);
        assert.match(alice.body.accessToken, /^[A-Za-z0-9_-]{43}$/);
        const user = await database
          .getRepository(User)
          .createQueryBuilder('user')
          .addSelect('user.passwordHash')
          .where('user.id = :id', { id: alice.body.user.id })
          .getOneOrFail();
        assert.match(user.passwordHash, /^\$scrypt\$/);
        assert.notEqual(user.passwordHash, password);
        const session = await database
          .getRepository(AuthSession)
          .createQueryBuilder('session')
          .addSelect('session.tokenHash')
          .where('session.userId = :id', { id: user.id })
          .getOneOrFail();
        assert.equal(
          session.tokenHash,
          createHash('sha256').update(alice.body.accessToken).digest('hex'),
        );
        assert.notEqual(session.tokenHash, alice.body.accessToken);
      },
    );
    await t.test(
      'duplicate email, weak passwords, and injected roles are rejected',
      async () => {
        assert.equal(
          (
            await send('POST', '/auth/register', {
              email: 'ALICE@example.com',
              password,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await send('POST', '/auth/register', {
              email: 'weak@example.com',
              password: 'short',
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await send('POST', '/auth/register', {
              email: 'injected@example.com',
              password,
              role: 'owner',
            })
          ).status,
          400,
        );
        assert.equal(await database.getRepository(User).count(), 2);
      },
    );
    await t.test(
      'login rejects wrong or unknown credentials and issues an independent session',
      async () => {
        const wrong = await send('POST', '/auth/login', {
          email: 'alice@example.com',
          password: 'A completely wrong password!',
        });
        const unknown = await send('POST', '/auth/login', {
          email: 'unknown@example.com',
          password,
        });
        assert.equal(wrong.status, 401);
        assert.deepEqual(wrong.body, unknown.body);
        const login = await send('POST', '/auth/login', {
          email: 'ALICE@example.com',
          password,
        });
        assert.equal(login.status, 200);
        assert.notEqual(login.body.accessToken, alice.body.accessToken);
        const me = await send(
          'GET',
          '/auth/me',
          undefined,
          login.body.accessToken,
        );
        assert.deepEqual(me.body, alice.body.user);
        assert.equal(me.body.passwordHash, undefined);
        assert.equal(
          (
            await send(
              'POST',
              '/auth/logout',
              undefined,
              login.body.accessToken,
            )
          ).status,
          204,
        );
        assert.equal(
          (await send('GET', '/auth/me', undefined, login.body.accessToken))
            .status,
          401,
        );
        assert.equal(
          (await send('GET', '/auth/me', undefined, alice.body.accessToken))
            .status,
          200,
        );
      },
    );
    await t.test(
      'protected endpoints reject missing and fabricated tokens',
      async () => {
        assert.equal(
          (await send('POST', '/vendors', { name: 'Anonymous' })).status,
          401,
        );
        assert.equal(
          (
            await send('PATCH', `/vendors/${randomUUID()}`, {
              name: 'Anonymous',
            })
          ).status,
          401,
        );
        for (const path of ['/auth/me', '/vendors']) {
          assert.equal((await send('GET', path)).status, 401);
          assert.equal(
            (await send('GET', path, undefined, 'x'.repeat(43))).status,
            401,
          );
        }
      },
    );
    await t.test(
      'onboarding creates exactly one owner membership and initial branch',
      async () => {
        const first = await send(
          'POST',
          '/vendors',
          { name: ' Alice Store ' },
          alice.body.accessToken,
        );
        const second = await send(
          'POST',
          '/vendors',
          { name: 'Bob Store' },
          bob.body.accessToken,
        );
        assert.equal(first.status, 201);
        assert.equal(second.status, 201);
        vendorA = first.body;
        vendorB = second.body;
        assert.equal(vendorA.name, 'Alice Store');
        assert.equal(vendorA.role, 'owner');
        assert.equal(vendorA.branches.length, 1);
        assert.equal(
          await database
            .getRepository(Branch)
            .countBy({ vendorId: vendorA.id }),
          1,
        );
        assert.equal(
          await database.getRepository(VendorMembership).countBy({
            vendorId: vendorA.id,
            userId: alice.body.user.id,
            role: 'owner',
          }),
          1,
        );
      },
    );
    await t.test(
      'failed branch creation rolls back vendor and owner membership',
      async () => {
        const vendorsBefore = await database.getRepository(Vendor).count();
        const membershipsBefore = await database
          .getRepository(VendorMembership)
          .count();
        await database.query(
          `CREATE FUNCTION fail_branch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test branch failure'; END $$`,
        );
        await database.query(
          `CREATE TRIGGER fail_branch BEFORE INSERT ON branches FOR EACH ROW EXECUTE FUNCTION fail_branch()`,
        );
        try {
          assert.equal(
            (
              await send(
                'POST',
                '/vendors',
                { name: 'Must roll back' },
                alice.body.accessToken,
              )
            ).status,
            500,
          );
          assert.equal(
            await database.getRepository(Vendor).count(),
            vendorsBefore,
          );
          assert.equal(
            await database.getRepository(VendorMembership).count(),
            membershipsBefore,
          );
        } finally {
          await database.query('DROP TRIGGER fail_branch ON branches');
          await database.query('DROP FUNCTION fail_branch()');
        }
      },
    );
    await t.test(
      'each user lists only their own vendors and cannot read or modify the other vendor',
      async () => {
        for (const [account, own, other] of [
          [alice, vendorA, vendorB],
          [bob, vendorB, vendorA],
        ]) {
          const token = account.body.accessToken;
          assert.deepEqual(
            (await send('GET', '/vendors', undefined, token)).body.map(
              (vendor) => vendor.id,
            ),
            [own.id],
          );
          assert.equal(
            (await send('GET', `/vendors/${own.id}`, undefined, token)).status,
            200,
          );
          assert.equal(
            (await send('GET', `/vendors/${other.id}`, undefined, token))
              .status,
            404,
          );
          assert.equal(
            (
              await send(
                'PATCH',
                `/vendors/${other.id}`,
                { name: 'Unauthorized edit' },
                token,
              )
            ).status,
            404,
          );
          assert.equal(
            (
              await send(
                'PATCH',
                `/vendors/${own.id}`,
                { name: 'Injected', vendorId: other.id },
                token,
              )
            ).status,
            400,
          );
        }
        assert.equal(
          (
            await database
              .getRepository(Vendor)
              .findOneByOrFail({ id: vendorB.id })
          ).name,
          'Bob Store',
        );
      },
    );
    await t.test(
      'cashier cannot rename a vendor; manager can; membership revocation takes effect immediately',
      async () => {
        const memberships = database.getRepository(VendorMembership);
        await memberships.insert({
          userId: bob.body.user.id,
          vendorId: vendorA.id,
          role: 'cashier',
        });
        assert.equal(
          (
            await send(
              'GET',
              `/vendors/${vendorA.id}`,
              undefined,
              bob.body.accessToken,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await send(
              'PATCH',
              `/vendors/${vendorA.id}`,
              { name: 'Cashier edit' },
              bob.body.accessToken,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await send(
              'PATCH',
              `/vendors/${vendorB.id}`,
              { name: 'Owner edit' },
              bob.body.accessToken,
            )
          ).status,
          200,
        );
        await memberships.update(
          { userId: bob.body.user.id, vendorId: vendorA.id },
          { role: 'manager' },
        );
        assert.equal(
          (
            await send(
              'PATCH',
              `/vendors/${vendorA.id}`,
              { name: 'Manager edit' },
              bob.body.accessToken,
            )
          ).status,
          200,
        );
        await memberships.delete({
          userId: bob.body.user.id,
          vendorId: vendorA.id,
        });
        assert.equal(
          (
            await send(
              'GET',
              `/vendors/${vendorA.id}`,
              undefined,
              bob.body.accessToken,
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await send(
              'PATCH',
              `/vendors/${vendorA.id}`,
              { name: 'Revoked edit' },
              bob.body.accessToken,
            )
          ).status,
          404,
        );
      },
    );
    await t.test('expired sessions cannot authenticate', async () => {
      await database
        .getRepository(AuthSession)
        .update(
          { userId: bob.body.user.id },
          { expiresAt: new Date(Date.now() - 1000) },
        );
      assert.equal(
        (await send('GET', '/auth/me', undefined, bob.body.accessToken)).status,
        401,
      );
    });
    await t.test('credential endpoints enforce rate limits', async () => {
      assert.equal((await send('POST', '/auth/register', {})).status, 429);
      let limited = false;
      for (let i = 0; i < 11; i++) {
        const result = await send('POST', '/auth/login', {});
        if (result.status === 429) {
          limited = true;
          break;
        }
        assert.equal(result.status, 400);
      }
      assert.equal(limited, true);
    });
    await t.test(
      'OpenAPI documents credentials, vendor requests, and bearer authentication',
      async () => {
        const response = await fetch(`${base}/docs-json`);
        const spec = await response.json();
        assert.ok(spec.components.securitySchemes.bearer);
        assert.ok(spec.paths['/api/v1/auth/register'].post.requestBody);
        assert.ok(spec.paths['/api/v1/vendors'].post.requestBody);
        assert.ok(spec.paths['/api/v1/vendors/{vendorId}'].patch.security);
      },
    );
  } finally {
    if (app) await app.close();
    if (database?.isInitialized) await database.destroy();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.destroy();
  }
});
