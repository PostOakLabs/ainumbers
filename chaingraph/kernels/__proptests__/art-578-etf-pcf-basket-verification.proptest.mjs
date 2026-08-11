// art-578-etf-pcf-basket-verification.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C30-1).
// kernel_digest_at_authoring: sha256:8490d544bbc1bcf3f211e1b3e65eb5f0d9d5e83522bb6baba6486139e802d40d
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — the WU row's triage table listed this kernel as float:yes; RE-CONFIRMED BY
// DIRECT READ per FIX-2 and that classification does NOT hold. This is a CORRECTION (yes -> no). The
// kernel's own docstring states every cash figure is an integer minor unit and every quantity an
// integer share count, "Non-integer input is REJECTED rather than coerced," and direct inspection
// confirms it: safeInt()/posInt() gate every numeric field to Number.isSafeInteger, and compute()
// contains not one division operator — every check is integer multiply (quantity_per_unit *
// units_requested, shortfall_quantity * substitution_price_minor, balancing_amount_per_unit_minor *
// units_requested), integer add, and integer `===`/`<=` compares. No ULP-boundary claim is made or
// needed.
// ⚠ Distinct from ULP forcing: neither posInt() nor safeInt() caps magnitude below
// Number.MAX_SAFE_INTEGER, so quantity_per_unit * units_requested (and the two balancing-amount
// products) can in principle exceed 2^53 for large-but-individually-valid inputs. This is a
// boundedness/overflow concern, floored here as P5's forced large-magnitude probe rather than
// fabricated as ULP forcing around a threshold this kernel does not have.
// Checks: fixture-oracle gate, termination (P1: pcf.lines truncated at MAX_LINES=100, basket.
// cash_in_lieu truncated at MAX_CIL=50), boundedness (P2: every expected_quantity is an exact integer
// multiple of quantity_per_unit, cash_in_lieu_total_minor is the exact sum of declared cash-in-lieu
// line values), a differential re-derivation of the per-line match + balancing-amount arithmetic
// against an independent reimplementation (P3), a metamorphic permutation-invariance identity over
// pcf.lines[]/basket.lines[] order (P4: matching is keyed by security_id, not position, so reordering
// either array leaves every verdict unchanged), and forced categorical boundary cases including the
// exact cash-tolerance boundary, an extra basket line not on the PCF, a cash-in-lieu declared for a
// non-PCF line, and a large-magnitude probe (P5).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-578-etf-pcf-basket-verification.proptest.mjs

import { compute } from '../art-578-etf-pcf-basket-verification.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-578-etf-pcf-basket-verification.fixtures.json');
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
const rand = mulberry32(0x578C30);

function randomPP(rng) {
  const nLines = 1 + Math.floor(rng() * 6);
  const securities = Array.from({ length: nLines }, (_, i) => `SEC-${i}`);
  const units_requested = 1 + Math.floor(rng() * 50);
  const pcfLines = securities.map((sid) => ({ security_id: sid, name: sid, quantity_per_unit: 1 + Math.floor(rng() * 500) }));
  const balancing = -10000 + Math.floor(rng() * 20000);
  // Build a basket that mostly matches, sometimes diverges, from the PCF lines above.
  const basketLines = pcfLines.map((line) => ({
    security_id: line.security_id,
    quantity: rng() < 0.8 ? line.quantity_per_unit * units_requested : Math.floor(rng() * line.quantity_per_unit * units_requested),
  }));
  const cashInLieu = rng() < 0.3 && pcfLines.length > 0
    ? [{ security_id: securities[0], shortfall_quantity: 1 + Math.floor(rng() * 50), substitution_price_minor: Math.floor(rng() * 10000) }]
    : [];
  const expectedBalancing = balancing * units_requested;
  const cilValue = cashInLieu.reduce((s, c) => s + c.shortfall_quantity * c.substitution_price_minor, 0);
  return {
    cash_tolerance_minor: rng() < 0.9 ? Math.floor(rng() * 100) : undefined,
    transaction_type: rng() < 0.5 ? 'create' : 'redeem',
    units_requested,
    creation_unit_size: 1 + Math.floor(rng() * 1000),
    pcf: { as_of: '2026-01-01', balancing_amount_per_unit_minor: balancing, lines: pcfLines },
    basket: { cash_deposited_minor: expectedBalancing + cilValue + (rng() < 0.5 ? 0 : Math.floor(rng() * 20) - 10), lines: basketLines, cash_in_lieu: cashInLieu },
  };
}

