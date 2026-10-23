import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
export type AuditEvent = {
  seq: number; ts: string; user: string; tool: string; tier: number | null; decision: string; reason: string;
  argsHash: string; prevHash: string; hash: string;
};
const h = (s: string) => createHash("sha256").update(s).digest("hex");
export class AuditLog {
  constructor(private file: string) { mkdirSync(dirname(file), { recursive: true }); }
  all(): AuditEvent[] {
    if (!existsSync(this.file)) return [];
    return readFileSync(this.file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  }
  append(e: { user: string; tool: string; tier: number | null; decision: string; reason: string; args: unknown }): AuditEvent {
    const prev = this.all().at(-1);
    const base = { seq: (prev?.seq ?? 0) + 1, ts: new Date().toISOString(), user: e.user, tool: e.tool, tier: e.tier,
      decision: e.decision, reason: e.reason, argsHash: h(JSON.stringify(e.args ?? null)), prevHash: prev?.hash ?? "GENESIS" };
    const ev: AuditEvent = { ...base, hash: h(JSON.stringify(base)) };
    appendFileSync(this.file, JSON.stringify(ev) + "\n");
    return ev;
  }
  /** Returns the seq of the first broken link, or null if the chain is intact. */
  verify(): number | null {
    let prev = "GENESIS";
    for (const e of this.all()) {
      const { hash, ...base } = e;
      if (e.prevHash !== prev || h(JSON.stringify(base)) !== hash) return e.seq;
      prev = hash;
    }
    return null;
  }
}
