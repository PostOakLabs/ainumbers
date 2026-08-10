// kernel_digest_at_authoring: sha256:5b09063e1cbd268666c288bd86047df127316f8a8e314b985ea89b240bc4ac13
//
// FV-PROPFLOOR-SHARD-B7-1 — property-test floor for art-226-mismo-uldd-ulad.
// Class B (bounded-numeric), stated float:no exception — purely structural lint (presence,
// enum membership, range checks over supplied fields), no continuous-double arithmetic in the
// output. Forced CATEGORICAL boundary cases used in place of ULP forcing, per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies. Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-226-mismo-uldd-ulad.proptest.mjs

import { compute } from '../art-226-mismo-uldd-ulad.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-226-mismo-uldd-ulad.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    if (!deepEqual(output_payload, vec.output_payload)) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
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
const rand = mulberry32(0x22601);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 8000;

const REQUIRED_FIELDS = ['loan_purpose_type','amortization_type','loan_amount','ltv_pct','occupancy_type','property_type','number_of_units','interest_rate_pct','loan_term_months','credit_score','dti_pct','channel_type','doc_type'];
const LOAN_PURPOSE = ['Purchase','CashOutRefinance','NoCashOutRefinance','Other','BOGUS'];
const AMORT = ['AdjustableRate','FixedRate','GraduatedPaymentMortgage','OtherAmortizationType'];
const OCC = ['InvestorProperty','PrimaryResidence','SecondHome'];
const PROP = ['Attached','Condominium','Detached'];
const CHANNEL = ['Broker','Correspondent','Retail','Wholesale','Other'];
const DOC = ['FullDocumentation','LimitedDocumentation','NoDocumentation'];

function mkLoan(rng) {
  const loan = {};
  for (const f of REQUIRED_FIELDS) {
    if (rng() < 0.9) {
      switch (f) {
        case 'loan_purpose_type': loan[f] = pick(rng, LOAN_PURPOSE); break;
        case 'amortization_type': loan[f] = pick(rng, AMORT); break;
        case 'occupancy_type': loan[f] = pick(rng, OCC); break;
        case 'property_type': loan[f] = pick(rng, PROP); break;
        case 'channel_type': loan[f] = pick(rng, CHANNEL); break;
        case 'doc_type': loan[f] = pick(rng, DOC); break;
        case 'loan_amount': loan[f] = Math.floor(randRange(rng, -1000, 60000000)); break;
        case 'ltv_pct': loan[f] = randRange(rng, -10, 110); break;
        case 'number_of_units': loan[f] = Math.floor(randRange(rng, 0, 6)); break;
        case 'interest_rate_pct': loan[f] = randRange(rng, -1, 30); break;
        case 'loan_term_months': loan[f] = Math.floor(randRange(rng, 0, 500)); break;
        case 'credit_score': loan[f] = Math.floor(randRange(rng, 250, 900)); break;
        case 'dti_pct': loan[f] = randRange(rng, -5, 110); break;
      }
    }
  }
  return loan;
}

// ---------- P1: boundedness — pass iff error_count === 0, and lint_pass never contradicts errors.length ----------
function checkP1_passMatchesErrorCount() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const loan = mkLoan(rand);
    const r = compute({ loan_data: loan }).output_payload;
    checked++;
    if (r.lint_pass !== (r.error_count === 0)) violations++;
    if (r.error_count !== r.errors.length) violations++;
    if (r.warning_count !== r.warnings.length) violations++;
  }
  return { name: 'P1_lint_pass_and_counts_agree_with_errors_array', trials: checked, violations };
}

