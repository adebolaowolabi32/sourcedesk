import { Store } from "./store.js";
import { Engine } from "./engine.js";
import { Corpus } from "./retrieval.js";
import { OpenAISelector } from "./model.js";
import { evaluate } from "./evaluation.js";
import { createApp } from "./app.js";
const enabled = process.env.ANSWER_MODE === "openai";
if (enabled && (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL))
  throw new Error("OpenAI mode requires OPENAI_API_KEY and OPENAI_MODEL.");
const price = (name: string) => {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0)
    throw new Error("Invalid token price");
  return value;
};
const input = price("INPUT_USD_PER_MILLION"),
  output = price("OUTPUT_USD_PER_MILLION");
const store = new Store(),
  corpus = new Corpus(),
  engine = new Engine(
    corpus,
    enabled
      ? new OpenAISelector(
          process.env.OPENAI_API_KEY!,
          process.env.OPENAI_MODEL!,
        )
      : undefined,
    input !== undefined && output !== undefined ? { input, output } : undefined,
  );
if (!store.evaluation() || store.evaluation()!.corpusVersion !== corpus.version)
  store.saveEvaluation(await evaluate(new Engine(corpus)));
const server = createApp(store, engine, { modelEnabled: enabled }).listen(
  Number(process.env.PORT ?? 3010),
  process.env.HOST ?? "127.0.0.1",
  () =>
    console.log(
      "SourceDesk listening on http://127.0.0.1:" + (process.env.PORT ?? 3010),
    ),
);
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, () =>
    server.close(() => {
      store.close();
      process.exit(0);
    }),
  );
