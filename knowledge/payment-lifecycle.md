# Understanding payment statuses

## Awaiting approval

A pending payment is a request waiting for independent review. No transfer has been submitted to the provider yet. Ask a checker or administrator who did not create the request to review it.

## Queued for processing

A queued payment has been approved and is waiting for a worker. Keep the worker and provider simulator running. If the queue stops progressing, check System health and ask operations to inspect readiness.

## Confirmed payments

Paid means the simulator returned a confirmed receipt. The receipt is visible in Payment details. All transfers in LedgerDesk are synthetic; a Paid status does not represent a real bank transfer.
