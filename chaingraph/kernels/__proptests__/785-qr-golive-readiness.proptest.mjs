// 785-qr-golive-readiness — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:a43752c87c5de993eccfbbfd7e00a4f60ee5347e73ec83e174fa79b6f2025622
// spec: research/QR-GOLIVE-PIN-2026-10-29.md (gate catalogue + Level One principles)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/785-qr-golive-readiness.proptest.mjs

import { compute } from '../785-qr-golive-readiness.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = '785-qr-golive-readiness';

const ALL = ['participant_certification', 'uat_completion', 'config_signoff', 'operating_procedures', 'support_cover', 'communications', 'link_agreements'];
const metGates = () => ALL.map(id => ({ gate_id: id, status: 'met' }));

// Class A — output shape: every non-refusal payload carries the fixed output fields.
function checkOutputShape() {
  let checked = 0, violations = 0;
  const phases = ['pilot', 'production', 'cross_border'];
  for (const phase of phases) {
    const r = compute({ phase, gates: metGates() });
    checked++;
    const p = r.output_payload;
    if (p.refusal !== false || typeof p.verdict !== 'string' || !Number.isInteger(p.score_bp)
      || !Array.isArray(p.blocking_failures) || !Array.isArray(p.conditions)
      || !Array.isArray(p.principles_summary) || !('phase_next' in p)) violations++;
    if (!['GO', 'GO_WITH_CONDITIONS', 'NO_GO'].includes(p.verdict)) violations++;
  }
  return { name: 'output_shape_fixed_fields', checked, violations };
}

// Class B — monotonicity: raising any gate status never lowers the score or worsens the verdict.
function checkMonotonicity() {
  let checked = 0, violations = 0;
  const rank = { not_met: 0, partially_met: 1, met: 2 };
  const verdictRank = { NO_GO: 0, GO_WITH_CONDITIONS: 1, GO: 2 };
  for (const phase of ['pilot', 'production', 'cross_border']) {
    for (const gate of ALL) {
      const low = compute({ phase, gates: ALL.map(id => ({ gate_id: id, status: id === gate ? 'not_met' : 'met' })) });
      const high = compute({ phase, gates: ALL.map(id => ({ gate_id: id, status: id === gate ? 'partially_met' : 'met' })) });
      checked++;
      if (high.output_payload.score_bp < low.output_payload.score_bp) violations++;
      if (verdictRank[high.output_payload.verdict] < verdictRank[low.output_payload.verdict]) violations++;
    }
  }
  return { name: 'monotone_in_gate_status', checked, violations };
}

// Class A — blocking-gate rule: a not_met blocking gate at the phase always yields NO_GO.
function checkBlockingNoGo() {
  let checked = 0, violations = 0;
  for (const phase of ['pilot', 'production', 'cross_border']) {
    for (const gate of ALL) {
      const r = compute({ phase, gates: ALL.map(id => ({ gate_id: id, status: id === gate ? 'not_met' : 'met' })) });
      checked++;
      if (r.output_payload.verdict === 'NO_GO') {
        if (!r.output_payload.blocking_failures.some(f => f.gate_id === gate)) violations++;
      } else {
        // acceptable only if the gate is not blocking at this phase
        const blockingSet = new Set(['participant_certification', 'uat_completion', 'config_signoff', 'operating_procedures', 'support_cover',
          ...(phase !== 'pilot' ? ['communications'] : []),
          ...(phase === 'cross_border' ? ['link_agreements'] : [])]);
        if (blockingSet.has(gate)) violations++;
      }
    }
  }
  return { name: 'blocking_gate_not_met_gives_no_go', checked, violations };
}

