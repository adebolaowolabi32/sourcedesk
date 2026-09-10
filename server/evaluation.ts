import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Engine } from "./engine.js";
import type { EvalCase, EvalResult } from "./types.js";
export const dataset = JSON.parse(
  readFileSync(new URL("../evals/dataset.json", import.meta.url), "utf8"),
) as { version: string; cases: EvalCase[] };
export async function evaluate(engine = new Engine()): Promise<EvalResult> {
  const results: EvalResult["results"] = [];
  let valid = 0,
    citations = 0;
  for (const item of dataset.cases) {
    const answer = await engine.answer(item.question);
    const sources = [
      ...new Set(answer.passages.map((p) => p.citationId.split("#")[0])),
    ];
    for (const p of answer.passages) {
      citations++;
      if (
        answer.evidence.some((e) => e.id === p.citationId && e.text === p.text)
      )
        valid++;
    }
    results.push({
      ...item,
      actual: answer.status,
      sources,
      passed:
        answer.status === item.expected &&
        (item.expected === "handoff" ||
          item.expectedSources.every((id) => sources.includes(id))),
      latencyMs: answer.latencyMs,
      reason: answer.reason,
    });
  }
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const positive = results.filter((r) => r.expected === "answered"),
    negative = results.filter((r) => r.expected === "handoff");
  return {
    id: randomUUID(),
    datasetVersion: dataset.version,
    corpusVersion: engine.corpus.version,
    engine: "extractive",
    createdAt: Date.now(),
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    answerableRecall: positive.filter((r) => r.passed).length / positive.length,
    abstentionAccuracy:
      negative.filter((r) => r.actual === "handoff").length / negative.length,
    citationValidity: citations ? valid / citations : 0,
    latencyP50: latencies[Math.floor(latencies.length * 0.5)],
    latencyP95:
      latencies[
        Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1)
      ],
    apiCostUsd: 0,
    results,
  };
}
