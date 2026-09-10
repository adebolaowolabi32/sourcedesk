import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

// Verified 2026-09-10: GPT-5.4-mini $0.75/$4.50 per million;
// text-embedding-3-small $0.02 per million. Text only, no paid tools.
// Reserve conservative byte-based input bounds plus the entire output cap.
// Reservations persist across retries; failures never refund the reservation.
export function budgetedFetch(
  path = "data/live-test-budget.json",
  request: typeof fetch = fetch,
) {
  mkdirSync("data", { recursive: true });
  const ledger = existsSync(path)
    ? JSON.parse(readFileSync(path, "utf8"))
    : {
        limitUsd: 0.5,
        reservedUsd: 0,
        estimatedUsageUsd: 0,
        requests: 0,
      };
  if (
    ledger.limitUsd !== 0.5 ||
    !Number.isFinite(ledger.reservedUsd) ||
    ledger.reservedUsd < 0
  )
    throw new Error("Invalid live-test budget ledger");
  const save = () =>
    writeFileSync(path, JSON.stringify(ledger, null, 2) + "\n");
  const wrapped: typeof fetch = async (url, options) => {
    if (typeof options?.body !== "string")
      throw new Error("Budget requires a JSON request");
    const body = JSON.parse(options.body);
    const embedding =
      String(url) === "https://api.openai.com/v1/embeddings" &&
      body.model === "text-embedding-3-small";
    const generation =
      String(url) === "https://api.openai.com/v1/responses" &&
      body.model === "gpt-5.4-mini";
    if (!embedding && !generation)
      throw new Error("Model or endpoint lacks a verified budget rate");
    if (
      body.tools ||
      body.previous_response_id ||
      body.conversation ||
      body.background
    )
      throw new Error("Budget permits only stateless text requests");
    if (
      generation &&
      (!Number.isInteger(body.max_output_tokens) ||
        body.max_output_tokens < 1 ||
        body.max_output_tokens > 3000)
    )
      throw new Error("Output budget exceeded");
    if (generation) body.service_tier = "default";
    const inputBound = Buffer.byteLength(JSON.stringify(body), "utf8") + 4096;
    const reserve =
      (2 *
        (inputBound * (embedding ? 0.02 : 0.75) +
          (generation ? body.max_output_tokens * 4.5 : 0))) /
      1e6;
    if (ledger.reservedUsd + reserve > ledger.limitUsd)
      throw new Error("Live-test budget exhausted; no request sent");
    ledger.reservedUsd += reserve;
    ledger.requests++;
    save();
    const response = await request(url, {
      ...options,
      body: JSON.stringify(body),
    });
    const data = await response
      .clone()
      .json()
      .catch(() => null);
    const usage = data?.usage;
    if (usage) {
      const cost = embedding
        ? (usage.total_tokens * 0.02) / 1e6
        : (usage.input_tokens * 0.75 + usage.output_tokens * 4.5) / 1e6;
      if (Number.isFinite(cost) && cost >= 0) ledger.estimatedUsageUsd += cost;
      save();
    }
    return response;
  };
  return { request: wrapped, summary: () => ({ ...ledger }) };
}
