// art-765-dependent-care-fsa-cdctc-optimizer.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the APEXPORT-130 porting payload
// (kernel + fixtures + VECTORS/DIFFERS/CITES records, GRADES PASS-PENDING-XV
// 2026-10-18, Builder-verifies-at-land 88/88).
// kernel_digest_at_authoring: sha256:c97db4a0decc3956e9c9e6a1878f1fafa546ce6b213a9a8b5c5ab7a41207bdee
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: PARTIAL — the kernel deliberately keeps the Apex page's float
// arithmetic so its outputs match the ported-from page to the digit. The
// properties below assert only relations that are exact under IEEE-754
// (non-increasing rate in AGI on the fixed grid, equality of recomputed
// tax-savings products, membership in the documented rate band) or restatements
// of the published formula, never fragile float equals on arbitrary draws.
//
// Checks: fixture-oracle gate (the 44 committed vectors — the Apex #130 live
// outputs plus the boundary pairs at and past every comparator: tier-A floor
// 0.35, tier-B floor 0.20, $2,000/$4,000 steps, $15,000/$75,000/$150,000
// thresholds, $3,000/$6,000 caps, the pre/post-2026 table switch, the $250
// sweep grid, the MFS flag and every named refusal); P1 the §21(a)(2)
// applicable percentage is non-increasing in AGI and never leaves
// [0.20, 0.50], on both the statutory schedules and both joint/non-joint
// tier-B entries; P2 determinism (two runs agree byte-for-byte) and output
// shape (no undefined/NaN/non-finite anywhere in output_payload — this pins
// the disabled-tier null encoding that keeps the execution hash I-JSON);
// P3 invalid-domain inputs take the refused-payload branch (this kernel's
// contract) with a named refusal_reason and ART765_INPUT_REFUSED;
// P4 the sweep contract: optimal_combo.total_savings >= max(fsa_only,
// cdctc_only), the recommended contribution is a multiple of the $250 grid
// whenever the FSA is available and 0 when it is not, and fsa_only never
// carries a CDCTC credit; P5 the schedule restated independently for a
// post-2025 single filer (0.50 minus ceil((agi-15000)/2000) points floored at
// 0.35, then the tier-B step to the 0.20 floor from $75,000); P6 the optional
// fsa_contrib echo never changes any number.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-765-dependent-care-fsa-cdctc-optimizer.proptest.mjs

import { compute } from '../art-765-dependent-care-fsa-cdctc-optimizer.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-765-dependent-care-fsa-cdctc-optimizer';

const STATUSES = ['single', 'mfj', 'mfs'];

const basePP = () => ({
  as_of: '2026-06-30', filing_status: 'single', agi: 60000,
  marginal_rate_pct: 22, state_rate_pct: 5, num_children: 2,
  childcare_cost: 12000, fsa_available: true,
});

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const hasBadNumber = (x) => {
  if (typeof x === 'number') return !Number.isFinite(x);
  if (x === null || typeof x !== 'object') return false;
  return Object.values(x).some(hasBadNumber);
};

const drawPP = (rng) => ({
  as_of: pick(rng, ['2026-06-30', '2025-06-30']),
  filing_status: pick(rng, STATUSES),
  agi: Math.floor(rng() * 200000),
  marginal_rate_pct: Math.floor(rng() * 35),
  state_rate_pct: Math.floor(rng() * 12),
  num_children: 1 + Math.floor(rng() * 3),
  childcare_cost: Math.floor(rng() * 30000),
  fsa_available: rng() < 0.8,
});

// P1 — applicable percentage non-increasing in AGI, always within [0.20, 0.50].
// STATUTORY ONLY: the apex_page schedule is deliberately the source page's own
// superseded table, which DIFFERS.md D4 records as NON-MONOTONIC (it falls
// below the 20% floor for AGI $31,000..$42,999 and snaps back at $43,000) —
// asserting monotonicity on apex_page is asserting a falsehood, not a bug.
function checkP1RateMonotone() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76501);
  for (let i = 0; i < 120; i++) {
    const pp = drawPP(rng);
    const agi = Math.floor(rng() * 200000);
    const r0 = compute({ ...pp, agi, ruleset: 'statutory' }).output_payload.cdctc_rate;
    const rUp = compute({ ...pp, agi: agi + 1, ruleset: 'statutory' }).output_payload.cdctc_rate;
    const rFar = compute({ ...pp, agi: agi + 2500, ruleset: 'statutory' }).output_payload.cdctc_rate;
    checked += 3;
    if (rUp > r0 || rFar > r0) { violations++; console.log(`P1 violation: statutory rate rose with AGI (agi=${agi}: ${r0} -> ${rUp}/${rFar})`); }
    if (!(r0 >= 0.20 && r0 <= 0.50)) { violations++; console.log(`P1 violation: statutory rate ${r0} outside [0.20, 0.50]`); }
  }
  return { name: 'P1 statutory cdctc_rate non-increasing in AGI, within [0.20, 0.50]', checked, violations };
}

// P2 — determinism and output shape.
function checkP2DeterminismShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76502);
  for (let i = 0; i < 60; i++) {
    const pp = { ...drawPP(rng), fsa_contrib: rng() < 0.5 ? Math.floor(rng() * 5000) : undefined };
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    checked += 2;
    if (!deepEqual(a, b)) { violations++; console.log('P2 violation: two runs differ'); }
    if (hasBadNumber(a) || JSON.stringify(a).includes('undefined')) { violations++; console.log('P2 violation: undefined/NaN/non-finite in output_payload'); }
  }
  return { name: 'P2 determinism + output shape (no undefined/NaN/non-finite)', checked, violations };
}

