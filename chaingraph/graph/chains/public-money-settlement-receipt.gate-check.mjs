// public-money-settlement-receipt.gate-check.mjs
// Local, site-repo-only proof that this chain's two OCG v0.8 SS21.4 gates are
// statically valid and that the three fixture scenarios in
// public-money-settlement-receipt.fixtures.json drive every branch + default.
// Reuses the SAME evaluator (kernels/_gateval.mjs) and the SAME kernels
// (kernels/index.mjs) the worker's runChain/gate-static use -- it does not
// reimplement gate semantics, only the minimal forward-stepping loop, because
// mcp-apps-poc/ (where runChain.mjs and gate-static.mjs actually live) is out
// of this row's fence. The worker-CI gates (gate-static.test.mjs,
// gate-branch-coverage.test.mjs, gate-parity.test.mjs) still MUST run at
// ASSEMBLE-LAND time against the vendored copy; this is not a substitute.
//
// Run: node chaingraph/graph/chains/public-money-settlement-receipt.gate-check.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getKernel } from '../../kernels/index.mjs';
import { evaluateGate, isPointerSyntaxValid, stepId, isTerminalTarget } from '../../kernels/_gateval.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const chain = JSON.parse(readFileSync(here + 'public-money-settlement-receipt.json', 'utf8'));
const fixtures = JSON.parse(readFileSync(here + 'public-money-settlement-receipt.fixtures.json', 'utf8'));

let fail = 0;
const ok = (label) => console.log('  ✓ ' + label);
const bad = (label, detail) => { fail++; console.error('  ✗ ' + label + (detail ? ' — ' + detail : '')); };

// --- SS21.4 static checks (mirrors gate-static.mjs's rules, standalone here) ---
const OPS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'present', 'absent']);
const ids = chain.steps.map((s, i) => stepId(s, i));
if (new Set(ids).size !== ids.length) bad('unique step ids'); else ok('step ids unique: ' + ids.join(', '));
chain.steps.forEach((s, i) => {
  if (!s.gate) return;
  if (!isPointerSyntaxValid(s.gate.input)) bad(`step ${i + 1} gate.input RFC 6901 valid`);
  if (!Array.isArray(s.gate.rules) || !s.gate.rules.length) bad(`step ${i + 1} rules non-empty`);
  s.gate.rules.forEach((r) => { if (!OPS.has(r.op)) bad(`step ${i + 1} op in closed enum`, r.op); });
  if (!s.gate.default) bad(`step ${i + 1} default present (mandatory)`);
  const targets = [...s.gate.rules.map((r) => r.next), s.gate.default];
  for (const t of targets) {
    if (isTerminalTarget(t)) continue;
    const ti = ids.indexOf(t);
    if (ti === -1) bad(`step ${i + 1} target resolves`, t);
    else if (ti <= i) bad(`step ${i + 1} target forward-only`, t);
  }
});
if (!fail) ok('both gates pass SS21.4 static validity (pointer syntax, closed enum, mandatory default, forward-only targets)');

// --- minimal forward-stepping loop (same shape as embed/runChain.mjs, kernels-only) ---
async function runScenario(name, inputs) {
  let idx = 0;
  const decisions = [];
  const ran = [];
  while (idx < chain.steps.length) {
    const step = chain.steps[idx];
    const kernel = getKernel(step.tool_id);
    if (!kernel) { bad(name + ': kernel found for ' + step.tool_id); return { decisions, ran }; }
    const pp = inputs[step.tool_id] ?? {};
    const artifact = await kernel.buildArtifact(pp, { now: '1970-01-01T00:00:00.000Z' });
    ran.push(step.tool_id);
    if (step.gate) {
      const dec = { step_id: stepId(step, idx), ...evaluateGate(step.gate, artifact.output_payload) };
      decisions.push(dec);
      if (isTerminalTarget(dec.next)) break;
      idx = ids.indexOf(dec.next);
    } else {
      idx++;
    }
  }
  return { decisions, ran };
}

const branchesNeeded = new Set();
chain.steps.forEach((s, i) => {
  if (!s.gate) return;
  s.gate.rules.forEach((_, ri) => branchesNeeded.add(`${stepId(s, i)}#rule${ri}`));
  branchesNeeded.add(`${stepId(s, i)}#default`);
});
const branchesHit = new Set();

for (const [name, inputs] of Object.entries(fixtures)) {
  if (name === 'note') continue;
  const { decisions, ran } = await runScenario(name, inputs);
  for (const d of decisions) branchesHit.add(`${d.step_id}#${d.matched_rule_index === null ? 'default' : 'rule' + d.matched_rule_index}`);
  ok(`${name}: ran [${ran.join(' -> ')}], decisions=${JSON.stringify(decisions.map((d) => ({ step: d.step_id, next: d.next })))}`);
}

const missing = [...branchesNeeded].filter((b) => !branchesHit.has(b));
if (missing.length) bad('every SS21.4 branch + default is driven by the fixture set', JSON.stringify(missing));
else ok(`fixture set (no_currency, currency_canton_leg, currency_bank_rail_leg) drives every branch: ${[...branchesHit].join(', ')}`);

// --- expected reachability, sanity per fixture ---
const expectNoCurrency = (r) => r.ran.length === 1 && r.ran[0] === 'art-513-public-money-settlement-receipt';
const expectCanton = (r) => JSON.stringify(r.ran) === JSON.stringify(['art-513-public-money-settlement-receipt', 'art-492-classify-settlement-finality', 'art-59-settlement-asset-finality-classifier', '511-multi-currency-pvp-validator']);
const expectBankRail = (r) => JSON.stringify(r.ran) === JSON.stringify(['art-513-public-money-settlement-receipt', 'art-492-classify-settlement-finality', 'art-59-settlement-asset-finality-classifier', '511-multi-currency-pvp-validator', 'rca-03-iso20022-address-migration-verifier']);

const rNoCur = await runScenario('no_currency', fixtures.no_currency);
const rCanton = await runScenario('currency_canton_leg', fixtures.currency_canton_leg);
const rBank = await runScenario('currency_bank_rail_leg', fixtures.currency_bank_rail_leg);
if (!expectNoCurrency(rNoCur)) bad('no_currency halts after art-513 only', JSON.stringify(rNoCur.ran));
else ok('no_currency correctly halts the automated path after art-513 (gate 1 default -> end)');
if (!expectCanton(rCanton)) bad('currency_canton_leg halts after 511 (skips rca-03)', JSON.stringify(rCanton.ran));
else ok('currency_canton_leg correctly runs all 4 members and skips rca-03 (gate 2 rule0 -> end)');
if (!expectBankRail(rBank)) bad('currency_bank_rail_leg runs all 5 members', JSON.stringify(rBank.ran));
else ok('currency_bank_rail_leg correctly runs the full 5-member chain (gate 2 default -> rca-03)');

if (fail) { console.error(`\n✗ gate-check: ${fail} failure(s)`); process.exit(1); }
console.log('\n✅ public-money-settlement-receipt: SS21.4 static validity + both-branch fixture coverage proven locally against site-repo kernels.');
