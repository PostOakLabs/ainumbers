// 817-eth-l2-stage-classifier — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:745613ba971a82796741cf117a41c497d5b114a5059b6a293a3e1432ff895949
// spec: board/claimed/ETH-L2-EXIT-STAGE-NODE-1.md
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/817-eth-l2-stage-classifier.proptest.mjs

import { compute } from '../817-eth-l2-stage-classifier.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = '817-eth-l2-stage-classifier';
const N = 600;

const ALL = {
  self_identifies_as_rollup: true, state_roots_posted_on_l1: true, da_on_l1: true,
  reconstruction_software_available: true, has_proper_proof_system: true, proof_system_type: 'fraud',
  fraud_proof_external_actors: 8, fraud_proof_permissionless: true,
  security_council_present: true, council_min_share_to_compromise_pct: 80,
  non_council_upgrades_possible: true, non_council_upgrade_exit_window_days: 10,
  unwanted_upgrade_exit_window_days: 45, council_restricted_to_onchain_detected_errors: true,
};
const RANK = { BELOW_STAGE_0: 0, STAGE_0: 1, STAGE_1: 2, STAGE_2: 3 };

const pick = (rng, xs) => xs[Math.floor(rng() * xs.length)];
const tri = (rng) => pick(rng, [true, false, null]);

// Fully random declared set: every field true, false or absent, numbers around their thresholds.
function randomPP(rng) {
  const council = tri(rng);
  const pp = {
    self_identifies_as_rollup: tri(rng), state_roots_posted_on_l1: tri(rng), da_on_l1: tri(rng),
    reconstruction_software_available: tri(rng), has_proper_proof_system: tri(rng),
    proof_system_type: pick(rng, ['fraud', 'validity', null]),
    fraud_proof_external_actors: pick(rng, [null, 0, 4, 5, 6, 30]),
    fraud_proof_permissionless: tri(rng),
    security_council_present: council,
    council_min_share_to_compromise_pct: council === false ? null : pick(rng, [null, 0, 74.9, 75, 100]),
    non_council_upgrades_possible: tri(rng),
    non_council_upgrade_exit_window_days: pick(rng, [null, 0, 6.9, 7, 90]),
    unwanted_upgrade_exit_window_days: pick(rng, [null, 0, 29.9, 30, 365]),
    council_restricted_to_onchain_detected_errors: tri(rng),
  };
  return pp;
}

function checkDeterminismAndShape() {
  const rng = mulberry32(817);
  let v = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomPP(rng);
    const a = compute(pp);
    const b = compute(JSON.parse(JSON.stringify(pp)));
    if (!deepEqual(a, b)) v++;
    const o = a.output_payload;
    if (o.refused !== false || o.live_stage_asserted !== false) v++;
    if (!deepEqual(o.issues, a.compliance_flags)) v++;
    if (o.criteria.length !== 11) v++;
    const failed = o.criteria.filter((c) => c.status === 'FAILED').map((c) => c.id);
    const indet = o.criteria.filter((c) => c.status === 'INDETERMINATE').map((c) => c.id);
    if (!deepEqual(failed, o.failed_criteria) || !deepEqual(indet, o.indeterminate_criteria)) v++;
  }
  return { name: 'determinism_and_output_shape', checked: N, violations: v };
}

// The reading is cumulative: a level above stage k is only returned when every criterion at or
// below stage k is MET or NOT_APPLICABLE, and INDETERMINATE only when nothing below it failed.
function checkLevelConsistency() {
  const rng = mulberry32(818);
  let v = 0;
  for (let i = 0; i < N; i++) {
    const o = compute(randomPP(rng)).output_payload;
    const clean = (n) => o.criteria.filter((c) => c.stage <= n).every((c) => c.status === 'MET' || c.status === 'NOT_APPLICABLE');
    if (o.declared_level === 'STAGE_2' && !clean(2)) v++;
    if (o.declared_level === 'STAGE_1' && !(clean(1) && o.criteria.some((c) => c.stage === 2 && c.status === 'FAILED'))) v++;
    if (o.declared_level === 'STAGE_0' && !(clean(0) && o.criteria.some((c) => c.stage === 1 && c.status === 'FAILED'))) v++;
    if (o.declared_level === 'BELOW_STAGE_0' && !o.criteria.some((c) => c.stage === 0 && c.status === 'FAILED')) v++;
    if (o.declared_level === 'INDETERMINATE') {
      if (o.first_unresolved_stage === null) v++;
      if (o.criteria.some((c) => c.stage < o.first_unresolved_stage && c.status === 'FAILED')) v++;
    } else if (o.first_unresolved_stage !== null) v++;
    if (o.declared_level === 'STAGE_2' && o.highest_confirmed_stage !== 2) v++;
  }
  return { name: 'level_is_cumulative_over_stages', checked: N, violations: v };
}

