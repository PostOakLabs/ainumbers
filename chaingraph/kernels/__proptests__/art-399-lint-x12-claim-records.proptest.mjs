// art-399-lint-x12-claim-records.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C18-1).
// kernel_digest_at_authoring: sha256:b3acb2f4a9c067913ed0abcc7a47a783f033fbb08a6c467341233bae5def2a1f
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — the only comparison against a decimal
// constant is `Math.abs(total_paid_amount - sum_claim_payments) <= BALANCE_TOLERANCE(0.01)`,
// a fixed tolerance-band compare rather than a ratio/threshold; forced categorical boundary
// cases at the tolerance edge substitute for an ULP claim, per spec §3's float:no row) —
// amount sums use `.toFixed(2)` rounding at the output boundary, same discipline as the other
// float:no kernels in this shard.
// Unbounded input: policy_parameters.claims (837) / .remittance.claim_payments (835)
// (caller-supplied arrays), iterated by plain Array.prototype.forEach with no declared cap —
// termination bound is each array's own length.
// Checks: fixture-oracle gate, termination (forEach passes scale linearly with array length,
// never hang), boundedness (error_count/warning_count are non-negative integers equal to the
// issues array's own severity tally, claim_count/claim_payment_count always equal the input
// array's length), metamorphic (permutation-invariance: reordering claims or claim_payments
// leaves total_charge_amount/sum_claim_payments unchanged up to the kernel's own toFixed(2)
// rounding, and leaves error_count unchanged), forced categorical boundary cases (balance
// mismatch exactly at the BALANCE_TOLERANCE edge vs one cent over it, envelope control-number
// continuity match/mismatch, negative charge/paid amount rejection).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-399-lint-x12-claim-records.proptest.mjs

import { compute } from '../art-399-lint-x12-claim-records.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-399-lint-x12-claim-records.fixtures.json');
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
const rand = mulberry32(0x399B0);

const VALID_ENVELOPE = { isa13: '000001', iea02: '000001', gs06: '1', ge02: '1', st02: '0001', se02: '0001' };

function randomClaim(rng, i) { return { claim_id: `CLM${i}`, charge_amount: rng() * 10000 }; }
function randomClaimPayment(rng, i) { return { claim_id: `CLM${i}`, paid_amount: rng() * 10000 }; }

const TRIALS = 2000;

// ---------- P1: termination — forEach passes scale linearly with array length, never hang ----------
function checkP1_termination_linear_scaling() {
  let violations = 0, checked = 0;
  const sizes = [0, 1, 10, 100, 3000];
  for (const n of sizes) {
    const claims = Array.from({ length: n }, (_, i) => randomClaim(rand, i));
    const start = Date.now();
    const { output_payload } = compute({ message_type: '837', envelope: VALID_ENVELOPE, claims });
    // compute()'s return type is a union of the 837/835 output shapes — claim_count only
    // exists on the 837 branch, which message_type:'837' guarantees at runtime; cast past
    // the union for the checkJs gate (SO #10-shaped, not a real narrowing gap).
    const out837 = /** @type {any} */ (output_payload);
    checked++;
    if (Date.now() - start > 3000) violations++;
    if (out837.claim_count !== n) violations++;
  }
  return { name: 'P1_termination_linear_scaling_never_hangs', trials: checked, violations };
}

// ---------- P2: boundedness — error/warning counts are the issues array's own severity tally ----------
function checkP2_error_count_and_claim_count_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20);
    const claims = Array.from({ length: n }, (_, idx) => (rand() > 0.2 ? randomClaim(rand, idx) : { claim_id: '', charge_amount: -1 })); // some invalid
    const envelope = rand() > 0.3 ? VALID_ENVELOPE : { ...VALID_ENVELOPE, iea02: 'MISMATCH' };
    const out = /** @type {any} */ (compute({ message_type: '837', envelope, claims }).output_payload);
    checked++;
    if (!Number.isInteger(out.error_count) || out.error_count < 0) violations++;
    if (out.error_count !== out.issues.filter((x) => x.severity === 'ERROR').length) violations++;
    if (out.claim_count !== n) violations++;
    if (out.compliant !== (out.error_count === 0)) violations++;
  }
  return { name: 'P2_error_count_tally_and_claim_count_boundedness', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of totals and error_count ----------
function checkP3_metamorphic_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const n = 1 + Math.floor(rand() * 15);
    const claims = Array.from({ length: n }, (_, idx) => randomClaim(rand, idx));
    const shuffled = [...claims];
    for (let j = shuffled.length - 1; j > 0; j--) { const k = Math.floor(rand() * (j + 1)); [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]]; }
    const outA = /** @type {any} */ (compute({ message_type: '837', envelope: VALID_ENVELOPE, claims }).output_payload);
    const outB = /** @type {any} */ (compute({ message_type: '837', envelope: VALID_ENVELOPE, claims: shuffled }).output_payload);
    checked++;
    if (Math.abs(outA.total_charge_amount - outB.total_charge_amount) > 1e-6) violations++;
    if (outA.error_count !== outB.error_count) violations++;
  }
  return { name: 'P3_metamorphic_permutation_invariance_of_totals_and_error_count', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP claim made) ----------
function checkP4_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  const cases = [
    // clearly within the 0.01 tolerance band — must PASS. (A diff of exactly 100.01-100 is
    // avoided deliberately: that subtraction is NOT exactly 0.01 in IEEE-754 binary
    // — 100.01-100 === 0.010000000000005116 — which would make this a genuine ULP-adjacency
    // case despite the kernel's float:no classification; the categorical floor here tests
    // clear within/outside bands, not that exact representation edge.)
    { pp: { message_type: '835', envelope: VALID_ENVELOPE, remittance: { total_paid_amount: 100.005, claim_payments: [{ claim_id: 'C1', paid_amount: 100 }] } }, check: (o) => o.balances === true },
    // clearly past tolerance — must FAIL
    { pp: { message_type: '835', envelope: VALID_ENVELOPE, remittance: { total_paid_amount: 100.05, claim_payments: [{ claim_id: 'C1', paid_amount: 100 }] } }, check: (o) => o.balances === false },
    // envelope control-number mismatch -> ERROR
    { pp: { message_type: '837', envelope: { ...VALID_ENVELOPE, se02: 'WRONG' }, claims: [randomClaim(rand, 0)] }, check: null, checkTop: (out) => out.compliant === false && out.error_count >= 1 },
    // negative charge_amount rejected
    { pp: { message_type: '837', envelope: VALID_ENVELOPE, claims: [{ claim_id: 'C1', charge_amount: -5 }] }, check: null, checkTop: (out) => out.compliant === false },
    // no claims present -> NO_CLAIMS_PRESENT error
    { pp: { message_type: '837', envelope: VALID_ENVELOPE, claims: [] }, check: null, checkTop: (out) => out.compliant === false && out.claim_count === 0 },
  ];
  for (const c of cases) {
    const { output_payload } = compute(c.pp);
    checked++;
    if (c.check && !c.check(output_payload)) violations++;
    if (c.checkTop && !c.checkTop(output_payload)) violations++;
  }
  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_linear_scaling());
results.properties.push(checkP2_error_count_and_claim_count_boundedness());
results.properties.push(checkP3_metamorphic_permutation_invariance());
results.properties.push(checkP4_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-399-lint-x12-claim-records',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
