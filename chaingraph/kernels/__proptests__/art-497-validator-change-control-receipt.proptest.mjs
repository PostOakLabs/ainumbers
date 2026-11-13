// art-497-validator-change-control-receipt.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C25-1).
// kernel_digest_at_authoring: sha256:64d13da8da930b00c495a583b6e58e4f530a3ca3ea360c4b2ce3d70db8192630
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
// of authorizing_identities order (only count/membership matter), forced categorical boundary
// cases around each change_type's exact-equality branches and the quorum threshold, and the strict
// statedness matrix (P6): weights, total stake and quorum numbers are statements only as finite JSON
// numbers or one strict decimal-string form; blanks, booleans, arrays, objects and junk refuse
// NOT_STATED, negatives refuse NEGATIVE, quorum counts must be whole, nothing coerces or clamps.
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
  // null and undefined fall to the same empty-object refuse path and never throw
  // (allowlist rule: compute(null) / compute(undefined) refuse, never accept)
  checked++;
  {
    const r = compute(null).output_payload;
    if (typeof r !== 'object' || r === null) violations++;
    if (r.exceptions.length === 0) violations++;
  }
  checked++;
  {
    const r = compute(undefined).output_payload;
    if (typeof r !== 'object' || r === null) violations++;
    if (r.exceptions.length === 0) violations++;
  }
  return { name: 'P4_forced_categorical_boundaries', trials: checked, violations };
}

// ---------- P5: required inputs fail closed (missing-input cure) ----------
// All ten manifest-required fields: deleting any one of them from the positive
// base vector must land the receipt in a non-positive state (an exception plus
// ESCALATION_RAISED, or an UNQUANTIFIED quorum). The weight and as-of fields are
// the cured ones (a missing weight used to read as a stated zero, a missing as_of
// used to pass silently); the quorum/identity/ref fields were already fail-closed
// and are pinned here so they stay that way. JSON null behaves like deleted for
// the cured three; an explicit 0 stays the caller's own statement and evaluates.
function checkP5_requiredInputsFailClosed() {
  const base = JSON.parse(readFileSync(path.join(__dirname, '..', 'fixtures', 'art-497-validator-change-control-receipt.fixtures.json'), 'utf8')).vectors[0].policy_parameters;
  const REQUIRED = ['as_of', 'authorizing_identities', 'change_type', 'effective_epoch', 'posterior_weight', 'prior_weight', 'quorum_achieved', 'quorum_required', 'total_stake_weight', 'validator_ref'];
  let violations = 0, checked = 0;
  for (const f of REQUIRED) {
    const pp = { ...base };
    delete pp[f];
    const { output_payload: op, compliance_flags } = compute(pp);
    checked++;
    if (op.exceptions.length === 0) violations++;
    if (!compliance_flags.includes('ESCALATION_RAISED')) violations++;
    if (f === 'quorum_achieved' || f === 'quorum_required') {
      if (op.quorum_status !== 'UNQUANTIFIED') violations++;
    }
  }
  // JSON null for the three cured fields behaves like deletion (no statement).
  for (const f of ['as_of', 'prior_weight', 'posterior_weight']) {
    const pp = { ...base, [f]: null };
    const { output_payload: op, compliance_flags } = compute(pp);
    checked++;
    if (!compliance_flags.includes('ESCALATION_RAISED')) violations++;
    if (op.exceptions.length === 0) violations++;
  }
  // An explicit 0 weight is the caller's own statement and evaluates as such
  // (here: a weight_change with no delta raises the no-delta exception, not NOT_STATED).
  const r0 = compute({ ...base, prior_weight: 0, posterior_weight: 0 }).output_payload;
  checked++;
  if (r0.exceptions.includes('PRIOR_WEIGHT_NOT_STATED') || r0.exceptions.includes('POSTERIOR_WEIGHT_NOT_STATED')) violations++;
  if (!r0.exceptions.includes('WEIGHT_CHANGE_WITH_NO_DELTA')) violations++;
  return { name: 'P5_required_inputs_fail_closed', trials: checked, violations };
}

