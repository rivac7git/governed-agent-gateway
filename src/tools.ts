import { Doc, REJECTION_REASONS, seedDocs } from "./data/seed.js";
const mask = (s: string) => s.split(" ").map((w) => w[0] + "***").join(" ");
export function makeImpls(docs: Doc[] = seedDocs()) {
  return {
    docs,
    impls: {
      list_blocked_documents: (a: { status?: string }) =>
        docs.filter((d) => (a?.status ? d.status === a.status : d.status === "BLOCKED" || d.status === "REJECTED"))
          .map((d) => ({ id: d.id, type: d.type, customer: mask(d.customer), status: d.status, rejectionCode: d.rejectionCode ?? null })),
      explain_rejection: (a: { id: string }) => {
        const d = docs.find((x) => x.id === a.id);
        if (!d) return { error: "unknown document" };
        if (d.status !== "REJECTED") return { id: d.id, explanation: `Document is ${d.status}, not rejected.` };
        return { id: d.id, code: d.rejectionCode, explanation: REJECTION_REASONS[d.rejectionCode!] ?? "Unknown code" };
      },
      get_order_status: (a: { id: string }) => docs.find((x) => x.id === a.id) ?? { error: "unknown document" },
      resubmit_document: (a: { id: string }) => {
        const d = docs.find((x) => x.id === a.id);
        if (!d || d.status !== "REJECTED") return { error: "only rejected documents can be resubmitted" };
        d.status = "PENDING"; d.rejectionCode = undefined; d.resubmitCount++;
        return { id: d.id, status: d.status, resubmitCount: d.resubmitCount };
      },
    },
  };
}