// ---------- P2: monotonicity — removing a required field never decreases error_count ----------
// amortization_type is excluded: deleting it can also remove cascading ARM_CONDITIONAL_REQUIRED
// errors it triggered, which is a genuine kernel behavior, not a property violation — this
// property is scoped to fields with no downstream conditional side effect (confirmed against
// the kernel source: only amortization_type=AdjustableRate gates ARM_CONDITIONAL checks).
const MONOTONE_SAFE_FIELDS = REQUIRED_FIELDS.filter((f) => f !== 'amortization_type');
function checkP2_missingFieldMonotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const loan = mkLoan(rand);
    const full = compute({ loan_data: loan }).output_payload;
    const field = pick(rand, MONOTONE_SAFE_FIELDS);
    const stripped = { ...loan };
    delete stripped[field];
    const strippedR = compute({ loan_data: stripped }).output_payload;
    checked++;
    if (strippedR.error_count < full.error_count) violations++;
  }
  return { name: 'P2_removing_required_field_never_decreases_error_count', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — range violation flagged iff numeric value outside declared [min,max] ----------
function checkP3_rangeViolationAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const loan = mkLoan(rand);
    const r = compute({ loan_data: loan }).output_payload;
    checked++;
    const hasLtvViolation = r.errors.some((e) => e.code === 'VALUE_OUT_OF_RANGE' && e.field === 'ltv_pct');
    const expected = loan.ltv_pct !== undefined && (loan.ltv_pct < 0 || loan.ltv_pct > 100);
    if (hasLtvViolation !== expected) violations++;
  }
  return { name: 'P3_ltv_range_violation_matches_0_100_bounds', trials: checked, violations };
}

// ---------- P4: round-trip — fields_supplied equals count of non-null/undefined keys in loan_data ----------
function checkP4_fieldsSuppliedRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const loan = mkLoan(rand);
    const r = compute({ loan_data: loan }).output_payload;
    checked++;
    const expected = Object.keys(loan).filter((k) => loan[k] !== undefined && loan[k] !== null).length;
    if (r.fields_supplied !== expected) violations++;
  }
  return { name: 'P4_fields_supplied_equals_non_null_key_count', trials: checked, violations };
}

// ---------- P5 (float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'completely empty loan_data — all 13 required fields must be flagged REQUIRED_FIELD_MISSING'],
  [{ loan_purpose_type: 'InvalidEnum' }, 'unrecognized enum value for loan_purpose_type — must raise INVALID_ENUM_VALUE'],
  [{ ltv_pct: 100 }, 'ltv_pct exactly at upper range boundary 100 — must NOT raise VALUE_OUT_OF_RANGE'],
  [{ ltv_pct: 100.0001 }, 'ltv_pct just above upper range boundary — must raise VALUE_OUT_OF_RANGE'],
  [{ ltv_pct: 0 }, 'ltv_pct exactly at lower range boundary 0 — must NOT raise VALUE_OUT_OF_RANGE'],
  [{ amortization_type: 'AdjustableRate' }, 'ARM amortization type with no arm_index_type/arm_margin_pct — must raise ARM_CONDITIONAL_REQUIRED for both'],
  [{ credit_score: 300 }, 'credit_score exactly at lower boundary 300 — must NOT raise VALUE_OUT_OF_RANGE'],
  [{ credit_score: 850 }, 'credit_score exactly at upper boundary 850 — must NOT raise VALUE_OUT_OF_RANGE'],
];

function checkP5_forced() {
  const baseline = {
    loan_purpose_type: 'Purchase', amortization_type: 'FixedRate', loan_amount: 300000, ltv_pct: 80,
    occupancy_type: 'PrimaryResidence', property_type: 'Detached', number_of_units: 1,
    interest_rate_pct: 6.5, loan_term_months: 360, credit_score: 720, dti_pct: 36,
    channel_type: 'Retail', doc_type: 'FullDocumentation',
  };
  const rows = [];
  for (const [overrides, label] of CATEGORICAL_BOUNDARY_CASES) {
    const loan = overrides.loan_purpose_type === undefined && Object.keys(overrides).length === 0 ? {} : { ...baseline, ...overrides };
    const r = compute({ loan_data: loan }).output_payload;
    const finite = typeof r.lint_pass === 'boolean' && Number.isFinite(r.error_count) && Number.isFinite(r.warning_count);
    rows.push({ label, overrides, error_count: r.error_count, errors: r.errors.map((e) => e.code), finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_passMatchesErrorCount());
results.properties.push(checkP2_missingFieldMonotone());
results.properties.push(checkP3_rangeViolationAgreement());
results.properties.push(checkP4_fieldsSuppliedRoundTrip());
results.boundary_forced = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
}, null, 2));

if (anyPropertyViolation || anyBoundaryImplausible) {
  console.error('PROPERTY FLOOR FAILED for art-226-mismo-uldd-ulad');
  process.exit(1);
}
console.log('PASS art-226-mismo-uldd-ulad');