// Class A — invalid-domain rejection: bad phase, empty gates, bad status, out-of-bounds weights.
function checkRefusals() {
  let checked = 0, violations = 0;
  const cases = [
    { pp: { phase: 'launch', gates: metGates() }, flag: 'REFUSED_INVALID_PHASE' },
    { pp: { phase: 'pilot' }, flag: 'REFUSED_MISSING_GATES' },
    { pp: { phase: 'pilot', gates: [{ gate_id: 'nope', status: 'met' }] }, flag: 'REFUSED_UNKNOWN_GATE' },
    { pp: { phase: 'pilot', gates: [{ gate_id: 'communications', status: 'done' }] }, flag: 'REFUSED_INVALID_STATUS' },
    { pp: { phase: 'pilot', gates: metGates(), weights: { participant_certification: 9000 } }, flag: 'REFUSED_WEIGHTS_OUT_OF_BOUNDS' },
    { pp: { phase: 'pilot', gates: metGates(), weights: { communications: -5 } }, flag: 'REFUSED_WEIGHTS_OUT_OF_BOUNDS' },
    { pp: { phase: 'pilot', gates: metGates(), uat_summary: { mandatory_cases: 10 } }, flag: 'REFUSED_INVALID_UAT_SUMMARY' },
    { pp: { phase: 'pilot', gates: metGates(), principles: [{ principle_id: 'x', status: 'maybe' }] }, flag: 'REFUSED_INVALID_PRINCIPLES' },
  ];
  for (const c of cases) {
    const r = compute(c.pp);
    checked++;
    if (r.output_payload.refusal !== true || !r.compliance_flags.includes(c.flag)) violations++;
  }
  return { name: 'invalid_domain_rejections', checked, violations };
}

// Class B — UAT exit-criteria override: open Sev-1 or failed pass count forces the UAT gate
// to not_met and the verdict to NO_GO even when every submitted gate is met.
function checkUatOverride() {
  let checked = 0, violations = 0;
  for (const u of [{ mandatory_cases: 48, passed: 48, open_sev1: 1 }, { mandatory_cases: 48, passed: 40, open_sev1: 0 }]) {
    const r = compute({ phase: 'production', gates: metGates(), uat_summary: u });
    checked++;
    if (r.output_payload.verdict !== 'NO_GO') violations++;
    if (!r.output_payload.blocking_failures.some(f => f.gate_id === 'uat_completion')) violations++;
  }
  const ok = compute({ phase: 'production', gates: metGates(), uat_summary: { mandatory_cases: 48, passed: 48, open_sev1: 0 } });
  checked++;
  if (ok.output_payload.verdict !== 'GO') violations++;
  return { name: 'uat_exit_criteria_override', checked, violations };
}

// Class A — weights override equivalence: a valid override equal to the defaults reproduces
// the same score; bounds [0,5000] with sum 10000 accepted.
function checkWeightsOverride() {
  let checked = 0, violations = 0;
  const defaults = Object.fromEntries(ALL.map(id => ({ participant_certification: 2000, uat_completion: 2000, config_signoff: 1000, operating_procedures: 1500, support_cover: 1500, communications: 1000, link_agreements: 1000 }[id] !== undefined ? [id, { participant_certification: 2000, uat_completion: 2000, config_signoff: 1000, operating_procedures: 1500, support_cover: 1500, communications: 1000, link_agreements: 1000 }[id]] : [id, 0])));
  const base = compute({ phase: 'pilot', gates: ALL.map(id => ({ gate_id: id, status: 'partially_met' })) });
  const over = compute({ phase: 'pilot', gates: ALL.map(id => ({ gate_id: id, status: 'partially_met' })), weights: defaults });
  checked++;
  if (over.output_payload.refusal === true || over.output_payload.score_bp !== base.output_payload.score_bp) violations++;
  return { name: 'weights_override_identity_and_bounds', checked, violations };
}

// Class K — determinism: same input, same output bytes.
function checkDeterminism() {
  const pp = { phase: 'cross_border', gates: ALL.map((id, i) => ({ gate_id: id, status: ['met', 'partially_met', 'met', 'met', 'not_met', 'met', 'met'][i] })), principles: [{ principle_id: 'safe_payments', status: 'met' }] };
  const a = JSON.stringify(compute(pp)), b = JSON.stringify(compute(pp));
  return { name: 'deterministic', checked: 1, violations: a !== b ? 1 : 0 };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkOutputShape(),
  checkMonotonicity(),
  checkBlockingNoGo(),
  checkRefusals(),
  checkUatOverride(),
  checkWeightsOverride(),
  checkDeterminism(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
