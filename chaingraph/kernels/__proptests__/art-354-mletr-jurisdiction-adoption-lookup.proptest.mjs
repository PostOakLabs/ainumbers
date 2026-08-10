// art-354-mletr-jurisdiction-adoption-lookup property-test floor (FV-PROPFLOOR-SHARD-A-ENUMSEL-1).
// kernel_digest_at_authoring: sha256:182b05c2f8ecd1a36f271bfffc299baad5f581b051bf9b4f921e9e9521599ab7
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: static-table lookup selector -- origin_jurisdiction x
// destination_jurisdiction each key a fixed 10-entry JURISDICTION_TABLE (plus an ALIASES map),
// then a corridor verdict is chosen by a 3-way enum comparison over the two resolved statuses.
// This is a fixed-table LOOKUP keyed by caller input, not an iteration/loop over caller-supplied
// data structures -- no arrays/loops over caller data. Confirmed against direct kernel source
// read for FV-PROPFLOOR-SHARD-A-ENUMSEL-1 (not inherited from triage-table rationale text).
// float:no (declared string jurisdiction-code/name inputs only) -- forced CATEGORICAL boundary
// cases (every declared jurisdiction code, plus the unknown-jurisdiction fallback path) stand in
// for ULP forcing. ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the
// kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-354-mletr-jurisdiction-adoption-lookup.proptest.mjs

import { compute } from '../art-354-mletr-jurisdiction-adoption-lookup.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

// Declared codes per kernel's JURISDICTION_TABLE (line 27-36). Status per code, mirrored here
// only for property assertions (not a re-implementation of the routing logic).
const CODES = ['UK', 'SG', 'AE', 'BH', 'FR', 'JP', 'IN', 'US', 'DE'];
const ADOPTED_CODES = new Set(['UK', 'SG', 'AE', 'BH', 'FR', 'JP', 'IN']);
const ALIGNED_CODES = new Set(['US', 'DE']);
const UNKNOWN_CODES = ['ZZ', 'XX', 'MARS'];
const VALID_VERDICTS = new Set(['MLETR_CORRIDOR_RECOGNIZED', 'FUNCTIONALLY_EQUIVALENT_CHECK_LOCAL_COUNSEL', 'GAP_LEGACY_PAPER_LIKELY_REQUIRED']);

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randomPP(rng) {
  const pool = [...CODES, ...UNKNOWN_CODES];
  return { origin_jurisdiction: pick(rng, pool), destination_jurisdiction: pick(rng, pool) };
}
function statusOf(code) {
  if (ADOPTED_CODES.has(code)) return 'adopted';
  if (ALIGNED_CODES.has(code)) return 'aligned';
  return 'not-adopted';
}

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-354-mletr-jurisdiction-adoption-lookup.fixtures.json');
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

// ---------- negative control ----------
function negativeControl() {
  const { output_payload } = compute({ origin_jurisdiction: 'UK', destination_jurisdiction: 'SG' });
  const mutated = { ...output_payload, verdict: output_payload.verdict === 'MLETR_CORRIDOR_RECOGNIZED' ? 'GAP_LEGACY_PAPER_LIKELY_REQUIRED' : 'MLETR_CORRIDOR_RECOGNIZED' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: verdict is always one of the 3 declared corridor verdicts; ebl_legally_effective is true
// iff the verdict is the fully-recognized one.
function checkP1_verdictDomainAndFlagAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(354001);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = compute(randomPP(rng));
    checked++;
    if (!VALID_VERDICTS.has(output_payload.verdict)) violations++;
    const expected = output_payload.verdict === 'MLETR_CORRIDOR_RECOGNIZED';
    if (output_payload.ebl_legally_effective !== expected) violations++;
  }
  return { name: 'P1_verdict_domain_and_flag_agreement_random300', trials: checked, violations };
}

