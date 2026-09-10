import express from "express";
import { z, ZodError } from "zod";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import path from "node:path";
import { Store, AppError } from "./store.js";
import { Engine } from "./engine.js";
import { evaluate } from "./evaluation.js";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function createApp(
  store: Store,
  engine: Engine,
  options: { modelEnabled?: boolean; secure?: boolean } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  let active = 0,
    evaluating = false;
  app.use((req, res, next) => {
    res.set({
      "X-Request-Id": randomUUID(),
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    });
    next();
  });
  app.use(express.json({ limit: "12kb" }));
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (req.get("X-Requested-With") !== "SourceDesk" ||
        req.get("Sec-Fetch-Site") === "cross-site")
    )
      throw new AppError(403, "A same-origin request is required.");
    next();
  });
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api", (req, res, next) => {
    const raw =
      req.headers.cookie
        ?.split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("sourcedesk_session="))
        ?.slice(19) ?? "";
    let id = hash(raw);
    if (!raw || !store.session(id)) {
      store.throttle("session:" + hash(req.ip ?? ""), 60);
      const token = randomBytes(32).toString("hex");
      id = hash(token);
      store.createSession(id);
      res.cookie("sourcedesk_session", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: options.secure ?? process.env.NODE_ENV === "production",
        maxAge: 7 * 86400000,
        path: "/",
      });
    }
    res.locals.session = id;
    next();
  });
  app.get("/api/bootstrap", (_req, res) =>
    res.json({
      mode: options.modelEnabled ? "openai" : "extractive",
      corpusVersion: engine.corpus.version,
      documentCount: engine.corpus.documents.length,
      chunkCount: engine.corpus.chunks.filter((c) => !c.quarantined).length,
      history: store.list(res.locals.session),
      cases: store.cases(res.locals.session),
      evaluation: store.evaluation(),
    }),
  );
  app.get("/api/documents", (_req, res) => res.json(engine.corpus.documents));
  app.get("/api/history", (req, res) =>
    res.json(
      store.list(
        res.locals.session,
        z.object({ cursor: z.string().max(100).optional() }).parse(req.query)
          .cursor,
      ),
    ),
  );
  app.get("/api/answers/:id", (req, res) =>
    res.json(store.answer(res.locals.session, String(req.params.id))),
  );
  app.post("/api/ask", async (req, res) => {
    const { question } = z
      .object({ question: z.string().trim().min(3).max(1200) })
      .strict()
      .parse(req.body);
    store.throttle("ask:" + res.locals.session, 20);
    store.throttle("ask-ip:" + hash(req.ip ?? ""), 60);
    if (active >= 4)
      throw new AppError(429, "The answer service is busy. Try again shortly.");
    active++;
    try {
      res
        .status(201)
        .json(store.save(res.locals.session, await engine.answer(question)));
    } finally {
      active--;
    }
  });
  app.post("/api/answers/:id/feedback", (req, res) => {
    const body = z
      .object({ value: z.enum(["helpful", "unhelpful"]) })
      .parse(req.body);
    res.json(
      store.feedback(res.locals.session, String(req.params.id), body.value),
    );
  });
  app.post("/api/answers/:id/handoff", (req, res) => {
    const { note } = z
      .object({ note: z.string().trim().max(1000).default("") })
      .parse(req.body);
    res.json(store.handoff(res.locals.session, String(req.params.id), note));
  });
  app.get("/api/cases", (_req, res) =>
    res.json(store.cases(res.locals.session)),
  );
  app.post("/api/cases/:id/resolve", (req, res) => {
    const input = z
      .object({
        version: z.number().int().positive(),
        resolution: z.string().trim().min(10).max(2000),
      })
      .parse(req.body);
    res.json(
      store.resolve(
        res.locals.session,
        String(req.params.id),
        input.version,
        input.resolution,
      ),
    );
  });
  app.get("/api/evaluations", (_req, res) =>
    res.json(store.evaluation() ?? null),
  );
  app.post("/api/evaluations", async (_req, res) => {
    store.throttle("evaluate", 3);
    if (evaluating)
      throw new AppError(409, "An evaluation is already running.");
    evaluating = true;
    try {
      res
        .status(201)
        .json(store.saveEvaluation(await evaluate(new Engine(engine.corpus))));
    } finally {
      evaluating = false;
    }
  });
  app.use("/api", (_req, _res) => {
    throw new AppError(404, "API route not found.");
  });
  app.use(express.static(path.resolve("dist")));
  app.get("/", (_req, res) => res.sendFile(path.resolve("dist/index.html")));
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (err instanceof ZodError)
        return res
          .status(400)
          .json({ error: err.issues.map((i) => i.message).join(" ") });
      if (err instanceof AppError)
        return res.status(err.status).json({ error: err.message });
      if (err instanceof SyntaxError)
        return res.status(400).json({ error: "Invalid JSON." });
      if (err.type === "entity.too.large")
        return res.status(413).json({ error: "Request too large." });
      console.error(
        JSON.stringify({
          event: "request.error",
          requestId: res.get("X-Request-Id"),
          type: err.name,
        }),
      );
      res.status(500).json({
        error: "An unexpected error occurred. Try again with the request ID.",
      });
    },
  );
  return app;
}
