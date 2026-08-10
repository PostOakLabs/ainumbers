// kernel_digest_at_authoring: sha256:05b8c0c228321335e7ba3d1133c961b3ba2aebcd9e92f1735833b892d78170ce
//
// FV-PROPFLOOR-SHARD-B26-1 — property-test floor for art-581-emir3-simm-approval-scope-classifier.
// Class B (bounded-categorical), FLOAT:NO per the WU row — pure enum/boolean classification plus
// one lexicographic ISO-date-string comparison (as_of_date > ONBOARDING_WINDOW_CLOSE), no
// arithmetic of any kind. Forced CATEGORICAL boundary cases used in place of ULP forcing. Zero
// external dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the
// B1/B3/B12 harness. READ-ONLY w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-581-emir3-simm-approval-scope-classifier.proptest.mjs

import { compute } from '../art-581-emir3-simm-approval-scope-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-581-emir3-simm-approval-scope-classifier.fixtures.json');
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
const rand = mulberry32(0x581581);
const TRIALS = 8000;
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const MODEL_TYPES = ['isda_simm', 'internal_model', 'none'];
const MODEL_STATUSES = ['new_application', 'modification', 'already_authorised', 'not_applicable'];
const OBLIGATION_IDS = ['NCA_PRIOR_AUTHORISATION', 'EBA_CENTRAL_VALIDATION_PROFORMA', 'ANNUAL_APPLICATION_DATA_UPDATE', 'EBA_ONBOARDING_WINDOW_2026'];
const VERDICTS = ['IN_SCOPE', 'OUT_OF_SCOPE', 'INDETERMINATE'];

function randDate2026(rng) {
  const month = 1 + Math.floor(rng() * 12);
  const day = 1 + Math.floor(rng() * 28);
  return `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function mkPP(rng) {
  return {
    counterparty_type: pick(rng, ['financial_counterparty', 'non_financial_counterparty_minus']),
    subject_to_bilateral_im: rng() < 0.5,
    model_type: pick(rng, MODEL_TYPES),
    model_status: pick(rng, MODEL_STATUSES),
    competent_authority_declared: rng() < 0.5,
    as_of_date: randDate2026(rng),
  };
}

// ---------- P1: obligations is always exactly the 4 fixed ids, in fixed order, each verdict in the fixed 3-state vocab ----------
function checkP1_obligationSetFixedAndBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.obligations.length !== 4) violations++;
    for (let j = 0; j < r.obligations.length; j++) {
      if (r.obligations[j].obligation_id !== OBLIGATION_IDS[j]) violations++;
      if (VERDICTS.indexOf(r.obligations[j].verdict) < 0) violations++;
    }
  }
  return { name: 'P1_obligation_set_fixed_4_in_order_verdict_bounded', trials: checked, violations };
}

// ---------- P2: EBA_CENTRAL_VALIDATION_PROFORMA is IN_SCOPE iff model_type is exactly isda_simm ----------
function checkP2_proFormaExactModelTypeGate() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const proforma = r.obligations.find((o) => o.obligation_id === 'EBA_CENTRAL_VALIDATION_PROFORMA');
    const expected = r.model_type === 'isda_simm' ? 'IN_SCOPE' : 'OUT_OF_SCOPE';
    if (proforma.verdict !== expected) violations++;
  }
  return { name: 'P2_proforma_exact_model_type_gate', trials: checked, violations };
}

// ---------- P3: NCA_PRIOR_AUTHORISATION is never IN_SCOPE unless subject_to_bilateral_im and a model status/type combination that's in-scope ----------
function checkP3_ncaAuthorisationRequiresSubjectAndModel() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const nca = r.obligations.find((o) => o.obligation_id === 'NCA_PRIOR_AUTHORISATION');
    if (nca.verdict !== 'OUT_OF_SCOPE') {
      if (!r.subject_to_bilateral_im) violations++;
      if (r.model_type === 'none') violations++;
      if (r.model_status !== 'new_application' && r.model_status !== 'modification') violations++;
    }
  }
  return { name: 'P3_nca_authorisation_requires_subject_and_in_scope_model', trials: checked, violations };
}

// ---------- P4: methodology_verification and isda_endorsement are constant, never computed from input ----------
function checkP4_zeroSimmContentInvariant() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.methodology_verification !== 'deliberately_absent') violations++;
    if (r.isda_endorsement !== false) violations++;
  }
  return { name: 'P4_zero_simm_methodology_content_invariant', trials: checked, violations };
}

// ---------- P5 (mandatory, float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ counterparty_type: 'financial_counterparty', subject_to_bilateral_im: true, model_type: 'isda_simm', model_status: 'already_authorised', competent_authority_declared: true, as_of_date: '2026-08-31' }, 'as_of_date exactly ON the EBA onboarding cutoff (2026-08-31) — must be IN_SCOPE (lexicographic compare is strictly >, so equal-to-cutoff is still within the window)'],
  [{ counterparty_type: 'financial_counterparty', subject_to_bilateral_im: true, model_type: 'isda_simm', model_status: 'already_authorised', competent_authority_declared: true, as_of_date: '2026-09-01' }, 'as_of_date exactly one day AFTER the cutoff — must be INDETERMINATE (onboarding window closed, late-path unsettled)'],
  [{ counterparty_type: 'financial_counterparty', subject_to_bilateral_im: true, model_type: 'internal_model', model_status: 'new_application', competent_authority_declared: false, as_of_date: '2026-08-07' }, 'in-scope NCA authorisation facts but competent_authority_declared exactly false — INDETERMINATE, never guessed IN_SCOPE'],
  [{ as_of_date: '2026-08-07' }, 'entirely empty policy_parameters — kernel default-destructures every field, must not throw, all four obligations OUT_OF_SCOPE or model-default-consistent'],
  [{ counterparty_type: 'financial_counterparty', subject_to_bilateral_im: true, model_type: 'bogus_model', model_status: 'bogus_status', competent_authority_declared: true, as_of_date: '2026-08-07' }, 'unrecognised model_type and model_status strings — must fall back to the safe defaults (none/not_applicable), never propagate the invalid literal into a verdict'],
  [{ counterparty_type: 'financial_counterparty', subject_to_bilateral_im: true, model_type: 'isda_simm', model_status: 'new_application', competent_authority_declared: true, as_of_date: '2026-08-07' }, 'new SIMM application — ANNUAL_APPLICATION_DATA_UPDATE must be INDETERMINATE (not yet authorised), distinct from the already_authorised IN_SCOPE case'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = Array.isArray(r.obligations) && r.obligations.length === 4 && r.obligations.every((o) => VERDICTS.indexOf(o.verdict) >= 0);
    rows.push({ label, input: pp, obligations: r.obligations.map((o) => ({ id: o.obligation_id, verdict: o.verdict })), plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_obligationSetFixedAndBounded());
results.properties.push(checkP2_proFormaExactModelTypeGate());
results.properties.push(checkP3_ncaAuthorisationRequiresSubjectAndModel());
results.properties.push(checkP4_zeroSimmContentInvariant());
results.boundary_forced = checkP5_forced();

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