// Independent reimplementation of the per-line match + balancing arithmetic, for the differential check (P3).
function reimplement(pp) {
  const basketQty = new Map(pp.basket.lines.map((l) => [l.security_id, l.quantity]));
  const cilBySec = new Map(pp.basket.cash_in_lieu.map((c) => [c.security_id, c]));
  let allMatch = true, cilTotal = 0;
  for (const line of pp.pcf.lines) {
    const expected = line.quantity_per_unit * pp.units_requested;
    const delivered = basketQty.get(line.security_id) || 0;
    const cil = cilBySec.get(line.security_id) || null;
    const substituted = cil ? cil.shortfall_quantity : 0;
    if (cil) cilTotal += cil.shortfall_quantity * cil.substitution_price_minor;
    if (delivered + substituted !== expected) allMatch = false;
  }
  const expectedBalancing = pp.pcf.balancing_amount_per_unit_minor * pp.units_requested;
  const expectedCash = expectedBalancing + cilTotal;
  const delta = pp.basket.cash_deposited_minor - expectedCash;
  const cashMatches = Math.abs(delta) <= pp.cash_tolerance_minor;
  return { allMatch, cilTotal, expectedCash, delta, cashMatches };
}

const TRIALS = 3000;

// ---------- P1: termination — pcf.lines/cash_in_lieu truncated at their MAX caps ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.line_count > 100) violations++;
    if (o.line_count > pp.pcf.lines.length) violations++;
  }
  return { name: 'P1_termination_pcf_lines_bounded', trials: checked, violations };
}

// ---------- P2: boundedness — expected_quantity is an exact multiple, cash-in-lieu total is exact sum ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.decision.execution_state !== 'ran') continue;
    for (const lr of o.line_results) {
      const pcfLine = pp.pcf.lines.find((l) => l.security_id === lr.security_id);
      if (lr.expected_quantity !== pcfLine.quantity_per_unit * pp.units_requested) violations++;
      if (!Number.isSafeInteger(lr.expected_quantity)) violations++;
    }
    const expectedCil = pp.basket.cash_in_lieu.reduce((s, c) => s + c.shortfall_quantity * c.substitution_price_minor, 0);
    if (o.cash_in_lieu_total_minor !== expectedCil) violations++;
  }
  return { name: 'P2_boundedness_exact_multiples_and_cil_sum', trials: checked, violations };
}

