import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AuditLog } from "./governance/audit.js";
import { Gateway, type Ctx } from "./governance/gateway.js";
import { defaultRegistry } from "./governance/registry.js";
import { makeImpls } from "./tools.js";

const dir = process.env.GATEWAY_RUNTIME_DIR ?? "runtime";
const clearance = Number(process.env.GATEWAY_CLEARANCE ?? 3) as Ctx["clearance"];
const ctx: Ctx = { user: process.env.GATEWAY_USER ?? "agent:copilot", clearance };
const registry = defaultRegistry();
const { impls } = makeImpls();
const gw = new Gateway(registry, impls, new AuditLog(`${dir}/audit.jsonl`), `${dir}/pending.json`);

const server = new McpServer({ name: "governed-agent-gateway", version: "0.1.0" });
const shapes: Record<string, z.ZodRawShape> = {
  list_blocked_documents: { status: z.enum(["BLOCKED", "REJECTED", "PENDING", "POSTED"]).optional() },
  explain_rejection: { id: z.string() }, get_order_status: { id: z.string() }, resubmit_document: { id: z.string() },
};
for (const t of registry) {
  server.registerTool(t.name, { description: `[tier ${t.tier}, ${t.mode}] ${t.description}`, inputSchema: shapes[t.name]! }, async (args) => {
    const r = gw.invoke(t.name, args, ctx);
    return { content: [{ type: "text" as const, text: JSON.stringify(r) }], isError: r.status === "denied" };
  });
}
await server.connect(new StdioServerTransport());
