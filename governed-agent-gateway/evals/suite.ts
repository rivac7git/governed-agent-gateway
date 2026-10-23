import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuditLog } from "../src/governance/audit.js";
import { ALL_ON, Gateway, type Controls, type Ctx } from "../src/governance/gateway.js";
import { defaultRegistry } from "../src/governance/registry.js";
import { makeImpls } from "../src/tools.js";

export type Env = { gw: Gateway; docs: ReturnType<typeof makeImpls>["docs"]; log: AuditLog; auditFile: string };
export type Case = { id: string; what: string; hard: boolean; run: (e: Env) => string | null }; // null = pass, string = failure message
const ctx = (clearance: Ctx["clearance"]): Ctx => ({ user: "agent:test", clearance });
const fail = (c: boolean, m: string) => (c ? null : m);
const rejectedId = (e: Env) => e.docs.find((d) => d.status === "REJECTED")!.id;

export const cases: Case[] = [
  { id: "C01", what: "list blocked docs at tier 2 returns only blocked/rejected, customers masked", hard: false, run: (e) => {
    const r = e.gw.invoke("list_blocked_documents", {}, ctx(2)); const d = r.data as any[];
    return fail(r.status === "ok" && d.length > 0 && d.every((x) => ["BLOCKED", "REJECTED"].includes(x.status)) && d.every((x) => x.customer.includes("***")), `got ${r.status}`); } },
  { id: "C02", what: "list with explicit status filter", hard: false, run: (e) => {
    const r = e.gw.invoke("list_blocked_documents", { status: "POSTED" }, ctx(2));
    return fail(r.status === "ok" && (r.data as any[]).every((x) => x.status === "POSTED"), "filter ignored"); } },
  { id: "C03", what: "explain_rejection gives the right reason for the right code", hard: false, run: (e) => {
    const id = rejectedId(e); const doc = e.docs.find((d) => d.id === id)!;
    const r = e.gw.invoke("explain_rejection", { id }, ctx(2)); const x = r.data as any;
    return fail(r.status === "ok" && x.code === doc.rejectionCode && typeof x.explanation === "string" && x.explanation.length > 10, "wrong explanation"); } },
  { id: "C04", what: "explain_rejection on a non-rejected doc says so instead of inventing a reason", hard: false, run: (e) => {
    const id = e.docs.find((d) => d.status === "POSTED")!.id; const x = e.gw.invoke("explain_rejection", { id }, ctx(2)).data as any;
    return fail(/not rejected/i.test(x.explanation) && !x.code, "invented a rejection reason"); } },
  { id: "C05", what: "unknown document id returns an error, not data", hard: false, run: (e) =>
    fail(!!(e.gw.invoke("get_order_status", { id: "NOPE-1" }, ctx(3)).data as any).error, "no error for unknown id") },
  { id: "C06", what: "tier 3 read allowed at clearance 3, includes full record", hard: false, run: (e) => {
    const r = e.gw.invoke("get_order_status", { id: "SO-1001" }, ctx(3));
    return fail(r.status === "ok" && !!(r.data as any).customerEmail, `got ${r.status}`); } },
  { id: "C07", what: "tier 3 read DENIED at clearance 2 and the denial is audited", hard: true, run: (e) => {
    const r = e.gw.invoke("get_order_status", { id: "SO-1001" }, ctx(2)); const last = e.log.all().at(-1);
    return fail(r.status === "denied" && !(r as any).data && last?.decision === "denied", "tier breach or missing audit of denial"); } },
  { id: "C08", what: "tier 3 read DENIED at clearance 1", hard: true, run: (e) =>
    fail(e.gw.invoke("get_order_status", { id: "SO-1001" }, ctx(1)).status === "denied", "tier breach") },
  { id: "C09", what: "tier 2 read DENIED at clearance 1", hard: true, run: (e) =>
    fail(e.gw.invoke("list_blocked_documents", {}, ctx(1)).status === "denied", "tier breach") },
  { id: "C10", what: "unregistered tool is refused", hard: true, run: (e) =>
    fail(e.gw.invoke("delete_all_orders", {}, ctx(4)).status === "denied", "unregistered tool executed or crashed") },
  { id: "C11", what: "tool switched off in the registry is refused", hard: true, run: (e) => {
    // the suite builds this env with explain_rejection inactive via env.registryOverride
    const r = e.gw.invoke("__disabled_probe__", {}, ctx(4)); return fail(r.status === "denied", "disabled tool executed"); } },
  { id: "C12", what: "write tool does not execute without approval; state unchanged", hard: true, run: (e) => {
    const id = rejectedId(e); const r = e.gw.invoke("resubmit_document", { id }, ctx(4));
    return fail(r.status === "approval_required" && e.docs.find((d) => d.id === id)!.status === "REJECTED", "write executed without approval"); } },
  { id: "C13", what: "approval by someone other than the registered approver is refused", hard: true, run: (e) => {
    const id = rejectedId(e); const r = e.gw.invoke("resubmit_document", { id }, ctx(4)); const a = e.gw.approve(r.approvalId ?? "x", "agent:test");
    return fail(a.status === "denied" && e.docs.find((d) => d.id === id)!.status === "REJECTED", "wrong approver accepted"); } },
  { id: "C14", what: "registered approver can approve; write executes once and is audited", hard: false, run: (e) => {
    const id = rejectedId(e); const r = e.gw.invoke("resubmit_document", { id }, ctx(4)); const a = e.gw.approve(r.approvalId!, "process-owner");
    const again = e.gw.approve(r.approvalId!, "process-owner"); const d = e.docs.find((x) => x.id === id)!;
    return fail(a.status === "ok" && d.status === "PENDING" && d.resubmitCount === 1 && again.status === "denied" && e.log.all().at(-2)?.decision === "approved_and_executed", "approval flow wrong"); } },
  { id: "C15", what: "audit log is hash-chained and tampering is detected", hard: false, run: (e) => {
    e.gw.invoke("list_blocked_documents", {}, ctx(2)); e.gw.invoke("get_order_status", { id: "SO-1001" }, ctx(1));
    if (e.log.all().length < 2) return "audit log empty";
    if (e.log.verify() !== null) return "chain broken before tampering";
    const lines = readFileSync(e.auditFile, "utf8").split("\n").filter(Boolean); const ev = JSON.parse(lines[0]!); ev.decision = "tampered"; lines[0] = JSON.stringify(ev);
    writeFileSync(e.auditFile, lines.join("\n") + "\n"); return fail(e.log.verify() === 1, "tampering not detected"); } },
];

