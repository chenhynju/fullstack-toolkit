# Reproducible performance evidence

## Measurement boundaries

Historical source reports are retained in docs/perf/lh-{baseline,optimized,final}-*.json. Each group contains three Lighthouse 13.5.0 navigation runs against a local production server. The figures below are medians calculated directly from numericValue, not estimates. They measure a previous committed frontend, not this continuation's new Vite app. INP is not available from these navigation runs. No new performance improvement is claimed before remeasurement.

| Metric | Baseline median     | Final median | Interpretation                                        |
| ------ | ------------------- | ------------ | ----------------------------------------------------- |
| LCP    | 2619.551 ms         | 2687.226 ms  | Regressed slightly; target not achieved               |
| CLS    | approximately 0.158 | 0            | Layout shift fixed                                    |
| TBT    | 471 ms              | 751 ms       | Regressed; do not present this as a speed improvement |

The previous report's 570 ms baseline TBT did not match the median of the retained raw samples and is corrected here. Statements attributing the entire LCP bottleneck to hydration, or predicting an RSC result below 1.5 seconds, are hypotheses rather than established measurements.

### Reproduce a new frontend sample

Use the checked-in lockfile, Node 22.20.0 and pnpm 11.7.0. Record the Git SHA, CPU/OS, Chrome/Lighthouse versions and complete configSettings in every new report. Build with pnpm build, run the production web/API servers using a disposable environment, and run Lighthouse three times with the same settings:

```sh
pnpm dlx lighthouse@13.5.0 http://localhost:3000/ --output=json --output-path=.local/lighthouse-1.json --chrome-flags="--headless"
```

Repeat for samples 2 and 3 and preserve the JSON. Use the same Chrome version, viewport, throttling, account/session state and machine for before/after. Do not compare development mode to production. A navigation lab run is not field-user INP or a service-level objective.

## GitHub CI cache comparison

These existing runs were rechecked through the GitHub API on 2026-10-17. Both completed successfully on GitHub-hosted runners; they measure the previous workflow, not the changes in this continuation.

| Job                                         | Cold run 39031103028 | Warm run 39031903702 |
| ------------------------------------------- | -------------------- | -------------------- |
| quality-gate                                | 86 s                 | 42 s                 |
| e2e                                         | 83 s                 | 84 s                 |
| container                                   | 340 s                | 26 s                 |
| Earliest job start to latest job completion | 340 s                | 85 s                 |

Observed execution wall clock decreased 75%. Queue time is excluded. The warm maximum individual job is 84 s; its 85 s execution window includes the one-second stagger in job starts. GitHub-hosted runners have normal variability. The handoff describes deleting caches before the cold run; deletion itself was not repeated or independently reconstructed here. Do not equate this cache comparison to a controlled no-cache serial-versus-parallel experiment.

- [Cold run](https://github.com/chenhynju/fullstack-toolkit/actions/runs/39031103028)
- [Warm run](https://github.com/chenhynju/fullstack-toolkit/actions/runs/39031903702)

```sh
gh api repos/chenhynju/fullstack-toolkit/actions/runs/39031103028/jobs
gh api repos/chenhynju/fullstack-toolkit/actions/runs/39031903702/jobs
```

The old comparison between Windows local serial tasks and an Ubuntu GitHub run is withdrawn as an optimization percentage: hardware, operating system and task sets differ. There is no verified remote Turbo cache; Actions-restored .turbo artifacts are local task cache on each runner.

## Bundle and container evidence

The historical aggregate budget is 278.5 KiB gzip across 16 emitted JS chunks. This includes multiple routes and is not initial-route JavaScript. scripts/check-entry-budget.mjs introduces a separate manifest-derived modern entry budget: unique Next layout/page JS and Vite entry/static imports. Lazy chunks, CSS, inline HTML/RSC and legacy polyfills are outside that metric; browser transferred-byte measurements remain separate.

No single-stage-versus-multistage image size result has been measured in this continuation. Docker Desktop availability and build resources must be verified, both images built from the same source/dependency lock/base image, and docker image inspect sizes recorded. Do not invent a reduction. Deliberately heavy dependency experiments must use an isolated benchmark fixture, not inflate the public template homepage.
