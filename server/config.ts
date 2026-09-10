import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
if (process.env.OPENAI_ENV_FILE)
  process.loadEnvFile(process.env.OPENAI_ENV_FILE);

export function ragConfig() {
  const key = process.env.OPENAI_API_KEY;
  const database = process.env.VECTOR_DATABASE_URL;
  if (!key || !database)
    throw new Error(
      "GPT mode requires OPENAI_API_KEY and VECTOR_DATABASE_URL in .env. See docs/INSTALLATION.md.",
    );
  return {
    key,
    database,
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    embeddingModel:
      process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
  };
}