// ---------- P6: strict statedness matrix (weight-statedness cure) ----------
// A weight, total-stake or quorum number is a statement ONLY as a finite JSON
// number or as one strict decimal-string form (a minus sign, digits, at most
// one fractional part; quorum counts whole), because the page port sends DOM
// input strings. Every other shape -- empty or blank string, boolean, array
// (empty or singleton), object, null, NaN, ±Infinity, exponent/hex/plus/junk
// strings -- must refuse NOT_STATED and never read as a coerced stated zero;
// negatives must refuse NEGATIVE and never clamp; a refused field echoes null
// (or its negative value), weight_delta/share_of_total_pct are never derived
// from a refused statement, quorum verdicts go UNQUANTIFIED (never SHORT),
// and every refusal escalates. String fields must be non-empty strings.
function checkP6_statednessMatrix() {
  let violations = 0, checked = 0;
  const base = JSON.parse(readFileSync(path.join(__dirname, '..', 'fixtures', 'art-497-validator-change-control-receipt.fixtures.json'), 'utf8')).vectors[0].policy_parameters;
  const NON_STATEMENTS = ['', '   ', false, true, [], ['5'], {}, 'junk', '1e3', '12,5', '+12', '0x10', '12.', '.5', null, NaN, Infinity, -Infinity, undefined];
  const NEGATIVE_WEIGHTS = [-1, -9.5, '-9', '-0.5'];
  const NEGATIVE_COUNTS = [-1, '-9'];
  const WEXC = { prior_weight: 'PRIOR_WEIGHT', posterior_weight: 'POSTERIOR_WEIGHT', total_stake_weight: 'TOTAL_STAKE_WEIGHT' };

  for (const f of ['prior_weight', 'posterior_weight', 'total_stake_weight']) {
    for (const bad of NON_STATEMENTS) {
      const { output_payload: op, compliance_flags } = compute({ ...base, [f]: bad });
      checked++;
      if (!op.exceptions.includes(WEXC[f] + '_NOT_STATED')) violations++;
      if (op[f] !== null) violations++;
      if (!compliance_flags.includes('ESCALATION_RAISED')) violations++;
      if (op.share_of_total_pct !== null) violations++;
      if (f !== 'total_stake_weight' && op.weight_delta !== null) violations++;
    }
    for (const neg of NEGATIVE_WEIGHTS) {
      const { output_payload: op, compliance_flags } = compute({ ...base, [f]: neg });
      checked++;
      if (!op.exceptions.includes(WEXC[f] + '_NEGATIVE')) violations++;
      if (!compliance_flags.includes('ESCALATION_RAISED')) violations++;
      if (op.share_of_total_pct !== null) violations++;
    }
  }

  const QEXC = { quorum_required: 'QUORUM_REQUIRED', quorum_achieved: 'QUORUM_ACHIEVED' };
  for (const f of ['quorum_required', 'quorum_achieved']) {
    for (const bad of NON_STATEMENTS) {
      const { output_payload: op, compliance_flags } = compute({ ...base, [f]: bad });
      checked++;
      if (op.quorum_status !== 'UNQUANTIFIED') violations++;
      if (op[f] !== null) violations++;
      if (!op.exceptions.includes(QEXC[f] + '_NOT_STATED')) violations++;
      if (!compliance_flags.includes('ESCALATION_RAISED')) violations++;
    }
    for (const frac of [2.5, '2.5', -1.5]) {
      const { output_payload: op } = compute({ ...base, [f]: frac });
      checked++;
      if (op.quorum_status !== 'UNQUANTIFIED' || op[f] !== null) violations++;
      if (!op.exceptions.includes(QEXC[f] + '_NOT_STATED')) violations++;
    }
    for (const neg of NEGATIVE_COUNTS) {
      const { output_payload: op, compliance_flags } = compute({ ...base, [f]: neg });
      checked++;
      if (op.quorum_status !== 'UNQUANTIFIED') violations++;
      if (!op.exceptions.includes(QEXC[f] + '_NEGATIVE')) violations++;
      if (!compliance_flags.includes('ESCALATION_RAISED')) violations++;
    }
  }

  for (const f of ['as_of', 'effective_epoch', 'validator_ref']) {
    const want = f === 'as_of' ? 'AS_OF_MISSING' : f === 'effective_epoch' ? 'EFFECTIVE_EPOCH_MISSING' : 'VALIDATOR_REF_MISSING';
    for (const bad of [0, 20260730, false, [], {}, null]) {
      const { output_payload: op } = compute({ ...base, [f]: bad });
      checked++;
      if (op[f] !== null) violations++;
      if (!op.exceptions.includes(want)) violations++;
    }
  }

  // change_type stays an exact allowlist of strings: an array never coerces in.
  {
    const op = compute({ ...base, change_type: ['add'] }).output_payload;
    checked++;
    if (op.change_type_valid !== false || !op.exceptions.includes('UNKNOWN_CHANGE_TYPE')) violations++;
  }

  // The strict decimal-string form evaluates exactly like the numeric base.
  {
    const strForm = compute({ ...base, prior_weight: '1200', posterior_weight: '1500', total_stake_weight: '50000', quorum_required: '3', quorum_achieved: '3' }).output_payload;
    const numForm = compute({ ...base }).output_payload;
    checked++;
    if (JSON.stringify(strForm) !== JSON.stringify(numForm)) violations++;
  }
  // Fractional weight strings are stated; a zero string is an explicit stated zero.
  {
    const op = compute({ ...base, prior_weight: '1200.5' }).output_payload;
    checked++;
    if (op.prior_weight !== 1200.5 || op.weight_delta !== 299.5) violations++;
  }
  {
    const op = compute({ ...base, prior_weight: '0', posterior_weight: '0' }).output_payload;
    checked++;
    if (op.exceptions.includes('PRIOR_WEIGHT_NOT_STATED') || op.exceptions.includes('POSTERIOR_WEIGHT_NOT_STATED')) violations++;
    if (!op.exceptions.includes('WEIGHT_CHANGE_WITH_NO_DELTA')) violations++;
  }
  return { name: 'P6_weight_quorum_statedness_matrix', trials: checked, violations };
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
results.properties.push(checkP5_requiredInputsFailClosed());
results.properties.push(checkP6_statednessMatrix());

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
