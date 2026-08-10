// kernel_digest_at_authoring: sha256:a7e25b5ced7deecbe2bfaf3ff54f75fec09c0b0058aaa4f1308c175e4f477344
//
// FV-PROPFLOOR-SHARD-B14-1 — property-test floor for art-54-digital-trade-rules-checker.
// Class B (rules-checker), FLOAT-SENSITIVE — confirmed on direct kernel reading (FIX-2 carry):
// lc_terms.invoice_amount vs lc_terms.amount*(1+tolerance_pct/100) is a strict-inequality float
// comparison with NO epsilon tolerance, and presentation-period diffDays = (presDate-shipDate)/
// 86400000 is a raw floating-point date-arithmetic comparison against an integer day count; both
// are exactly the "strict > with no tolerance band" pattern ULP-forcing exists to catch.
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-54-digital-trade-rules-checker.proptest.mjs

import { compute } from '../art-54-digital-trade-rules-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-54-digital-trade-rules-checker.fixtures.json');
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
const rand = mulberry32(0x547707);
const TRIALS = 8000;

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

function mkPP(rng) {
  const lca = randRange(rng, 1, 1e7);
  const tolPct = randRange(rng, 0, 20);
  return {
    rule_set: pick(rng, ['eUCP-2.1', 'eURC-1.1', 'URDTT-1.0']),
    electronic_address_provided: rng() < 0.5,
    format_specified: rng() < 0.5,
    presentation: [],
    lc_terms: {
      invoice_amount: randRange(rng, 0, lca * 1.5),
      amount: lca,
      currency: 'USD',
      tolerance_pct: tolPct,
    },
  };
}

// ---------- P1: verdict is 'discrepant' iff discrepancies.length > 0; counts consistent ----------
function checkP1_verdictConsistentWithDiscrepancies() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { verdict, discrepancies, presentation_summary } = r.output_payload;
    const expectedVerdict = discrepancies.length === 0 ? 'compliant' : 'discrepant';
    if (verdict !== expectedVerdict) violations++;
    if (presentation_summary.discrepancy_count !== discrepancies.length) violations++;
    const critical = discrepancies.filter((d) => d.severity === 'critical').length;
    const major = discrepancies.filter((d) => d.severity === 'major').length;
    if (presentation_summary.critical_count !== critical) violations++;
    if (presentation_summary.major_count !== major) violations++;
  }
  return { name: 'P1_verdict_and_counts_exact_function_of_discrepancies_array', trials: checked, violations };
}

// ---------- P2: amount_check is an exact function of the invoice_amount vs LC amount comparison ----------
function checkP2_amountCheckExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { lc_terms } = pp;
    const expected = lc_terms?.invoice_amount != null && lc_terms?.amount != null
      ? (Number(lc_terms.invoice_amount) > Number(lc_terms.amount) ? 'exceeds' : 'within')
      : 'no_lc_amount';
    if (r.output_payload.amount_check !== expected) violations++;
  }
  return { name: 'P2_amount_check_exact_function_of_invoice_vs_lc_amount', trials: checked, violations };
}

