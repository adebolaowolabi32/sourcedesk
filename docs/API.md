# API

All endpoints return JSON. Errors use `{error}` with an `X-Request-Id` response header. Mutations require `X-Requested-With: SourceDesk` and reject browser requests marked `Sec-Fetch-Site: cross-site`.

A browser receives a private, seven-day HttpOnly session cookie on its first API call. The server stores a hash and scopes all questions/cases to that session. This is demo isolation, not a login/account system.

| Method | Path                        | Purpose                                                                      |
| ------ | --------------------------- | ---------------------------------------------------------------------------- |
| GET    | `/api/health`               | Process liveness                                                             |
| GET    | `/api/bootstrap`            | Mode, corpus version, counts, first history page, cases, evaluation          |
| GET    | `/api/documents`            | Published synthetic guides and sections                                      |
| POST   | `/api/ask`                  | `{question}` → answer/handoff with evidence, source passages, timings, usage |
| GET    | `/api/history?cursor=...`   | Twenty questions per page, `{items,nextCursor}`                              |
| GET    | `/api/answers/:id`          | Session-owned question and saved evidence                                    |
| POST   | `/api/answers/:id/feedback` | `{value:"helpful"                                                            | "unhelpful"}` |
| POST   | `/api/answers/:id/handoff`  | `{note}` → idempotent review case with original question/evidence            |
| GET    | `/api/cases`                | Latest 100 session-owned review cases                                        |
| POST   | `/api/cases/:id/resolve`    | `{version,resolution}` → records reviewer note and increments version        |
| GET    | `/api/evaluations`          | Latest local baseline report                                                 |
| POST   | `/api/evaluations`          | `{}` → new local extractive evaluation; never calls a model                  |

Questions are 3–1,200 trimmed characters, handoff notes at most 1,000, and resolutions 10–2,000. Requests have a 12 KB JSON limit. Ask requests are limited per session and source IP; new session issuance and evaluation runs are also bounded. At most four answers run concurrently in one server process.

An answer has `status: answered|handoff`, `engine: extractive|openai|fallback`, `passages: [{text,citationId}]`, `evidence`, `corpusVersion`, `retrievalMs`, `latencyMs`, usage, feedback, and an optional case ID. Handed-off answers have no answer passages. Evidence consists of candidate passages, which may be relevant context without fully answering the question.

Provider failures, refusals, incomplete output, and invalid citation IDs produce a handoff. The browser does not receive provider keys or raw provider error bodies. Raw retrieval scores are relevance scores, not probabilities. Usage costs are zero for extraction, optionally estimated from configured model token prices, and otherwise null.

Repeated handoff creation returns the existing case. Already-resolved cases or stale versions return 409. Foreign-session or unknown answer/case IDs return 404. All state is synthetic; no route acts on a LedgerDesk payment or sends an external message.
