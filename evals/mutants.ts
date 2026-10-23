// Proves the evals can fail: each mutant switches one control off and MUST be caught.
import { ALL_ON, type Controls } from "../src/governance/gateway.js";
import { runSuite } from "./suite.js";
const mutants: { name: keyof Controls; needsHard: boolean }[] = [
  { name: "enforceRegistry", needsHard: true }, { name: "enforceActive", needsHard: true },
  { name: "enforceTier", needsHard: true }, { name: "requireApproval", needsHard: true }, { name: "audit", needsHard: false },
];
let bad = 0;
for (const m of mutants) {
  const r = runSuite({ ...ALL_ON, [m.name]: false });
  const caught = r.score < 1 && (!m.needsHard || r.hardFailures > 0);
  console.log(`${caught ? "CAUGHT " : "MISSED "} mutant "${m.name} off": score ${r.passed}/${r.total}, hard failures ${r.hardFailures}, failing ${r.results.filter((x) => !x.passed).map((x) => x.id).join(",")}`);
  if (!caught) bad++;
}
if (bad) { console.error(`${bad} mutant(s) not caught`); process.exit(1); }
console.log("all mutants caught");
