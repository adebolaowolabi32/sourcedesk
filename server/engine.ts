import { randomUUID } from "node:crypto";
import { Corpus, suspicious, tokens } from "./retrieval.js";
import type { Answer } from "./types.js";
import type { Generator } from "./generator.js";
import { validateGeneration } from "./generator.js";
import type { SemanticRetriever } from "./vectors.js";
import type { Selector } from "./model.js";
export class Engine {
  constructor(
    public corpus = new Corpus(),
    private selector?: Selector,
    private prices?: { input: number; output: number },
    private rag?: { retriever: SemanticRetriever; generator: Generator },
  ) {}
  async answer(question: string): Promise<Answer> {
    const started = performance.now();
    let evidence = this.rag ? [] : this.corpus.retrieve(question);
    let retrievalMs = performance.now() - started;
    let claims: Answer["claims"] = [],
      embeddingTokens = 0;
    let status: Answer["status"] = "answered",
      reason = "Relevant passages found in the published support guides.",
      selected = evidence.slice(0, 2),
      engine: Answer["engine"] = "extractive",
      inputTokens = 0,
      outputTokens = 0;
    const specific =
      /\bpay_[a-z0-9_-]+|\b(my|our)\s+(bank\s+)?(balance|refund|dispute|missing funds|missing money)|\b(where|missing|lost)\b.{0,25}\b(my money|my funds)|\b(approve|cancel|delete|transfer|send)\s+(this|my|the)\s+(payment|money|funds)/i.test(
        question,
      );
    const query = tokens(question);
    const top = evidence[0];
    if (suspicious(question)) {
      status = "handoff";
      reason =
        "This request includes instructions outside the support assistant’s scope. A reviewer can help with the underlying question.";
    } else if (specific) {
      status = "handoff";
      reason =
        "This needs account-specific investigation or an action. SourceDesk cannot access live accounts or change payments.";
    } else if (
      !this.rag &&
      (!top ||
        top.coverage < 0.5 ||
        top.matches.length < Math.min(2, query.length) ||
        top.score < 1.5)
    ) {
      status = "handoff";
      reason =
        "The published guides do not contain enough evidence to answer this confidently.";
    }
    if (this.rag) {
      engine = "openai";
      if (status === "answered") {
        try {
          const retrievalStarted = performance.now();
          const result = await this.rag.retriever.retrieve(question);
          evidence = result.evidence;
          embeddingTokens = result.tokens;
          retrievalMs = performance.now() - retrievalStarted;
          if (!evidence.length) throw new Error("No indexed evidence");
          const generated = await this.rag.generator.generate(
            question,
            evidence,
          );
          inputTokens = generated.inputTokens;
          outputTokens = generated.outputTokens;
          validateGeneration(
            { supported: generated.supported, claims: generated.claims },
            evidence,
          );
          if (!generated.supported) {
            status = "handoff";
            reason =
              "The retrieved guides do not provide enough support for a GPT answer. A reviewer can investigate.";
          } else {
            claims = generated.claims;
            const ids = new Set(
              claims.flatMap((c) => c.citations.map((c) => c.id)),
            );
            selected = evidence.filter((e) => ids.has(e.id));
            reason =
              "GPT synthesized this answer from the indexed guides. Citation quotes match the sources; review them before acting.";
          }
        } catch {
          status = "handoff";
          engine = "fallback";
          reason =
            "GPT or semantic search is unavailable, the index needs rebuilding, or citation validation failed. Try again or send this question to review.";
        }
      }
    }
    if (status === "answered" && this.selector) {
      try {
        const result = await this.selector.select(question, evidence);
        inputTokens = result.inputTokens;
        outputTokens = result.outputTokens;
        engine = "openai";
        if (!result.supported) {
          status = "handoff";
          reason =
            "The model could not find sufficient support in the retrieved passages.";
        } else {
          selected = result.citationIds
            .map((id) => evidence.find((e) => e.id === id)!)
            .filter(Boolean);
          if (selected.length !== result.citationIds.length || !selected.length)
            throw new Error("Unverified citation");
        }
      } catch {
        status = "handoff";
        reason =
          "The optional model is unavailable or returned an unverifiable response. Send this question to review or try again.";
        engine = "fallback";
      }
    }
    if (status === "answered" && engine === "extractive")
      selected = evidence
        .filter((e) => e.coverage >= 0.4 && e.score >= (top?.score ?? 0) * 0.55)
        .slice(0, 2);
    return {
      id: randomUUID(),
      question,
      status,
      reason,
      passages:
        status === "answered"
          ? selected.map((e) => ({ text: e.text, citationId: e.id }))
          : [],
      evidence,
      claims,
      embeddingTokens,
      retrievalMode: this.rag ? "vector" : "lexical",
      engine,
      latencyMs: Math.round((performance.now() - started) * 100) / 100,
      retrievalMs: Math.round(retrievalMs * 100) / 100,
      corpusVersion: this.corpus.version,
      createdAt: Date.now(),
      usage: {
        inputTokens,
        outputTokens,
        estimatedCostUsd: this.rag
          ? null
          : engine === "extractive"
            ? 0
            : this.prices
              ? (inputTokens * this.prices.input +
                  outputTokens * this.prices.output) /
                1e6
              : null,
      },
      feedback: null,
      caseId: null,
    };
  }
}
