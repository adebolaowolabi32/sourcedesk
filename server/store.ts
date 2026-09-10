import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { Answer, ReviewCase, EvalResult } from "./types.js";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export class Store {
  db: DatabaseSync;
  constructor(path = process.env.DB_PATH ?? "data/sourcedesk.db") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS answers(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,data TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS answers_session ON answers(session_id,created_at DESC,id DESC);
 CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,answer_id TEXT NOT NULL UNIQUE REFERENCES answers(id) ON DELETE CASCADE,data TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS cases_session ON cases(session_id,created_at DESC,id DESC);
 CREATE TABLE IF NOT EXISTS evaluations(id TEXT PRIMARY KEY,data TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);
 PRAGMA user_version=1;`);
  }
  tx<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  session(id: string) {
    return !!this.db
      .prepare("SELECT id FROM sessions WHERE id=? AND expires_at>?")
      .get(id, Date.now());
  }
  createSession(id: string) {
    this.db
      .prepare("INSERT INTO sessions VALUES(?,?)")
      .run(id, Date.now() + 7 * 86400000);
    this.db
      .prepare(
        "DELETE FROM sessions WHERE id IN (SELECT id FROM sessions WHERE expires_at<? LIMIT 100)",
      )
      .run(Date.now());
  }
  throttle(key: string, limit = 30) {
    const now = Date.now();
    this.db
      .prepare(
        "DELETE FROM limits WHERE key IN (SELECT key FROM limits WHERE expires_at<? LIMIT 100)",
      )
      .run(now);
    const row = this.db
      .prepare(
        "INSERT INTO limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN limits.expires_at<? THEN 1 ELSE limits.count+1 END,expires_at=CASE WHEN limits.expires_at<? THEN excluded.expires_at ELSE limits.expires_at END RETURNING count",
      )
      .get(key, now + 60000, now, now)!;
    if (Number(row.count) > limit)
      throw new AppError(429, "Please wait a minute before trying again.");
  }
  save(session: string, answer: Answer) {
    this.db
      .prepare("INSERT INTO answers VALUES(?,?,?,?)")
      .run(answer.id, session, JSON.stringify(answer), answer.createdAt);
    return answer;
  }
  answer(session: string, id: string): Answer {
    const row = this.db
      .prepare("SELECT data FROM answers WHERE session_id=? AND id=?")
      .get(session, id);
    if (!row) throw new AppError(404, "Conversation not found.");
    return JSON.parse(String(row.data));
  }
  list(session: string, cursor?: string) {
    if (cursor && !/^\d+\|[a-f0-9-]{36}$/.test(cursor))
      throw new AppError(400, "Invalid history cursor.");
    const args: (string | number)[] = [session];
    let where = "session_id=?";
    if (cursor) {
      const [at, id] = cursor.split("|");
      where += " AND (created_at,id)<(?,?)";
      args.push(Number(at), id);
    }
    const rows = this.db
      .prepare(
        `SELECT data FROM answers WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT 21`,
      )
      .all(...args);
    const items = rows
      .slice(0, 20)
      .map((r) => JSON.parse(String(r.data)) as Answer);
    return {
      items,
      nextCursor:
        rows.length > 20
          ? items.at(-1)!.createdAt + "|" + items.at(-1)!.id
          : null,
    };
  }
  feedback(session: string, id: string, value: "helpful" | "unhelpful") {
    const answer = this.answer(session, id);
    answer.feedback = value;
    this.db
      .prepare("UPDATE answers SET data=? WHERE id=?")
      .run(JSON.stringify(answer), id);
    return answer;
  }
  handoff(session: string, id: string, note: string) {
    return this.tx(() => {
      const answer = this.answer(session, id);
      if (answer.caseId) return this.reviewCase(session, answer.caseId);
      const item: ReviewCase = {
        id: randomUUID(),
        answerId: id,
        question: answer.question,
        reason: answer.reason,
        note,
        resolution: "",
        status: "open",
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.db
        .prepare("INSERT INTO cases VALUES(?,?,?,?,?)")
        .run(item.id, session, id, JSON.stringify(item), item.createdAt);
      answer.caseId = item.id;
      this.db
        .prepare("UPDATE answers SET data=? WHERE id=?")
        .run(JSON.stringify(answer), id);
      return item;
    });
  }
  reviewCase(session: string, id: string): ReviewCase {
    const row = this.db
      .prepare("SELECT data FROM cases WHERE session_id=? AND id=?")
      .get(session, id);
    if (!row) throw new AppError(404, "Review case not found.");
    return JSON.parse(String(row.data));
  }
  cases(session: string) {
    return this.db
      .prepare(
        "SELECT data FROM cases WHERE session_id=? ORDER BY created_at DESC,id DESC LIMIT 100",
      )
      .all(session)
      .map((r) => JSON.parse(String(r.data)) as ReviewCase);
  }
  resolve(session: string, id: string, version: number, resolution: string) {
    return this.tx(() => {
      const item = this.reviewCase(session, id);
      if (item.version !== version || item.status === "resolved")
        throw new AppError(
          409,
          "This case changed. Refresh before resolving it.",
        );
      item.resolution = resolution;
      item.status = "resolved";
      item.version++;
      item.updatedAt = Date.now();
      this.db
        .prepare("UPDATE cases SET data=? WHERE id=?")
        .run(JSON.stringify(item), id);
      return item;
    });
  }
  saveEvaluation(value: EvalResult) {
    this.tx(() => {
      this.db
        .prepare("INSERT INTO evaluations VALUES(?,?,?)")
        .run(value.id, JSON.stringify(value), value.createdAt);
      this.db.exec(
        "DELETE FROM evaluations WHERE id NOT IN (SELECT id FROM evaluations ORDER BY created_at DESC LIMIT 10)",
      );
    });
    return value;
  }
  evaluation(): EvalResult | undefined {
    const row = this.db
      .prepare("SELECT data FROM evaluations ORDER BY created_at DESC LIMIT 1")
      .get();
    return row ? JSON.parse(String(row.data)) : undefined;
  }
  close() {
    this.db.close();
  }
}
