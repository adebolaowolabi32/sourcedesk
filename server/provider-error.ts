/** Safe operator diagnostics: never include a provider response body or headers. */
export class ProviderError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(`OpenAI request failed (HTTP ${status}, ${code})`);
  }
}
export async function providerError(
  response: Response,
): Promise<ProviderError> {
  const body = await response.json().catch(() => null);
  const allowed = new Set([
    "credit_balance_exhausted",
    "insufficient_quota",
    "rate_limit_exceeded",
    "invalid_api_key",
    "model_not_found",
    "permission_denied",
  ]);
  const code = allowed.has(body?.error?.code)
    ? body.error.code
    : "provider_error";
  return new ProviderError(response.status, code);
}
