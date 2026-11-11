Continue building my project, Vendora. Inspect the existing files first
and verify the current state before making changes.

PRODUCT AND GOAL
Vendora is a multi-vendor POS and ecommerce platform.
Initially it is a portfolio project, but I want to develop it into
a sellable SaaS product.

The proposed first commercial direction is:
- Multiple merchants use the same platform.
- Each merchant manages its own store, products, stock, staff, and sales.
- Each merchant can sell in-store through POS and online.
- A shared public marketplace is a possible later expansion.
This commercial direction is provisional, not fully finalized.

ENVIRONMENT
- Windows host with Ubuntu WSL.
- Ubuntu project directory: /home/fahmy/projects/vendora
- Windows path: \\wsl.localhost\Ubuntu\home\fahmy\projects\vendora
- VS Code is running with the project reopened in a Dev Container.
- Container workspace: /workspaces/vendora
- Container user: node
- Node: v24.22.1
- npm: 11.19.1
- Run Node/npm commands inside the container.
- The Dev Container configuration already exists; inspect it.
- An existing portfolio runs in the same WSL environment using
  Docker, Cloudflare Tunnel, and Caddy.
- Do not change the portfolio, proxy, or tunnel configuration
  during backend development.

COMPLETED
- Created the Vendora directory.
- Configured and opened the Node development container.
- Scaffolded a NestJS backend at apps/api.
- Selected ESM with Vitest.
- Declined optional @nestjs/observe integration.
- Fixed an accidental duplicated apps/apps directory.
- Started the backend successfully and confirmed Hello World.
Verify these details from the files rather than assuming versions
or generated configuration.

TECHNOLOGY AND ARCHITECTURE
- TypeScript with NestJS.
- PostgreSQL planned, not yet configured.
- REST API with OpenAPI documentation planned.
- Modular monolith, deployed initially on one host.
- One backend serves web and future mobile clients.
- Separate modules with clear responsibilities.
- No immediate need for microservices, Kubernetes, Redis,
  message brokers, or dedicated mobile apps.
- Database access library/ORM has not been selected.
  Recommend a suitable option and explain the choice briefly.

TENANCY AND DATA RULES
- Enforce vendor isolation from the beginning.
- Merchant-owned records must belong to a vendor.
- Derive and validate access using authenticated membership;
  do not trust a client-supplied vendor ID alone.
- A user can belong to multiple vendors.
- Roles belong to vendor memberships, rather than one global user role.
- Separate platform administration permissions from merchant roles.
- Use explicit decimal or integer-minor-unit representations for money,
  with currency; avoid floating-point monetary calculations.
- Stock changes need transactions and an auditable movement history.
- Checkout and payment operations eventually need idempotency.

PROPOSED FIRST RELEASE
- Authentication.
- Vendors and staff memberships.
- Owner, manager, and cashier permissions.
- One branch per vendor initially, with a model that can expand later.
- Product catalog, variants, prices, and inventory.
- POS cash sales, receipts, refunds, and cashier shifts.
- Merchant online storefront and order management.
- One vendor per online order.
- Basic sales reporting and audit records.
- Online-only POS initially.

LATER PHASES
- Payment-provider integration using sandbox mode first.
- Merchant subscription billing.
- Multiple branches and stock transfers.
- Barcode scanners and receipt-printer integrations.
- Mixed-vendor carts, commissions, and payouts if marketplace
  direction is selected.
- Offline POS synchronization.
- Dedicated mobile app if justified.

IMPLEMENTATION PLAN

Phase 1 — Backend foundation (start here)
1. Inspect project structure, package versions, scripts,
   Dev Container configuration, and existing Git status.
2. Recommend a database access library/ORM.
3. Add PostgreSQL through Docker Compose and integrate it
   with the existing development container.
4. Keep PostgreSQL private; avoid publishing its port unless needed.
5. Add persistent database storage.
6. Add environment configuration validation, an .env.example,
   and appropriate Git ignores. Never commit secrets.