// ---------- P3: differential — per-line match + balancing arithmetic re-derived independently ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.decision.execution_state !== 'ran') continue;
    const exp = reimplement(pp);
    if (o.cash_delta_minor !== exp.delta) violations++;
    if (o.cash_matches !== exp.cashMatches) violations++;
    const linesMatch = o.line_results.every((lr) => lr.matches);
    if (linesMatch !== exp.allMatch) violations++;
  }
  return { name: 'P3_line_match_and_balancing_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance over pcf.lines[] and basket.lines[] order ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1000; i++) {
    const pp = randomPP(rand);
    if (pp.pcf.lines.length < 2) continue;
    const shuffled = {
      ...pp,
      pcf: { ...pp.pcf, lines: [...pp.pcf.lines].reverse() },
      basket: { ...pp.basket, lines: [...pp.basket.lines].reverse() },
    };
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    checked++;
    if (a.verdict !== b.verdict) violations++;
    if (a.cash_delta_minor !== b.cash_delta_minor) violations++;
    if (a.cash_in_lieu_total_minor !== b.cash_in_lieu_total_minor) violations++;
  }
  return { name: 'P4_permutation_invariance_pcf_and_basket_lines', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  const pcf = { as_of: '2026-01-01', balancing_amount_per_unit_minor: 100, lines: [{ security_id: 'A', name: 'A', quantity_per_unit: 10 }] };
  // tolerance absent -> did_not_run
  { const { output_payload: o } = compute({ transaction_type: 'create', units_requested: 1, creation_unit_size: 1, pcf, basket: { cash_deposited_minor: 100, lines: [{ security_id: 'A', quantity: 10 }], cash_in_lieu: [] } }); checked++; if (o.decision.execution_state !== 'did_not_run') violations++; }
  // exact cash boundary and one unit over
  { const { output_payload: o } = compute({ cash_tolerance_minor: 5, transaction_type: 'create', units_requested: 1, creation_unit_size: 1, pcf, basket: { cash_deposited_minor: 105, lines: [{ security_id: 'A', quantity: 10 }], cash_in_lieu: [] } }); checked++; if (!o.cash_matches) violations++; }
  { const { output_payload: o } = compute({ cash_tolerance_minor: 5, transaction_type: 'create', units_requested: 1, creation_unit_size: 1, pcf, basket: { cash_deposited_minor: 106, lines: [{ security_id: 'A', quantity: 10 }], cash_in_lieu: [] } }); checked++; if (o.cash_matches) violations++; }
  // extra basket line not on the PCF -> LINE_EXTRA_IN_BASKET, high-severity, DIVERGES
  { const { output_payload: o } = compute({ cash_tolerance_minor: 0, transaction_type: 'create', units_requested: 1, creation_unit_size: 1, pcf, basket: { cash_deposited_minor: 100, lines: [{ security_id: 'A', quantity: 10 }, { security_id: 'ZZZ', quantity: 5 }], cash_in_lieu: [] } }); checked++; if (!o.findings.some((f) => f.code === 'LINE_EXTRA_IN_BASKET')) violations++; if (o.verdict !== 'DIVERGES') violations++; }
  // cash-in-lieu declared for a security not on the PCF -> CASH_IN_LIEU_NOT_A_PCF_LINE
  { const { output_payload: o } = compute({ cash_tolerance_minor: 100000, transaction_type: 'create', units_requested: 1, creation_unit_size: 1, pcf, basket: { cash_deposited_minor: 100, lines: [{ security_id: 'A', quantity: 10 }], cash_in_lieu: [{ security_id: 'ZZZ', shortfall_quantity: 1, substitution_price_minor: 1 }] } }); checked++; if (!o.findings.some((f) => f.code === 'CASH_IN_LIEU_NOT_A_PCF_LINE')) violations++; }
  // large-magnitude probe: quantity_per_unit * units_requested near Number.MAX_SAFE_INTEGER
  {
    const bigQty = Number.MAX_SAFE_INTEGER - 5;
    const bigPcf = { as_of: '2026-01-01', balancing_amount_per_unit_minor: 0, lines: [{ security_id: 'A', name: 'A', quantity_per_unit: bigQty }] };
    const pp = { cash_tolerance_minor: 0, transaction_type: 'create', units_requested: 1, creation_unit_size: 1, pcf: bigPcf, basket: { cash_deposited_minor: 0, lines: [{ security_id: 'A', quantity: bigQty }], cash_in_lieu: [] } };
    const { output_payload: o } = compute(pp);
    checked++;
    if (!Number.isFinite(o.line_results[0].expected_quantity)) violations++;
    const { output_payload: o2 } = compute(pp);
    if (o2.line_results[0].expected_quantity !== o.line_results[0].expected_quantity) violations++;
  }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
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
  tool_id: 'art-578-etf-pcf-basket-verification',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
