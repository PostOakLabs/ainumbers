// art-497-validator-change-control-receipt.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C25-1).
// kernel_digest_at_authoring: sha256:54af35dcf6e35f959764ddf334f63dafbdf57047a8f810e47e3f980586a861b3
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (matches the WU row, direct read confirms). `r2((weight_delta/total_stake_weight)
// * 100)` is genuine IEEE-754 division, but `share_of_total_pct` is a DISPLAY-ONLY informational field
// — it never feeds a branch, a compliance_flag, or an exception. Every actual decision
// (ADD_WITH_NONZERO_PRIOR_WEIGHT, quorum_status, etc.) compares caller-supplied weights/counts
// directly with exact equality/inequality, never a derived/rounded float. Forced categorical boundary
// cases are used in place of ULP-boundary forcing, per the art-461/art-465 precedent for a
// display-only float ratio.
// Checks: fixture-oracle gate, termination (authorization_chain bounded by input array length after
// filter(Boolean)), differential re-derivation of weight_delta/quorum_status, permutation-invariance
// of authorizing_identities order (only count/membership matter), and forced categorical boundary
// cases around each change_type's exact-equality branches and the quorum threshold.
//
// Run: node chaingraph/kernels/__proptests__/art-497-validator-change-control-receipt.proptest.mjs

import { compute } from '../art-497-validator-change-control-receipt.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-497-validator-change-control-receipt.fixtures.json');
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
const rand = mulberry32(0x49700);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomIdentities(rng) {
  const n = Math.floor(rng() * 6);
  const out = [];
  for (let i = 0; i < n; i++) out.push(rng() < 0.1 ? '' : `id-${Math.floor(rng() * 5)}`);
  return out;
}

function randomPP(rng) {
  const change_type = pick(rng, ['add', 'remove', 'weight_change', 'bogus']);
  return {
    validator_ref: rng() < 0.05 ? '' : `V-${Math.floor(rng() * 100)}`,
    change_type,
    prior_weight: Math.floor(rng() * 1000),
    posterior_weight: Math.floor(rng() * 1000),
    total_stake_weight: rng() < 0.1 ? 0 : Math.floor(rng() * 1_000_000),
    authorizing_identities: randomIdentities(rng),
    quorum_required: rng() < 0.15 ? undefined : Math.floor(rng() * 5),
    quorum_achieved: rng() < 0.15 ? undefined : Math.floor(rng() * 5),
    effective_epoch: rng() < 0.1 ? '' : `E-${Math.floor(rng() * 10)}`,
    as_of: '2026-08-11',
  };
}

const TRIALS = 3000;

// ---------- P1: termination — authorization_chain bounded by input array length, non-empty strings only ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.authorization_chain.length > pp.authorizing_identities.length) violations++;
    if (output_payload.authorization_chain.some((s) => s === '')) violations++;
  }
  return { name: 'P1_authorization_chain_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2 (differential): weight_delta and quorum_status re-derived ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const prior = Math.max(0, Number(pp.prior_weight));
    const posterior = Math.max(0, Number(pp.posterior_weight));
    if (output_payload.weight_delta !== posterior - prior) violations++;

    const qr = Number(pp.quorum_required);
    const qrEvaluable = Number.isFinite(qr) && qr > 0;
    const qa = Number(pp.quorum_achieved);
    let expectedStatus;
    if (!qrEvaluable) expectedStatus = 'UNQUANTIFIED';
    else if (!Number.isFinite(qa)) expectedStatus = 'UNQUANTIFIED';
    else expectedStatus = qa >= qr ? 'MET' : 'SHORT';
    if (output_payload.quorum_status !== expectedStatus) violations++;
  }
  return { name: 'P2_weight_delta_and_quorum_status_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — permuting authorizing_identities never changes authorized/quorum fields ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    if (pp.authorizing_identities.length < 2) continue;
    const shuffled = { ...pp, authorizing_identities: [...pp.authorizing_identities].sort(() => rand() - 0.5) };
    const r1 = compute(pp).output_payload;
    const r2 = compute(shuffled).output_payload;
    checked++;
    if (r1.authorized !== r2.authorized) violations++;
    if (r1.authorization_chain.length !== r2.authorization_chain.length) violations++;
    if (r1.quorum_status !== r2.quorum_status) violations++;
  }
  return { name: 'P3_authorizing_identities_order_invariance', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (the r2()-based display ratio is never gated on) ----------
function checkP4_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  const base = { validator_ref: 'V1', authorizing_identities: ['id1'], effective_epoch: 'E1' };

  // add with zero prior and positive posterior -> no ADD exceptions
  checked++;
  {
    const r = compute({ ...base, change_type: 'add', prior_weight: 0, posterior_weight: 5, total_stake_weight: 100 }).output_payload;
    if (r.exceptions.includes('ADD_WITH_NONZERO_PRIOR_WEIGHT') || r.exceptions.includes('ADD_WITH_NONPOSITIVE_POSTERIOR_WEIGHT')) violations++;
  }
  // add with nonzero prior -> exception raised
  checked++;
  {
    const r = compute({ ...base, change_type: 'add', prior_weight: 1, posterior_weight: 5, total_stake_weight: 100 }).output_payload;
    if (!r.exceptions.includes('ADD_WITH_NONZERO_PRIOR_WEIGHT')) violations++;
  }
  // remove with zero posterior and positive prior -> no REMOVE exceptions
  checked++;
  {
    const r = compute({ ...base, change_type: 'remove', prior_weight: 5, posterior_weight: 0, total_stake_weight: 100 }).output_payload;
    if (r.exceptions.includes('REMOVE_WITH_NONZERO_POSTERIOR_WEIGHT') || r.exceptions.includes('REMOVE_WITH_NONPOSITIVE_PRIOR_WEIGHT')) violations++;
  }
  // weight_change with identical prior/posterior -> no-delta exception
  checked++;
  {
    const r = compute({ ...base, change_type: 'weight_change', prior_weight: 7, posterior_weight: 7, total_stake_weight: 100 }).output_payload;
    if (!r.exceptions.includes('WEIGHT_CHANGE_WITH_NO_DELTA')) violations++;
  }
  // quorum exact-equality boundary: achieved === required -> MET
  checked++;
  {
    const r = compute({ ...base, change_type: 'weight_change', prior_weight: 1, posterior_weight: 2, total_stake_weight: 100, quorum_required: 3, quorum_achieved: 3 }).output_payload;
    if (r.quorum_status !== 'MET') violations++;
  }
  // quorum one below -> SHORT
  checked++;
  {
    const r = compute({ ...base, change_type: 'weight_change', prior_weight: 1, posterior_weight: 2, total_stake_weight: 100, quorum_required: 3, quorum_achieved: 2 }).output_payload;
    if (r.quorum_status !== 'SHORT') violations++;
  }
  // total_stake_weight zero -> share_of_total_pct null, TOTAL_STAKE_WEIGHT_ZERO_OR_ABSENT exception, no throw
  checked++;
  {
    const r = compute({ ...base, change_type: 'weight_change', prior_weight: 1, posterior_weight: 2, total_stake_weight: 0 }).output_payload;
    if (r.share_of_total_pct !== null || !r.exceptions.includes('TOTAL_STAKE_WEIGHT_ZERO_OR_ABSENT')) violations++;
  }
  // empty input -> no throw, finite gate
  checked++;
  {
    const r = compute({}).output_payload;
    if (typeof r !== 'object' || r === null) violations++;
  }
  return { name: 'P4_forced_categorical_boundaries', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-497-validator-change-control-receipt',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
