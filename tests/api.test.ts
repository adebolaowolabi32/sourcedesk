import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { Store } from "../server/store.js";
import { Engine } from "../server/engine.js";
import type { Answer, ReviewCase } from "../server/types.js";
test("HTTP sessions, mutation protection, validation, handoff, and resolution work end to end", async (t) => {
  const store = new Store(":memory:");
  const server = createApp(store, new Engine()).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  t.after(
    () =>
      new Promise<void>((r) =>
        server.close(() => {
          store.close();
          r();
        }),
      ),
  );
  const base =
    "http://127.0.0.1:" + (server.address() as { port: number }).port;
  const bootstrap = await fetch(base + "/api/bootstrap"),
    cookie = bootstrap.headers.get("set-cookie")!;
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  const headers = {
    "Content-Type": "application/json",
    "X-Requested-With": "SourceDesk",
    Cookie: cookie.split(";")[0],
  };
  const post = (
    url: string,
    body: unknown,
    override: Record<string, string> = {},
  ) =>
    fetch(base + "/api" + url, {
      method: "POST",
      headers: { ...headers, ...override },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await post(
        "/ask",
        { question: "Why is my payment still confirming?" },
        { "X-Requested-With": "" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await post(
        "/ask",
        { question: "Why is my payment still confirming?" },
        { "Sec-Fetch-Site": "cross-site" },
      )
    ).status,
    403,
  );
  assert.equal((await post("/ask", { question: "x" })).status, 400);
  const answer = (await (
    await post("/ask", { question: "What is my bank balance?" })
  ).json()) as Answer;
  assert.equal(answer.status, "handoff");
  assert.ok((await fetch(base + "/api/answers/" + answer.id, { headers })).ok);
  assert.equal((await fetch(base + "/api/answers/" + answer.id)).status, 404);
  const item = (await (
    await post("/answers/" + answer.id + "/handoff", {
      note: "Please investigate",
    })
  ).json()) as ReviewCase;
  assert.equal(
    (
      await post("/cases/" + item.id + "/resolve", {
        version: 1,
        resolution: "no",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post("/cases/" + item.id + "/resolve", {
        version: 1,
        resolution: "Refer to the operations team with the payment ID.",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post("/cases/" + item.id + "/resolve", {
        version: 1,
        resolution: "Refer to the operations team again.",
      })
    ).status,
    409,
  );
  assert.equal(
    (await post("/ask", { question: "x".repeat(1300) })).status,
    400,
  );
  assert.equal((await fetch(base + "/api/missing", { headers })).status, 404);
});
