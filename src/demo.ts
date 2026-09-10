import fixtures from "./demo-fixtures.json";
import type { Answer, ReviewCase } from "../server/types";
const storageKey = "sourcedesk-portfolio-v1";
type State = { answers: Answer[]; cases: ReviewCase[] };
let state: State = { answers: [], cases: [] };
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
  if (saved && Array.isArray(saved.answers) && Array.isArray(saved.cases))
    state = saved;
} catch {
  /* A restricted browser still gets an in-memory preview. */
}
const persist = () => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    /* Memory-only session. */
  }
};
const normalized = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const history = (offset = 0) => ({
  items: state.answers.slice(offset, offset + 20),
  nextCursor: offset + 20 < state.answers.length ? String(offset + 20) : null,
});
export function demoApi(path: string, body?: unknown): unknown {
  const input = body as Record<string, unknown> | undefined;
  const url = new URL(path, "https://preview.invalid");
  let result: unknown;
  if (path === "/bootstrap")
    result = {
      mode: "portfolio",
      corpusVersion: fixtures.corpusVersion,
      documentCount: fixtures.documents.length,
      chunkCount: fixtures.documents.reduce((n, d) => n + d.sections.length, 0),
      history: history(),
      cases: state.cases,
      evaluation: fixtures.evaluation,
    };
  else if (path === "/documents") result = fixtures.documents;
  else if (path === "/evaluations") result = fixtures.evaluation;
  else if (url.pathname === "/history")
    result = history(Number(url.searchParams.get("cursor")) || 0);
  else if (path === "/demo/reset") {
    state = { answers: [], cases: [] };
    result = {};
  } else if (path === "/ask") {
    const question = String(input?.question || "").trim();
    if (question.length < 3 || question.length > 1200)
      throw new Error("Use a question between 3 and 1,200 characters.");
    const recorded = fixtures.answers.find(
      (a) => normalized(a.question) === normalized(question),
    );
    const answer: Answer = recorded
      ? (structuredClone(recorded) as Answer)
      : {
          question,
          id: "",
          status: "handoff",
          claims: [],
          passages: [],
          evidence: [],
          reason:
            "This portfolio preview has no recorded answer for this question. Try a suggested question, or explore the simulated review workflow.",
          engine: "extractive",
          latencyMs: 0,
          retrievalMs: 0,
          corpusVersion: fixtures.corpusVersion,
          createdAt: 0,
          usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
          feedback: null,
          caseId: null,
        };
    Object.assign(answer, {
      id: crypto.randomUUID(),
      question,
      createdAt: Date.now(),
      feedback: null,
      caseId: null,
    });
    if (recorded)
      answer.reason =
        "Recorded sample answer from the tested implementation. No model is running in this preview.";
    state.answers.unshift(answer);
    // Bound local demo history and remove associated cases when old answers expire.
    state.answers = state.answers.slice(0, 100);
    state.cases = state.cases.filter((c) =>
      state.answers.some((a) => a.id === c.answerId),
    );
    result = answer;
  } else if (url.pathname.startsWith("/answers/")) {
    const [, , id, action] = url.pathname.split("/");
    const answer = state.answers.find((a) => a.id === id);
    if (!answer)
      throw new Error("This sample is no longer in your browser history.");
    if (action === "feedback") {
      if (!["helpful", "unhelpful"].includes(String(input?.value)))
        throw new Error("Choose a feedback option.");
      answer.feedback = input!.value as Answer["feedback"];
      result = answer;
    } else if (action === "handoff") {
      let review = state.cases.find((c) => c.answerId === id);
      if (!review) {
        review = {
          id: crypto.randomUUID(),
          answerId: id,
          question: answer.question,
          reason: answer.reason,
          note: String(input?.note || "").slice(0, 1000),
          resolution: "",
          status: "open",
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        state.cases.unshift(review);
        answer.caseId = review.id;
      }
      result = review;
    } else result = answer;
  } else if (url.pathname.startsWith("/cases/")) {
    const id = url.pathname.split("/")[2];
    const review = state.cases.find((c) => c.id === id);
    if (!review) throw new Error("Demo case not found.");
    if (review.status !== "open" || review.version !== input?.version)
      throw new Error("This case has changed. Refresh and try again.");
    const resolution = String(input?.resolution || "").trim();
    if (resolution.length < 10 || resolution.length > 2000)
      throw new Error("Use a resolution between 10 and 2,000 characters.");
    Object.assign(review, {
      resolution,
      status: "resolved",
      version: review.version + 1,
      updatedAt: Date.now(),
    });
    result = review;
  } else if (path === "/cases") result = state.cases;
  else
    throw new Error("This action is not available in the portfolio preview.");
  if (body !== undefined) persist();
  return structuredClone(result);
}
