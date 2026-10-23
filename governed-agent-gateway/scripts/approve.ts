// Human approval path. Not reachable from the model: run it yourself.  npm run approve -- <approvalId> <approver>
import { AuditLog } from "../src/governance/audit.js";
import { Gateway } from "../src/governance/gateway.js";
import { defaultRegistry } from "../src/governance/registry.js";
import { makeImpls } from "../src/tools.js";
const [id, approver] = process.argv.slice(2);
if (!id || !approver) { console.error("usage: approve <approvalId> <approver>"); process.exit(1); }
const dir = process.env.GATEWAY_RUNTIME_DIR ?? "runtime";
const gw = new Gateway(defaultRegistry(), makeImpls().impls, new AuditLog(`${dir}/audit.jsonl`), `${dir}/pending.json`);
console.log(JSON.stringify(gw.approve(id, approver), null, 2));
