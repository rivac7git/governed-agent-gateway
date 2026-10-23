// Runs the scenario + evals and writes web/public/data.json for the dashboard.
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path";
import { AuditLog } from "../src/governance/audit.js"; import { Gateway } from "../src/governance/gateway.js";
import { defaultRegistry } from "../src/governance/registry.js"; import { makeImpls } from "../src/tools.js"; import { REJECTION_REASONS } from "../src/data/seed.js";
import { runSuite } from "../evals/suite.js";
const dir = mkdtempSync(join(tmpdir(), "gw-demo-")); const { docs, impls } = makeImpls(); const log = new AuditLog(join(dir, "audit.jsonl"));
const reg = defaultRegistry(); const gw = new Gateway(reg, impls, log, join(dir, "p.json"));
const agent = { user: "agent:copilot", clearance: 2 as const };
gw.invoke("list_blocked_documents", {}, agent);
const rej = docs.find((d) => d.status === "REJECTED")!;
gw.invoke("explain_rejection", { id: rej.id }, agent);
gw.invoke("get_order_status", { id: rej.id }, agent);           // tier breach at clearance 2 -> denied
gw.invoke("delete_all_orders", {}, agent);                       // unregistered -> denied
const w = gw.invoke("resubmit_document", { id: rej.id }, agent); // approval required
gw.approve(w.approvalId!, "process-owner");
const suite = runSuite();
const hist = existsSync("evals/history.jsonl") ? readFileSync("evals/history.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
writeFileSync("web/public/data.json", JSON.stringify({ docs, reasons: REJECTION_REASONS, registry: reg, audit: log.all(), chainOk: log.verify() === null, suite, history: hist }, null, 2));
console.log("wrote web/public/data.json");