// Improving one declaration (false to true, or a number raised) never lowers a determinate reading.
function checkMonotone() {
  const rng = mulberry32(819);
  let v = 0;
  const boolKeys = ['self_identifies_as_rollup', 'state_roots_posted_on_l1', 'da_on_l1', 'reconstruction_software_available',
    'has_proper_proof_system', 'fraud_proof_permissionless', 'council_restricted_to_onchain_detected_errors'];
  for (let i = 0; i < N; i++) {
    const pp = randomPP(rng);
    pp.proof_system_type = pp.proof_system_type === 'none' ? 'fraud' : pp.proof_system_type;
    const before = compute(pp).output_payload;
    const key = pick(rng, boolKeys);
    if (pp[key] !== false) continue;
    const better = { ...pp, [key]: true };
    const after = compute(better).output_payload;
    if (before.declared_level in RANK && after.declared_level in RANK && RANK[after.declared_level] < RANK[before.declared_level]) v++;
    if (after.failed_criteria.length > before.failed_criteria.length) v++;
  }
  // Raising the unwanted-upgrade window across the threshold flips S2-2 and nothing else.
  for (const days of [0, 1, 29.999, 30, 30.001, 365]) {
    const o = compute({ ...ALL, unwanted_upgrade_exit_window_days: days }).output_payload;
    const s22 = o.criteria.find((c) => c.id === 'S2-2').status;
    if (s22 !== (days >= 30 ? 'MET' : 'FAILED')) v++;
    if (o.criteria.filter((c) => c.id !== 'S2-2').some((c) => c.status !== 'MET')) v++;
  }
  return { name: 'improving_a_declaration_never_lowers_the_reading', checked: N + 6, violations: v };
}

// A declaration that is absent is never guessed: blanking any single field of the all-met fraud-proof
// set leaves a criterion INDETERMINATE and the reading INDETERMINATE, never a stage.
function checkMissingNeverGuessed() {
  let v = 0;
  let n = 0;
  for (const key of Object.keys(ALL)) {
    for (const how of ['absent', 'null']) {
      const pp = { ...ALL };
      if (how === 'absent') delete pp[key]; else pp[key] = null;
      const o = compute(pp).output_payload;
      n++;
      if (o.declared_level !== 'INDETERMINATE' || o.indeterminate_criteria.length === 0) v++;
    }
  }
  if (compute({}).output_payload.declared_level !== 'INDETERMINATE') v++;
  return { name: 'missing_declaration_is_indeterminate_never_a_stage', checked: n + 1, violations: v };
}

function checkRefusals() {
  /** @type {Array<[(p: any) => void, string]>} */
  const cases = [
    [(p) => { p.proof_system_type = 'optimistic'; }, 'PROOF_SYSTEM_TYPE_UNKNOWN'],
    [(p) => { p.da_on_l1 = 1; }, 'BOOLEAN_FIELD_NOT_BOOLEAN'],
    [(p) => { p.fraud_proof_external_actors = 2.5; }, 'FRAUD_PROOF_ACTORS_OUT_OF_RANGE'],
    [(p) => { p.fraud_proof_external_actors = -1; }, 'FRAUD_PROOF_ACTORS_OUT_OF_RANGE'],
    [(p) => { p.council_min_share_to_compromise_pct = 101; }, 'COUNCIL_SHARE_OUT_OF_RANGE'],
    [(p) => { p.council_min_share_to_compromise_pct = '80'; }, 'COUNCIL_SHARE_OUT_OF_RANGE'],
    [(p) => { p.unwanted_upgrade_exit_window_days = -3; }, 'EXIT_WINDOW_OUT_OF_RANGE'],
    [(p) => { p.non_council_upgrade_exit_window_days = Infinity; }, 'EXIT_WINDOW_OUT_OF_RANGE'],
    [(p) => { p.proof_system_type = 'none'; }, 'PROOF_SYSTEM_DECLARATIONS_CONTRADICT'],
    [(p) => { p.security_council_present = false; }, 'COUNCIL_SHARE_DECLARED_WITHOUT_COUNCIL'],
  ];
  let v = 0;
  for (const [mutate, code] of cases) {
    const p = { ...ALL };
    mutate(p);
    const r = compute(p);
    if (r.output_payload.refusal_code !== code || !deepEqual(r.compliance_flags, ['INPUT_REFUSED'])) v++;
  }
  if (compute([]).output_payload.refusal_code !== 'INPUT_NOT_AN_OBJECT') v++;
  return { name: 'each_refusal_branch_reachable', checked: cases.length + 1, violations: v };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkDeterminismAndShape(),
  checkLevelConsistency(),
  checkMonotone(),
  checkMissingNeverGuessed(),
  checkRefusals(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
