# Functional UI cleanup — 2026-10-18

Public URL: https://toolkit.purelamp.uk/. Frontend release: `r20261018-ui-02`. The three runtime frontend files match application commit `eb671e8`; the API, schema and existing service container identities were preserved.

Removed the noninteractive Foundation context/dropdown, promotional sidebar panel, technical badge, hero slogans, decorative architecture panel, footer slogans/arrows, statistic captions, fake board-view label and nonfunctional empty-state plus sign. Kept meaningful headings, real statistics, API status, help/security information and working controls. Guest navigation opens the account form; authenticated project navigation targets the board. English remains default and Chinese retains the same functionality.

| Status  | Validation                                                  | Evidence                                                                                                                                                                                 |
| ------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASS    | Final local production build including lint/type validation | `.local/ui-cleanup-build-final.log`                                                                                                                                                      |
| PASS    | Final isolated local browser suite, 6/6                     | `.local/ui-cleanup-final-e2e.log`: registration/login/logout, CRUD, role/owner isolation, admin directory, EN/ZH/session/errors, guide and mobile                                        |
| PASS    | Linux multistage candidate and EN/ZH SSR                    | Server project shared log `ui-cleanup-candidate-02.log`                                                                                                                                  |
| PASS    | Public HTTPS browser suite, 2/2                             | `.local/ui-cleanup-public-browser-verified.log`: guide, early navigation under delayed session loading, manual, locale persistence, mobile and browser-origin 401/403 checks             |
| PASS    | Public visual and runtime inspection                        | `.local/ui-cleanup-public-visual-final.log`; EN/ZH desktop and Chinese mobile PNGs under `.local/ui-cleanup-*` were captured and inspected; no horizontal overflow or page runtime error |
| PASS    | Compatible images, release pointer and isolation            | `.local/ui-cleanup-release-final.log`: healthy frontend, matching source hashes, unchanged API/container identities; no database migration or production acceptance account              |
| PASS    | Staged checks                                               | Actual code commits `23d5320` and `eb671e8` passed formatting, package-aware ESLint and Conventional Commit hooks                                                                        |
| NOT_RUN | New GitHub Actions acceptance for this cleanup              | Source publication/CI status must be checked independently; earlier PR success is not acceptance of these changes                                                                        |

## Corrected failures

The first public guide journey caught an early-click race: its anchor did not exist until session checking finished. The loading state now exposes the same destination as the rendered form/board, and the regression deliberately delays the session request before clicking. Local and public final journeys passed.

Public Playwright's separate HTTP request context repeatedly encountered ECONNRESET even after transport retries. The guest journey now makes the same negative requests through the real browser origin and still requires 401 for projects and 403 for the missing-CSRF write. No authentication assertion was skipped or weakened. The initial and intermediate failing logs remain under `.local/ui-cleanup-public-browser*.log`.

Initial local invocations exposed the existing pnpm shim/network lookup and ESLint peer-resolution environment issues. Explicit installed tooling and the local dependency search path produced passing standalone lint/types and clean final builds; no application dependency version was changed. The first candidate upload reset; smaller transfer blocks succeeded before any publication. Expected connection resets during the container's startup retry loop were followed by successful HTTPS/readiness checks.

Rollback retains `r20261018-guide-02`; matching API/migration image aliases refer to the unchanged prior images. This frontend release performs no schema migration and does not establish a general database rollback guarantee.
