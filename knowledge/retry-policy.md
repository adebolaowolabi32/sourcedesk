# Retries, declines, and safe recovery

## Temporary provider outages

An explicit provider failure before acceptance retries up to three times, starting with roughly 5 seconds and then 10 seconds between attempts, plus jitter. After exhaustion, the payment needs attention and a checker or administrator can start a new retry cycle.

## Permanent declines

A permanently declined transfer is terminal and is not automatically retried. Manual retry is unavailable for declined payments. Ask the operations team to investigate the decline before deciding whether a new request is appropriate.

## History across retry cycles

Starting a new retry cycle preserves every earlier processing attempt. Payment details includes started operations and their outcome events, request IDs, and stale-worker indicators. An unfinished started event may mean a worker was interrupted.
