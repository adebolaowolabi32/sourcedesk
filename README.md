# SourceDesk

Ask a question about payments and read the guide behind the answer.

I built SourceDesk around 12 fictional payment guides. It retrieves relevant passages and can use GPT to write an answer with quotes you can check. If a question needs account data or the guides don’t cover it, the app sends it to review. The payment scenarios relate to [LedgerDesk](https://github.com/adebolaowolabi32/payment-operations-console).

![SourceDesk portfolio preview](docs/portfolio-desktop.png)

## Try the portfolio preview

**[Open the interactive demo](https://adebolaowolabi32.github.io/sourcedesk/)** · [Browse the implementation](https://github.com/adebolaowolabi32/sourcedesk)

The GitHub Pages preview runs entirely in your browser: try suggested questions, inspect recorded answers and citations, give feedback, and simulate a review case. Examples use synthetic data. The evaluation screen displays a saved regression report. Preview history is stored only in this browser and can be cleared with **Reset demo**. It does not call OpenAI or connect to a backend/database.

To try live generation, run the backend locally with GPT and pgvector. The repository includes setup instructions and saved results from a small live test. The public site uses recorded answers.

## Install and run

Node.js 22.13+ (22.x) or 24+ and npm are the only runtime prerequisites. No API key, Docker, or external database is needed for the default demo.

```bash
git clone https://github.com/adebolaowolabi32/sourcedesk.git
cd sourcedesk
npm ci
npm run dev
```

Open **http://127.0.0.1:5175**. The API runs on localhost:3010, and SQLite stores your sandbox in `data/sourcedesk.db`. For a remote VM, run this from your laptop:

```bash
ssh -L 5175:127.0.0.1:5175 YOUR_USER@YOUR_VM_ADDRESS
```

Then open localhost:5175 on your laptop. The frontend proxies API traffic, so only the frontend port needs forwarding.

See the [installation guide](docs/INSTALLATION.md) for the compiled app, configuration, checks, troubleshooting, and optional model setup.

## Try it

- **Assistant:** ask “Why is my payment still confirming?” Open a citation to inspect the exact source passage. Save feedback or return to the question later.
- **Knowledge:** browse 12 synthetic guides covering payments, recovery, access, controls, operations, and local setup.
- **Handoffs:** ask “What is my bank balance?” The assistant cannot access live accounts. Create a case with context, inspect its evidence, and record a resolution note.
- **Evaluations:** run the 40-case regression suite and inspect every outcome, including unsupported questions and injection attempts.

Each browser gets its own seven-day session. Questions, feedback, and review notes persist on disk and are scoped to that session. This is a local support-team simulation: handoffs do not email anyone, change LedgerDesk payments, or access bank data.

## How answers work

The default engine performs BM25-style lexical retrieval with explicit normalization/synonyms over section-sized passages. A coverage/score gate abstains when evidence is weak. Account-specific requests and recognized instruction overrides take the handoff path. Accepted answers display **exact source passages** with server-verified document/section IDs.

Optional **GPT + pgvector mode** embeds the guides and question with OpenAI, retrieves the six closest passages from PostgreSQL, and uses the Responses API to synthesize a concise explanation. Each claim includes source IDs and exact supporting quotes checked against retrieved text. Invalid quotes, unavailable dependencies, refusals, and unsupported answers become review handoffs. There are no payment-changing tools or secrets in model context.

Exact quote validation establishes citation provenance; it does not prove that a model-written claim is entailed by the quote. Review sources before acting. The local corpus and request gates reduce tested failure cases but are not universal prompt-injection defenses.

## Measured results

The initial authored regression run passed **38/40 cases**. It exposed a missing plural-role synonym and an account-specific missing-funds question that needed handoff. Both fixes are documented; the current saved run passes **40/40**:

| Metric                                                           | Saved local result         |
| ---------------------------------------------------------------- | -------------------------- |
| Expected-source recall on answerable cases                       | 26/26                      |
| Correct handoffs on unsupported/account-specific/injection cases | 14/14                      |
| Citation identity and exact-text validity                        | 100% of rendered citations |
| API cost, default extractive run                                 | $0                         |

These are development regression results from 40 questions used while building the app, including the subset originally called “holdout.” They do not measure performance on unseen questions. The [evaluation guide](docs/EVALUATION.md) explains the graders and remaining gaps, with links to the [original baseline](docs/baseline-evaluation.json) and [current report](docs/evaluation-report.json).

![Source-backed answer](docs/answer.png)

## GPT and vector search

See [installation](docs/INSTALLATION.md#gpt-and-vector-search) for secure key configuration and PostgreSQL setup. A key alone does not enable requests.

```bash
docker compose up -d --wait
# Configure the ignored .env as described in the installation guide.
npm run index:knowledge
npm run dev
```

`ANSWER_MODE=rag` enables semantic retrieval and generated answers; `openai` is an alias. Defaults are `gpt-5.4-mini` and `text-embedding-3-small` with 1,536 dimensions. Indexing sends the synthetic guides to OpenAI; answering sends the question for embedding, then the question and up to six passages for generation. Responses use `store:false`, following [OpenAI structured-output documentation](https://developers.openai.com/api/docs/guides/structured-outputs). PostgreSQL stores embeddings; SQLite retains browser sessions, answers, and review cases.

Index generations include the corpus content hash and embedding configuration. Re-indexing an unchanged corpus makes no embedding calls. Failed indexing publishes no partial generation. Rebuild after changing guides or embedding model, then restart the app. Startup and `/api/ready` check index completeness.

Live indexing stored **30 passages**, and five integration checks passed. Reviewing the first run caught wording that implied knowledge of a specific payment. I changed the prompt to describe the documentation conditionally and reran the checks. Both [initial](docs/live-evaluation-initial.json) and [final](docs/live-evaluation-report.json) reports are retained.

The dashboard and `npm run evaluate` test the offline pipeline. `npm run evaluate:live` makes paid API calls and has a persistent $0.50 test budget; that limit does not cover normal app usage or standalone indexing. Read the [live-test instructions](docs/EVALUATION.md#running-live-tests) before running it.

## Validate

```bash
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm run evaluate
npm run format:check
```

Backend tests cover exact citations, abstention, quarantined instruction-bearing passages, model response validation, session isolation, persistence, history pagination, handoff idempotency, optimistic case resolution, and HTTP protections. Browser checks cover answers/citations/feedback, review cases, guide search, evaluation controls, desktop/mobile layouts, and error recovery. CI repeats the checks and saves screenshots and traces.

## Project map

| Path                     | Responsibility                                                 |
| ------------------------ | -------------------------------------------------------------- |
| `knowledge/catalog.json` | Original synthetic corpus, section IDs, and versions           |
| `knowledge/*.md`         | Human-readable copies checked against the catalog              |
| `server/retrieval.ts`    | Normalization, BM25 scoring, passage quarantine                |
| `server/engine.ts`       | Support scope, evidence gate, answer selection                 |
| `server/generator.ts`    | Structured GPT claims and quote validation                     |
| `server/vectors.ts`      | OpenAI embeddings and versioned pgvector retrieval             |
| `server/model.ts`        | Legacy evidence-selector adapter retained for compatibility    |
| `server/store.ts`        | Browser sessions, durable answers/cases, rate limits           |
| `evals/dataset.json`     | Versioned authored regression questions                        |
| `server/evaluation.ts`   | Reproducible graders and measured latency                      |
| `src/`                   | Responsive assistant, source library, reviews, and evaluations |

- [Architecture and boundaries](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [Evaluation methodology](docs/EVALUATION.md)
- [Installation](docs/INSTALLATION.md)

Before using this with a support team, I would add sign-in and reviewer assignment. Answer quality also needs testing on questions written by someone who has not seen the implementation. All support data in this repository is fictional.

## Publish the static preview

```bash
npm ci
npm run build:portfolio
npm run preview:portfolio
```

Open http://127.0.0.1:4173/sourcedesk/. `npm run test:portfolio` exercises the static artifact, including citations, saved feedback, simulated cases, saved evaluation, mobile layout, and no backend API requests. The Pages workflow builds and tests this same artifact before deployment. Only `dist/` is uploaded; server files, databases, and local credentials are excluded.

The preview uses checked-in synthetic fixtures in `src/demo-fixtures.json`. To refresh them after intentionally updating the corpus or saved reports, run `node --import=tsx scripts/demo-fixtures.ts` and format/review the resulting file. This generator uses the offline engine and the existing live report; it makes no API calls.

## Author

Built by [Cynthia Owolabi](https://github.com/adebolaowolabi32).

[Portfolio and experience](https://adebolaowolabi32.github.io/) · [Current CVs](https://adebolaowolabi32.github.io/resume.html)
