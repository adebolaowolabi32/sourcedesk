# Install SourceDesk

## Browser-only portfolio preview

Use [the GitHub Pages demo](https://adebolaowolabi32.github.io/sourcedesk/) with no installation. It shows recorded sample answers and simulated workflows, keeps state in your browser, and makes no API calls. Use **Reset demo** to clear your preview history.

To run the same preview locally, use `npm ci`, `npm run build:portfolio`, then `npm run preview:portfolio`. Open http://127.0.0.1:4173/sourcedesk/. The rest of this guide describes the optional full implementation for code review and local development.

## Prerequisites

- Git.
- Node.js 22.13 or later in the 22.x line, or 24+.
- npm, included with Node.

The default mode uses local lexical retrieval and source extraction. It needs no model key, Docker, or hosted database.

## Development setup

```bash
git clone https://github.com/adebolaowolabi32/sourcedesk.git
cd sourcedesk
node --version
npm ci
npm run dev
```

Open http://127.0.0.1:5175. The API uses port 3010; Vite forwards `/api` requests there. The app creates `data/sourcedesk.db` on first start and runs the local evaluation baseline. A private demo session is created automatically for each browser; there is no shared login password.

On a remote VM, keep the application running and forward the frontend from your laptop:

```bash
ssh -L 5175:127.0.0.1:5175 YOUR_USER@YOUR_VM_ADDRESS
```

Open http://127.0.0.1:5175 on the laptop. If that local port is busy, use `-L 5176:127.0.0.1:5175` and browse localhost:5176. No public database port is required.

## Compiled application

```bash
npm run build
npm start
```

Open http://127.0.0.1:3010. For VM access, forward port 3010 using the same SSH pattern. `npm start` serves the built frontend and API from one process.

## Configuration

The server loads `.env` automatically; already-exported environment variables take precedence. `OPENAI_ENV_FILE` optionally loads a separate server-only env file for a securely provisioned key. Keep that file ignored by Git. Never put keys in a `VITE_` variable or frontend file.

| Variable                 | Default / effect                                                 |
| ------------------------ | ---------------------------------------------------------------- |
| `PORT`                   | API port, 3010                                                   |
| `HOST`                   | Bind address, 127.0.0.1                                          |
| `DB_PATH`                | SQLite session/history file, `data/sourcedesk.db`                |
| `ANSWER_MODE`            | `extractive`; `rag` or `openai` enables GPT and vector retrieval |
| `OPENAI_API_KEY`         | Server-only credential, required for RAG                         |
| `OPENAI_ENV_FILE`        | Optional ignored env-file path containing the key                |
| `OPENAI_MODEL`           | `gpt-5.4-mini`                                                   |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small`, requested at 1,536 dimensions          |
| `VECTOR_DATABASE_URL`    | Required PostgreSQL connection URL in RAG mode                   |
| `NODE_ENV`               | `production` enables Secure cookies; requires HTTPS              |

If the API port changes, update the Vite proxy to match. The default offline mode and dashboard evaluations make no API calls.

## GPT and vector search

1. Start PostgreSQL with pgvector: `docker compose up -d --wait`. The supplied Compose service binds only to localhost:55433, stores data in a named volume, and uses local-demo credentials. An existing PostgreSQL instance with pgvector also works; provide a dedicated database and a role able to initialize the extension/schema.
2. Copy `.env.example` to ignored `.env`, configure `VECTOR_DATABASE_URL`, and provision an OpenAI API key securely. A separately provisioned env file can be loaded through `OPENAI_ENV_FILE`; keep it ignored by Git. Do not paste a key into documentation or source files. Set `ANSWER_MODE=rag`.
3. Run `npm run index:knowledge`. This sends the synthetic guides to OpenAI and stores their vectors in PostgreSQL. Check the printed `ready: true` status.
4. Run `npm run dev`, or build and run `npm start`. `/api/ready` returns 200 only when the expected vector generation is complete.
5. Run `npm run evaluate:live` for an explicit paid smoke check of paraphrase retrieval, cited generation, unsupported questions, and account handoff. Its report is separate from the offline baseline.

Indexing and answering incur API usage. A ChatGPT subscription does not provide API credits. If a request returns `credit_balance_exhausted`, fund [API billing](https://platform.openai.com/settings/organization/billing) before retrying. The configured starter answer model is `gpt-5.4-mini`.

The corpus hash and embedding model determine the index generation. Repeat indexing reuses a complete matching generation. After changing guides or models, re-index and restart. Keep old generations until no process uses them; no automatic destructive cleanup is performed. Back up PostgreSQL as well as SQLite if retaining the RAG index is important. `docker compose down` keeps the named volume; deleting the volume removes the index.

## Verify

```bash
curl http://127.0.0.1:3010/api/health
npm test
npm run build
npm run evaluate
```

Expect `{"status":"ok"}` from health. To exercise the UI:

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

The browser tests use port 3011 and an in-memory database, preserving your saved local questions. Results, screenshots, and failure traces are written to `docs/` and `test-results/`.

## Troubleshooting

| Problem                                | Check                                                                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cannot import `node:sqlite`            | Upgrade to a supported Node version. The experimental SQLite warning on Node 22 is informational.                                                    |
| Browser cannot reach a VM              | Run SSH forwarding on the laptop and open the laptop’s forwarded localhost port.                                                                     |
| Port already in use                    | Stop the previous SourceDesk process or choose a free port and adjust the proxy.                                                                     |
| Model mode refuses to start            | Check the key, `VECTOR_DATABASE_URL`, pgvector installation, and a complete index.                                                                   |
| Model request creates a review handoff | The provider timed out, refused, returned incomplete output, or returned invalid citation quotes. The app deliberately avoids rendering that output. |
| Past questions disappeared             | Sessions belong to one browser cookie and expire after seven days; clearing cookies creates a new sandbox.                                           |
| No handoff email arrives               | Review cases are local workflow records. The demo does not send external messages.                                                                   |

Press Ctrl+C to stop. Restart with the same `DB_PATH` to keep saved sessions/questions. For a file backup, stop the app before copying the SQLite database; copying the main file while a WAL database is running can omit recent writes. Store backups securely if you enter anything beyond synthetic demo data.

For local database integration tests, set `TEST_VECTOR_DATABASE_URL` to a disposable PostgreSQL database with pgvector and run `npm test`. Without it, the vector integration test is explicitly skipped; CI provisions pgvector and requires this variable. Tests use temporary schemas and delete only their own fixtures. No live API key is needed for backend or browser tests.

The live smoke runner now indexes automatically if needed and enforces a persistent $0.50 conservative budget across serial reruns. Its ledger is `data/live-test-budget.json`; do not reset it without a new spending authorization. Only the priced default models are accepted. Interactive app requests and standalone `index:knowledge` are outside that runner budget.