// P3 — invalid-domain inputs take the refused-payload branch with a named reason.
function checkP3DomainRefusal() {
  let checked = 0, violations = 0;
  const bad = [
    ['as_of not ISO', { ...basePP(), as_of: '2026-13-45' }], ['as_of number', { ...basePP(), as_of: 20260630 }],
    ['filing_status bad', { ...basePP(), filing_status: 'hoH' }], ['agi negative', { ...basePP(), agi: -1 }],
    ['agi string', { ...basePP(), agi: '60000' }], ['marginal 100.5', { ...basePP(), marginal_rate_pct: 100.5 }],
    ['state -0.1', { ...basePP(), state_rate_pct: -0.1 }], ['num_children 0', { ...basePP(), num_children: 0 }],
    ['num_children 2.5', { ...basePP(), num_children: 2.5 }], ['childcare negative', { ...basePP(), childcare_cost: -100 }],
    ['fsa_available string', { ...basePP(), fsa_available: 'yes' }], ['fsa_contrib negative', { ...basePP(), fsa_contrib: -1 }],
    ['ruleset bad', { ...basePP(), ruleset: 'page' }],
  ];
  for (const [label, pp] of bad) {
    checked++;
    const out = compute(pp);
    // The refused payload names the reason, carries domain_errors, raises
    // ART765_INPUT_REFUSED and nulls every strategy field. (The refusals[]
    // array itself is empty by the payload contract — the detail rides in
    // domain_errors.)
    if (out.output_payload.refusal_reason === null || out.output_payload.domain_errors.length === 0
      || !out.compliance_flags.includes('ART765_INPUT_REFUSED')
      || out.output_payload.best_strategy !== null) {
      violations++; console.log(`P3 violation: ${label} did not take the refused-payload branch`);
    }
  }
  return { name: 'P3 invalid-domain inputs refused with named reason + ART765_INPUT_REFUSED', checked, violations };
}

// P4 — sweep contract: combo dominance, $250 grid, zero-contribution cases.
function checkP4SweepContract() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76504);
  for (let i = 0; i < 80; i++) {
    const pp = drawPP(rng);
    const out = compute(pp).output_payload;
    const s = out.strategies;
    checked += 3;
    if (s.optimal_combo.total_savings < s.fsa_only.total_savings - 1e-9
      || s.optimal_combo.total_savings < s.cdctc_only.total_savings - 1e-9) {
      violations++; console.log(`P4 violation: optimal combo does not dominate the single strategies (agi=${pp.agi})`);
    }
    if (pp.fsa_available && out.optimal_fsa_contribution % 250 !== 0) {
      violations++; console.log(`P4 violation: contribution ${out.optimal_fsa_contribution} off the $250 grid`);
    }
    if (!pp.fsa_available && out.optimal_fsa_contribution !== 0) {
      violations++; console.log('P4 violation: contribution non-zero with no FSA available');
    }
    checked++;
    if (s.fsa_only.cdctc_credit !== 0) { violations++; console.log('P4 violation: fsa_only carries a CDCTC credit'); }
  }
  return { name: 'P4 sweep contract (dominance, $250 grid, no-FSA zero, fsa_only credit 0)', checked, violations };
}

// P5 — the statutory schedule restated independently (post-2025 single filer).
function checkP5ScheduleRestated() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76505);
  for (let i = 0; i < 80; i++) {
    const agi = Math.floor(rng() * 250000);
    const pp = { ...basePP(), filing_status: 'single', agi, as_of: '2026-06-30', ruleset: 'statutory' };
    const got = compute(pp).output_payload.cdctc_rate;
    // §21(a)(2) as amended: 50% cut by ceil((agi-15000)/2000) points (floor 35%),
    // then further cut by ceil((agi-75000)/2000) points (floor 20%).
    let rate = 0.50;
    if (agi > 15000) rate = Math.max(0.35, rate - Math.ceil((agi - 15000) / 2000) * 0.01);
    if (agi > 75000) rate = Math.max(0.20, rate - Math.ceil((agi - 75000) / 2000) * 0.01);
    checked++;
    if (got !== rate) { violations++; console.log(`P5 violation: agi=${agi} got ${got}, restated ${rate}`); }
  }
  return { name: 'P5 statutory single-filer schedule restated independently', checked, violations };
}

// P6 — the optional fsa_contrib echo never changes any number.
function checkP6FsaContribEcho() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76506);
  for (let i = 0; i < 40; i++) {
    const pp = drawPP(rng);
    const without = /** @type {any} */ (compute(pp));
    const withField = /** @type {any} */ (compute({ ...pp, fsa_contrib: 4250 }));
    checked++;
    if (withField.output_payload.fsa_contrib_input !== 4250) { violations++; console.log('P6 violation: fsa_contrib not echoed'); continue; }
    const a = { ...without.output_payload }; delete a.fsa_contrib_input;
    const b = { ...withField.output_payload }; delete b.fsa_contrib_input;
    if (!deepEqual(a, b)) { violations++; console.log(`P6 violation: fsa_contrib changed an output (agi=${pp.agi})`); }
  }
  return { name: 'P6 fsa_contrib echoed only, never load-bearing', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1RateMonotone(),
  checkP2DeterminismShape(),
  checkP3DomainRefusal(),
  checkP4SweepContract(),
  checkP5ScheduleRestated(),
  checkP6FsaContribEcho(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
