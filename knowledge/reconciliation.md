# When a payment is still confirming

## An uncertain outcome

A reconciling payment has an uncertain provider outcome, often because a response was lost after acceptance. The worker checks the provider using the original idempotency key. Do not create a replacement payment while the outcome is unknown.

## Waiting for a status lookup

If the provider status lookup is unavailable, the payment stays in reconciliation. An unavailable lookup is not proof that a transfer failed. The worker continues checking with capped backoff; ask operations to investigate a prolonged incident.

## Why manual retry is unavailable

Manual retry is unavailable for reconciling payments. Retry is allowed only after three explicit failures before provider acceptance. An unknown outcome must be resolved through authoritative provider lookup or a verified callback.