// P2: verdict monotonicity -- both-adopted implies RECOGNIZED; at-least-one not-adopted (with the
// other adopted/aligned) never yields RECOGNIZED; both not-adopted implies GAP.
function checkP2_verdictMonotonicity() {
  let violations = 0, checked = 0;
  const rng = mulberry32(354002);
  for (let i = 0; i < 300; i++) {
    const pp = randomPP(rng);
    const { output_payload } = compute(pp);
    checked++;
    const oCode = (pp.origin_jurisdiction || '').toUpperCase();
    const dCode = (pp.destination_jurisdiction || '').toUpperCase();
    const oStatus = statusOf(oCode);
    const dStatus = statusOf(dCode);
    if (oStatus === 'adopted' && dStatus === 'adopted' && output_payload.verdict !== 'MLETR_CORRIDOR_RECOGNIZED') violations++;
    if (oStatus === 'not-adopted' && output_payload.verdict === 'MLETR_CORRIDOR_RECOGNIZED') violations++;
    if (dStatus === 'not-adopted' && output_payload.verdict === 'MLETR_CORRIDOR_RECOGNIZED') violations++;
    if (oStatus === 'not-adopted' && dStatus === 'not-adopted' && output_payload.verdict !== 'GAP_LEGACY_PAPER_LIKELY_REQUIRED') violations++;
  }
  return { name: 'P2_verdict_monotonicity_random300', trials: checked, violations };
}

// P3: an unrecognized jurisdiction code always resolves status 'not-adopted' with null statute.
function checkP3_unknownCodeFallsBackCleanly() {
  let violations = 0, checked = 0;
  for (const code of UNKNOWN_CODES) {
    const { output_payload } = compute({ origin_jurisdiction: code, destination_jurisdiction: 'UK' });
    checked++;
    if (output_payload.corridor.origin.status !== 'not-adopted') violations++;
    if (output_payload.corridor.origin.statute !== null) violations++;
    if (output_payload.verdict !== 'GAP_LEGACY_PAPER_LIKELY_REQUIRED') violations++;
  }
  return { name: 'P3_unknown_code_fallback_clean', trials: checked, violations };
}

// P4: forced categorical boundary cases -- every declared jurisdiction code as origin against a
// fixed known destination, and self-corridor (code -> same code) for every declared code.
function checkP4_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  for (const code of CODES) {
    const { output_payload } = compute({ origin_jurisdiction: code, destination_jurisdiction: 'SG' });
    checked++;
    if (!VALID_VERDICTS.has(output_payload.verdict)) violations++;
    if (output_payload.corridor.origin.status !== statusOf(code)) violations++;
  }
  for (const code of CODES) {
    const { output_payload } = compute({ origin_jurisdiction: code, destination_jurisdiction: code });
    checked++;
    if (!VALID_VERDICTS.has(output_payload.verdict)) violations++;
  }
  return { name: 'P4_forced_categorical_boundary_cases_all_codes', trials: checked, violations };
}

// P5: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { origin_jurisdiction: 'UK' }, { destination_jurisdiction: 'SG' }, { origin_jurisdiction: '', destination_jurisdiction: '' }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (!VALID_VERDICTS.has(output_payload.verdict)) violations++;
    if (typeof output_payload.ebl_legally_effective !== 'boolean') violations++;
    if (typeof output_payload.corridor !== 'object') violations++;
    if (typeof output_payload.data_version !== 'string') violations++;
  }
  return { name: 'P5_output_shape_no_nan_undefined', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

const negControl = negativeControl();
if (!negControl.rejected_wrong_spec) {
  console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
  process.exit(1);
}

results.properties.push(checkP1_verdictDomainAndFlagAgreement());
results.properties.push(checkP2_verdictMonotonicity());
results.properties.push(checkP3_unknownCodeFallsBackCleanly());
results.properties.push(checkP4_forcedCategoricalBoundaries());
results.properties.push(checkP5_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-354-mletr-jurisdiction-adoption-lookup',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
