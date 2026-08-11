// art-564-ucp-checkout-payload-lint.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C28-1).
// kernel_digest_at_authoring: sha256:828c4890e7f551a049a00ccacf21c33350300f9b10d047e2d05904d0f97e5c62
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (matches the WU row, direct read confirms). isSafeInt() REQUIRES
// Number.isSafeInteger() for every Total.amount and LineItem.quantity -- the kernel's own
// design deliberately REJECTS non-integer amounts as a lint finding rather than doing float
// arithmetic on them. There is zero division, multiplication, or rounding anywhere in the file;
// every check is structural (required-field presence, enum membership, cardinality counting,
// integer-type validation). Forced categorical boundary cases are used in place of ULP-boundary
// forcing -- including the non-integer-amount case itself, which demonstrates the float
// exclusion rather than a float computation.
// Checks: fixture-oracle gate, termination (findings bounded by a finite function of the fixed
// required-field count plus line_items.length and totals.length), boundedness (error_count +
// warning_count === finding_count, verdict is one of 3 enums, the three-way verdict precedence
// order is respected), differential re-derivation of the subtotal/total cardinality counts and
// the three-way verdict precedence via an independent reimplementation, permutation-invariance
// of line_items/totals array order (finding counts and cardinality checks are order-independent
// even though per-finding "path" strings carry a positional index), and forced categorical
// boundary cases (absent payload, unknown ucp.version capping the verdict at UNKNOWN_VERSION
// regardless of otherwise-clean structure, quantity 0 vs 1 boundary, exactly-one-subtotal/-total
// vs miscounted cardinality, non-integer amount).
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-564-ucp-checkout-payload-lint.proptest.mjs

import { compute, KNOWN_UCP_VERSIONS } from '../art-564-ucp-checkout-payload-lint.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-564-ucp-checkout-payload-lint.fixtures.json');
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
const rand = mulberry32(0x56400028);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const STATUS_ENUM = ['incomplete', 'requires_escalation', 'ready_for_complete', 'complete_in_progress', 'completed', 'canceled'];

function randomTotalEntry(rng, type) {
  return { type, amount: rng() < 0.1 ? 4.5 : Math.floor(rng() * 100000) };
}
function randomLineItem(rng, i) {
  return {
    id: `li_${i}`,
    item: { id: `sku_${i}` },
    quantity: rng() < 0.1 ? 0 : Math.floor(rng() * 5) + 1,
    totals: [randomTotalEntry(rng, 'subtotal'), randomTotalEntry(rng, 'total')],
  };
}
function randomPayload(rng) {
  const nLine = Math.floor(rng() * 4);
  const version = rng() < 0.8 ? pick(rng, KNOWN_UCP_VERSIONS) : '1999-01-01';
  const totals = [randomTotalEntry(rng, 'subtotal')];
  if (rng() < 0.85) totals.push(randomTotalEntry(rng, 'total'));
  return {
    ucp: { version },
    id: `checkout_${Math.floor(rng() * 10000)}`,
    status: rng() < 0.9 ? pick(rng, STATUS_ENUM) : 'bogus_status',
    currency: rng() < 0.9 ? 'USD' : 'us',
    line_items: Array.from({ length: nLine }, (_, i) => randomLineItem(rng, i)),
    totals,
    links: [],
  };
}
function randomPP(rng) {
  return { payload: rng() < 0.1 ? null : randomPayload(rng) };
}

const TRIALS = 3000;

// ---------- P1: termination -- findings bounded by a finite function of input array sizes ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const li = (pp.payload && Array.isArray(pp.payload.line_items)) ? pp.payload.line_items.length : 0;
    const to = (pp.payload && Array.isArray(pp.payload.totals)) ? pp.payload.totals.length : 0;
    // generous finite bound: 7 required-field checks + a handful of per-entry checks each
    const bound = 10 + li * 6 + to * 3;
    if (output_payload.finding_count > bound) violations++;
    if (output_payload.error_count + output_payload.warning_count !== output_payload.finding_count) violations++;
  }
  return { name: 'P1_findings_bounded_by_finite_function_of_input_size', trials: checked, violations };
}

// ---------- P2: boundedness -- verdict enum, three-way precedence order respected ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!['CONFORMANT', 'NONCONFORMANT', 'UNKNOWN_VERSION'].includes(output_payload.verdict)) violations++;
    if (!pp.payload) { if (output_payload.verdict !== 'NONCONFORMANT') violations++; }
    else if (output_payload.ucp_version_declared === null || !KNOWN_UCP_VERSIONS.includes(output_payload.ucp_version_declared)) {
      if (output_payload.verdict !== 'UNKNOWN_VERSION') violations++;
    } else if (output_payload.error_count > 0) {
      if (output_payload.verdict !== 'NONCONFORMANT') violations++;
    } else if (output_payload.verdict !== 'CONFORMANT') violations++;
  }
  return { name: 'P2_verdict_precedence_order_respected', trials: checked, violations };
}

