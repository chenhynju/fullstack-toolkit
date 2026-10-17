# A3 delivery assessment — 2026-10-18

This is a source/evidence audit against the user's uploaded A3 reference, not a claim that its acceptance checks were all executed today. The reference's directory layout is illustrative; directory names alone do not prove engineering value.

## Verdict

The repository has a working F12 starter foundation. It does not yet meet the complete A3 evidence, portability and independent-onboarding standard. The public website is documentation plus an authenticated example, not a project provisioning or deployment control plane.

GitHub main was verified as e034c285b16bd7d1723373d9a0d7b155de6bab57 during this audit. Engineering PR #2 and homepage PR #3 remain open. Default-template consumers therefore do not receive every enhancement present on the current development branch.

| Area                 | Current evidence                                                                                                                                  | Remaining acceptance                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runnable foundation  | pnpm workspace, pinned toolchain/lockfile, Turbo graph, web/API, shared contracts/configuration/database/i18n; minimal Vite consumer              | Independent clean-environment onboarding; devcontainer if justified; prove consumer-only rebuilding on a controlled shared-package change                                                    |
| Quality gates        | Vitest/API cases, Playwright business journeys, staged formatting/lint and commit validation, CI, entry budgets                                   | A single supported validate command; full app-to-app boundary protection; stable first-run setup and measured hook latency; explicit untested scope                                          |
| Delivery/operations  | Non-root multistage web/API images, migration stage, health/readiness, request IDs/redaction, graceful close handler, current Virginia deployment | New-product deployment configuration without toolkit-specific collisions; tag/registry release path if adopted; measured recovery and image budgets; shutdown under in-flight traffic        |
| Performance evidence | Retained Lighthouse JSON and historical GitHub cold/warm job timings, asset-budget checks                                                         | Controlled five-run medians with identified source revisions; actual LCP improvement; dependency/bundle and image-layer before/after evidence; CI time series and optimization retrospective |
| Handoff/reuse        | Five ADRs, English/Chinese manuals, deployment/reuse documentation and a bounded InvoiceFlow pilot                                                | Independent reader first-PR/onboarding trial, complete representative reuse workflow, and a repeatable record of time saved                                                                  |

## Important source-level gaps

- `packages/config-eslint/rules/no-app-imports.mjs` only checks files under `packages/`. It prevents shared packages from importing apps, but does not enforce the reference's web-to-api boundary example.
- Root `package.json` has individual check commands, but no `validate` entry point. Do not advertise `pnpm run validate` yet.
- `@repo/ui` exports TypeScript source. That is usable inside its configured workspace, but does not satisfy the reference's compiled-only distributable UI package requirement.
- `apps/admin` is an engineering lab consumer of shared UI/utilities, not an implemented business administration application. The public web currently consumes shared contracts/i18n but does not import `@repo/ui` components.
- Existing release scripts have toolkit-specific server paths, Compose names, volume/container references and loopback ports. A hostname input alone does not make a different product's deployment safe or complete.
- Existing rollback is conditional on compatible migration history. It is not a general automatic database rollback.
- The web Playwright configuration retains failure screenshots, but does not currently configure video recording. Existing artifacts should not be called video evidence.

## What the numbers support

`docs/perf-report-template.md` records historical local navigation medians from three samples per group:

- LCP: 2619.551 ms to 2687.226 ms — no speed improvement.
- TBT: 471 ms to 751 ms — regressed.
- CLS: approximately 0.158 to 0 — layout stability improved.

Historical GitHub execution windows were 340 seconds cold and 85 seconds warm. Much of that difference is container caching. It is not proof that using a monorepo made development 75% faster, or a controlled serial-versus-parallel comparison. These measurements also do not describe the latest homepage revision without remeasurement.

## What reuse has actually demonstrated

The InvoiceFlow pilot consumes compiled `@toolkit/i18n` in a separate source-only copy while retaining InvoiceFlow's API, tenancy and invoice logic. This is real but bounded package reuse. It does not adopt the entire starter or prove the benefits of keeping multiple applications in one monorepo. See `examples/invoiceflow/README.md` and `docs/i18n-verification.md` for acceptance limits.

Monorepo-specific value should be demonstrated by an actual shared contract/configuration change across real consumers: one reviewed change, consistent checks, correct dependency invalidation and a measured build. A second artificial application or more directory/package scaffolding is not a substitute for that demonstration.

## Recommended next acceptance

1. Choose one real product workflow and record the template/source revision, adaptations and actual time to first working business change. Preserve existing product-specific identity and tenancy rules.
2. Provide one supported verification command. Deliberately introduce a contract error, ownership regression and forbidden dependency; prove that the appropriate gate rejects each one.
3. Publish that product in an independent environment, record recovery evidence, and maintain a reproducible performance/build ledger. Invite a fresh reader to follow only the documented path before claiming a fifteen-minute onboarding result.

Further work on decorative website features does not address these gaps.
