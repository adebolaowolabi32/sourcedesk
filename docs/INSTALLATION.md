# Install SourceDesk

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

Set variables in the same terminal that starts the app. The scripts do not automatically load a `.env` file. On Windows PowerShell, use `$env:NAME = 'value'` instead of `export NAME='value'`.

| Variable                 | Default / effect                                                       |
| ------------------------ | ---------------------------------------------------------------------- |
| `PORT`                   | API listener, default 3010                                             |
| `HOST`                   | Bind address, default 127.0.0.1                                        |
| `DB_PATH`                | SQLite path, default `data/sourcedesk.db`                              |
| `ANSWER_MODE`            | `extractive` by default; `openai` explicitly enables model requests    |
| `OPENAI_API_KEY`         | Server-side key, required only in OpenAI mode                          |
| `OPENAI_MODEL`           | Explicit Responses/structured-output model ID, required in OpenAI mode |
| `INPUT_USD_PER_MILLION`  | Optional manually verified input-token price                           |
| `OUTPUT_USD_PER_MILLION` | Optional manually verified output-token price                          |
| `NODE_ENV`               | `production` enables Secure cookies; use HTTPS in that mode            |

If you change the development API port, update the Vite proxy in `vite.config.ts` to match. Never put an API key in a `VITE_` variable or frontend file. The app sends the entered question and retrieved passages to OpenAI only when `ANSWER_MODE=openai` is enabled. No API request is made by the default mode or evaluation dashboard.

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

| Problem                                | Check                                                                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Cannot import `node:sqlite`            | Upgrade to a supported Node version. The experimental SQLite warning on Node 22 is informational.                                              |
| Browser cannot reach a VM              | Run SSH forwarding on the laptop and open the laptop’s forwarded localhost port.                                                               |
| Port already in use                    | Stop the previous SourceDesk process or choose a free port and adjust the proxy.                                                               |
| Model mode refuses to start            | Both `OPENAI_API_KEY` and `OPENAI_MODEL` must be present. Use the default mode to explore without them.                                        |
| Model request creates a review handoff | The provider timed out, refused, returned incomplete output, or selected invalid citations. The app deliberately avoids rendering that output. |
| Past questions disappeared             | Sessions belong to one browser cookie and expire after seven days; clearing cookies creates a new sandbox.                                     |
| No handoff email arrives               | Review cases are local workflow records. The demo does not send external messages.                                                             |

Press Ctrl+C to stop. Restart with the same `DB_PATH` to keep saved sessions/questions. For a file backup, stop the app before copying the SQLite database; copying the main file while a WAL database is running can omit recent writes. Store backups securely if you enter anything beyond synthetic demo data.
