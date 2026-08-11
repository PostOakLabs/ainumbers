// art-163-vida-oss-registration-router property-test floor (FV-PROPFLOOR-SHARD-A-ENUMSEL-1).
// kernel_digest_at_authoring: sha256:e9b1818d3a4a679dc9585a58e6326dbccbfd2d60ea6a738cf3cd6b51adfb12ef
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: enum branch router -- supply_type x seller/destination
// member-state membership select one of a fixed set of VAT OSS schemes, no arrays/loops over
// caller-supplied data (the member-state Set is a fixed lookup, not iterated per input). Confirmed
// against direct kernel source read for FV-PROPFLOOR-SHARD-A-ENUMSEL-1 (not inherited from
// triage-table rationale text). float:no (declared string enum inputs only) -- forced CATEGORICAL
// boundary cases (every supply_type value, plus in/out-of-EU member-state combinations) stand in
// for ULP forcing. ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the
// kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-163-vida-oss-registration-router.proptest.mjs

import { compute } from '../art-163-vida-oss-registration-router.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const SUPPLY_TYPES = ['B2C_digital', 'B2C_goods', 'deemed_supplier', 'stock_transfer', 'B2B'];
const EU_MS = ['DE', 'FR', 'NL', 'IT', 'ES'];
const NON_EU = ['US', 'GB', 'CN', ''];
const SCHEMES = new Set(['Union_OSS', 'Domestic_VAT', 'Non_Union_OSS', 'IOSS', null]);

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
  const seller = pick(rng, [...EU_MS, ...NON_EU]);
  const dest = pick(rng, [...EU_MS, ...NON_EU]);
  return { supply: { supply_type: pick(rng, SUPPLY_TYPES), seller_establishment: seller, destination_member_state: dest } };
}

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-163-vida-oss-registration-router.fixtures.json');
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
  const { output_payload } = compute({ supply: { supply_type: 'B2C_digital', seller_establishment: 'DE', destination_member_state: 'FR' } });
  const mutated = { ...output_payload, recommended_scheme: output_payload.recommended_scheme === 'IOSS' ? 'Union_OSS' : 'IOSS' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: recommended_scheme is always one of the four declared schemes, or null.
function checkP1_schemeDomain() {
  let violations = 0, checked = 0;
  const rng = mulberry32(163001);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = compute(randomPP(rng));
    checked++;
    if (!SCHEMES.has(output_payload.recommended_scheme)) violations++;
  }
  return { name: 'P1_scheme_domain_random300', trials: checked, violations };
}

// P2: eligible_for_oss is true iff a scheme was assigned and it isn't Domestic_VAT.
function checkP2_eligibilityAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(163002);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = compute(randomPP(rng));
    checked++;
    const expected = output_payload.recommended_scheme !== null && output_payload.recommended_scheme !== 'Domestic_VAT';
    if (output_payload.eligible_for_oss !== expected) violations++;
  }
  return { name: 'P2_eligibility_agreement_random300', trials: checked, violations };
}

// P3: same-member-state B2C supply always resolves to Domestic_VAT, never OSS.
function checkP3_sameStateIsDomestic() {
  let violations = 0, checked = 0;
  for (const ms of EU_MS) {
    const { output_payload } = compute({ supply: { supply_type: 'B2C_digital', seller_establishment: ms, destination_member_state: ms } });
    checked++;
    if (output_payload.recommended_scheme !== 'Domestic_VAT') violations++;
  }
  return { name: 'P3_same_member_state_is_domestic_vat', trials: checked, violations };
}

// P4: forced categorical boundary cases -- every supply_type against a fixed EU-EU cross-border pair.
function checkP4_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  for (const supply_type of SUPPLY_TYPES) {
    const { output_payload } = compute({ supply: { supply_type, seller_establishment: 'DE', destination_member_state: 'FR' } });
    checked++;
    if (!SCHEMES.has(output_payload.recommended_scheme)) violations++;
    if (typeof output_payload.eligible_for_oss !== 'boolean') violations++;
  }
  return { name: 'P4_forced_categorical_boundary_cases_all_supply_types', trials: checked, violations };
}

// P5: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { supply: {} }, { supply: { supply_type: 'B2C_digital' } }, { supply: { seller_establishment: 'DE' } }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (typeof output_payload.eligible_for_oss !== 'boolean') violations++;
    if (typeof output_payload.seller_in_eu !== 'boolean') violations++;
    if (typeof output_payload.dest_in_eu !== 'boolean') violations++;
    if (output_payload.recommended_scheme !== null && typeof output_payload.recommended_scheme !== 'string') violations++;
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

results.properties.push(checkP1_schemeDomain());
results.properties.push(checkP2_eligibilityAgreement());
results.properties.push(checkP3_sameStateIsDomestic());
results.properties.push(checkP4_forcedCategoricalBoundaries());
results.properties.push(checkP5_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-163-vida-oss-registration-router',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
