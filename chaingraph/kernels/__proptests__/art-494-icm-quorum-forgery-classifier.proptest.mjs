// art-494-icm-quorum-forgery-classifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C24-1).
// kernel_digest_at_authoring: sha256:5d1204c5f516f5975687ac3d86c9f9325f1fbac2071cfebf14f55f33094d7c7f
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO per the WU row's own table, direct read confirmed on re-check — BUT this is
// the closest call in the shard: the quorum gate `cum*100 >= total_stake_weight*quorum_pct` is a
// genuine numeric threshold comparison over caller-supplied floats, deliberately cross-multiplied
// (source comment) "so no division rounding can move the boundary." Because the source itself
// engineers this comparison to avoid float precision loss rather than exhibiting float-boundary
// sensitivity, and the WU row classifies it float:no, this file floors it with FORCED CATEGORICAL
// boundary cases around the quorum threshold (spec §3's float:no fallback) rather than an ULP claim.
// Checks: fixture-oracle gate, termination (validators bounded by input validator_weights.length),
// forced categorical boundary cases at the quorum threshold (exact match, zero stake, zero
// quorum_pct, quorum_pct>100, single validator meeting quorum alone), differential re-derivation of
// min_colluding_validators via independent sorted-prefix-sum, and metamorphic permutation-invariance
// (shuffling validator_weights input order never changes min_colluding_validators/total_stake_weight).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-494-icm-quorum-forgery-classifier.proptest.mjs

import { compute } from '../art-494-icm-quorum-forgery-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-494-icm-quorum-forgery-classifier.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x494E0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomValidators(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ validator_id: `V${i}`, weight: pick(rng, [0, 1, 10, 33, 50, 100, 1000]) + (rng() < 0.3 ? rng() * 10 : 0) });
  }
  return out;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 10);
  return {
    validator_weights: randomValidators(rng, n),
    quorum_pct: pick(rng, [1, 33, 50, 67, 90, 100]),
    min_colluding_floor: Math.floor(rng() * 3),
    source_l1_label: pick(rng, ['Subnet-A', '']),
    message_class: pick(rng, ['warp', null]),
  };
}

const TRIALS = 5000;

// ---------- P1: termination — total_validators bounded by input array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const validCount = pp.validator_weights.filter((v) => v && String(v.validator_id || '').trim()).length;
    if (output_payload.total_validators > pp.validator_weights.length) violations++;
    if (output_payload.total_validators !== validCount) violations++;
    if (output_payload.min_colluding_validators !== null && output_payload.min_colluding_validators > output_payload.total_validators) violations++;
  }
  return { name: 'P1_termination_validators_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2: forced categorical boundary cases at the quorum threshold (float:no fallback) ----------
function checkP2_quorum_boundary_categorical() {
  let violations = 0, checked = 0;
  const cases = [
    // exact quorum match: 2 validators of 50 each, quorum 100 -> both required
    { validators: [{ validator_id: 'A', weight: 50 }, { validator_id: 'B', weight: 50 }], quorum_pct: 100, expectMin: 2, expectReachable: true },
    // quorum exactly met by the single largest validator
    { validators: [{ validator_id: 'A', weight: 67 }, { validator_id: 'B', weight: 33 }], quorum_pct: 67, expectMin: 1, expectReachable: true },
    // one unit below the threshold requires both
    { validators: [{ validator_id: 'A', weight: 66 }, { validator_id: 'B', weight: 34 }], quorum_pct: 67, expectMin: 2, expectReachable: true },
    // quorum_pct = 0 (invalid, outside evaluable range)
    { validators: [{ validator_id: 'A', weight: 50 }], quorum_pct: 0, expectMin: null, expectReachable: false },
    // quorum_pct > 100 (invalid)
    { validators: [{ validator_id: 'A', weight: 50 }], quorum_pct: 101, expectMin: null, expectReachable: false },
    // zero total stake
    { validators: [{ validator_id: 'A', weight: 0 }, { validator_id: 'B', weight: 0 }], quorum_pct: 50, expectMin: null, expectReachable: false },
    // no validators
    { validators: [], quorum_pct: 50, expectMin: null, expectReachable: false },
    // quorum_pct exactly 100 with all-but-one weight — full set required
    { validators: [{ validator_id: 'A', weight: 1 }, { validator_id: 'B', weight: 1 }, { validator_id: 'C', weight: 1 }], quorum_pct: 100, expectMin: 3, expectReachable: true },
  ];
  for (const c of cases) {
    const pp = { validator_weights: c.validators, quorum_pct: c.quorum_pct, min_colluding_floor: 0, source_l1_label: 'Test', message_class: null };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.quorum_reachable !== c.expectReachable) violations++;
    if (c.expectMin !== null && output_payload.min_colluding_validators !== c.expectMin) violations++;
  }
  return { name: 'P2_quorum_threshold_forced_categorical_boundary', trials: checked, violations };
}

// ---------- P3 (differential): min_colluding_validators re-derivation via independent prefix-sum ----------
function checkP3_min_colluding_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const validators = pp.validator_weights
      .map((v) => ({ id: String((v && v.validator_id) || '').trim(), w: Math.max(0, Number(v && v.weight) || 0) }))
      .filter((v) => v.id);
    const total = validators.reduce((s, v) => s + v.w, 0);
    const quorumValid = pp.quorum_pct > 0 && pp.quorum_pct <= 100;
    if (!quorumValid || validators.length === 0 || total <= 0) {
      if (output_payload.quorum_reachable !== false) violations++;
      continue;
    }
    const sorted = [...validators].sort((a, b) => b.w - a.w || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    let cum = 0, expectedMin = null;
    for (let j = 0; j < sorted.length; j++) {
      cum += sorted[j].w;
      if (cum * 100 >= total * pp.quorum_pct) { expectedMin = j + 1; break; }
    }
    if (output_payload.min_colluding_validators !== expectedMin) violations++;
  }
  return { name: 'P3_min_colluding_validators_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of validator_weights input order ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp).output_payload;
    const shuffled = [...pp.validator_weights];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r2 = compute({ ...pp, validator_weights: shuffled }).output_payload;
    checked++;
    if (r1.min_colluding_validators !== r2.min_colluding_validators) violations++;
    if (r1.total_stake_weight !== r2.total_stake_weight) violations++;
    if (r1.quorum_reachable !== r2.quorum_reachable) violations++;
    if (r1.stake_hhi !== r2.stake_hhi) violations++;
  }
  return { name: 'P4_permutation_invariance_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_quorum_boundary_categorical());
results.properties.push(checkP3_min_colluding_differential());
results.properties.push(checkP4_permutation_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-494-icm-quorum-forgery-classifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
