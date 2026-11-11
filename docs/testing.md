# Try Vendora locally

Vendora currently has a backend API. Swagger is the interface for trying registration, login, and vendor management; there is no storefront or POS screen yet.

## Start the API

In the VS Code Dev Container terminal:

```sh
cd /workspaces/vendora/apps/api
npm run migration:run
npm run start:dev
```

Open [Swagger](http://localhost:3000/docs). Expand an endpoint, click **Try it out**, enter its input, then click **Execute**. All authentication and vendor paths below begin with `/api/v1`.

## Register and sign in

1. Execute `POST /api/v1/auth/register` with an email address and a password between 15 and 128 characters:

   ```json
   {
     "email": "owner@example.com",
     "password": "My local test password 2026!"
   }
   ```

   Use this example password only for local testing. A successful response has status **201** and includes `accessToken`, `expiresAt`, and the new user's `id` and `email`. It never returns the password or its hash. The email is trimmed and lowercased. Repeating registration with the same email returns **409**.

2. Copy the `accessToken` value, click Swagger's **Authorize** button, paste the token itself (without quotation marks or the `Bearer` prefix), and click **Authorize**.
3. Execute `GET /api/v1/auth/me`. Status **200** and your user details confirm you are signed in.
4. For an existing account, execute `POST /api/v1/auth/login` with the same email and password to get a new token. If you use this new token, update Swagger's authorization value too.

Tokens last 24 hours. Treat them like passwords. Registration is limited to five requests per minute per IP; login is limited to ten. A **429** response means wait at least one minute before trying again.

## Create and access a vendor

While authorized, execute `POST /api/v1/vendors`:

```json
{
  "name": "My First Store"
}
```

A **201** response includes the vendor ID, your `owner` role, and one initial branch named `Main`. The vendor, membership, and branch are created together; a failure rolls all three back.

- `GET /api/v1/vendors` lists only vendors you belong to.
- `GET /api/v1/vendors/{vendorId}` returns the vendor and its branches. Paste the returned ID into the path parameter.
- `PATCH /api/v1/vendors/{vendorId}` with `{"name":"My Renamed Store"}` renames the vendor. Owners and managers can do this; cashiers receive **403**.

Roles and user IDs are derived from the signed-in user and database membership. Do not include `userId`, `vendorId`, or `role` in the request body; unexpected fields return **400**. Staff invitation and membership management endpoints are not implemented yet.

## Check vendor isolation yourself

1. Keep the first vendor's ID.
2. Register another account using a different email, and replace Swagger's authorization token with that account's token.
3. List vendors. The first account's vendor is absent.
4. Try getting or renaming the first vendor by its ID. Both requests return **404**, and the vendor stays unchanged.

A vendor that does not exist and a vendor you cannot access both return **404**.

## Sign out

Execute `POST /api/v1/auth/logout`. A **204** response has no body. Try `GET /api/v1/auth/me` again using the same token: it now returns **401**. Clear Swagger's token using **Authorize → Logout**. Other login sessions remain valid.

## Automated checks

From `apps/api`:

```sh
npm run build
npm run lint
npm test
npm run test:e2e
npm run test:database
```

| Command | What it checks |
| --- | --- |
| `npm test` | Small units such as configuration validation and request validation |
| `npm run test:e2e` | Foundation HTTP routes with database access mocked |
| `npm run test:database` | Real PostgreSQL constraints, migration reversal, and real HTTP authentication and vendor access |

The database tests create randomly named test schemas in your development database and remove them afterward. They require schema creation permission and do not modify existing application tables. They start their own temporary API instance on an available port; you do not need to run `start:dev` for them.

User, role, and data constraint tests: `apps/api/test/database/identity-tenancy.test.mjs`.

Registration, login, logout, token expiry, permissions, transaction rollback, and cross-vendor HTTP tests: `apps/api/test/database/auth-tenancy.test.mjs`.
