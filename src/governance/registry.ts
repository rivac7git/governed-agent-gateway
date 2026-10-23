// Tier model: 1 metadata/synthetic, 2 aggregated/masked, 3 schema-aware inside perimeter, 4 human-in-the-loop.
export type Tier = 1 | 2 | 3 | 4;
export type ToolEntry = { name: string; tier: Tier; mode: "read" | "write"; approver: string; active: boolean; description: string };
export const defaultRegistry = (): ToolEntry[] => [
  { name: "list_blocked_documents", tier: 2, mode: "read", approver: "process-owner", active: true,
    description: "List blocked/rejected documents with masked customer names." },
  { name: "explain_rejection", tier: 2, mode: "read", approver: "process-owner", active: true,
    description: "Explain the rejection code of a document in plain language." },
  { name: "get_order_status", tier: 3, mode: "read", approver: "process-owner", active: true,
    description: "Full status record of one document (customer contact included)." },
  { name: "resubmit_document", tier: 4, mode: "write", approver: "process-owner", active: true,
    description: "Resubmit a rejected document. Requires a named human approval." },
];
