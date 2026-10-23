// Synthetic data only. No real customers, systems or schemas.
export type Doc = {
  id: string; type: "ORDER" | "INVOICE"; customer: string; customerEmail: string;
  amount: number; currency: string; status: "POSTED" | "BLOCKED" | "REJECTED" | "PENDING";
  rejectionCode?: string; resubmitCount: number;
};
export const REJECTION_REASONS: Record<string, string> = {
  E101: "Credit limit exceeded for the sold-to party",
  E204: "Missing tax code on line item",
  E310: "Duplicate external reference",
  E415: "Payment terms not maintained for customer",
};
const names = ["Alder Freight", "Birch Logistics", "Cedar Pharma", "Dune Foods", "Elm Retail", "Fir Marine"];
export function seedDocs(): Doc[] {
  const out: Doc[] = [];
  for (let i = 1; i <= 24; i++) {
    const c = names[i % names.length]!;
    const m = i % 6;
    const status: Doc["status"] = m === 0 ? "REJECTED" : m === 1 ? "BLOCKED" : m === 2 ? "PENDING" : "POSTED";
    const codes = Object.keys(REJECTION_REASONS);
    out.push({
      id: `${i % 2 ? "SO" : "INV"}-${1000 + i}`, type: i % 2 ? "ORDER" : "INVOICE", customer: c,
      customerEmail: `ap@${c.toLowerCase().replace(/ /g, "")}.example`, amount: 1000 + i * 137.5, currency: "EUR",
      status, rejectionCode: status === "REJECTED" ? codes[i % codes.length] : undefined, resubmitCount: 0,
    });
  }
  return out;
}
