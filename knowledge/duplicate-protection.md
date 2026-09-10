# Preventing duplicate requests

## Idempotency keys

Each payment creation request uses an Idempotency-Key scoped to its creator and workspace. Reusing the same key with equivalent payment details returns the original payment. Reusing it with different details returns a conflict.

## Duplicate protection at the provider

Workers use a stable workspace and payment key for provider submissions. A restarted worker checks for an existing transfer before resubmitting. The provider must retain receipts and honor idempotency for this protection to work.
