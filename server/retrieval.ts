import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { SourceDocument, Chunk, Evidence } from "./types.js";
const stop = new Set(
  "a an the is are was were be been being do does did can could would should how what why when where who which i my me we our you your it its this that these those to of for in on with at from by and or but if as have has had still please about get tell explain mean means".split(
    " ",
  ),
);
const synonyms: Record<string, string> = {
  viewers: "viewer",
  makers: "maker",
  checkers: "checker",
  confirming: "reconciling",
  confirmation: "confirmed",
  uncertain: "reconciling",
  unknown: "reconciling",
  stuck: "waiting",
  approve: "approval",
  approved: "approval",
  approving: "approval",
  approvals: "approval",
  approver: "checker",
  admin: "administrator",
  admins: "administrator",
  administrators: "administrator",
  retries: "retry",
  retrying: "retry",
  retryable: "retry",
  declines: "declined",
  decline: "declined",
  rejected: "reject",
  rejection: "reject",
  passwords: "password",
  recipients: "recipient",
  beneficiary: "recipient",
  beneficiaries: "recipient",
  duplicates: "duplicate",
  duplicated: "duplicate",
  workspaces: "workspace",
  payments: "payment",
  transfers: "transfer",
  tokens: "token",
  invitations: "invitation",
  invites: "invitation",
  invite: "invitation",
  emails: "email",
  records: "record",
  statuses: "status",
  fees: "fee",
  refunds: "refund",
  currencies: "currency",
  naira: "ngn",
  logs: "history",
  audit: "history",
  restarted: "restart",
  restarting: "restart",
  members: "member",
  revoked: "deactivate",
  revocation: "deactivate",
  access: "membership",
  expires: "expire",
  expiration: "expire",
  expiry: "expire",
  expirationtime: "expire",
  forgot: "forgotten",
  changing: "change",
  changed: "change",
  expired: "expire",
  permanently: "permanent",
};
export function tokens(text: string) {
  return (
    text
      .toLowerCase()
      .normalize("NFKC")
      .match(/[a-z0-9]+/g)
      ?.filter((t) => !stop.has(t) && t.length > 1)
      .map((t) => synonyms[t] ?? t) ?? []
  );
}
export function suspicious(text: string) {
  return /ignore\s+(all\s+|previous\s+|prior\s+)?(instructions|rules)|system\s*(prompt|message)\s*[:=]|reveal\s+(your\s+)?(prompt|secret|token)|<\/?(system|developer)>|send\s+.*(password|secret|token)\s+to|bypass\s+(all\s+)?(rules|safety|guardrails)/i.test(
    text,
  );
}
export class Corpus {
  documents: SourceDocument[];
  chunks: Chunk[];
  version: string;
  private terms: Map<string, number>[];
  private df = new Map<string, number>();
  private average: number;
  constructor(
    catalog = JSON.parse(
      readFileSync(
        new URL("../knowledge/catalog.json", import.meta.url),
        "utf8",
      ),
    ) as { version: string; documents: SourceDocument[] },
  ) {
    this.documents = catalog.documents;
    this.version =
      catalog.version +
      "-" +
      createHash("sha256")
        .update(JSON.stringify(catalog.documents))
        .digest("hex")
        .slice(0, 8);
    this.chunks = this.documents.flatMap((d) =>
      d.sections.map((s) => ({
        id: d.id + "#" + s.id,
        documentId: d.id,
        title: d.title,
        heading: s.heading,
        text: s.text,
        version: d.version,
        category: d.category,
        quarantined: suspicious(s.text),
      })),
    );
    this.terms = this.chunks.map((c) => {
      const map = new Map<string, number>();
      for (const t of tokens(c.title + " " + c.heading + " " + c.text))
        map.set(t, (map.get(t) ?? 0) + 1);
      for (const t of map.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      return map;
    });
    this.average =
      this.terms.reduce(
        (sum, m) => sum + [...m.values()].reduce((a, b) => a + b, 0),
        0,
      ) / Math.max(1, this.terms.length);
  }
  retrieve(question: string, limit = 4): Evidence[] {
    const query = [...new Set(tokens(question))];
    if (!query.length) return [];
    return this.chunks
      .flatMap((chunk, i) => {
        if (chunk.quarantined) return [];
        const terms = this.terms[i],
          length = [...terms.values()].reduce((a, b) => a + b, 0),
          matches = query.filter((t) => terms.has(t));
        const score = matches.reduce((n, t) => {
          const frequency = terms.get(t)!;
          const idf = Math.log(
            1 +
              (this.chunks.length - (this.df.get(t) ?? 0) + 0.5) /
                ((this.df.get(t) ?? 0) + 0.5),
          );
          return (
            n +
            (idf * frequency * 2.2) /
              (frequency + 1.2 * (0.25 + (0.75 * length) / this.average))
          );
        }, 0);
        return score > 0
          ? [
              {
                ...chunk,
                score: Math.round(score * 1000) / 1000,
                coverage: matches.length / query.length,
                matches,
              },
            ]
          : [];
      })
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, limit);
  }
}