7. Configure database migrations.
8. Add liveness and database readiness endpoints.
9. Add API versioning, request validation, and OpenAPI documentation.
10. Document how to start, stop, migrate, and verify the environment.
11. Run appropriate build, lint, and meaningful checks.

Phase 2 — Identity and tenancy
- Users and secure authentication.
- Vendors, branches, and vendor memberships.
- Role-based authorization and enforced tenant boundaries.
- Tests proving one vendor cannot read or modify another vendor's data.

Phase 3 — Catalog and inventory
- Products, variants, prices, and stock.
- Inventory adjustments and movement history.
- Transaction-safe stock changes and concurrency checks.

Phase 4 — POS sales
- Cashier shifts, cash checkout, sale items, receipts, and refunds.
- Preserve price/product snapshots on completed sales.
- Atomic sale and inventory updates.
- Protection against duplicate sale submissions.

Phase 5 — Online commerce
- Storefront APIs, checkout, stock reservations, and order lifecycle.
- Sandbox payments and verified, idempotent webhook handling.

Phase 6 — Commercial and deployment readiness
- Reports, audit trails, imports/exports, and demo seed data.
- Merchant onboarding and subscriptions if confirmed.
- Separate production Docker configuration.
- Integrate with existing Caddy and Cloudflare setup only after
  inspecting their configuration and agreeing on hostnames.
- CI checks, monitoring, backups, and tested restoration.
- Public portfolio demo uses sample data and sandbox payments.

WORKING STYLE
- Work incrementally and explain the purpose of important changes.
- Start with Phase 1; do not implement the entire product at once.
- Make routine, reversible implementation decisions autonomously.
- Ask only when a missing decision materially affects the design.
- Preserve existing work and avoid unrelated deployment changes.
- Finish each milestone with verification results and next steps.
- Record the agreed plan in docs/plan.md so future chats can
  recover context from the repository.

FIRST ACTION
Inspect the repository and report its actual state, then implement
the backend foundation in Phase 1.

IMPLEMENTATION STATUS
- Phase 1 source and development configuration implemented.
- TypeORM selected; explicit migrations with synchronization disabled.
- Development PostgreSQL connectivity, foundation migration application, transactional down/up SQL, and live API/readiness/OpenAPI verified on 2026-11-11.
- Build, lint, 12 unit tests, and 6 mocked HTTP tests passed.
- Database persistence across a Compose restart remains unverified; perform this from the WSL host because Docker CLI is unavailable in the container.
- See docs/development.md for commands, verification scope, and dependency audit findings.
- Phase 2 started: user, vendor, branch, and vendor membership entities plus an explicit reversible migration. Migration applied to development PostgreSQL; both migrations show as applied and live readiness returns HTTP 200.
- Merchant roles are stored per vendor membership (owner, manager, cashier); users have no global merchant role. Platform administration is not implemented.
- Real PostgreSQL tests cover migration reversal/reapplication, entity/schema agreement, normalized unique email, password-hash selection, multiple memberships, valid roles, foreign keys, branch ownership, and restricted deletion.
- Phase 2 authentication increment implemented on 2026-11-12: registration/login/logout/me, scrypt password hashing, hashed opaque bearer sessions expiring after 24 hours, credential endpoint rate limits, and authentication required by default for new controller routes.
- Authentication migration applied to development PostgreSQL; all three migrations show as applied. Build, lint, 12 unit tests, 6 mocked HTTP tests, and 22 database/HTTP test results passed; live readiness returns HTTP 200.
- Vendor create/list/get/rename endpoints implemented. Onboarding atomically creates an owner membership and one initial branch. Vendor access derives from authenticated membership; rename requires owner/manager and holds a membership lock through commit.
- Real HTTP/PostgreSQL tests prove cross-vendor reads/writes are denied, cashier rename is denied, membership revocation takes immediate effect, and failed onboarding rolls back. See docs/testing.md for a manual Swagger walkthrough.
- Phase 2 next: staff invitation/membership management with protection against owner lockout, plus email verification/password recovery before public use. Refresh/cleanup policy and platform administration remain pending. No frontend yet.
