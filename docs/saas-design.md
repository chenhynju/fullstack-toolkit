# Multi-tenant workspace implementation and acceptance

2026-10-21. User approved implementation and production release. Preserve authentication, shared packages and engineering tooling. The backed-up starting revision is `8af90a8`; secret-free source backup: `.local/saas/source-before-20261021.tgz`.

## Architecture

PostgreSQL replaces SQLite using a new migration lineage; keep the SQLite schema/migrations for a read-only export tool. Preserve user IDs, password hashes, session token hashes, timestamps and project IDs. Each existing account receives one personal organization and OWNER membership; its projects move there. Import is transactional into an empty isolated database and reconciles counts before cutover. No database reset or deletion.

Identity remains global. Organization discovery is scoped to the authenticated user. Every organization resource request runs in a Prisma transaction with transaction-local actor and tenant settings. RLS is forced on organization resources; application role is not owner/superuser/BYPASSRLS. Membership policies limit access to self or the selected organization; organization policies require membership. Organization creation is a constrained bootstrap transaction. Application code acquires an organization advisory transaction lock before membership-sensitive work to serialize permission changes, invitations and ownership transfer. Roles OWNER/ADMIN/MEMBER/VIEWER are organization-specific; global legacy ADMIN grants no organization bypass. Audit is append-only and written within the business transaction. Cross-tenant relations use composite foreign keys.

Invitation tokens are random, hashed in storage, expire, are single-use and bound to normalized account email. Invitations are copied as links, never automatically emailed. Invitation acceptance resolves by digest via a narrowly scoped database function, sets tenant context, acquires the same organization advisory lock and revalidates identity/expiry/membership. Only OWNER can transfer ownership; OWNER cannot be removed/demoted through member endpoints. ADMIN cannot promote to OWNER or manage OWNER. Downgrades/removals take effect on the next request; membership authorization is not cached.

Shared Redis rate limits use the plugin Redis store with an application namespace and client-IP keys, and fail closed when unavailable. No tenant business data or membership permissions are cached. No membership cache to invalidate. Organization IDs in URL are untrusted and always checked. UI is English-first with Chinese labels, real organization switcher, projects/tasks/comments, members/invitations, organization settings and read-only audit. Help owns engineering instructions.

## Stages and acceptance

1. Read-only host inventory, source backup, isolated PostgreSQL/Redis test services. Record resource and existing service baseline.
2. Schema, RLS, migration importer and tenant transaction wrapper. Prove nonprivileged role and connection reuse isolation.
3. Organization/member/invitation/owner transfer, project/task/comment and audit API. Test two organizations, multi-role users, forged headers/IDs, removed-member sessions, VIEWER writes, foreign associations and rollback.
4. Actual bilingual UI, shared contracts, browser journeys including failure states. Preserve login/logout protections.
5. Run formatter/lint/types/unit/API/database tests, production build, browser E2E and Docker startup/restart. Do not claim inherited tests prove tenant behavior.
6. Back up production SQLite, rehearse import/restore with isolated volumes, build immutable release, CI/PR, switch only toolkit, then public HTTPS dual-organization browser acceptance and restart checks. Preserve old source/images/SQLite for compatible rollback. Do not modify shop or other services.

## Delivery record

Keep exact commands/results and PASS/FAIL/BLOCKED/NOT_RUN in `docs/saas-verification.md`. Credentials and data backups stay in private ignored directories. The migration owner connection is used by migrations/import only, never by the web API. No production switch until data reconciliation, RLS acceptance and business browser tests pass.
