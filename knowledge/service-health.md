# Diagnosing service health

## Liveness and readiness

The health endpoint reports that the API process is alive. The readiness endpoint also checks PostgreSQL, the provider, and a recent worker heartbeat when jobs exist. A 503 readiness response indicates a degraded dependency or stale worker.

## What to include in an incident

For a payment incident, send the payment ID, approximate time, current status, and request ID to your operations team. Include the observed error and whether other payments are affected. Do not send passwords, session cookies, or recovery tokens.
