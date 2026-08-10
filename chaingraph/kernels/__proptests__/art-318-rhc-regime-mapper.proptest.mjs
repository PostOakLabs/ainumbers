// art-318-rhc-regime-mapper.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C11-1).
// kernel_digest_at_authoring: sha256:a254b7eb00a32b29a66ec968198d5fcaf29bff88a1a9881739f2a25b5ec59856
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — pure string-equality and Array.includes boolean
// logic, no arithmetic anywhere in the kernel).
// Checks: fixture-oracle gate, termination/boundedness (regime_tree is fixed at 2 entries and
// assumptions bounded to at most 4 known strings regardless of target_jurisdictions array
// length — the one unbounded input this kernel takes), differential re-derivation of every
// boolean flag, and metamorphic permutation-invariance of target_jurisdictions (Array.includes
// is order-independent).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-318-rhc-regime-mapper.proptest.mjs

import { compute } from '../art-318-rhc-regime-mapper.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-318-rhc-regime-mapper.fixtures.json');
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
const rand = mulberry32(0x318F0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const INSTRUMENT_TYPES = ['tokenized_debt_security', 'tokenized_equity', 'utility_token', 'e_money_token', 'asset_referenced_token'];
const JURIS_POOL = ['EU', 'US', 'UK', 'SG', 'JP', 'CH'];

function randomJurisdictions(rng) {
  const n = Math.floor(rng() * 5);
  const out = [];
  for (let i = 0; i < n; i++) out.push(pick(rng, JURIS_POOL));
  return out;
}

function randomPP(rng) {
  return {
    issuer_entity: 'RHJ',
    instrument_type: pick(rng, INSTRUMENT_TYPES),
    wrapper: pick(rng, ['SPV', 'direct']),
    holder_of_record: pick(rng, ['SPV', 'token_holder']),
    voting_rights: pick(rng, [true, false, null]),
    target_jurisdictions: randomJurisdictions(rng),
  };
}

const TRIALS = 5000;

// ---------- P1: termination/boundedness — regime_tree fixed at 2, assumptions bounded <=4 ----------
function checkP1_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.regime_tree.length !== 2) violations++;
    if (output_payload.assumptions.length > 4) violations++;
    if (new Set(output_payload.assumptions).size !== output_payload.assumptions.length) violations++;
  }
  return { name: 'P1_regime_tree_fixed_assumptions_bounded', trials: checked, violations };
}

// ---------- P2 (differential): every boolean flag re-derived independently ----------
function checkP2_flags_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const micaExpected = pp.instrument_type === 'tokenized_debt_security' && pp.wrapper === 'SPV';
    if (output_payload.mica_carveout_applies !== micaExpected) violations++;
    const mifid2Expected = pp.instrument_type === 'tokenized_debt_security';
    if (output_payload.mifid2_transferable_security !== mifid2Expected) violations++;
    const targetsEU = pp.target_jurisdictions.includes('EU');
    const prospectusExpected = mifid2Expected && targetsEU;
    if (output_payload.prospectus_exposure !== prospectusExpected) violations++;
    const usExpected = pp.target_jurisdictions.includes('US');
    if (output_payload.us_persons_gate_violated !== usExpected) violations++;
    const votingExpected = pp.holder_of_record === 'SPV' && pp.voting_rights !== true;
    if (output_payload.disclose_no_voting_rights !== votingExpected) violations++;
  }
  return { name: 'P2_flags_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of target_jurisdictions order ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    const shuffled = [...pp.target_jurisdictions];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r1 = compute(pp).output_payload;
    const r2 = compute({ ...pp, target_jurisdictions: shuffled }).output_payload;
    checked++;
    if (r1.prospectus_exposure !== r2.prospectus_exposure) violations++;
    if (r1.us_persons_gate_violated !== r2.us_persons_gate_violated) violations++;
    if (JSON.stringify(r1.regime_tree) !== JSON.stringify(r2.regime_tree)) violations++;
  }
  return { name: 'P3_permutation_invariance_jurisdictions_order', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_bounded());
results.properties.push(checkP2_flags_differential());
results.properties.push(checkP3_permutation_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-318-rhc-regime-mapper',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
