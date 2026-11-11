# Backend development

## Current setup

The inspected scaffold uses NestJS 12, TypeScript 6, ESM, Express, Vitest 4, and Oxlint. Node 24.22.1 and npm 11.19.1 were verified in the original container. The workspace initially had no Git repository. Git was initialized on 2026-11-12; real environment files and generated output are ignored, and staged files were checked for the current environment passwords before the initial commit. Root package-lock.json predates this work and is left untouched; the API owns its package and lockfile.

TypeORM was selected for its first-party Nest integration, PostgreSQL support, explicit SQL migrations, and transaction support. Automatic schema synchronization and startup migrations are disabled. Entities should live beside their domain module; migrations are reviewed and applied explicitly. TypeORM does not automatically enforce tenant isolation: Phase 2 must derive access from authenticated memberships and test cross-vendor access.

References: [Nest TypeORM](https://docs.nestjs.com/data/typeorm.md), [Nest OpenAPI](https://docs.nestjs.com/openapi/introduction.md).

## First start

Local root `.env` and `apps/api/.env` files were prepared with matching, randomly generated development credentials if neither file existed. Both are ignored. Never commit them. `.env.example` files contain illustrative credentials only.

For a fresh clone, from the workspace root copy `.env.example` to `.env` and `apps/api/.env.example` to `apps/api/.env`. Choose a local password and match it in both files. Percent-encode special characters in the database URL password. The root environment configures PostgreSQL; the API environment configures Nest and migration commands.

In VS Code, run **Dev Containers: Rebuild Container**. The new container uses `compose.yaml`, starts PostgreSQL, waits for its health check, and runs `npm ci --prefix apps/api`. Rebuilding interrupts running processes, so save work first. Docker Compose runs through VS Code on the host; Docker is not required inside the workspace container. No portfolio, Caddy, or Cloudflare configuration is used.

Inside the rebuilt container:

```sh
cd /workspaces/vendora/apps/api
npm run migration:run
npm run migration:show
npm run start:dev
```

The API connects to `db:5432` on its Compose network. PostgreSQL has no published host port. Port 3000 is forwarded by VS Code. Database files persist in the `vendora_postgres_data` named volume. Changing POSTGRES credentials after initialization does not update the existing database role: change the role deliberately rather than deleting data.

## Verify

```sh
cd /workspaces/vendora/apps/api
npm run build
npm run lint
npm test
npm run test:e2e
curl --fail http://localhost:3000/api/v1
curl --fail http://localhost:3000/api/health/live
curl --fail http://localhost:3000/api/health/ready
curl --fail http://localhost:3000/docs-json
```

Open `http://localhost:3000/docs` for Swagger UI. `/api/v1` currently returns the scaffold greeting. Health routes are version neutral. Readiness returns 503 for database errors or pending migrations and hides connection error details. Liveness makes no database query; initial API startup still requires a database connection. Connection and query timeouts are five seconds. Invalid environment configuration prevents startup.

HTTP tests mock database access and verify routing, readiness failure responses, and OpenAPI paths. They do not prove PostgreSQL connectivity or migration correctness. Real database connectivity, migration application, and live HTTP routes were verified on 2026-11-11 (see verification status below).

## Migrations

```sh
npm run migration:run
npm run migration:show
npm run migration:generate -- src/database/migrations/DescribeChange
npm run migration:revert
```

Generation builds first and compares compiled entities with the development database; review generated SQL before applying. Run build again after generation (migration:run does this). The initial reversible migration adds a small infrastructure metadata table. Phase 2 adds users, vendors, branches, and vendor memberships in a separate migration. Never use schema synchronization. Migration revert rolls back the latest migration and can remove data; use only deliberately.

## Stop and restart

Stop the API with Ctrl+C. VS Code stops these Compose services when closing the Dev Container. From the WSL host, in the project directory, use `docker compose stop` or `docker compose up -d db` as needed. Reopen the folder in its Dev Container to resume development. `docker compose down` removes containers and the network but retains the database volume; adding `-v` deletes database data. Do not use that for routine shutdown.

## Verification status and next milestone

Verified on 2026-11-11 in the current Dev Container:

- Build and lint passed; 12 unit tests and 6 mocked HTTP tests passed.
- The Compose database hostname `db` resolves and PostgreSQL accepts the configured API connection.
- The foundation migration was pending, applied successfully through `migration:run`, and appears as applied in `migration:show`.
- Migration down/up SQL was verified inside a transaction that was rolled back, preserving the existing database state and migration history.
- A temporary API instance connected to PostgreSQL and returned HTTP 200 for `/api/v1`, `/api/health/live`, `/api/health/ready`, `/docs`, and `/docs-json`. Readiness reported the database up, and OpenAPI contained the expected API and health paths. The temporary instance was closed after verification.

Database persistence across a Compose stop/start remains unverified. The current container has no Docker CLI, so this requires the WSL host: stop and restart the Compose services without deleting volumes, reopen the Dev Container, then confirm `npm run migration:show` still lists the foundation migration as applied and readiness returns HTTP 200. Git was subsequently initialized on 2026-11-12, allowing status and staged-file checks.

The foundation now has real PostgreSQL runtime verification; the remaining infrastructure check is persistence across a restart. Phase 2 now includes users, authentication, vendor memberships, branch modeling, and tenant-boundary tests. Staff membership management is next.

Dependency audit currently reports five findings through the scaffold's existing development deployment package `@nestjs/mau` (including two high-severity transitive dependencies). No force downgrade was applied. Review or remove that deployment integration before deployment; it is not used by this local foundation.


## Phase 2: identity and tenancy data model

The first Phase 2 increment adds `users`, `vendors`, `branches`, and `vendor_memberships`. The migration was applied to development PostgreSQL on 2026-11-11; both migrations show as applied and live readiness returns HTTP 200. Membership roles are `owner`, `manager`, or `cashier`; the same user can hold a different role in each vendor. Branches always reference a vendor, and a composite unique key on `(vendor_id, id)` supports future vendor-scoped foreign keys. The schema permits multiple branches for future expansion; onboarding creates one initial branch. Referenced users and vendors cannot be deleted without deliberately handling their dependent records.

User emails must be trimmed and lowercase before storage and are unique. `password_hash` is excluded from ordinary TypeORM queries. This is query behavior, not a serialization guarantee: authentication endpoints explicitly shape responses to exclude credentials. Registration, login, logout, and membership-protected vendor endpoints are now implemented (see below). Database ownership columns and foreign keys do not themselves enforce authenticated tenant access; vendor services check authenticated memberships for every request.

Run real PostgreSQL checks from `apps/api`:

```sh
npm run test:database
```

This builds the API, creates a randomly named test schema in the configured development database, verifies migration up/down/up and entity/schema agreement, and tests data constraints through TypeORM repositories. The test schema is dropped in cleanup; existing application tables are untouched. Use development credentials with schema creation permission. Eight database subtests plus their parent test passed on 2026-11-11, alongside build, lint, 12 unit tests, and 6 mocked HTTP tests.

UUIDs use PostgreSQL's built-in `gen_random_uuid()`; automatic extension installation remains disabled. Entity and migration behavior follows the [TypeORM entity documentation](https://typeorm.io/docs/entity/entities/).


## Phase 2: authentication and protected vendor APIs

Implemented on 2026-11-12. Follow [the testing guide](testing.md) to try the complete flow in Swagger.

- Registration and login issue a random 256-bit bearer token with a fixed 24-hour lifetime. PostgreSQL stores only its SHA-256 hash in `auth_sessions`; logout deletes that session. Tokens are sent in the Authorization header, not cookies or query strings. Login creates an independent session. Expired tokens fail authentication; expired rows can be deleted during future session maintenance.
- Passwords use the first-party `@nestjs/authentication` `PasswordHasher`, with its default asynchronous scrypt parameters and per-password salt. Its verifier does dummy work for unknown accounts. Registration requires 15–128 characters; passwords are never trimmed or lowercased by application code (the hasher applies its documented Unicode normalization). All credential responses and `/auth/me` use `Cache-Control: no-store`.
- The application uses the package's password hasher directly; its `AuthenticationModule` is not registered. The opaque bearer session service and global authentication guard live in `src/identity`. New Nest controller routes require authentication by default. Only registration, login, scaffold greeting, and health routes are explicitly public; Swagger remains accessible.
- `@nestjs/throttler` limits registration to five requests and login to ten requests per minute per IP. Storage is in memory for the current single-process setup; a restart resets counters. Before public deployment, configure trusted proxies deliberately and shared rate-limit storage if scaling to multiple instances.
- Vendor onboarding transactionally creates the vendor, an owner membership for the authenticated user, and one `Main` branch. Vendor lists are scoped to the user's memberships. Vendor reads return branches only after checking membership. Owners/managers may rename a vendor; cashiers may read it. Rename holds a membership row lock until commit so concurrent revocation or role changes cannot bypass that authorization decision.
- Input validation rejects extra fields, empty vendor names, invalid emails, and malformed UUID parameters. Nonmembers get 404 for vendor reads/writes, matching unknown IDs. No endpoint accepts a client-selected user or role.

The `Authentication` migration adds the session table and indexes. It has been applied to development PostgreSQL; all three migrations show as applied, live readiness returns HTTP 200, and an unauthenticated vendor request returns HTTP 401. The full database suite now runs the actual migration runner and boots the real application against isolated test schemas. It covers credential hashing, session lifecycle, public health routes, transactional onboarding, cross-vendor read/write denial, role checks, immediate membership revocation, rate limits, and OpenAPI request documentation. Build, lint, 12 unit tests, 6 mocked HTTP tests, and 22 PostgreSQL/HTTP test results (including two parent tests) passed on 2026-11-12.

Email verification, password recovery, refresh tokens, session cleanup scheduling, staff invitation/role management, platform administration, and a frontend are still pending. Registration currently reports duplicate emails with 409; addresses are not verified. This is a local development increment, not a completed public authentication service.

References: [Nest authentication and password hashing](https://docs.nestjs.com/security/authentication), [Nest rate limiting](https://docs.nestjs.com/security/rate-limiting).