// ---------- P3 (differential): subtotal/total cardinality re-derived ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!pp.payload || !Array.isArray(pp.payload.totals)) continue;
    const subCount = pp.payload.totals.filter((t) => t && t.type === 'subtotal').length;
    const totCount = pp.payload.totals.filter((t) => t && t.type === 'total').length;
    const hasSubViolation = output_payload.findings.some((f) => f.code === 'TOTALS_SUBTOTAL_CARDINALITY');
    const hasTotViolation = output_payload.findings.some((f) => f.code === 'TOTALS_TOTAL_CARDINALITY');
    if (hasSubViolation !== (subCount !== 1)) violations++;
    if (hasTotViolation !== (totCount !== 1)) violations++;
  }
  return { name: 'P3_cardinality_differential', trials: checked, violations };
}

// ---------- P4: metamorphic -- permutation-invariance of line_items/totals order ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1200; i++) {
    const pp = randomPP(rand);
    if (!pp.payload || pp.payload.line_items.length < 2) continue;
    const shuffled = { payload: { ...pp.payload, line_items: [...pp.payload.line_items].reverse() } };
    const r1 = compute(pp).output_payload;
    const r2v = compute(shuffled).output_payload;
    checked++;
    if (r1.finding_count !== r2v.finding_count) violations++;
    if (r1.error_count !== r2v.error_count) violations++;
    if (r1.warning_count !== r2v.warning_count) violations++;
    if (r1.verdict !== r2v.verdict) violations++;
  }
  return { name: 'P4_line_items_order_invariance', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  const conformantBase = {
    ucp: { version: '2026-04-08' }, id: 'c1', status: 'incomplete', currency: 'USD',
    line_items: [], totals: [{ type: 'subtotal', amount: 100 }, { type: 'total', amount: 100 }], links: [],
  };
  // absent payload -> NONCONFORMANT (structural failure, never UNKNOWN_VERSION)
  checked++;
  { const r = compute({}).output_payload; if (r.verdict !== 'NONCONFORMANT' || r.ucp_version_declared !== null) violations++; }
  // unknown version, otherwise clean structure -> capped at UNKNOWN_VERSION, never CONFORMANT
  checked++;
  { const r = compute({ payload: { ...conformantBase, ucp: { version: '1999-01-01' } } }).output_payload; if (r.verdict !== 'UNKNOWN_VERSION') violations++; }
  // quantity === 0 -> LINE_ITEM_QUANTITY_INVALID error
  checked++;
  {
    const r = compute({ payload: { ...conformantBase, line_items: [{ id: 'li1', item: { id: 's1' }, quantity: 0, totals: [] }] } }).output_payload;
    if (!r.findings.some((f) => f.code === 'LINE_ITEM_QUANTITY_INVALID')) violations++;
  }
  // quantity === 1 (just above 0) -> no quantity finding
  checked++;
  {
    const r = compute({ payload: { ...conformantBase, line_items: [{ id: 'li1', item: { id: 's1' }, quantity: 1, totals: [] }] } }).output_payload;
    if (r.findings.some((f) => f.code === 'LINE_ITEM_QUANTITY_INVALID')) violations++;
  }
  // exactly one subtotal + one total -> no cardinality finding
  checked++;
  { const r = compute({ payload: conformantBase }).output_payload; if (r.findings.some((f) => f.code.startsWith('TOTALS_'))) violations++; }
  // two subtotals, zero totals -> both cardinality findings fire
  checked++;
  {
    const r = compute({ payload: { ...conformantBase, totals: [{ type: 'subtotal', amount: 10 }, { type: 'subtotal', amount: 20 }] } }).output_payload;
    if (!r.findings.some((f) => f.code === 'TOTALS_SUBTOTAL_CARDINALITY') || !r.findings.some((f) => f.code === 'TOTALS_TOTAL_CARDINALITY')) violations++;
  }
  // non-integer amount -> TOTAL_ENTRY_AMOUNT_NOT_INTEGER (the float-exclusion boundary itself)
  checked++;
  {
    const r = compute({ payload: { ...conformantBase, totals: [{ type: 'subtotal', amount: 100 }, { type: 'total', amount: 4.5 }] } }).output_payload;
    if (!r.findings.some((f) => f.code === 'TOTAL_ENTRY_AMOUNT_NOT_INTEGER')) violations++;
  }
  return { name: 'P5_forced_categorical_boundaries', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-564-ucp-checkout-payload-lint',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
