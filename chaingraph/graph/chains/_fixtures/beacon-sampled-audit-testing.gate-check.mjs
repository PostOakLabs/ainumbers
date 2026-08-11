// beacon-sampled-audit-testing.gate-check.mjs
// Local, site-repo-only proof that this chain's two OCG v0.8 SS21.4 gates are
// statically valid, that the three fixture scenarios drive every branch +
// default, and that the TWO REGIME CONFIGURATIONS of the one generic ceremony
// (prevailing wage via art-574, garnishment via art-572) both reach their
// recompute stage from an identical art-583 selection.
// Reuses the SAME evaluator (kernels/_gateval.mjs) and the SAME kernels
// (kernels/index.mjs) the worker's runChain/gate-static use -- it does not
// reimplement gate semantics, only the minimal forward-stepping loop, because
// mcp-apps-poc/ (where runChain.mjs and gate-static.mjs actually live) is out
// of this row's fence. The worker-CI gates (gate-static.test.mjs,
// gate-branch-coverage.test.mjs, gate-parity.test.mjs) still MUST run at
// ASSEMBLE-LAND time against the vendored copy; this is not a substitute.
//
// Run: node chaingraph/graph/chains/_fixtures/beacon-sampled-audit-testing.gate-check.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getKernel } from '../../../kernels/index.mjs';
import { evaluateGate, isPointerSyntaxValid, stepId, isTerminalTarget } from '../../../kernels/_gateval.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const chain = JSON.parse(readFileSync(here + '../beacon-sampled-audit-testing.json', 'utf8'));
const fixtures = JSON.parse(readFileSync(here + 'beacon-sampled-audit-testing.fixtures.json', 'utf8'));

const DERIVER = 'art-583-beacon-seeded-fair-sampling-deriver';
const PW = 'art-574-certified-payroll-prevailing-wage-recompute';
const GARNISH = 'art-572-multi-garnishment-stacking-recompute';

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
  const verdicts = {};
  while (idx < chain.steps.length) {
    const step = chain.steps[idx];
    const kernel = getKernel(step.tool_id);
    if (!kernel) { bad(name + ': kernel found for ' + step.tool_id); return { decisions, ran, verdicts }; }
    const pp = inputs[step.tool_id] ?? {};
    const artifact = await kernel.buildArtifact(pp, { now: '1970-01-01T00:00:00.000Z' });
    ran.push(step.tool_id);
    verdicts[step.tool_id] = artifact.output_payload.verdict;
    if (step.gate) {
      const dec = { step_id: stepId(step, idx), ...evaluateGate(step.gate, artifact.output_payload) };
      decisions.push(dec);
      if (isTerminalTarget(dec.next)) break;
      idx = ids.indexOf(dec.next);
    } else {
      idx++;
    }
  }
  return { decisions, ran, verdicts };
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
else ok(`fixture set (sample_not_derived, prevailing_wage_configuration, garnishment_configuration) drives every branch: ${[...branchesHit].join(', ')}`);

// --- expected reachability + the two-configuration claim ---
const rNoSample = await runScenario('sample_not_derived', fixtures.sample_not_derived);
const rPW = await runScenario('prevailing_wage_configuration', fixtures.prevailing_wage_configuration);
const rGarnish = await runScenario('garnishment_configuration', fixtures.garnishment_configuration);

if (JSON.stringify(rNoSample.ran) !== JSON.stringify([DERIVER])) bad('sample_not_derived halts after art-583 only', JSON.stringify(rNoSample.ran));
else if (rNoSample.verdicts[DERIVER] !== 'INDETERMINATE') bad('sample_not_derived art-583 verdict is INDETERMINATE', rNoSample.verdicts[DERIVER]);
else ok('sample_not_derived: an underived sample ends the automated path (gate 1 default -> end); no population is recomputed');

if (JSON.stringify(rPW.ran) !== JSON.stringify([DERIVER, PW])) bad('prevailing_wage_configuration runs art-583 then art-574 and ends', JSON.stringify(rPW.ran));
else if (rPW.verdicts[DERIVER] !== 'DERIVED') bad('prevailing_wage_configuration art-583 verdict is DERIVED', rPW.verdicts[DERIVER]);
else if (rPW.verdicts[PW] === 'INDETERMINATE') bad('prevailing_wage_configuration art-574 reaches a tested verdict', rPW.verdicts[PW]);
else ok(`prevailing_wage_configuration: CONFIGURATION 1 — art-583 DERIVED -> art-574 ${rPW.verdicts[PW]} (gate 2 default -> end)`);

if (JSON.stringify(rGarnish.ran) !== JSON.stringify([DERIVER, PW, GARNISH])) bad('garnishment_configuration falls through art-574 to art-572', JSON.stringify(rGarnish.ran));
else if (rGarnish.verdicts[DERIVER] !== 'DERIVED') bad('garnishment_configuration art-583 verdict is DERIVED', rGarnish.verdicts[DERIVER]);
else if (rGarnish.verdicts[PW] !== 'INDETERMINATE') bad('garnishment_configuration art-574 is INDETERMINATE (no certified payroll declared)', rGarnish.verdicts[PW]);
else if (rGarnish.verdicts[GARNISH] === 'INDETERMINATE') bad('garnishment_configuration art-572 reaches a tested verdict', rGarnish.verdicts[GARNISH]);
else ok(`garnishment_configuration: CONFIGURATION 2 — art-583 DERIVED -> art-574 INDETERMINATE (gate 2 rule0) -> art-572 ${rGarnish.verdicts[GARNISH]}`);

// The ceremony claim the pack page teaches: an IDENTICAL selection drives both configurations.
const pwSel = JSON.stringify(rPW.verdicts) && (await (async () => {
  const k = getKernel(DERIVER);
  const a = await k.buildArtifact(fixtures.prevailing_wage_configuration[DERIVER], { now: '1970-01-01T00:00:00.000Z' });
  const b = await k.buildArtifact(fixtures.garnishment_configuration[DERIVER], { now: '1970-01-01T00:00:00.000Z' });
  return [a.execution_hash, b.execution_hash, JSON.stringify(a.output_payload.selected_indices)];
})());
if (pwSel[0] !== pwSel[1]) bad('both configurations share one identical art-583 selection', `${pwSel[0]} vs ${pwSel[1]}`);
else ok(`both configurations run off ONE identical selection: execution_hash ${pwSel[0].slice(0, 16)}… indices ${pwSel[2]}`);

if (fail) { console.error(`\n✗ gate-check: ${fail} failure(s)`); process.exit(1); }
console.log('\n✅ beacon-sampled-audit-testing: SS21.4 static validity, both-branch fixture coverage, and both regime configurations proven locally against site-repo kernels.');
