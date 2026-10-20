# SaaS verification ledger — in progress

Starting source: `8af90a83ca73cedd31a4725d6382cce2cda1b990`. Source backup SHA-256: `27f23863a286b55d6f4244c57cc1413c764f02a9e53609a0624d1e65a90c43c7`.

## Completed evidence

- PASS: nine core organization/API/database scenarios against a dedicated PostgreSQL 16 and Redis 7 instance through SSH. Non-superuser/non-BYPASSRLS/non-table-owner application connection; forced RLS on all seven tenant tables; two organizations and a user with different roles; same-company collaboration; immediate downgrade/removal; identity-bound single-use/expired/revoked invitations; cross-tenant IDs and forged header denied; append-only audit, transaction rollback, connection-pool context reset; safe ownership transfer.
- PASS: real SQLite → PostgreSQL migration fixture. Password hashes, token digests, IDs, dates, legacy roles and project ownership reconciled; existing session and password login worked after import. A repeat import into a nonempty database was rejected.
- PASS: frontend TypeScript and 13 frontend unit tests at the first workspace milestone; production Next build generated `/`, `/help`, `/manual`.
- PASS: live legacy SQLite consistent snapshot and isolated restore integrity checks, 11 users / 3 sessions / 2 projects. The original volume is untouched. Snapshot SHA-256: `b635cb6923ca23b52108a5da272b14f876eaf1101b043a3c1cc6b6512b44b3f1`. Raw data stays in the private host directory.

## Failures corrected / still being verified

- Initial cross-Pacific integration timeout was 20 seconds. Increased to 60 seconds for multi-request scenarios without removing assertions. These timings are not production performance measurements.
- A real permissions defect was found: SELECT FOR UPDATE also applied the organization update policy, hiding an organization from members/viewers. Replaced this with a scoped transaction advisory lock and rechecked membership after acquiring it. Invitation acceptance uses the same lock. Core nine-case rerun passed.
- Windows quality run attempted Prisma generation while an API process/test had its engine DLL loaded, causing EPERM. Serialize generation before starting those processes; do not treat this as a successful quality run.
- First browser run: help, unauthenticated protection and locale persistence passed; organization creation refresh failed acceptance. Dependency command timeouts added; full browser rerun is pending.

## Latest milestone

- PASS: complete API suite, 33 tests / 5 files, 98.05% statement/line coverage, 91.28% branches and 95.65% functions. Additional Redis tests subsequently passed 2/2, proving shared limits across two instances and startup refusal when Redis is unavailable. Final CI must cover the combined source.
- PASS: full monorepo lint/typecheck, 19 tasks after serializing generation; production web build; tooling tests 4/4; production dependency audit reported no known vulnerabilities.
- PASS: aggregate emitted JS gzip 291.0 KB against 300 KB budget; modern web entry 124,491 bytes gzip against 160 KB. These are asset sizes, not loading-time measurements.
- Browser rerun completed invitation acceptance, team task/comment collaboration, role downgrade, organization switch, member removal, audit and logout. Its final wrong-password assertion failed because it matched both the workspace alert and Next route announcer. Scoped the locator to main without weakening the expected error. An earlier actual hash-only invitation navigation defect was fixed with a hashchange listener. Final complete green rerun is still required.
- Desktop/mobile workspace screenshots were visually reviewed; the 390px layout had no horizontal overflow.

## Release gates

Full final format/lint/typecheck/unit/API coverage: IN_PROGRESS. Additional CRUD case and migration test included in the final suite. Browser complete journey: IN_PROGRESS. GitHub CI: NOT_RUN for this milestone. Linux Docker image startup/restart and PostgreSQL restore: NOT_RUN. Production cutover/public dual-organization browser acceptance: NOT_RUN. Do not infer an online release from this ledger.
