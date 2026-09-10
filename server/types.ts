export type SourceDocument = {
  id: string;
  title: string;
  category: string;
  version: string;
  updatedAt: string;
  file: string;
  sections: { id: string; heading: string; text: string }[];
};
export type Chunk = {
  id: string;
  documentId: string;
  title: string;
  heading: string;
  text: string;
  version: string;
  category: string;
  quarantined: boolean;
};
export type Evidence = Chunk & {
  score: number;
  coverage: number;
  matches: string[];
};
export type Answer = {
  id: string;
  question: string;
  status: "answered" | "handoff";
  reason: string;
  passages: { text: string; citationId: string }[];
  evidence: Evidence[];
  engine: "extractive" | "openai" | "fallback";
  latencyMs: number;
  retrievalMs: number;
  corpusVersion: string;
  createdAt: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number | null;
  };
  feedback: "helpful" | "unhelpful" | null;
  caseId: string | null;
};
export type ReviewCase = {
  id: string;
  answerId: string;
  question: string;
  reason: string;
  note: string;
  resolution: string;
  status: "open" | "resolved";
  version: number;
  createdAt: number;
  updatedAt: number;
};
export type EvalCase = {
  id: string;
  category: string;
  question: string;
  expected: "answered" | "handoff";
  expectedSources: string[];
  split: "development" | "holdout";
};
export type EvalResult = {
  id: string;
  datasetVersion: string;
  corpusVersion: string;
  engine: string;
  createdAt: number;
  total: number;
  passed: number;
  answerableRecall: number;
  abstentionAccuracy: number;
  citationValidity: number;
  latencyP50: number;
  latencyP95: number;
  apiCostUsd: number;
  results: (EvalCase & {
    actual: string;
    sources: string[];
    passed: boolean;
    latencyMs: number;
    reason: string;
  })[];
};