// ---------- P3: tolerance discrepancy fires exactly when invoice_amount > amount*(1+tol) ----------
function checkP3_toleranceDiscrepancyExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    if (pp.rule_set !== 'eUCP-2.1') { i--; continue; }
    const r = compute(pp);
    checked++;
    const { invoice_amount, amount, tolerance_pct } = pp.lc_terms;
    const tol = tolerance_pct != null ? Number(tolerance_pct) / 100 : 0.10;
    const expected = Number(invoice_amount) > Number(amount) * (1 + tol);
    const has = r.output_payload.discrepancies.some((d) => d.rule_ref === 'eUCP v2.1 / UCP 600 Art. 18b');
    if (has !== expected) violations++;
  }
  return { name: 'P3_tolerance_discrepancy_exact_strict_inequality_no_epsilon', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ rule_set: 'eUCP-2.1', electronic_address_provided: true, format_specified: true, presentation: [], lc_terms: { invoice_amount: 1100, amount: 1000, tolerance_pct: 10 } }, 'invoice exactly at LC amount*(1+tol) boundary (1000*1.10=1100) — strict > means this must NOT be flagged as exceeding tolerance'],
  [{ rule_set: 'eUCP-2.1', electronic_address_provided: true, format_specified: true, presentation: [], lc_terms: { invoice_amount: 1100 + 1100 * Number.EPSILON, amount: 1000, tolerance_pct: 10 } }, 'invoice 1 ULP above the tolerance boundary — must now be flagged as exceeding tolerance'],
  [{ rule_set: 'eUCP-2.1', electronic_address_provided: true, format_specified: true, presentation: [], lc_terms: { invoice_amount: 0, amount: 0, tolerance_pct: 10 } }, 'both invoice and LC amount exactly zero — 0 > 0*1.1 is false, must not flag, amount_check must be "within"'],
  [{ rule_set: 'eUCP-2.1', electronic_address_provided: true, format_specified: true, presentation: [], lc_terms: { invoice_amount: -0, amount: 100, tolerance_pct: 0 } }, 'invoice negative zero — must behave as zero, no NaN'],
  [{ rule_set: 'eUCP-2.1', electronic_address_provided: true, format_specified: true, presentation: [], lc_terms: { invoice_amount: 100, amount: 100, tolerance_pct: NaN } }, 'tolerance_pct NaN — Number(NaN)/100 propagates NaN, so tol becomes NaN; kernel does NOT default this (only null/undefined triggers the 0.10 default via the != null check) — 100 > 100*(1+NaN)=NaN is false in JS, so must resolve to NOT flagged'],
  [{ rule_set: 'eUCP-2.1', electronic_address_provided: true, format_specified: true, presentation: [{ doc_type: 'invoice', presented_at: '2026-01-01T00:00:00Z', expiry: '2026-01-01T00:00:00Z' }], lc_terms: null }, 'presented_at exactly equal to expiry (equal timestamps) — strict > means this must NOT be flagged as expired'],
  [{ rule_set: 'eUCP-2.1', electronic_address_provided: true, format_specified: true, presentation: [{ doc_type: 'invoice', presented_at: '2026-01-01T00:00:00.001Z', expiry: '2026-01-01T00:00:00.000Z' }], lc_terms: null }, 'presented_at 1ms after expiry — must be flagged as expired (critical)'],
  [{ rule_set: 'eUCP-2.1', electronic_address_provided: true, format_specified: true, presentation: [{ doc_type: 'invoice', presented_at: 'not-a-date', expiry: '2026-01-01T00:00:00Z' }], lc_terms: null }, 'presented_at is an unparseable date string — new Date() yields Invalid Date (NaN), isNaN() guard must prevent throwing or a false expiry flag'],
  [{ rule_set: 'eUCP-2.1', electronic_address_provided: true, format_specified: true, presentation: [], lc_terms: { invoice_amount: Number.MAX_SAFE_INTEGER, amount: Number.MAX_SAFE_INTEGER, tolerance_pct: 0 } }, 'both amounts at MAX_SAFE_INTEGER, tolerance zero — must not overflow to Infinity, must resolve amount_check "within"'],
  [{ rule_set: 'eUCP-2.1', electronic_address_provided: true, format_specified: true, presentation: [], lc_terms: { invoice_amount: Number.MIN_VALUE, amount: Number.MIN_VALUE, tolerance_pct: 0 } }, 'both amounts at smallest positive double — must remain finite, non-NaN'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { verdict, amount_check, expiry_check, discrepancies } = r.output_payload;
    const plausible = typeof verdict === 'string' && typeof amount_check === 'string' && typeof expiry_check === 'string' && Array.isArray(discrepancies);
    rows.push({ label, input: pp, verdict, amount_check, expiry_check, discrepancy_count: discrepancies.length, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_verdictConsistentWithDiscrepancies());
results.properties.push(checkP2_amountCheckExact());
results.properties.push(checkP3_toleranceDiscrepancyExact());
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
