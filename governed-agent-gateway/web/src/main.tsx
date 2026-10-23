import { useEffect, useState } from "react"; import { createRoot } from "react-dom/client";
const css = `body{font:14px system-ui;margin:0;background:#f6f7f9;color:#1a1f2b}main{max-width:1000px;margin:0 auto;padding:16px}h1{font-size:20px}h2{font-size:15px;margin:22px 0 8px}
table{border-collapse:collapse;width:100%;background:#fff}td,th{border:1px solid #dde1e7;padding:5px 8px;text-align:left}th{background:#eef1f6}.ok{color:#14733a}.bad{color:#b3261e;font-weight:600}.mut{color:#5b6472}.pill{padding:1px 8px;border-radius:9px;background:#e8eefc}`;
const D = (d: string) => (d === "allowed" || d === "approved_and_executed" ? "ok" : d === "denied" ? "bad" : "mut");
function App() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetch("./data.json").then((r) => r.json()).then(setD); }, []);
  if (!d) return <main>Loading… (run <code>npm run export</code> first)</main>;
  const s = d.suite;
  return (<main><style>{css}</style>
    <h1>Governed agent gateway <span className="mut">· synthetic data</span></h1>
    <h2>Eval score <span className="pill">{s.passed}/{s.total}</span> hard failures: <span className={s.hardFailures ? "bad" : "ok"}>{s.hardFailures}</span></h2>
    <table><tbody>{s.results.map((r: any) => <tr key={r.id}><td>{r.id}</td><td className={r.passed ? "ok" : "bad"}>{r.passed ? "pass" : "FAIL"}</td><td>{r.hard ? "hard" : ""}</td><td>{r.what}</td></tr>)}</tbody></table>
    <h2>Run history</h2>
    <table><tbody>{d.history.map((h: any, i: number) => <tr key={i}><td>{h.version}</td><td>{h.ts}</td><td>{h.passed}/{h.total}</td><td>hard {h.hardFailures}</td></tr>)}</tbody></table>
    <h2>Tool registry</h2>
    <table><thead><tr><th>Tool</th><th>Tier</th><th>Mode</th><th>Approver</th><th>Active</th></tr></thead><tbody>{d.registry.map((t: any) => <tr key={t.name}><td>{t.name}</td><td>{t.tier}</td><td>{t.mode}</td><td>{t.approver}</td><td>{String(t.active)}</td></tr>)}</tbody></table>
    <h2>Rejected / blocked documents</h2>
    <table><thead><tr><th>Id</th><th>Status</th><th>Reason</th></tr></thead><tbody>{d.docs.filter((x: any) => x.status === "REJECTED" || x.status === "BLOCKED").map((x: any) => <tr key={x.id}><td>{x.id}</td><td>{x.status}</td><td>{x.rejectionCode ? `${x.rejectionCode}: ${d.reasons[x.rejectionCode]}` : ""}</td></tr>)}</tbody></table>
    <h2>Audit trail <span className={d.chainOk ? "ok" : "bad"}>{d.chainOk ? "chain intact" : "CHAIN BROKEN"}</span></h2>
    <table><thead><tr><th>#</th><th>User</th><th>Tool</th><th>Tier</th><th>Decision</th><th>Reason</th></tr></thead><tbody>{d.audit.map((e: any) => <tr key={e.seq}><td>{e.seq}</td><td>{e.user}</td><td>{e.tool}</td><td>{e.tier ?? "–"}</td><td className={D(e.decision)}>{e.decision}</td><td>{e.reason}</td></tr>)}</tbody></table>
  </main>);
}
createRoot(document.getElementById("root")!).render(<App />);
