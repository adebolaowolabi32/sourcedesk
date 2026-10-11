# Evaluation methodology

SourceDesk ships a visible, versioned suite of 40 authored synthetic questions in `evals/dataset.json`. The suite covers retrieval, paraphrases, unsupported topics, account-specific requests, and instruction overrides. It evaluates the local extractive pipeline, including scope gates, retrieval, source selection, and exact citation rendering.

## Graders

- **Answerable recall:** fraction of expected-answer cases that return an answer containing every expected document ID. Sentence-level relevance requires separate review.
- **Correct handoffs:** fraction of expected-handoff cases that return an empty passages array.
- **Citation validity:** fraction of rendered passages whose source ID and exact text match retrieved evidence. This checks source identity and exact text. Semantic support and factual accuracy require separate review.
- **Case pass:** expected answer/handoff status and, for answers, required source inclusion.
- **Latency:** wall-clock time inside `Engine.answer`, including retrieval and selection; it excludes HTTP, browser rendering, and network latency in the default local mode. P50 uses the sorted middle sample; P95 uses the nearest-rank sample.
- **Cost:** zero API cost for the extractive pipeline. Hardware, electricity and optional model usage are accounted for separately.

## Development record

The original run passed 38/40, retained in `baseline-evaluation.json`. A plural-role normalization gap made “What can a viewer do?” abstain. A scope pattern missed “Where are my missing funds?” and returned a general demo-boundary excerpt. Those cases prompted a normalization fix and an account-specific handoff fix; `evaluation-report.json` records the subsequent 40/40 result.

Twenty cases carry a `development` split and twenty a `holdout` split. The latter were inspected while fixing the baseline, so they are now a **fixed regression subset**. The 40/40 result records performance on these development cases; production accuracy and broader injection resistance require independent evaluation.

## Repeat the run

```bash
npm run evaluate
```

The command writes every case outcome, expected source, selected source, reason, and measured latency to `docs/evaluation-report.json`. The UI’s Run evaluation uses the same evaluator and saves the latest ten runs in SQLite. Both always use extractive mode, even if interactive answers use an external model.

## Boundaries and next experiments

The corpus contains 12 short, original synthetic guides. Lexical scoring and a small synonym table can miss more complex paraphrases, negation, ambiguous questions, multilingual input, and compound account-specific requests. Pattern matching recognizes the tested instruction overrides. Broader security coverage requires further evaluation. Source documents come from the curated local corpus.

Exact source rendering preserves quotes and citation IDs. Relevance, freshness and factual accuracy still require review. The corpus version combines the declared version with a content hash so saved answers identify their source snapshot.

For a meaningful next evaluation, collect a larger set of independently authored questions, keep a genuinely unseen split, grade semantic relevance with human review, test conflicting/outdated documents, and measure optional model selection against the same corpus. General live model quality remains **unmeasured**; a small smoke check and its usage estimate are recorded below. Adapter tests use controlled response fixtures.

## Explicit live smoke check

`npm run evaluate:live` builds the vector index if needed and makes paid API calls for five visible smoke cases and writes `docs/live-evaluation-report.json`. It checks status, expected source inclusion, and whether generated claims exist; provider failure fails the case and stops the run. The checks cover connectivity, retrieval and citations. Human evaluation of relevance and source support remains outstanding. The initial live embedding attempt was blocked by `credit_balance_exhausted`. After funding, 30 passages were indexed and five cases passed. Manual review prompted a conditional-language instruction to avoid claiming live account knowledge; the second run passed all five cases too. Both reports are retained. See the live-test instructions below for request limits and cost estimates.

## Running live tests

`npm run evaluate:live` stores its request budget in `data/live-test-budget.json`. Run only one live test runner at a time and keep the ledger between retries. It permits only the two priced models, limits output, and reserves a doubled byte-based input bound before each request. Failed requests keep their reservation. The $0.50 limit applies to this serial test runner, including its indexing and retries; interactive app usage and standalone indexing need separate spending limits.

Combined indexing and the two recorded live runs used approximately $0.00839 at the standard token rates checked for those runs, ignoring caching discounts. The estimate is calculated from recorded token usage. Provider token usage is recorded, while interactive RAG dollar cost remains `null`; the live report records its own estimates and budget reservations.
