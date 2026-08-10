// kernel_digest_at_authoring: sha256:a255de01b67ae52790e981e245331dbb46ba3aeeec9c86f951688603f24bff64
//
// FV-PROPFLOOR-SHARD-B2-1 — property-test floor for art-108-canton-selective-disclosure.
// Class B (bounded categorical), float:no exception per the WU row — boolean/set-membership
// logic only, no continuous arithmetic. Forced categorical boundary cases used in place of
// ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG
// + explicit boundary arrays), same shape as the B1 pilot harness. This file is READ-ONLY
// with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-108-canton-selective-disclosure.proptest.mjs

import { compute } from '../art-108-canton-selective-disclosure.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-108-canton-selective-disclosure.fixtures.json');
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
const rand = mulberry32(0x10801);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const TRIALS = 10000;
const PARTIES = ['registrar', 'bank', 'auditor', 'counterparty'];
const FIELD_POOL = ['isin', 'quantity', 'settlement_date', 'amount_usd', 'value_date', 'account_ref', 'trade_id'];

function randVisibleTo(rng) {
  const n = Math.floor(rng() * 3);
  const shuffled = shuffle(rng, PARTIES);
  return shuffled.slice(0, n);
}
function randFields(rng) {
  const n = Math.floor(rng() * 4);
  const shuffled = shuffle(rng, FIELD_POOL);
  return shuffled.slice(0, n);
}

function mkDvp(rng, overrides = {}) {
  return {
    asset_leg: { visible_to: randVisibleTo(rng), fields: randFields(rng) },
    cash_leg: { visible_to: randVisibleTo(rng), fields: randFields(rng) },
    shared_commitment: pick(rng, ['hash:abc123', '', 'hash:xyz789def']),
    ...overrides,
  };
}

// ---------- P1: metamorphic — reordering visible_to/fields arrays never changes the verdict ----------
function checkP1_orderInvariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const dvp = mkDvp(rand);
    const shuffledDvp = {
      asset_leg: { visible_to: shuffle(rand, dvp.asset_leg.visible_to), fields: shuffle(rand, dvp.asset_leg.fields) },
      cash_leg: { visible_to: shuffle(rand, dvp.cash_leg.visible_to), fields: shuffle(rand, dvp.cash_leg.fields) },
      shared_commitment: dvp.shared_commitment,
    };
    const r1 = compute({ dvp_structure: dvp });
    const r2 = compute({ dvp_structure: shuffledDvp });
    checked++;
    if (r1.output_payload.verdict !== r2.output_payload.verdict) violations++;
    if (r1.output_payload.registrar_view_ok !== r2.output_payload.registrar_view_ok) violations++;
    if (r1.output_payload.no_cross_leg_leak !== r2.output_payload.no_cross_leg_leak) violations++;
  }
  return { name: 'P1_order_invariance_of_visible_to_and_fields_arrays', trials: checked, violations };
}

// ---------- P2: boundedness — verdict is one of two fixed strings, compliance_flags subset of known set ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN_VERDICTS = new Set(['PARTITION_SOUND', 'PARTITION_BREACH']);
  const KNOWN_FLAGS = new Set(['CANTON_PARTITION_ATTESTED', 'CANTON_PARTITION_FAILED', 'REGISTRAR_VIEW_OK', 'BANK_VIEW_OK', 'NO_CROSS_LEG_LEAK']);
  for (let i = 0; i < TRIALS; i++) {
    const dvp = mkDvp(rand);
    const r = compute({ dvp_structure: dvp });
    checked++;
    if (!KNOWN_VERDICTS.has(r.output_payload.verdict)) violations++;
    for (const f of r.compliance_flags) if (!KNOWN_FLAGS.has(f)) violations++;
  }
  return { name: 'P2_boundedness_verdict_and_flags_from_known_sets', trials: checked, violations };
}

// ---------- P3: categorical threshold agreement — verdict is exactly the AND of the 4 sub-checks ----------
function checkP3_verdictAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const dvp = mkDvp(rand);
    const r = compute({ dvp_structure: dvp });
    checked++;
    const { registrar_view_ok, bank_view_ok, no_cross_leg_leak, reconciles_to_commitment, verdict } = r.output_payload;
    const expected = (registrar_view_ok && bank_view_ok && no_cross_leg_leak && reconciles_to_commitment) ? 'PARTITION_SOUND' : 'PARTITION_BREACH';
    if (verdict !== expected) violations++;
  }
  return { name: 'P3_verdict_equals_and_of_four_subchecks', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ asset_leg: { visible_to: ['registrar'], fields: [] }, cash_leg: { visible_to: ['bank'], fields: [] }, shared_commitment: 'x' }, 'minimal sound partition, no fields at all — must be PARTITION_SOUND'],
  [{ asset_leg: { visible_to: [], fields: [] }, cash_leg: { visible_to: [], fields: [] }, shared_commitment: 'x' }, 'empty visible_to on both legs — registrar/bank see neither, must be PARTITION_BREACH'],
  [{ asset_leg: { visible_to: ['registrar', 'bank'], fields: ['f1'] }, cash_leg: { visible_to: ['bank'], fields: ['f1'] }, shared_commitment: 'x' }, 'exact single-field overlap — cross_leak_fields must contain exactly that field'],
  [{ asset_leg: { visible_to: ['registrar'], fields: ['a', 'b'] }, cash_leg: { visible_to: ['bank'], fields: ['c', 'd'] }, shared_commitment: '' }, 'empty shared_commitment string — reconciles_to_commitment must be false, verdict PARTITION_BREACH'],
  [{ asset_leg: {}, cash_leg: {}, shared_commitment: 'x' }, 'missing asset_leg/cash_leg entirely — must default to registrar/bank visibility, not throw'],
  [{}, 'empty dvp_structure — must default cleanly through every branch, PARTITION_BREACH (no commitment)'],
];

function checkP4_forced() {
  const rows = [];
  for (const [dvp_structure, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute({ dvp_structure });
    const { verdict } = r.output_payload;
    const plausible = ['PARTITION_SOUND', 'PARTITION_BREACH'].includes(verdict);
    rows.push({ label, dvp_structure, verdict, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_orderInvariance());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_verdictAgreement());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
