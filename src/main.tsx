import React, {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUp,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  FlaskConical,
  Inbox,
  Layers,
  LifeBuoy,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
  Menu,
  ExternalLink,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  Command,
} from "lucide-react";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import { api, date, percent } from "./lib";
import type {
  Answer,
  SourceDocument,
  ReviewCase,
  EvalResult,
  Evidence,
} from "../server/types";
import "./styles.css";
type Bootstrap = {
  mode: string;
  corpusVersion: string;
  documentCount: number;
  chunkCount: number;
  history: { items: Answer[]; nextCursor: string | null };
  cases: ReviewCase[];
  evaluation: EvalResult;
};
const suggestions = [
  {
    icon: Clock,
    title: "A payment is still confirming",
    question: "Why is my payment still confirming?",
    tag: "Payment recovery",
  },
  {
    icon: ShieldCheck,
    title: "Who can approve a payment?",
    question: "Can an admin approve their own payment?",
    tag: "Approvals & controls",
  },
  {
    icon: RotateCw,
    title: "Understand the retry policy",
    question: "What happens after three temporary provider failures?",
    tag: "Provider operations",
  },
  {
    icon: LifeBuoy,
    title: "Recover account access",
    question: "How long does a recovery token last?",
    tag: "Account security",
  },
];
function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark">
        <Layers size={22} />
      </span>
      SourceDesk<span className="logo-dot">.</span>
    </span>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = ref.current!,
      prior = document.activeElement as HTMLElement;
    el.showModal();
    const cancel = (e: Event) => {
      e.preventDefault();
      close.current();
    };
    el.addEventListener("cancel", cancel);
    return () => {
      el.removeEventListener("cancel", cancel);
      el.close();
      prior?.focus();
    };
  }, []);
  return (
    <dialog ref={ref} className="modal" aria-labelledby="modal-title">
      <div className="modal-head">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function App() {
  const [data, setData] = useState<Bootstrap>(),
    [docs, setDocs] = useState<SourceDocument[]>([]),
    [page, setPage] = useState("Assistant"),
    [answer, setAnswer] = useState<Answer>(),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [mobile, setMobile] = useState(false),
    [source, setSource] = useState<{
      document: SourceDocument;
      chunk?: string;
      snapshot?: boolean;
    }>(),
    [handoff, setHandoff] = useState(false),
    [caseNote, setCaseNote] = useState(""),
    [docSearch, setDocSearch] = useState(""),
    [category, setCategory] = useState("All guides"),
    [review, setReview] = useState<ReviewCase>(),
    [resolution, setResolution] = useState(""),
    [evalFilter, setEvalFilter] = useState("all");
  const composer = useRef<HTMLTextAreaElement>(null);
  const mounted = useRef(true);
  async function refresh() {
    const next = await api<Bootstrap>("/bootstrap");
    if (mounted.current) setData(next);
    return next;
  }
  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        await refresh();
        const documents = await api<SourceDocument[]>("/documents");
        if (mounted.current) setDocs(documents);
      } catch (e) {
        if (mounted.current) setError((e as Error).message);
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobile(false);
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPage("Assistant");
        setMobile(false);
        composer.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  async function ask(question: string) {
    if (busy || question.trim().length < 3) return;
    setBusy(true);
    setError("");
    setPage("Assistant");
    setMobile(false);
    try {
      const result = await api<Answer>("/ask", { question: question.trim() });
      setAnswer(result);
      setDraft("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function action(fn: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function navigate(name: string) {
    setPage(name);
    setMobile(false);
    setError("");
  }
  function openSource(id: string) {
    const document = docs.find((d) => d.id === id.split("#")[0]);
    const evidence = answer?.evidence.find((e) => e.id === id);
    if (
      evidence &&
      (!document || answer?.corpusVersion !== data?.corpusVersion)
    ) {
      setSource({
        snapshot: true,
        chunk: id,
        document: {
          id: evidence.documentId,
          title: evidence.title,
          category: evidence.category,
          version: evidence.version,
          updatedAt: new Date(answer!.createdAt).toISOString().slice(0, 10),
          file: evidence.documentId + ".md",
          sections: [
            {
              id: id.split("#")[1],
              heading: evidence.heading,
              text: evidence.text,
            },
          ],
        },
      });
    } else if (document)
      setSource({ document, chunk: id.includes("#") ? id : undefined });
  }
  const openCases = data?.cases.filter((c) => c.status === "open").length ?? 0;
  const library = docs.filter(
    (d) =>
      (category === "All guides" || d.category === category) &&
      (
        d.title +
        " " +
        d.category +
        " " +
        d.sections.map((s) => s.text).join(" ")
      )
        .toLowerCase()
        .includes(docSearch.toLowerCase()),
  );
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {mobile && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={"sidebar " + (mobile ? "is-open" : "")}>
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("Assistant");
            setAnswer(undefined);
          }}
        >
          <Logo />
        </a>
        <div className="workspace-switch">
          <span className="workspace-icon">C</span>
          <div>
            <strong>Cedar Finance</strong>
            <span>Support workspace</span>
          </div>
          <ChevronDown size={16} />
        </div>
        <div className="nav-heading">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {[
            { name: "Assistant", icon: Sparkles },
            { name: "Knowledge", icon: BookOpen },
            { name: "Handoffs", icon: Inbox },
            { name: "Evaluations", icon: FlaskConical },
          ].map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={page === name ? "active" : ""}
              aria-current={page === name ? "page" : undefined}
              onClick={() => navigate(name)}
            >
              <Icon size={18} />
              {name}
              {name === "Handoffs" && openCases > 0 && (
                <span className="nav-badge">{openCases}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="recent-heading">
          <span>RECENT QUESTIONS</span>
          <button
            className="icon-button"
            aria-label="New question"
            onClick={() => {
              navigate("Assistant");
              setAnswer(undefined);
              setDraft("");
              composer.current?.focus();
            }}
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="recent-list">
          {data?.history.items.slice(0, 8).map((a) => (
            <button
              key={a.id}
              title={a.question}
              className={
                answer?.id === a.id && page === "Assistant" ? "selected" : ""
              }
              onClick={() => {
                setAnswer(a);
                navigate("Assistant");
              }}
            >
              <MessageSquare size={14} />
              <span>{a.question}</span>
            </button>
          ))}
          {!data?.history.items.length && (
            <p>Your questions will appear here.</p>
          )}
          {!!data?.history.items.length && (
            <button className="text-button" onClick={() => navigate("History")}>
              View question history <ArrowRight size={13} />
            </button>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="trust-note">
            <ShieldCheck size={18} />
            <strong>Evidence comes first.</strong>
            <p>
              Sources you can inspect.
              <br />
              Answers you can verify.
            </p>
          </div>
          <div className="profile">
            <span className="avatar">CO</span>
            <div>
              <strong>Cynthia’s demo</strong>
              <span>Private browser sandbox</span>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-toggle"
              aria-label="Toggle navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <span className="corpus-status">
              <span className="online-dot" /> Knowledge connected
            </span>
            <span className="demo-badge">DEMO</span>
          </div>
        </header>
        <main
          id="main"
          className={
            "main-content " + (page === "Assistant" ? "assistant-page" : "")
          }
        >
          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button
                className="text-button"
                onClick={() => void action(refresh, "Workspace refreshed.")}
              >
                Retry
              </button>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!data && !error && (
            <div className="loading">
              <span className="spinner" />
              Opening your support workspace…
            </div>
          )}
          {data && page === "Assistant" && (
            <div className="assistant-grid">
              <section className="conversation">
                <div className="section-kicker">
                  <span className="purple-dot" /> YOUR KNOWLEDGE, CONNECTED
                </div>
                <div className="assistant-heading">
                  <div>
                    <h1>
                      {answer
                        ? "A little more clarity."
                        : "Clarity, with a source."}
                    </h1>
                    <p>Thoughtful answers for the questions that matter.</p>
                  </div>
                  {answer && (
                    <button
                      className="button secondary small"
                      onClick={() => {
                        setAnswer(undefined);
                        setDraft("");
                        composer.current?.focus();
                      }}
                    >
                      <Plus size={15} />
                      New question
                    </button>
                  )}
                </div>
                {!answer && (
                  <>
                    <div className="welcome-card">
                      <div className="orb">
                        <Sparkles size={30} />
                        <span className="orb-dot" />
                      </div>
                      <span className="mini-label">
                        MEET YOUR SUPPORT COMPANION
                      </span>
                      <h2>
                        Less searching.
                        <br />
                        More understanding.
                      </h2>
                      <p>
                        Ask about payments, approvals, and recovery. Every
                        answer starts with your published guides.
                      </p>
                      <div className="welcome-tags">
                        <span>
                          <FileText size={13} />
                          {data.documentCount} trusted guides
                        </span>
                        <span>
                          <ShieldCheck size={13} />
                          Source-linked answers
                        </span>
                      </div>
                      <div className="welcome-decoration">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                    <div className="suggestion-heading">
                      <h3>A good place to start</h3>
                      <span>
                        Try a question <ArrowUpRight size={13} />
                      </span>
                    </div>
                    <div className="suggestions">
                      {suggestions.map(
                        ({ icon: Icon, title, question, tag }) => (
                          <button
                            key={title}
                            disabled={busy}
                            onClick={() => void ask(question)}
                          >
                            <span className="suggestion-icon">
                              <Icon size={19} />
                            </span>
                            <strong>{title}</strong>
                            <span>
                              {tag}
                              <ArrowUpRight size={15} />
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  </>
                )}
                {answer && (
                  <div className="answer-thread">
                    <div className="question-line">
                      <span className="question-avatar">You</span>
                      <div>
                        <span className="message-label">
                          Your question <time>{date(answer.createdAt)}</time>
                        </span>
                        <p>{answer.question}</p>
                      </div>
                    </div>
                    <article
                      className={
                        "answer-card " +
                        (answer.status === "handoff" ? "needs-review" : "")
                      }
                    >
                      <div className="answer-top">
                        <span className="answer-icon">
                          <Sparkles size={19} />
                        </span>
                        <div>
                          <strong>SourceDesk</strong>
                          <span>
                            {answer.engine === "openai"
                              ? "Model-selected source passages"
                              : answer.engine === "fallback"
                                ? "Model connection unavailable"
                                : "Extractive answer · no model required"}
                          </span>
                        </div>
                        <span
                          className={
                            "status-pill " +
                            (answer.status === "answered" ? "green" : "amber")
                          }
                        >
                          {answer.status === "answered" ? (
                            <Check size={12} />
                          ) : (
                            <LifeBuoy size={12} />
                          )}{" "}
                          {answer.status === "answered"
                            ? "Source-backed"
                            : "Needs review"}
                        </span>
                      </div>
                      {answer.status === "answered" ? (
                        <>
                          <h2>Here’s what the guides say.</h2>
                          {answer.passages.map((p, i) => (
                            <p className="answer-passage" key={p.citationId}>
                              {p.text}{" "}
                              <button
                                className="inline-citation"
                                aria-label={"Open citation " + (i + 1)}
                                onClick={() => openSource(p.citationId)}
                              >
                                {i + 1}
                              </button>
                            </p>
                          ))}
                          <div className="answer-sources">
                            {answer.passages.map((p, i) => (
                              <button
                                key={p.citationId}
                                onClick={() => openSource(p.citationId)}
                              >
                                <span>{i + 1}</span>
                                {
                                  answer.evidence.find(
                                    (e) => e.id === p.citationId,
                                  )?.title
                                }
                                <ArrowUpRight size={12} />
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <h2>Let’s get the right person involved.</h2>
                          <p className="handoff-reason">{answer.reason}</p>
                          <p className="muted">
                            Your question and retrieved evidence can travel with
                            the review case. This demo does not contact a real
                            support team.
                          </p>
                        </>
                      )}
                      <div className="answer-footer">
                        <div>
                          <span className="tiny-dot" />
                          {answer.status === "answered"
                            ? answer.passages.length +
                              " verified source passages"
                            : "No unsupported answer generated"}
                          <span className="answer-latency">
                            {answer.latencyMs} ms
                          </span>
                        </div>
                        <div className="feedback-actions">
                          <button
                            className={
                              "icon-button " +
                              (answer.feedback === "helpful" ? "chosen" : "")
                            }
                            aria-label="Helpful answer"
                            disabled={busy}
                            onClick={() =>
                              void action(
                                async () =>
                                  setAnswer(
                                    await api<Answer>(
                                      "/answers/" + answer.id + "/feedback",
                                      { value: "helpful" },
                                    ),
                                  ),
                                "Feedback saved.",
                              )
                            }
                          >
                            <ThumbsUp size={15} />
                          </button>
                          <button
                            className={
                              "icon-button " +
                              (answer.feedback === "unhelpful" ? "chosen" : "")
                            }
                            aria-label="Unhelpful answer"
                            disabled={busy}
                            onClick={() =>
                              void action(
                                async () =>
                                  setAnswer(
                                    await api<Answer>(
                                      "/answers/" + answer.id + "/feedback",
                                      { value: "unhelpful" },
                                    ),
                                  ),
                                "Feedback saved.",
                              )
                            }
                          >
                            <ThumbsDown size={15} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label="Copy answer"
                            onClick={() =>
                              void action(
                                () =>
                                  navigator.clipboard.writeText(
                                    answer.passages.length
                                      ? answer.passages
                                          .map(
                                            (p, i) =>
                                              p.text + " [" + (i + 1) + "]",
                                          )
                                          .join("\n\n") +
                                          "\n\n" +
                                          answer.passages
                                            .map(
                                              (p, i) =>
                                                "[" +
                                                (i + 1) +
                                                "] " +
                                                p.citationId,
                                            )
                                            .join("\n")
                                      : answer.reason,
                                  ),
                                "Copied to clipboard.",
                              )
                            }
                          >
                            <Copy size={15} />
                          </button>
                        </div>
                      </div>
                    </article>
                    <div className="handoff-bar">
                      <span>
                        <LifeBuoy size={17} />
                        {answer.caseId
                          ? "This question has a review case."
                          : "Need a second pair of eyes?"}
                      </span>
                      <button
                        className="text-button"
                        onClick={() => {
                          if (answer.caseId) navigate("Handoffs");
                          else {
                            setCaseNote("");
                            setHandoff(true);
                          }
                        }}
                      >
                        {answer.caseId ? "View handoff" : "Send to review"}
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
                <form
                  className="composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void ask(draft);
                  }}
                >
                  <div className="composer-top">
                    <Sparkles size={19} />
                    <textarea
                      ref={composer}
                      aria-label="Ask a support question"
                      placeholder="Ask about payments, approvals, or recovery…"
                      value={draft}
                      maxLength={1200}
                      rows={2}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          void ask(draft);
                        }
                      }}
                    />
                  </div>
                  <div className="composer-bottom">
                    <span>
                      <BookOpen size={13} />
                      {data.mode === "openai"
                        ? "Model-assisted evidence selection"
                        : "Knowledge-only · works offline"}
                    </span>
                    <span className="composer-count">{draft.length}/1200</span>
                    <button
                      className="send-button"
                      disabled={busy || draft.trim().length < 3}
                      aria-label="Send question"
                    >
                      {busy ? (
                        <span className="spinner" />
                      ) : (
                        <ArrowUp size={19} />
                      )}
                    </button>
                  </div>
                </form>
                {busy && (
                  <p role="status" className="working">
                    <span className="spinner" />
                    Working on your request…
                  </p>
                )}
                <p className="composer-note">
                  Answers use synthetic guides, not live account data.{" "}
                  <span>Always check the source.</span>
                </p>
              </section>
              <aside className="evidence-rail">
                <div className="rail-heading">
                  <div>
                    <BookOpen size={17} />
                    <h2>
                      {answer ? "Answer evidence" : "Your source of truth"}
                    </h2>
                  </div>
                  <span>
                    {answer ? answer.evidence.length : data.documentCount}
                  </span>
                </div>
                <p className="rail-intro">
                  {answer
                    ? "Open a passage to see the context behind this response."
                    : "A small, carefully maintained library for everyday payment questions."}
                </p>
                {answer ? (
                  <div className="evidence-list">
                    {answer.evidence.map((e, i) => (
                      <button
                        key={e.id}
                        className="evidence-card"
                        onClick={() => openSource(e.id)}
                      >
                        <div>
                          <span className="source-number">{i + 1}</span>
                          <span>{e.category}</span>
                          <ArrowUpRight size={14} />
                        </div>
                        <h3>{e.title}</h3>
                        <p>{e.text}</p>
                        <small>
                          {e.heading} · v{e.version}
                        </small>
                      </button>
                    ))}
                    {!answer.evidence.length && (
                      <p className="empty-small">
                        No relevant passages were found.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="featured-guides">
                    {docs.slice(0, 4).map((d, i) => (
                      <button key={d.id} onClick={() => openSource(d.id)}>
                        <span className={"doc-icon tone-" + i}>
                          <FileText size={19} />
                        </span>
                        <span>
                          <strong>{d.title}</strong>
                          <small>
                            {d.sections.length} passages · v{d.version}
                          </small>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                    <button
                      className="text-button"
                      onClick={() => navigate("Knowledge")}
                    >
                      Explore all guides <ArrowRight size={14} />
                    </button>
                  </div>
                )}
                <div className="rail-quality">
                  <div className="quality-symbol">
                    <CheckCheck size={21} />
                  </div>
                  <h3>Good answers are accountable.</h3>
                  <p>
                    Inspect the source. Flag a gap. Bring a person into the loop
                    when the evidence stops.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => navigate("Evaluations")}
                  >
                    See how we evaluate <ArrowUpRight size={14} />
                  </button>
                </div>
                <div className="rail-foot">
                  <span className="online-dot" />
                  Library version{" "}
                  {data.corpusVersion.split("-").slice(0, 3).join("-")}
                  <span>Synthetic documentation</span>
                </div>
              </aside>
            </div>
          )}
          {data && page === "Knowledge" && (
            <>
              <PageHeading
                kicker="THE PUBLISHED LIBRARY"
                title="Knowledge, kept close."
                subtitle="Inspect the guides that power every answer. No hidden sources."
                aside={
                  <span className="soft-label">
                    <BookOpen size={15} />
                    {docs.length} published guides
                  </span>
                }
              />
              <div className="library-toolbar">
                <div className="category-tabs">
                  {[
                    "All guides",
                    "Payments",
                    "Recovery",
                    "Controls",
                    "Access",
                    "Operations",
                    "Product",
                  ].map((c) => (
                    <button
                      key={c}
                      className={category === c ? "active" : ""}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <label className="search-box">
                  <Search size={17} />
                  <input
                    aria-label="Search guides"
                    placeholder="Find a guide…"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                  />
                </label>
              </div>
              <div className="document-grid">
                {library.map((d, i) => (
                  <button
                    className="document-card"
                    key={d.id}
                    onClick={() => openSource(d.id)}
                  >
                    <div>
                      <span className={"doc-icon tone-" + (i % 4)}>
                        <FileText size={22} />
                      </span>
                      <span className="published">
                        <span className="online-dot" />
                        Published
                      </span>
                    </div>
                    <span className="document-category">{d.category}</span>
                    <h2>{d.title}</h2>
                    <p>{d.sections[0].text}</p>
                    <footer>
                      <span>
                        {d.sections.length} passages · v{d.version}
                      </span>
                      <ArrowUpRight size={18} />
                    </footer>
                  </button>
                ))}
              </div>
              {!library.length && (
                <Empty
                  icon={<Search />}
                  title="No matching guides"
                  text="Try another search or category."
                />
              )}
            </>
          )}
          {data && page === "Handoffs" && (
            <>
              <PageHeading
                kicker="A PERSON IN THE LOOP"
                title="Careful handoffs."
                subtitle="The question, context, and evidence. Ready for a human decision."
                aside={
                  <span className="soft-label">
                    <Inbox size={15} />
                    {openCases} open cases
                  </span>
                }
              />
              <div className="info-banner">
                <ShieldCheck size={18} />
                <p>
                  This is your browser’s review sandbox. Resolving a case
                  records a note; it does not approve payments or contact a real
                  support team.
                </p>
              </div>
              {!data.cases.length ? (
                <Empty
                  icon={<Inbox size={32} />}
                  title="Nothing left in limbo."
                  text="Questions sent to review will appear here with their source evidence."
                  action={
                    <button
                      className="button primary"
                      onClick={() => navigate("Assistant")}
                    >
                      Ask a question <ArrowRight size={16} />
                    </button>
                  }
                />
              ) : (
                <div className="case-list">
                  {data.cases.map((c) => (
                    <article className="case-card" key={c.id}>
                      <div className={"case-icon " + c.status}>
                        {c.status === "open" ? (
                          <LifeBuoy size={22} />
                        ) : (
                          <CheckCircle2 size={22} />
                        )}
                      </div>
                      <div className="case-content">
                        <div className="case-meta">
                          <span>CASE {c.id.slice(0, 8).toUpperCase()}</span>
                          <span
                            className={
                              "status-pill " +
                              (c.status === "open" ? "amber" : "green")
                            }
                          >
                            {c.status === "open"
                              ? "Awaiting review"
                              : "Resolved"}
                          </span>
                        </div>
                        <h2>{c.question}</h2>
                        <p>{c.note || c.reason}</p>
                        <small>{date(c.createdAt)}</small>
                        {c.resolution && (
                          <div className="resolution">
                            <strong>Reviewer note</strong>
                            <p>{c.resolution}</p>
                          </div>
                        )}
                      </div>
                      <button
                        className="button secondary small"
                        onClick={() => {
                          setReview(c);
                          setResolution("");
                        }}
                      >
                        {c.status === "open" ? "Review case" : "View details"}
                        <ArrowUpRight size={15} />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
          {data && page === "Evaluations" && (
            <>
              <PageHeading
                kicker="QUALITY YOU CAN INSPECT"
                title="Measured, not assumed."
                subtitle="A repeatable test suite for retrieval, citations, and knowing when to stop."
                aside={
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const evaluation = await api<EvalResult>(
                          "/evaluations",
                          {},
                        );
                        setData((d) => (d ? { ...d, evaluation } : d));
                      }, "Evaluation complete.")
                    }
                  >
                    <FlaskConical size={16} />
                    {busy ? "Evaluating…" : "Run evaluation"}
                  </button>
                }
              />
              {data.evaluation && (
                <>
                  <div className="evaluation-meta">
                    <span className="soft-label">Extractive baseline</span>
                    <span>Dataset v{data.evaluation.datasetVersion}</span>
                    <span>Last run {date(data.evaluation.createdAt)}</span>
                  </div>
                  <div className="metric-grid">
                    <Metric
                      label="Cases passed"
                      value={
                        data.evaluation.passed + "/" + data.evaluation.total
                      }
                      detail="Authored synthetic regression suite"
                    />
                    <Metric
                      label="Answerable recall"
                      value={percent(data.evaluation.answerableRecall)}
                      detail="Expected source included in answer"
                    />
                    <Metric
                      label="Correct handoffs"
                      value={percent(data.evaluation.abstentionAccuracy)}
                      detail="Unsupported questions sent to review"
                    />
                    <Metric
                      label="Citation validity"
                      value={percent(data.evaluation.citationValidity)}
                      detail="Exact passage and source ID match"
                    />
                  </div>
                  <div className="eval-detail-grid">
                    <section className="panel eval-chart">
                      <div className="panel-title">
                        <h2>Coverage by scenario</h2>
                        <span>Passed / total</span>
                      </div>
                      {[
                        "retrieval",
                        "paraphrase",
                        "unsupported",
                        "account-specific",
                        "injection",
                      ].map((cat) => {
                        const rows = data.evaluation.results.filter(
                            (r) => r.category === cat,
                          ),
                          pass = rows.filter((r) => r.passed).length;
                        return (
                          <div className="chart-row" key={cat}>
                            <span>{cat.replace("-", " ")}</span>
                            <div>
                              <i
                                style={{
                                  width: (pass / rows.length) * 100 + "%",
                                }}
                              />
                            </div>
                            <strong>
                              {pass}/{rows.length}
                            </strong>
                          </div>
                        );
                      })}
                    </section>
                    <section className="panel runtime-card">
                      <Clock size={22} />
                      <h2>
                        Small footprint.
                        <br />
                        Visible tradeoffs.
                      </h2>
                      <dl>
                        <dt>Median latency</dt>
                        <dd>{data.evaluation.latencyP50} ms</dd>
                        <dt>95th percentile</dt>
                        <dd>{data.evaluation.latencyP95} ms</dd>
                        <dt>API spend</dt>
                        <dd>$0.00</dd>
                      </dl>
                      <p>
                        Local retrieval and extraction only. Optional model
                        quality and cost are not measured by this run.
                      </p>
                    </section>
                  </div>
                  <section className="panel evaluation-table">
                    <div className="panel-title">
                      <h2>Every case, in the open</h2>
                      <label>
                        <span className="sr-only">Filter evaluation cases</span>
                        <select
                          value={evalFilter}
                          onChange={(e) => setEvalFilter(e.target.value)}
                        >
                          <option value="all">All cases</option>
                          <option value="failed">Failed cases</option>
                          <option value="holdout">Holdout subset</option>
                          <option value="injection">Injection attempts</option>
                        </select>
                      </label>
                    </div>
                    <div className="case-results">
                      {data.evaluation.results
                        .filter(
                          (r) =>
                            evalFilter === "all" ||
                            (evalFilter === "failed" && !r.passed) ||
                            (evalFilter === "holdout" &&
                              r.split === "holdout") ||
                            r.category === evalFilter,
                        )
                        .map((r) => (
                          <div className="eval-result" key={r.id}>
                            <span
                              className={
                                "result-icon " + (r.passed ? "pass" : "fail")
                              }
                            >
                              {r.passed ? <Check size={16} /> : <X size={16} />}
                            </span>
                            <div>
                              <strong>{r.question}</strong>
                              <small>
                                {r.category} · {r.split} · {r.id}
                              </small>
                            </div>
                            <span className="result-status">
                              {r.actual === "answered"
                                ? "Answered"
                                : "Handed off"}
                            </span>
                            <span className="result-time">
                              {r.latencyMs} ms
                            </span>
                          </div>
                        ))}
                    </div>
                  </section>
                  <p className="evaluation-note">
                    Citation validity checks source identity and exact text, not
                    semantic relevance. These 40 authored cases are a regression
                    baseline, not a production accuracy claim. The fixed holdout
                    subset is visible and is not an independent blind
                    evaluation.
                  </p>
                </>
              )}
            </>
          )}
          {data && page === "History" && (
            <>
              <PageHeading
                kicker="YOUR QUESTION TRAIL"
                title="Pick up the thread."
                subtitle="Saved questions and evidence in this browser’s private sandbox."
              />
              <div className="history-list">
                {data.history.items.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setAnswer(a);
                      navigate("Assistant");
                    }}
                  >
                    <MessageSquare size={19} />
                    <span>
                      <strong>{a.question}</strong>
                      <small>
                        {date(a.createdAt)} ·{" "}
                        {a.status === "answered"
                          ? "Source-backed answer"
                          : "Needs review"}
                      </small>
                    </span>
                    <ArrowUpRight size={17} />
                  </button>
                ))}
              </div>
              {!data.history.items.length && (
                <Empty
                  icon={<MessageSquare />}
                  title="Start with a question"
                  text="Your saved answers will appear here."
                />
              )}
              {data.history.nextCursor && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const more = await api<Bootstrap["history"]>(
                        "/history?cursor=" +
                          encodeURIComponent(data.history.nextCursor!),
                      );
                      setData({
                        ...data,
                        history: {
                          items: [...data.history.items, ...more.items],
                          nextCursor: more.nextCursor,
                        },
                      });
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Load older questions
                </button>
              )}
            </>
          )}
          <footer className="app-footer">
            <span>Built with care by Cynthia Owolabi</span>
            <span>Synthetic data · No real funds or account access</span>
          </footer>
        </main>
      </div>
      {source && (
        <Modal
          title={source.document.title}
          onClose={() => setSource(undefined)}
        >
          <div className="source-modal-body">
            <div className="source-meta">
              <span className="soft-label">{source.document.category}</span>
              <span>Version {source.document.version}</span>
              <span>
                {source.snapshot ? "Saved" : "Updated"}{" "}
                {source.document.updatedAt}
              </span>
            </div>
            <p className="source-disclaimer">
              {source.snapshot
                ? "Saved evidence snapshot from this answer. The current library has changed."
                : "Published synthetic support documentation. A highlighted passage is the evidence opened from your answer."}
            </p>
            {source.document.sections.map((s) => (
              <section
                key={s.id}
                className={
                  "source-section " +
                  (source.chunk === source.document.id + "#" + s.id
                    ? "highlighted"
                    : "")
                }
              >
                <h3>{s.heading}</h3>
                <p>{s.text}</p>
                <small>
                  {source.document.id}#{s.id}
                </small>
              </section>
            ))}
          </div>
        </Modal>
      )}
      {handoff && answer && (
        <Modal
          title="Send this question to review"
          onClose={() => !busy && setHandoff(false)}
        >
          <form
            className="modal-body"
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                const item = await api<ReviewCase>(
                  "/answers/" + answer.id + "/handoff",
                  { note: caseNote },
                );
                setAnswer({ ...answer, caseId: item.id });
                setHandoff(false);
              }, "Review case created.");
            }}
          >
            <div className="review-question">
              <MessageSquare size={18} />
              <p>{answer.question}</p>
            </div>
            <p className="muted">
              The question and its evidence stay attached. Add any context that
              would help a reviewer.
            </p>
            <label>
              Additional context
              <textarea
                value={caseNote}
                onChange={(e) => setCaseNote(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="What have you already checked?"
              />
            </label>
            {error && (
              <p role="alert" className="inline-error">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setHandoff(false)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                Create review case <ArrowRight size={15} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {review && (
        <ReviewModal
          item={review}
          resolution={resolution}
          setResolution={setResolution}
          busy={busy}
          error={error}
          onClose={() => !busy && setReview(undefined)}
          onResolve={() =>
            void action(async () => {
              await api("/cases/" + review.id + "/resolve", {
                version: review.version,
                resolution,
              });
              setReview(undefined);
            }, "Case resolved with your note.")
          }
          openEvidence={async () => {
            try {
              const result = await api<Answer>("/answers/" + review.answerId);
              setAnswer(result);
              setReview(undefined);
              navigate("Assistant");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}
    </div>
  );
}
function PageHeading({
  kicker,
  title,
  subtitle,
  aside,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  aside?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="section-kicker">{kicker}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {aside}
    </div>
  );
}
function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span>{icon}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
function ReviewModal({
  item,
  resolution,
  setResolution,
  busy,
  error,
  onClose,
  onResolve,
  openEvidence,
}: {
  item: ReviewCase;
  resolution: string;
  setResolution: (s: string) => void;
  busy: boolean;
  error: string;
  onClose: () => void;
  onResolve: () => void;
  openEvidence: () => void;
}) {
  return (
    <Modal title="Review case" onClose={onClose}>
      <form
        className="modal-body"
        onSubmit={(e) => {
          e.preventDefault();
          onResolve();
        }}
      >
        <span className="mini-label">
          CASE {item.id.slice(0, 8).toUpperCase()}
        </span>
        <h3>{item.question}</h3>
        <p>{item.reason}</p>
        {item.note && <div className="review-question">{item.note}</div>}
        <button type="button" className="text-button" onClick={openEvidence}>
          Inspect the original evidence <ArrowUpRight size={14} />
        </button>
        {item.status === "open" ? (
          <>
            <label>
              Resolution note
              <textarea
                required
                minLength={10}
                maxLength={2000}
                rows={5}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Record what was checked and the next step for the requester."
              />
            </label>
            {error && (
              <p role="alert" className="inline-error">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={busy || resolution.trim().length < 10}
              >
                Resolve case <Check size={15} />
              </button>
            </div>
          </>
        ) : (
          <div className="resolution">
            <strong>Resolution note</strong>
            <p>{item.resolution}</p>
          </div>
        )}
      </form>
    </Modal>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
