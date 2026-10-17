# Monitoring and alerting

## Default behavior and external gates

Local monitoring must remain disabled without a DSN. NEXT_PUBLIC_* and VITE_* are public build-time values; a Sentry DSN identifies an ingestion endpoint but authentication tokens, source-map upload credentials and backend service keys must never use these prefixes. Preview and production require distinct environment tags and a release SHA. Browser replay, request bodies and user identity collection are not required by this project.

SDK integration and an intentional error probe are tracked in engineering-continuation.md. Until implemented and tested, this document is a setup runbook, not evidence of a functioning Sentry delivery. Actual ingestion requires a configured Sentry project and a human-visible event ID. Leave the external check BLOCKED when no DSN/project access exists.

## Uptime monitor

1. Create an HTTPS monitor in Better Stack or UptimeRobot for the correct environment's public landing page. Use a separate API readiness monitor when deploying the existing Fastify demo.
2. Set an explicit interval, failure confirmation and recovery policy. Verify TLS certificates rather than accepting invalid certificates.
3. Connect the provider's Slack integration to an explicitly approved channel. Creating a Slack destination is an operator step; no message is sent by this repository.
4. In staging, deliberately stop only the relevant container or serve an intentional failure. Record alert and recovery timestamps, then restore the service.
5. Publish a status page with service names and incident handling instructions. Keep internal addresses, credentials and customer identifiers private.

No monitoring account, Slack integration, incident alert or status page is provisioned or claimed verified by this document.

## Official references

- [Sentry React documentation](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Sentry Next.js documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Better Stack uptime documentation](https://betterstack.com/docs/uptime/)
- [UptimeRobot help center](https://help.uptimerobot.com/)
