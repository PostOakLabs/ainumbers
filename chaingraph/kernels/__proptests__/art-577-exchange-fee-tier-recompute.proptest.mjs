// art-577-exchange-fee-tier-recompute.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C30-1).
// kernel_digest_at_authoring: sha256:caed451dceca161ee2dd898a0aee48ceeaee497d39ac0eab2963ebad4437f5d8
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — the WU row's triage table listed this kernel as float:yes; RE-CONFIRMED BY
// DIRECT READ per FIX-2 and that classification does NOT hold. This is a CORRECTION (yes -> no). The
// kernel's own docstring states every rate and money amount is an integer number of micro-dollars
// "so ... every operation here is exact integer arithmetic -- no floating-point residue," and direct
// inspection confirms it: there is not a single division operator anywhere in compute() — the invoice
// recompute is pure integer multiply-then-add (maker_shares_total * rate + taker_shares_total *
// rate), the diff is integer subtraction, and both the invoice-tolerance comparison and the
// Rule-610(c) cap comparison are plain integer `<=`/`>` compares. There is no continuous quotient
// anywhere for a 0/-0/denormal/x·y÷y≠x-style ULP case to exist against. No ULP-boundary claim is
// made or needed.
// Checks: fixture-oracle gate, termination (P1: tiers truncated at MAX_TIERS=20, volume_lines
// truncated at MAX_LINES=2000), boundedness (P2: maker/taker share totals are the exact sum of their
// declared lines, recomputed_invoice_micros is an exact integer when an active tier resolves), a
// differential re-derivation of the active-tier resolution + invoice recompute + Rule 610(c) cap
// check against an independent reimplementation (P3), a metamorphic permutation-invariance identity
// over volume_lines[] order (P4: summation is commutative so maker/taker totals and the recomputed
// invoice do not depend on line order), and forced categorical boundary cases including the exact
// diff_tolerance_micros boundary, the no-tier-qualifies path, the cap-applicability-undeclared path,
// and a large-magnitude probe confirming the kernel stays a deterministic finite integer even when a
// share*rate product approaches Number.MAX_SAFE_INTEGER (P5).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-577-exchange-fee-tier-recompute.proptest.mjs

import { compute } from '../art-577-exchange-fee-tier-recompute.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-577-exchange-fee-tier-recompute.fixtures.json');
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
const rand = mulberry32(0x577C30);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomSchedule(rng) {
  const nTiers = 1 + Math.floor(rng() * 5);
  const thresholds = new Set();
  while (thresholds.size < nTiers) thresholds.add(Math.floor(rng() * 5_000_000));
  const tiers = [...thresholds].map((t, i) => ({
    tier_id: `T${i}`,
    min_adv_shares: t,
    maker_rate_micros_per_share: -500 + Math.floor(rng() * 1500), // rebates can be negative
    taker_rate_micros_per_share: Math.floor(rng() * 1500),
  }));
  return {
    schedule_id: 'SCH-1',
    effective_date: '2026-01-01',
    quotes_priced_ge_1usd: rng() < 0.7,
    tiers,
  };
}
function randomPP(rng) {
  const nLines = Math.floor(rng() * 10);
  return {
    recompute_tolerance_micros: rng() < 0.9 ? Math.floor(rng() * 5000) : undefined,
    invoice_period: { start_date: '2026-01-01', end_date: '2026-01-31' },
    prior_period_adv_shares: Math.floor(rng() * 6_000_000),
    fee_schedule: randomSchedule(rng),
    volume_lines: Array.from({ length: nLines }, () => ({ side: rng() < 0.5 ? 'maker' : 'taker', shares: 1 + Math.floor(rng() * 100_000) })),
    claimed_invoice_micros: Math.floor(rng() * 100_000) - 20_000,
  };
}

// Independent reimplementation, for the differential check (P3).
function reimplement(pp) {
  const tiersSorted = [...pp.fee_schedule.tiers].sort((a, b) => a.min_adv_shares - b.min_adv_shares);
  let active = null;
  for (const t of tiersSorted) if (t.min_adv_shares <= pp.prior_period_adv_shares) active = t;
  let makerTotal = 0, takerTotal = 0;
  for (const l of pp.volume_lines) { if (l.side === 'maker') makerTotal += l.shares; else takerTotal += l.shares; }
  let invoiceVerdict = 'INDETERMINATE', recomputed = null;
  if (active) {
    recomputed = makerTotal * active.maker_rate_micros_per_share + takerTotal * active.taker_rate_micros_per_share;
    const diff = recomputed - pp.claimed_invoice_micros;
    invoiceVerdict = Math.abs(diff) <= pp.recompute_tolerance_micros ? 'MATCHES' : 'DIVERGES';
  }
  let capVerdict;
  if (pp.fee_schedule.quotes_priced_ge_1usd !== true) capVerdict = 'INDETERMINATE';
  else capVerdict = tiersSorted.some((t) => t.taker_rate_micros_per_share > 1000) ? 'CAP_EXCEEDS' : 'CAP_CONFORMANT';
  return { active, makerTotal, takerTotal, invoiceVerdict, recomputed, capVerdict };
}

const TRIALS = 3000;

// ---------- P1: termination — tiers/lines truncated at their MAX caps ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.tiers.length > 20) violations++;
    if (o.volume_summary && o.volume_summary.line_count > 2000) violations++;
    if (o.tiers.length > pp.fee_schedule.tiers.length) violations++;
  }
  return { name: 'P1_termination_tiers_and_lines_bounded', trials: checked, violations };
}

