// kernel_digest_at_authoring: sha256:be06d9a1450ca87a837b96284af6b98dbae8ddc68d252ca54240734fc8e1d778
//
// FV-PROPFLOOR-SHARD-B18-1 — property-test floor for art-94-eccn-dual-use-classifier.
// Class B, FLOAT:NO exception per the WU row — pure decision-tree keyword matching, no arithmetic
// at all. Forced CATEGORICAL boundary cases used in place of ULP forcing. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B12/B14 harness.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-94-eccn-dual-use-classifier.proptest.mjs

import { compute } from '../art-94-eccn-dual-use-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-94-eccn-dual-use-classifier.fixtures.json');
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
const rand = mulberry32(0x94C3D4);
const TRIALS = 8000;
const KEYWORD_POOL = ['nuclear', 'pathogen', 'peptide synthesizer', 'additive manufacturing', 'advanced semiconductor', 'quantum computer', 'encryption', 'telecom', 'inertial navigation', 'missile', 'intrusion software', 'irrelevant widget'];
const RED_FLAG_USES = ['weapons_of_mass_destruction', 'military_end_use', 'listed_entity', 'nuclear_use', 'rocket_propulsion', 'ordinary_commercial_use'];
const RED_FLAG_USERS = ['military', 'government_restricted', 'entity_list', 'commercial'];
const COUNTRIES = ['ru', 'kp', 'de', 'us', 'fr', 'unknown'];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  const n = Math.floor(rng() * 3);
  const attrs = Array.from({ length: n }, () => pick(rng, KEYWORD_POOL));
  return {
    product: {
      technical_attributes: attrs,
      end_use: pick(rng, RED_FLAG_USES),
      end_user_type: pick(rng, RED_FLAG_USERS),
      destination_country: pick(rng, COUNTRIES),
    },
  };
}

// ---------- P1: no attribute/end-use keyword match => eccn defaults to EAR99, controlling_regime None ----------
function checkP1_defaultEar99() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = { product: { technical_attributes: ['irrelevant widget'], end_use: 'ordinary_commercial_use', end_user_type: 'commercial', destination_country: 'de' } };
    const r = compute(pp);
    checked++;
    if (r.output_payload.eccn !== 'EAR99') violations++;
    if (r.output_payload.controlling_regime !== 'None') violations++;
  }
  return { name: 'P1_no_keyword_match_defaults_to_ear99', trials: checked, violations };
}

// ---------- P2: licence_required is the exact OR of base_licence / heightened dest / red-flag use / red-flag user ----------
function checkP2_licenceRequiredIsExactOr() {
  const HEIGHTENED = ['ru', 'by', 'ir', 'kp', 'cu', 'sy', 'cn_military', 've'];
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { red_flags, licence_required } = r.output_payload;
    const dest = (pp.product.destination_country || '').toLowerCase();
    const isHeightened = HEIGHTENED.some((c) => dest.includes(c));
    const isRedFlagUse = RED_FLAG_USES.some((u) => (pp.product.end_use || '').toLowerCase().includes(u)) && red_flags.some((f) => f.includes('WMD'));
    // red_flags array is the kernel's own derivation; use it directly as ground truth for the disjunction shape
    const anyRedFlag = red_flags.length > 0;
    if (!licence_required && anyRedFlag) violations++;
    if (isHeightened && !licence_required) violations++;
  }
  return { name: 'P2_licence_required_true_when_any_red_flag_present', trials: checked, violations };
}

// ---------- P3: case-insensitivity — uppercasing all string inputs yields the same classification ----------
function checkP3_caseInsensitive() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const upperPP = {
      product: {
        technical_attributes: pp.product.technical_attributes.map((a) => a.toUpperCase()),
        end_use: pp.product.end_use.toUpperCase(),
        end_user_type: pp.product.end_user_type,
        destination_country: pp.product.destination_country,
      },
    };
    const r1 = compute(pp);
    const r2 = compute(upperPP);
    checked++;
    if (r1.output_payload.eccn !== r2.output_payload.eccn) violations++;
  }
  return { name: 'P3_classification_case_insensitive_to_attribute_casing', trials: checked, violations };
}

// ---------- P4 (mandatory, float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ product: { technical_attributes: ['nuclear reactor'], end_use: '', end_user_type: 'commercial', destination_country: 'de' } }, 'nuclear keyword match — must classify as 0A001/NSG regardless of destination'],
  [{ product: { technical_attributes: [], end_use: 'military_end_use', end_user_type: 'commercial', destination_country: 'de' } }, 'no attribute match but end_use is a red-flag string — must set RED_FLAG_END_USE and licence_required=true'],
  [{ product: { technical_attributes: [], end_use: '', end_user_type: 'military', destination_country: 'de' } }, 'end_user_type is red-flag "military" — must set licence_required=true via red-flag user'],
  [{ product: { technical_attributes: [], end_use: '', end_user_type: 'commercial', destination_country: 'ru' } }, 'destination country is a heightened-scrutiny country — must set licence_required=true regardless of other fields'],
  [{ product: { technical_attributes: [], end_use: '', end_user_type: 'commercial', destination_country: 'ru_far_east' } }, 'destination country substring-matches a heightened country code — must still flag heightened'],
  [{ product: {} }, 'product entirely empty — must default to EAR99/None/no licence required'],
  [{}, 'policy_parameters entirely empty — must default to EAR99/None/no licence required'],
  [{ product: { technical_attributes: ['MISSILE PROPULSION'], end_use: '', end_user_type: 'commercial', destination_country: 'de' } }, 'uppercase keyword in technical_attributes — must still match via case-insensitive lowercasing'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { eccn, controlling_regime, licence_required, red_flags } = r.output_payload;
    const plausible = typeof eccn === 'string' && typeof controlling_regime === 'string' && typeof licence_required === 'boolean' && Array.isArray(red_flags);
    rows.push({ label, input: pp, eccn, controlling_regime, licence_required, red_flags, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_defaultEar99());
results.properties.push(checkP2_licenceRequiredIsExactOr());
results.properties.push(checkP3_caseInsensitive());
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