export type CaseResult = { id: string; what: string; hard: boolean; passed: boolean; message: string | null };
export function runSuite(controls: Controls = ALL_ON): { score: number; passed: number; total: number; hardFailures: number; results: CaseResult[] } {
  const results: CaseResult[] = cases.map((c) => {
    const dir = mkdtempSync(join(tmpdir(), "gw-eval-")); const auditFile = join(dir, "audit.jsonl");
    const { docs, impls } = makeImpls(); const log = new AuditLog(auditFile);
    const registry = defaultRegistry(); registry.push({ name: "__disabled_probe__", tier: 1, mode: "read", approver: "none", active: false, description: "probe" });
    const gw = new Gateway(registry, { ...impls, __disabled_probe__: () => "executed", delete_all_orders: () => "executed" }, log, join(dir, "pending.json"), controls);
    let message: string | null;
    try { message = c.run({ gw, docs, log, auditFile }); } catch (err) { message = `threw: ${(err as Error).message}`; }
    return { id: c.id, what: c.what, hard: c.hard, passed: message === null, message };
  });
  const passed = results.filter((r) => r.passed).length;
  return { score: passed / results.length, passed, total: results.length, hardFailures: results.filter((r) => !r.passed && r.hard).length, results };
}
export const appendHistory = (file: string, entry: object) => appendFileSync(file, JSON.stringify(entry) + "\n");
