import { ragConfig } from "./config.js";
import { Corpus } from "./retrieval.js";
import { OpenAIEmbedder, VectorStore } from "./vectors.js";
import { ProviderError } from "./provider-error.js";
const config = ragConfig();
const store = new VectorStore(
  new Corpus(),
  new OpenAIEmbedder(config.key, config.embeddingModel),
  config.database,
);
try {
  await store.initialize();
  console.log(JSON.stringify(await store.index(), null, 2));
} catch (error) {
  if (error instanceof ProviderError) console.error(error.message);
  console.error(
    "Indexing failed. Check the database URL, pgvector extension, OpenAI credentials and model access. No partial index was published.",
  );
  process.exitCode = 1;
} finally {
  await store.close();
}
