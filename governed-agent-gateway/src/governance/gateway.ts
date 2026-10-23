import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { AuditLog } from "./audit.js";
import type { ToolEntry } from "./registry.js";

export type Ctx = { user: string; clearance: 1 | 2 | 3 | 4 };
export type Result = { status: "ok" | "denied" | "approval_required"; reason?: string; data?: unknown; approvalId?: string };
export type Impl = (args: any) => unknown;
/** Switches exist only so the eval suite can build deliberately broken gateways (mutants). */
export type Controls = { enforceRegistry: boolean; enforceActive: boolean; enforceTier: boolean; requireApproval: boolean; audit: boolean };
export const ALL_ON: Controls = { enforceRegistry: true, enforceActive: true, enforceTier: true, requireApproval: true, audit: true };

type Pending = { id: string; tool: string; args: unknown; requestedBy: string; status: "pending" | "approved" | "executed" };

export class Gateway {
  constructor(private registry: ToolEntry[], private impls: Record<string, Impl>, readonly log: AuditLog,
    private pendingFile: string, private controls: Controls = ALL_ON) {
    mkdirSync(dirname(pendingFile), { recursive: true });
  }
  private loadP(): Pending[] { return existsSync(this.pendingFile) ? JSON.parse(readFileSync(this.pendingFile, "utf8")) : []; }
  private saveP(p: Pending[]) { writeFileSync(this.pendingFile, JSON.stringify(p, null, 2)); }
  private rec(ctx: Ctx, tool: string, tier: number | null, decision: string, reason: string, args: unknown) {
    if (this.controls.audit) this.log.append({ user: ctx.user, tool, tier, decision, reason, args });
  }
  invoke(tool: string, args: unknown, ctx: Ctx): Result {
    const entry = this.registry.find((t) => t.name === tool);
    if (!entry && this.controls.enforceRegistry) { this.rec(ctx, tool, null, "denied", "not registered", args); return { status: "denied", reason: "tool not registered" }; }
    const tier = entry?.tier ?? null;
    if (entry && !entry.active && this.controls.enforceActive) { this.rec(ctx, tool, tier, "denied", "tool disabled", args); return { status: "denied", reason: "tool disabled" }; }
    if (entry && entry.mode === "write" && this.controls.requireApproval) {
      const id = randomUUID().slice(0, 8);
      this.saveP([...this.loadP(), { id, tool, args, requestedBy: ctx.user, status: "pending" }]);
      this.rec(ctx, tool, tier, "approval_required", `awaiting ${entry.approver}`, args);
      return { status: "approval_required", approvalId: id, reason: `needs approval by ${entry.approver}` };
    }
    // Tier 4 is write-only here and handled above; clearance gates the read tiers.
    if (entry && entry.tier > ctx.clearance && this.controls.enforceTier) { this.rec(ctx, tool, tier, "denied", `tier ${entry.tier} above clearance ${ctx.clearance}`, args); return { status: "denied", reason: `tier ${entry.tier} above clearance ${ctx.clearance}` }; }
    const impl = this.impls[tool];
    if (!impl) { this.rec(ctx, tool, tier, "denied", "no implementation", args); return { status: "denied", reason: "no implementation" }; }
    const data = impl(args);
    this.rec(ctx, tool, tier, "allowed", "ok", args);
    return { status: "ok", data };
  }
  /** Human-only path: never exposed as an MCP tool. */
  approve(approvalId: string, approver: string): Result {
    const p = this.loadP(); const item = p.find((x) => x.id === approvalId);
    const ctx: Ctx = { user: approver, clearance: 4 };
    if (!item || item.status !== "pending") { this.rec(ctx, item?.tool ?? "unknown", null, "denied", "no such pending approval", { approvalId }); return { status: "denied", reason: "no such pending approval" }; }
    const entry = this.registry.find((t) => t.name === item.tool);
    if (!entry || approver !== entry.approver) { this.rec(ctx, item.tool, entry?.tier ?? null, "denied", `${approver} is not the registered approver`, item.args); return { status: "denied", reason: "not the registered approver" }; }
    item.status = "executed"; this.saveP(p);
    const data = this.impls[item.tool]!(item.args);
    this.rec(ctx, item.tool, entry.tier, "approved_and_executed", `requested by ${item.requestedBy}`, item.args);
    return { status: "ok", data };
  }
}