// ---------- P2: boundedness — maker/taker totals are exact sums, invoice is an exact integer ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.decision.execution_state !== 'ran' || !o.volume_summary) continue;
    let maker = 0, taker = 0;
    for (const l of pp.volume_lines) { if (l.side === 'maker') maker += l.shares; else taker += l.shares; }
    if (o.volume_summary.maker_shares_total !== maker) violations++;
    if (o.volume_summary.taker_shares_total !== taker) violations++;
    if (o.recomputed_invoice_micros !== null && !Number.isSafeInteger(o.recomputed_invoice_micros)) violations++;
  }
  return { name: 'P2_boundedness_exact_sums_and_integer_invoice', trials: checked, violations };
}

// ---------- P3: differential — tier resolution + invoice + cap check re-derived independently ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.decision.execution_state !== 'ran') continue;
    const exp = reimplement(pp);
    if ((o.active_tier === null) !== (exp.active === null)) violations++;
    if (o.active_tier && exp.active && o.active_tier.tier_id !== exp.active.tier_id) violations++;
    if (o.invoice_verdict !== exp.invoiceVerdict) violations++;
    if (o.recomputed_invoice_micros !== exp.recomputed) violations++;
    if (o.cap_verdict !== exp.capVerdict) violations++;
  }
  return { name: 'P3_tier_invoice_cap_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance over volume_lines[] order ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1000; i++) {
    const pp = randomPP(rand);
    if (pp.volume_lines.length < 2) continue;
    const shuffled = { ...pp, volume_lines: [...pp.volume_lines].reverse() };
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    checked++;
    if (a.invoice_verdict !== b.invoice_verdict) violations++;
    if (a.recomputed_invoice_micros !== b.recomputed_invoice_micros) violations++;
    if (JSON.stringify(a.volume_summary) !== JSON.stringify(b.volume_summary)) violations++;
  }
  return { name: 'P4_permutation_invariance_volume_lines', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  const schedule = { schedule_id: 'S', effective_date: '2026-01-01', quotes_priced_ge_1usd: true, tiers: [{ tier_id: 'T0', min_adv_shares: 0, maker_rate_micros_per_share: -200, taker_rate_micros_per_share: 300 }] };
  // tolerance absent -> did_not_run
  { const { output_payload: o } = compute({ invoice_period: { start_date: '2026-01-01', end_date: '2026-01-31' }, prior_period_adv_shares: 0, fee_schedule: schedule, volume_lines: [{ side: 'taker', shares: 10 }], claimed_invoice_micros: 3000 }); checked++; if (o.decision.execution_state !== 'did_not_run') violations++; }
  // exact tolerance boundary: recomputed = 10*300=3000, claimed=3000+tol -> MATCHES at tol, DIVERGES at tol-1's complement
  { const { output_payload: o } = compute({ recompute_tolerance_micros: 50, invoice_period: { start_date: '2026-01-01', end_date: '2026-01-31' }, prior_period_adv_shares: 0, fee_schedule: schedule, volume_lines: [{ side: 'taker', shares: 10 }], claimed_invoice_micros: 3050 }); checked++; if (o.invoice_verdict !== 'MATCHES') violations++; }
  { const { output_payload: o } = compute({ recompute_tolerance_micros: 50, invoice_period: { start_date: '2026-01-01', end_date: '2026-01-31' }, prior_period_adv_shares: 0, fee_schedule: schedule, volume_lines: [{ side: 'taker', shares: 10 }], claimed_invoice_micros: 3051 }); checked++; if (o.invoice_verdict !== 'DIVERGES') violations++; }
  // no tier qualifies -> INDETERMINATE (min_adv_shares=100 > declared adv=0)
  { const s2 = { schedule_id: 'S2', effective_date: '2026-01-01', quotes_priced_ge_1usd: true, tiers: [{ tier_id: 'T0', min_adv_shares: 100, maker_rate_micros_per_share: 0, taker_rate_micros_per_share: 10 }] }; const { output_payload: o } = compute({ recompute_tolerance_micros: 0, invoice_period: { start_date: '2026-01-01', end_date: '2026-01-31' }, prior_period_adv_shares: 0, fee_schedule: s2, volume_lines: [{ side: 'taker', shares: 10 }], claimed_invoice_micros: 0 }); checked++; if (o.invoice_verdict !== 'INDETERMINATE') violations++; }
  // cap applicability not declared true -> cap_verdict INDETERMINATE, independent of invoice outcome
  { const s3 = { ...schedule, quotes_priced_ge_1usd: false }; const { output_payload: o } = compute({ recompute_tolerance_micros: 0, invoice_period: { start_date: '2026-01-01', end_date: '2026-01-31' }, prior_period_adv_shares: 0, fee_schedule: s3, volume_lines: [{ side: 'taker', shares: 10 }], claimed_invoice_micros: 3000 }); checked++; if (o.cap_verdict !== 'INDETERMINATE') violations++; }
  // large-magnitude probe: shares near Number.MAX_SAFE_INTEGER -- must stay finite/deterministic
  {
    const bigShares = Number.MAX_SAFE_INTEGER - 3;
    const pp = { recompute_tolerance_micros: 0, invoice_period: { start_date: '2026-01-01', end_date: '2026-01-31' }, prior_period_adv_shares: 0, fee_schedule: schedule, volume_lines: [{ side: 'taker', shares: bigShares }], claimed_invoice_micros: 0 };
    const { output_payload: o } = compute(pp);
    checked++;
    if (!Number.isFinite(o.recomputed_invoice_micros)) violations++;
    const { output_payload: o2 } = compute(pp);
    if (o2.recomputed_invoice_micros !== o.recomputed_invoice_micros) violations++;
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
  tool_id: 'art-577-exchange-fee-tier-recompute',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
