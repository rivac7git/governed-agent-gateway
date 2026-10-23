import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "gw-"));
const t = new StdioClientTransport({ command: "npx", args: ["tsx", "src/server.ts"], env: { ...process.env as Record<string,string>, GATEWAY_RUNTIME_DIR: dir } });
const c = new Client({ name: "smoke", version: "0" });
await c.connect(t);
const tools = (await c.listTools()).tools.map((x) => x.name).sort();
const call = async (name: string, args: Record<string, unknown>) => JSON.parse(((await c.callTool({ name, arguments: args })) as any).content[0].text);
const a = await call("list_blocked_documents", {});
const b = await call("get_order_status", { id: "SO-1001" });
const r = await call("resubmit_document", { id: a.data.find((d: any) => d.status === "REJECTED").id });
const ok = tools.length === 4 && a.status === "ok" && b.status === "ok" && r.status === "approval_required";
console.log({ tools, list: a.status, status: b.status, resubmit: r.status });
await c.close();
if (!ok) { console.error("SMOKE FAILED"); process.exit(1); }
console.log("smoke ok");
