import pg from "pg";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Corpus } from "./retrieval.js";
import type { Evidence } from "./types.js";
import { providerError } from "./provider-error.js";

export interface Embedder {
  model: string;
  dimensions: number;
  embed(texts: string[]): Promise<{ vectors: number[][]; tokens: number }>;
}
export class OpenAIEmbedder implements Embedder {
  readonly dimensions = 1536;
  constructor(
    private key: string,
    public model = "text-embedding-3-small",
    private request: typeof fetch = fetch,
  ) {}
  async embed(texts: string[]) {
    const response = await this.request(
      "https://api.openai.com/v1/embeddings",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + this.key,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          model: this.model,
          input: texts,
          dimensions: this.dimensions,
          encoding_format: "float",
        }),
      },
    );
    if (!response.ok) throw await providerError(response);
    const value = z
      .object({
        data: z
          .array(
            z.object({
              index: z.number().int().nonnegative(),
              embedding: z.array(z.number().finite()).length(this.dimensions),
            }),
          )
          .length(texts.length),
        usage: z.object({ total_tokens: z.number().int().nonnegative() }),
      })
      .parse(await response.json());
    const ordered = value.data.sort((a, b) => a.index - b.index);
    if (
      ordered.some(
        (row, index) =>
          row.index !== index || !row.embedding.some((n) => n !== 0),
      )
    )
      throw new Error("Invalid embedding indices or zero vector");
    return {
      vectors: ordered.map((row) => row.embedding),
      tokens: value.usage.total_tokens,
    };
  }
}
export interface SemanticRetriever {
  retrieve(question: string): Promise<{ evidence: Evidence[]; tokens: number }>;
}

/** Each index is bound to both content and embedding configuration; old versions never answer new questions. */
export class VectorStore implements SemanticRetriever {
  private pool: pg.Pool;
  readonly generation: string;
  constructor(
    private corpus: Corpus,
    private embedder: Embedder,
    database: string,
    private schema = "sourcedesk_vectors",
  ) {
    if (!/^[a-z][a-z0-9_]{0,50}$/.test(schema))
      throw new Error("Invalid vector schema");
    if (
      !Number.isInteger(embedder.dimensions) ||
      embedder.dimensions < 1 ||
      embedder.dimensions > 2000
    )
      throw new Error("Invalid vector dimensions");
    this.pool = new pg.Pool({
      connectionString: database,
      max: 4,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
    });
    this.pool.on("error", () =>
      console.error("Vector database connection interrupted"),
    );
    this.generation = createHash("sha256")
      .update(
        JSON.stringify([corpus.version, embedder.model, embedder.dimensions]),
      )
      .digest("hex");
  }
  async initialize() {
    await this.pool.query("CREATE EXTENSION IF NOT EXISTS vector");
    await this.pool.query(`CREATE SCHEMA IF NOT EXISTS ${this.schema}`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS ${this.schema}.chunks (
      generation text NOT NULL, id text NOT NULL, embedding vector(${this.embedder.dimensions}) NOT NULL,
      PRIMARY KEY (generation, id))`);
    // Exact cosine search is intentional for a small support corpus; no approximate index recall loss.
  }
  async status() {
    const { rows } = await this.pool.query(
      `SELECT count(*)::int AS count FROM ${this.schema}.chunks WHERE generation = $1`,
      [this.generation],
    );
    const expected = this.corpus.chunks.filter((c) => !c.quarantined).length;
    return {
      ready: expected > 0 && rows[0].count === expected,
      indexedChunks: rows[0].count as number,
      expectedChunks: expected,
      embeddingModel: this.embedder.model,
      dimensions: this.embedder.dimensions,
      corpusVersion: this.corpus.version,
    };
  }
  async index() {
    if ((await this.status()).ready)
      return { ...(await this.status()), tokens: 0, reused: true };
    const chunks = this.corpus.chunks.filter((c) => !c.quarantined);
    const vectors: number[][] = [];
    let tokens = 0;
    for (let start = 0; start < chunks.length; start += 32) {
      const batch = await this.embedder.embed(
        chunks
          .slice(start, start + 32)
          .map((c) => `${c.title}\n${c.heading}\n${c.text}`),
      );
      if (batch.vectors.length !== Math.min(32, chunks.length - start))
        throw new Error("Embedding batch incomplete");
      batch.vectors.forEach((v) => this.vector(v));
      vectors.push(...batch.vectors);
      tokens += batch.tokens;
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        this.schema + this.generation,
      ]);
      await client.query(
        `DELETE FROM ${this.schema}.chunks WHERE generation = $1`,
        [this.generation],
      );
      for (let i = 0; i < chunks.length; i++)
        await client.query(
          `INSERT INTO ${this.schema}.chunks (generation, id, embedding) VALUES ($1, $2, $3::vector)`,
          [this.generation, chunks[i].id, this.vector(vectors[i])],
        );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return { ...(await this.status()), tokens, reused: false };
  }
  async retrieve(question: string) {
    if (!(await this.status()).ready)
      throw new Error("Vector index needs rebuilding");
    const { vectors, tokens } = await this.embedder.embed([question]);
    const { rows } = await this.pool.query(
      `SELECT id, 1 - (embedding <=> $2::vector) AS similarity
      FROM ${this.schema}.chunks WHERE generation = $1 ORDER BY embedding <=> $2::vector, id LIMIT 6`,
      [this.generation, this.vector(vectors[0])],
    );
    const evidence = rows.flatMap((row) => {
      const chunk = this.corpus.chunks.find(
        (c) => c.id === row.id && !c.quarantined,
      );
      return chunk
        ? [
            {
              ...chunk,
              score: Number(row.similarity),
              coverage: 0,
              matches: [],
              retrieval: "vector" as const,
            },
          ]
        : [];
    });
    return { evidence, tokens };
  }
  private vector(value: number[]) {
    if (
      !Array.isArray(value) ||
      value.length !== this.embedder.dimensions ||
      value.some((n) => !Number.isFinite(n)) ||
      !value.some((n) => n !== 0)
    )
      throw new Error("Invalid embedding vector");
    return JSON.stringify(value);
  }
  close() {
    return this.pool.end();
  }
}
