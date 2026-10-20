# Engineering infrastructure continuation — 2026-10-17

## Scope and preservation

The uploaded engineering prompt is authoritative for this continuation. Existing authentication/demo/API and shop-platform are preserved, not expanded or removed. New pages demonstrate infrastructure only. No production DNS changes, new commerce/payment features, or secret values belong in this work. The handoff contains credentials: do not copy it into the repository, reports, artifacts or automation prompts.

Starting local commit: 5bd5e09. Remote main has merge-only changes and identical source (GitHub compare API verified). Source backup: .local/engineering/source-before.zip. Existing successful CI and Deploy records were verified read-only via gh; future changes still require their own checks.

## Milestones

- M1/M2: exact installed dependency pins; minimal Vite admin and utilities; shared UI/unit coverage; tested package boundary ESLint rule and zero-warning lint; Husky/lint-staged/commitlint.
- M2: actual initial-route asset budgets in addition to the aggregate guard; production browser journeys; preserve current auth regression tests. Dependencies/build selection must include shared changes and conservative unknown/root changes.
- M3: trusted CI gates, pnpm/Turbo/browser caches, affected builds, opt-in GHCR and Vercel CI-prebuilt configurations. Fork PRs must never receive deployment secrets. Existing Virginia deploy remains independent.
- M4: optional Sentry in both frontends, disabled locally by default; error probe; English observability/domain/email/environment runbooks. No DNS/mail/Sentry service is silently provisioned.
- M4: reproducible measurement scripts and retained baselines. Separate local-vs-runner comparisons; no fabricated speedup, Lighthouse INP or unmeasured image sizes. Deliberately heavy dependency belongs to an isolated benchmark fixture, never the live homepage.

## Acceptance

Run frozen installation, warning-free lint, all package type checks, meaningful RuleTester/unit/coverage tests, production builds, size regressions and production-browser journeys. Record PASS/FAIL/BLOCKED/NOT_RUN precisely. New external deployments require configured GitHub Environments and verified credentials; report missing external gates without claiming success. Use small Conventional Commits/PRs when checks support them.

## Conditional continuation

If this turn hits remaining capacity before completion, schedule one continuation for 2026-10-18 04:23 Asia/Shanghai (2026-10-17 20:23 UTC), reading this plan and final handoff first. No recurring monitor and no unrelated product development.
