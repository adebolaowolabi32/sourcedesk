import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { budgetedFetch } from "../evals/budget.js";
test("live budget blocks overspend before network and retains failed-call reservations across runs", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sourcedesk-budget-"));
  const path = join(dir, "ledger.json");
  let calls = 0;
  const request: typeof fetch = async () => {
    calls++;
    throw new Error("transport failure");
  };
  const options = {
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      input: "test",
      max_output_tokens: 3000,
    }),
  };
  try {
    const budget = budgetedFetch(path, request);
    await assert.rejects(
      budget.request("https://api.openai.com/v1/responses", options),
    );
    assert.equal(calls, 1);
    assert.ok(budget.summary().reservedUsd > 0);
    assert.equal(
      budgetedFetch(path, request).summary().reservedUsd,
      budget.summary().reservedUsd,
    );
    const ledger = JSON.parse(readFileSync(path, "utf8"));
    ledger.reservedUsd = 0.499;
    writeFileSync(path, JSON.stringify(ledger));
    await assert.rejects(
      budgetedFetch(path, request).request(
        "https://api.openai.com/v1/responses",
        options,
      ),
      /budget exhausted/,
    );
    assert.equal(calls, 1);
    await assert.rejects(budget.request("https://example.com", options));
    assert.equal(calls, 1);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
