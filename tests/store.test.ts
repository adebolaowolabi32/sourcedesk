import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Engine } from "../server/engine.js";
import { Store, AppError } from "../server/store.js";
const error = (status: number) => (e: unknown) =>
  e instanceof AppError && e.status === status;
test("answers, feedback, and review cases are isolated to their browser session", async () => {
  const store = new Store(":memory:");
  try {
    store.createSession("a");
    store.createSession("b");
    const a = store.save(
      "a",
      await new Engine().answer("Why is my payment still confirming?"),
    );
    assert.equal(store.list("b").items.length, 0);
    assert.throws(() => store.answer("b", a.id), error(404));
    assert.throws(() => store.feedback("b", a.id, "helpful"), error(404));
    assert.throws(() => store.handoff("b", a.id, "note"), error(404));
    const review = store.handoff("a", a.id, "Need a review");
    assert.throws(() => store.reviewCase("b", review.id), error(404));
    assert.throws(
      () =>
        store.resolve("b", review.id, 1, "Checked the current documentation."),
      error(404),
    );
    assert.equal(store.cases("b").length, 0);
  } finally {
    store.close();
  }
});
test("handoffs are idempotent and resolution requires the current version", async () => {
  const store = new Store(":memory:");
  try {
    store.createSession("a");
    const a = store.save(
      "a",
      await new Engine().answer("What is my bank balance?"),
    );
    const first = store.handoff("a", a.id, "Initial note"),
      again = store.handoff("a", a.id, "Second note");
    assert.equal(first.id, again.id);
    assert.equal(store.answer("a", a.id).caseId, first.id);
    assert.throws(
      () => store.resolve("a", first.id, 2, "Checked with operations team."),
      error(409),
    );
    const resolved = store.resolve(
      "a",
      first.id,
      1,
      "Ask operations using the payment ID.",
    );
    assert.equal(resolved.status, "resolved");
    assert.throws(
      () => store.resolve("a", first.id, 1, "Another resolution attempt."),
      error(409),
    );
    assert.equal(store.reviewCase("a", first.id).note, "Initial note");
  } finally {
    store.close();
  }
});
test("history pagination handles matching timestamps without skips", async () => {
  const store = new Store(":memory:");
  try {
    store.createSession("a");
    const engine = new Engine();
    for (let i = 0; i < 45; i++) {
      const a = await engine.answer("Question " + i);
      a.createdAt = 1000;
      store.save("a", a);
    }
    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const page = store.list("a", cursor ?? undefined);
      ids.push(...page.items.map((a) => a.id));
      cursor = page.nextCursor;
    } while (cursor);
    assert.equal(ids.length, 45);
    assert.equal(new Set(ids).size, 45);
    assert.throws(() => store.list("a", "bad-cursor"), error(400));
  } finally {
    store.close();
  }
});
test("saved questions and review notes survive a restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sourcedesk-store-")),
    file = join(dir, "demo.db");
  let store = new Store(file);
  try {
    store.createSession("a");
    const a = store.save(
      "a",
      await new Engine().answer("What is my bank balance?"),
    );
    const item = store.handoff("a", a.id, "Needs investigation");
    store.close();
    store = new Store(file);
    assert.equal(store.answer("a", a.id).caseId, item.id);
    assert.equal(store.reviewCase("a", item.id).note, "Needs investigation");
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("shared rate limits bound repeated requests and expired sessions are rejected", () => {
  const store = new Store(":memory:");
  try {
    for (let i = 0; i < 3; i++) store.throttle("same", 3);
    assert.throws(() => store.throttle("same", 3), error(429));
    store.createSession("a");
    store.db.prepare("UPDATE sessions SET expires_at=0 WHERE id=?").run("a");
    assert.equal(store.session("a"), false);
  } finally {
    store.close();
  }
});
