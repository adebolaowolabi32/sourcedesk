# Evaluation methodology

SourceDesk ships a visible, versioned suite of 40 authored synthetic questions in `evals/dataset.json`. The suite covers retrieval, paraphrases, unsupported topics, account-specific requests, and instruction overrides. It evaluates the local extractive pipeline, including scope gates, retrieval, source selection, and exact citation rendering.

## Graders

- **Answerable recall:** fraction of expected-answer cases that return an answer containing every expected document ID. It does not grade every sentence’s relevance.
- **Correct handoffs:** fraction of expected-handoff cases that return no answer passages.
- **Citation validity:** fraction of rendered passages whose source ID and exact text match retrieved evidence. This is identity/text verification, not semantic entailment or truth verification.
- **Case pass:** expected answer/handoff status and, for answers, required source inclusion.
- **Latency:** wall-clock time inside `Engine.answer`, including retrieval and selection; it excludes HTTP, browser rendering, and network latency in the default local mode. P50 uses the sorted middle sample; P95 uses the nearest-rank sample.
- **Cost:** zero API cost for the extractive pipeline. This excludes hardware/electricity and does not describe the optional model mode.

## Development record

The original run passed 38/40, retained in `baseline-evaluation.json`. A plural-role normalization gap made “What can a viewer do?” abstain. A scope pattern missed “Where are my missing funds?” and returned a general demo-boundary excerpt. Those cases prompted a normalization fix and an account-specific handoff fix; `evaluation-report.json` records the subsequent 40/40 result.

Twenty cases carry a `development` split and twenty a `holdout` split. The latter were inspected while fixing the baseline, so they are now a **fixed regression subset, not a blind independent holdout**. Do not present 40/40 as production accuracy or proof that prompt injection is solved.

## Repeat the run

```bash
npm run evaluate
```

The command writes every case outcome, expected source, selected source, reason, and measured latency to `docs/evaluation-report.json`. The UI’s Run evaluation uses the same evaluator and saves the latest ten runs in SQLite. Both always use extractive mode, even if interactive answers use an external model.

## Boundaries and next experiments

The corpus contains 12 short, original synthetic guides. Lexical scoring and a small synonym table can miss more complex paraphrases, negation, ambiguous questions, multilingual input, and compound account-specific requests. Pattern matching recognizes tested instruction overrides but is not a comprehensive security classifier. Source documents are curated local content, not arbitrary user uploads.

Exact source rendering prevents fabricated quotes and invented citation IDs; it does not prevent irrelevant or outdated passages. A source can itself be wrong. The corpus version combines the declared version with a content hash so saved answers identify their source snapshot.

For a meaningful next evaluation, collect a larger set of independently authored questions, keep a genuinely unseen split, grade semantic relevance with human review, test conflicting/outdated documents, and measure optional model selection against the same corpus. General live model quality remains **unmeasured**; a small smoke check and its usage estimate are recorded below. Adapter tests use controlled response fixtures rather than claiming live API validation.

## Explicit live smoke check

`npm run evaluate:live` builds the vector index if needed and makes paid API calls for five visible smoke cases and writes `docs/live-evaluation-report.json`. It checks status, expected source inclusion, and whether generated claims exist; provider failure fails the case and stops the run. It is a connectivity/retrieval/citation smoke check, not a human relevance or entailment evaluation. The initial live embedding attempt was blocked by `credit_balance_exhausted`. After funding, 30 passages were indexed and five cases passed. Manual review prompted a conditional-language instruction to avoid claiming live account knowledge; the second run passed all five cases too. Both reports are retained, and combined usage estimates total $0.00838958. This small visible smoke suite is not a general quality score. The serial runner reserves conservative costs against a persistent $0.50 budget, including indexing and retries.
