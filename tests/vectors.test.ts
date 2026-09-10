import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { Corpus } from "../server/retrieval.js";
import { VectorStore, type Embedder } from "../server/vectors.js";
const database = process.env.TEST_VECTOR_DATABASE_URL;
if (process.env.CI && !database)
  throw new Error("CI requires TEST_VECTOR_DATABASE_URL");
test(
  "real pgvector persists cosine retrieval, isolates generations, skips re-embedding and refuses stale/partial indexes",
  { skip: !database },
  async (t) => {
    const schema = "test_vectors_" + randomBytes(6).toString("hex");
    const admin = new pg.Pool({ connectionString: database });
    const corpus = new Corpus({
      version: "fixture",
      documents: [
        {
          id: "guide",
          title: "Operations",
          category: "test",
          version: "1",
          updatedAt: "2026-09-10",
          file: "guide.md",
          sections: [
            {
              id: "timeout",
              heading: "Uncertain outcome",
              text: "When the upstream service times out, reconcile before resubmitting.",
            },
            {
              id: "login",
              heading: "Access recovery",
              text: "Reset a forgotten password using a recovery link.",
            },
          ],
        },
      ],
    });
    let calls = 0,
      fail = false;
    const embedder: Embedder = {
      model: "controlled-fixture",
      dimensions: 3,
      embed: async (texts) => {
        calls++;
        if (fail) throw new Error("Provider failed");
        return {
          vectors: texts.map((text) =>
            /recovery|password/.test(text) ? [0, 1, 0] : [1, 0, 0],
          ),
          tokens: texts.length * 5,
        };
      },
    };
    const stores: VectorStore[] = [];
    const make = (c = corpus, e = embedder) => {
      const s = new VectorStore(c, e, database!, schema);
      stores.push(s);
      return s;
    };
    t.after(async () => {
      await Promise.all(stores.map((s) => s.close()));
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    });
    const store = make();
    await store.initialize();
    assert.equal((await store.status()).ready, false);
    await assert.rejects(store.retrieve("question"));
    assert.equal(calls, 0);
    assert.equal((await store.index()).indexedChunks, 2);
    const before = calls;
    assert.equal((await store.index()).reused, true);
    assert.equal(calls, before);
    const reopened = make();
    const result = await reopened.retrieve("The upstream system went silent");
    assert.equal(result.evidence[0].id, "guide#timeout");
    assert.equal(result.evidence[0].score, 1);
    assert.equal(
      (await reopened.retrieve("forgotten password")).evidence[0].id,
      "guide#login",
    );
    const changed = new Corpus({
      version: "fixture",
      documents: structuredClone(corpus.documents),
    });
    changed.documents[0].sections[0].text += " Updated.";
    const newer = make(
      new Corpus({ version: "fixture", documents: changed.documents }),
    );
    assert.equal((await newer.status()).ready, false);
    fail = true;
    await assert.rejects(newer.index());
    assert.equal((await newer.status()).indexedChunks, 0);
    assert.equal((await store.status()).ready, true);
    fail = false;
    assert.equal((await newer.index()).ready, true);
    assert.equal(
      (await make(corpus, { ...embedder, model: "different-model" }).status())
        .ready,
      false,
    );
  },
);
