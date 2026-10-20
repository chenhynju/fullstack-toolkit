# SaaS development, migration and operations

## Local workspace

Use the pinned Node/pnpm toolchain. Copy `.env.example` to a private `.env`, start `docker compose -f docker/compose.dev.yml up -d --wait`, install using `pnpm install --frozen-lockfile`, then run migrations with the local migration-owner URL. The API always uses the separate `toolkit_app` URL. Start with `pnpm dev`; read `/help` for the bilingual user manual.

For example, in PowerShell, temporarily set `DATABASE_URL` to the local postgres migration-owner URL from the example before `pnpm db:migrate`, then restore it to the toolkit_app URL. Never leave the API using the owner URL: startup rejects superusers, BYPASSRLS roles and tenant-table owners. Local passwords are examples, not production credentials.

Integration tests require an isolated PostgreSQL administrator connection (`TEST_ADMIN_DATABASE_URL`), a preprovisioned nonprivileged `toolkit_app` login (`TEST_APP_PASSWORD`) and Redis (`REDIS_URL`). `scripts/provision-dev-role.mjs` provisions only development/CI. Tests create random `toolkit_test_*` databases, apply the real SQL migrations and drop their own database afterwards. Never use a shared production instance for this test role/database provisioning. Generate Prisma before starting Windows API/test processes to avoid DLL locking.

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e`, `pnpm size-check` and the tooling tests remain separate gates. PostgreSQL/Redis tests are not cached. Public E2E writes require explicit operator flags and a private random test password; the read-only checks do not create accounts.

## Tenant boundary and reuse

`apps/api/src/lib/tenant.ts` establishes transaction-local actor/organization context, validates membership and role after an organization transaction lock, and writes audit records in that same transaction. Routes use the scoped transaction client only. New business tables must carry organizationId, use composite references to organization-owned parents, and receive forced RLS with nonprivileged-role tests. Never perform tenant queries through the global client or trust a tenant ID header. The global client is reserved for identity/session lookups.

Reuse the User/Session, Organization/Membership/Invitation and audit/tenant transaction conventions when adding CRM or another SaaS business module. Do not copy the permission checks into a separate inconsistent implementation. Membership is read from PostgreSQL on every request, not cached. Redis is currently used for namespaced shared rate limits; unavailable Redis fails requests rather than bypassing limits.

## Existing SQLite migration

The legacy provider/schema/migrations are preserved in `packages/db/prisma/legacy-sqlite`. The PostgreSQL lineage is independent. `scripts/export-sqlite.py <consistent-snapshot> <private-packet.json>` is read-only and refuses to overwrite its packet. The packet contains password/session digests and must remain private.

After owner-role migrations and private provisioning of toolkit_app, set `MIGRATION_DATABASE_URL` only for `node scripts/import-sqlite.mjs <private-packet.json>`. The importer refuses any nonempty target and commits all records transactionally. Each legacy account gets a deterministic personal organization and OWNER membership, while legacy global ADMIN grants no organization bypass. IDs, hashes, dates, projects and ownership are reconciled before commit. Old sessions retain their original expiry; expired sessions remain expired. Never reset or clear the source database.

Rehearse export/import and restore first. During final cutover, stop only the old toolkit API, take a final consistent SQLite snapshot, export/import into the isolated PostgreSQL production target and reconcile counts. Retain the old SQLite volume and exact old API/web image identities. Do not treat the earlier hot rehearsal snapshot as the final cutover snapshot.

## Production operations

Production Compose is `docker/compose.saas.yml`; the older `docker/docker-compose.yml` is retained only for legacy rollback. Keep private configuration under `/opt/fullstack-toolkit/shared`, with random PostgreSQL owner/application passwords and separate migration/application URLs. The API image receives only the application URL. PostgreSQL/Redis use private project volumes and publish no host ports. Web/API bind to loopback 3180/3181; keep the existing Caddy/DNS route for toolkit.purelamp.uk. Do not modify shop or other applications.

Before any release, build all images while the current application remains running. Validate the nonprivileged-role startup, both dependencies, real purchase-free team journeys, backup restoration and resource headroom. On first migration, an operator must complete the source/data rehearsal before approving cutover. Save the actual source revision, image IDs, counts, backup hashes and browser evidence. Future compatible PostgreSQL releases should take a pg_dump before migration and preserve previous immutable images.

Rollback must use the exact previously running API and web tags; these may differ because the old homepage was deployed independently. Recreate only toolkit API/web against the retained old SQLite volume for a first-cutover rollback. Preserve all new PostgreSQL writes for reconciliation; a code rollback does not magically reverse schema/data changes or preserve newly created records in SQLite. Do not delete volumes, use down -v or restore over a live database.

See `saas-verification.md` for actual results and limitations; documentation and container health do not substitute for public business acceptance.
