import "./config.js";
import { ragConfig } from "./config.js";
import { Store } from "./store.js";
import { Engine } from "./engine.js";
import { Corpus } from "./retrieval.js";
import { OpenAIGenerator } from "./generator.js";
import { OpenAIEmbedder, VectorStore } from "./vectors.js";
import { evaluate } from "./evaluation.js";
import { createApp } from "./app.js";
const mode = process.env.ANSWER_MODE || "extractive";
if (!["extractive", "rag", "openai"].includes(mode))
  throw new Error("Unknown ANSWER_MODE");
const enabled = mode !== "extractive";
const corpus = new Corpus();
const config = enabled ? ragConfig() : undefined;
const vectors = config
  ? new VectorStore(
      corpus,
      new OpenAIEmbedder(config.key, config.embeddingModel),
      config.database,
    )
  : undefined;
if (vectors) {
  try {
    await vectors.initialize();
    if (!(await vectors.status()).ready) throw new Error("Index missing");
  } catch {
    await vectors.close();
    console.error(
      "Vector database is unavailable or not indexed. Check VECTOR_DATABASE_URL and run npm run index:knowledge. See docs/INSTALLATION.md.",
    );
    process.exit(1);
  }
}
const store = new Store();
const engine = new Engine(
  corpus,
  undefined,
  undefined,
  config && vectors
    ? {
        retriever: vectors,
        generator: new OpenAIGenerator(config.key, config.model),
      }
    : undefined,
);
if (!store.evaluation() || store.evaluation()!.corpusVersion !== corpus.version)
  store.saveEvaluation(await evaluate(new Engine(corpus)));
const server = createApp(store, engine, {
  modelEnabled: enabled,
  runtime: {
    model: config?.model ?? null,
    embeddingModel: config?.embeddingModel ?? null,
    vectorDatabase: enabled ? "PostgreSQL + pgvector" : null,
  },
  readiness: vectors ? () => vectors.status() : undefined,
}).listen(
  Number(process.env.PORT ?? 3010),
  process.env.HOST ?? "127.0.0.1",
  () =>
    console.log("SourceDesk listening on port " + (process.env.PORT ?? 3010)),
);
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, () =>
    server.close(async () => {
      store.close();
      await vectors?.close();
      process.exit(0);
    }),
  );
