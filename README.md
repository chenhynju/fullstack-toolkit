# Toolkit Workspace

A multi-tenant team project workspace built from the existing fullstack-toolkit foundation: Next.js, TypeScript, Fastify, PostgreSQL/Prisma and Redis in a pnpm/Turborepo monorepo.

Live workspace: https://toolkit.purelamp.uk · [Operating help](https://toolkit.purelamp.uk/help). The 2026-10-21 release retained existing accounts/projects and passed public two-organization collaboration and restart acceptance; see the verification ledger for exact scope.

Organizations contain their own memberships, invitations, projects, tasks, comments and append-only audit events. One identity can hold different roles in different organizations. Legacy global ADMIN is not an organization permission. The API checks live membership and role; forced PostgreSQL RLS and composite foreign keys provide database isolation. The application rejects database roles that own tenant tables or bypass RLS.

## Develop

1. Use Node >=22.14 and the pinned pnpm 11.7.0. Copy `.env.example` to private `.env`.
2. Start local dependencies: `docker compose -f docker/compose.dev.yml up -d --wait`.
3. Install: `pnpm install --frozen-lockfile`.
4. Run `pnpm db:migrate` with DATABASE_URL temporarily set to the **local migration-owner URL** in the example. Restore the application URL before starting the API. The two URLs serve different purposes; a superuser API connection is deliberately rejected.
5. Start `pnpm dev`, open http://localhost:3000, register, create an organization and invite a teammate. No default administrator password is shipped.

The interface defaults to English and supports Chinese. `/help` explains real user operations. Platform engineering reference material remains under `/manual` and `docs/`.

## Validate and release

Use `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e`, `pnpm test:tooling`, `pnpm size-check` and `node scripts/check-entry-budget.mjs`. API integration tests require isolated PostgreSQL/Redis settings; see the runbook. Do not point test administrator credentials at production. On Windows, generate Prisma before starting API/test processes because the loaded engine DLL cannot be replaced.

Production uses `docker/compose.saas.yml` with private configuration and separate migration/application roles. Preserve the SQLite volume and exact old image tags during the first migration. A hostname parameter alone does not prove safe deployment, and a code rollback does not reverse database migrations.

- [User operations](docs/saas-user-manual.md)
- [Architecture and acceptance](docs/saas-design.md)
- [Development, reuse, migration and recovery](docs/saas-operations.md)
- [Actual verification ledger](docs/saas-verification.md)

The verification ledger distinguishes executed checks from pending release gates. Historical A3 performance notes describe earlier template revisions, not the current SaaS application. CRM, billing, SSO, MFA and external email delivery are outside this release.
