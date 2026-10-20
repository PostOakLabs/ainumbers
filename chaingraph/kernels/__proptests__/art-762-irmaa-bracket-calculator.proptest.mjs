// art-762-irmaa-bracket-calculator.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the APEXPORT-150 porting payload
// (kernel + fixtures + VECTORS/DIFFERS/CITES records, GRADES PASS-PENDING-XV
// 2026-10-14, Builder-verifies-at-land replay 57/57 2026-10-20).
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: NO — the kernel is integer-cents throughout (every CMS 2026
// figure is an exact number of cents; the single division, implied_marginal_bps,
// is explicit round-half-away-from-zero integer division). The properties below
// are exact integer relations.
//
// Checks: fixture-oracle gate (all 57 payload vectors — 8 Apex live, 43 boundary
// at and just past every CMS 2026 comparator including the inclusive top-band
// edge and the MFS 391,000 second threshold, 6 refusal guards); P1 the IRMAA
// band is non-decreasing in agi_usd on every filing-status branch; P2 the band
// is restated independently (every threshold except the last an exclusive edge,
// the last an inclusive one) and always lands in 0..bands; P3 determinism
// (two runs agree byte-for-byte) and output shape (no NaN/non-finite anywhere in
// output_payload); P4 invalid-domain inputs return the named refusal payload
// with the ART762_INPUT_REFUSED flag while valid inputs carry no flag; P5 the
// cliff contract: headroom is 0 exactly at an exclusive edge, distance to the
// next threshold is positive strictly below it, top band nulls the cliff rows,
// and the MFS lived-together branch prices from the dedicated MFS ladders.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-762-irmaa-bracket-calculator.proptest.mjs

import { compute } from '../art-762-irmaa-bracket-calculator.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-762-irmaa-bracket-calculator';

const THRESHOLDS = {
  Single: [10900000, 13700000, 17100000, 20500000, 50000000],
  MFJ: [21800000, 27400000, 34200000, 41000000, 75000000],
  MFS_APART: [10900000, 13700000, 17100000, 20500000, 50000000],
  MFS_TOGETHER: [10900000, 39100000],
};
const STATUSES = ['Single', 'MFJ', 'MFS'];

const basePP = (status) => ({
  filing_status: status,
  agi_usd: 60000,
  tax_exempt_interest_usd: 0,
  enrollees: 1,
  enrolled_part_d: true,
  additional_income_usd: 0,
  mfs_living_apart: true,
  life_changing_event: false,
});

// bandOf restated independently of the kernel (SPEC §17: kernel identity).
function bandOfRestated(magiCents, thresholds) {
  const n = thresholds.length;
  let tier = 0;
  for (let k = 0; k < n - 1; k++) if (magiCents > thresholds[k]) tier = k + 1;
  if (magiCents >= thresholds[n - 1]) tier = n;
  return tier;
}

function ladderFor(status, mfsLivingApart) {
  if (status === 'MFJ') return THRESHOLDS.MFJ;
  if (status === 'MFS') return mfsLivingApart ? THRESHOLDS.MFS_APART : THRESHOLDS.MFS_TOGETHER;
  return THRESHOLDS.Single;
}

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const hasBadNumber = (x) => {
  if (typeof x === 'number') return !Number.isFinite(x);
  if (x === null || typeof x !== 'object') return false;
  return Object.values(x).some(hasBadNumber);
};

// P1 — band non-decreasing in agi_usd, on every filing-status branch.
function checkP1Monotone() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76201);
  for (let i = 0; i < 60; i++) {
    const status = ['Single', 'MFJ', 'MFS'][Math.floor(rng() * 3)];
    const apart = rng() < 0.5;
    const tei = Math.floor(rng() * 5000);
    const agi = Math.floor(rng() * 900000);
    const pp = { ...basePP(status), tax_exempt_interest_usd: tei, mfs_living_apart: apart, agi_usd: agi };
    const t0 = compute(pp).output_payload.tier;
    const tUp = compute({ ...pp, agi_usd: agi + 250 }).output_payload.tier;
    checked++;
    if (tUp < t0) { violations++; console.log(`P1 violation: band ${tUp} < ${t0} when raising AGI (${status}, apart=${apart})`); }
  }
  return { name: 'P1 band non-decreasing in agi_usd (all status branches)', checked, violations };
}

// P2 — band restated independently; always within 0..bands.
function checkP2BandRestated() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76202);
  for (let i = 0; i < 120; i++) {
    const status = ['Single', 'MFJ', 'MFS'][Math.floor(rng() * 3)];
    const apart = rng() < 0.5;
    const agi = Math.floor(rng() * 1000000);
    const tei = Math.floor(rng() * 20000);
    const pp = { ...basePP(status), mfs_living_apart: apart, agi_usd: agi, tax_exempt_interest_usd: tei };
    const out = compute(pp).output_payload;
    const magiCents = Math.max(0, Math.floor(agi * 100)) + Math.floor(tei * 100);
    const thresholds = ladderFor(status, apart);
    const want = bandOfRestated(magiCents, thresholds);
    checked++;
    if (out.tier !== want || out.tier < 0 || out.tier > thresholds.length) {
      violations++; console.log(`P2 violation: band ${out.tier} != restated ${want} (${status}, apart=${apart}, magi=${magiCents})`);
    }
  }
  return { name: 'P2 band restated independently and in 0..bands', checked, violations };
}

// P3 — determinism and output shape.
function checkP3DeterminismShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76203);
  for (let i = 0; i < 40; i++) {
    const status = ['Single', 'MFJ', 'MFS'][Math.floor(rng() * 3)];
    const pp = {
      ...basePP(status),
      mfs_living_apart: rng() < 0.5,
      agi_usd: Math.floor(rng() * 1000000),
      tax_exempt_interest_usd: Math.floor(rng() * 20000),
      enrollees: 1 + Math.floor(rng() * 2),
      enrolled_part_d: rng() < 0.8,
      additional_income_usd: Math.floor(rng() * 100000),
    };
    const r1 = compute(pp);
    const r2 = compute(pp);
    checked += 2;
    if (!deepEqual(r1.output_payload, r2.output_payload)) { violations++; console.log('P3 violation: two runs disagree'); }
    if (hasBadNumber(r1.output_payload)) { violations++; console.log('P3 violation: non-finite number in output_payload'); }
  }
  return { name: 'P3 determinism and finite output shape', checked, violations };
}

// P4 — invalid-domain inputs return the named refusal payload; valid inputs carry no flag.
function checkP4DomainRefusal() {
  let checked = 0, violations = 0;
  const bads = [
    [{ filing_status: 'HeadOfHousehold', agi_usd: 95000, enrollees: 1 }, 'INVALID_FILING_STATUS'],
    [{ filing_status: 'Single', agi_usd: '95000', enrollees: 1 }, 'INVALID_AGI'],
    [{ filing_status: 'Single', agi_usd: 95000, enrollees: 0 }, 'INVALID_ENROLLEES'],
    [{ filing_status: 'Single', agi_usd: 95000, enrollees: 1, additional_income_usd: 'x' }, 'INVALID_ADDITIONAL_INCOME'],
    [{ filing_status: 'Single', agi_usd: 95000, enrollees: 1, tax_exempt_interest_usd: -1 }, 'INVALID_TAX_EXEMPT_INTEREST'],
    [{ filing_status: 'Single', agi_usd: 95000, enrollees: 1, premium_year: 2026.5 }, 'INVALID_PREMIUM_YEAR'],
    [null, 'MALFORMED_INPUT'],
  ];
  for (const [pp, want] of bads) {
    const r = compute(pp);
    checked++;
    if (r.output_payload.refusal_reason !== want) {
      violations++; console.log(`P4 violation: refusal_reason ${r.output_payload.refusal_reason} != ${want}`);
    }
    if (r.compliance_flags.indexOf('ART762_INPUT_REFUSED') === -1) {
      violations++; console.log(`P4 violation: ART762_INPUT_REFUSED flag missing for ${want}`);
    }
  }
  const good = compute(basePP('Single'));
  checked++;
  if (good.compliance_flags.length !== 0 || good.output_payload.refusal_reason !== null) {
    violations++; console.log('P4 violation: valid input carries a flag or refusal');
  }
  return { name: 'P4 named refusal payload with ART762_INPUT_REFUSED flag', checked, violations };
}

// P5 — cliff contract and the dedicated MFS ladders.
function checkP5CliffContract() {
  let checked = 0, violations = 0;
  // At an exclusive edge exactly: still the lower band, headroom 0.
  const at = compute({ ...basePP('Single'), agi_usd: 109000 });
  checked += 3;
  if (at.output_payload.tier !== 0) { violations++; console.log(`P5 violation: tier ${at.output_payload.tier} at exactly 109000, want 0`); }
  if (at.output_payload.headroom_before_next_usd_cents !== 0) { violations++; console.log('P5 violation: headroom at the edge is not 0'); }
  if (at.output_payload.next_threshold_usd_cents !== 10900000) { violations++; console.log('P5 violation: next threshold wrong'); }
  // One cent below: headroom 1 cent, still band 0.
  const below = compute({ ...basePP('Single'), agi_usd: 109000, tax_exempt_interest_usd: -0 });
  const underBy = compute({ ...basePP('Single'), agi_usd: 108999.99 });
  checked += 2;
  if (underBy.output_payload.tier !== 0) { violations++; console.log('P5 violation: one cent below the edge is not band 0'); }
  if (underBy.output_payload.headroom_before_next_usd_cents !== 1) { violations++; console.log('P5 violation: headroom one cent below the edge is not 1 cent'); }
  // Top band nulls the cliff rows.
  const top = compute({ ...basePP('Single'), agi_usd: 500000 });
  checked += 3;
  if (top.output_payload.at_top_tier !== true || top.output_payload.tier !== 5) { violations++; console.log(`P5 violation: 500000 is band ${top.output_payload.tier}, want 5 (inclusive top edge)`); }
  if (top.output_payload.next_threshold_usd_cents !== null || top.output_payload.headroom_before_next_usd_cents !== null) {
    violations++; console.log('P5 violation: top band does not null the cliff rows');
  }
  // MFS lived-together prices from the dedicated ladders.
  const mfs = compute({ ...basePP('MFS'), mfs_living_apart: false, agi_usd: 100000 });
  checked += 3;
  if (mfs.output_payload.threshold_basis !== 'mfs_lived_together') { violations++; console.log('P5 violation: MFS together basis wrong'); }
  if (mfs.output_payload.part_b_total_monthly_usd_cents !== 20290) { violations++; console.log(`P5 violation: MFS band-0 Part B ${mfs.output_payload.part_b_total_monthly_usd_cents}, want 20290`); }
  if (mfs.output_payload.part_d_irmaa_monthly_usd_cents !== 0) { violations++; console.log('P5 violation: MFS band-0 Part D IRMAA not 0'); }
  const mfs2 = compute({ ...basePP('MFS'), mfs_living_apart: false, agi_usd: 400000 });
  checked += 2;
  if (mfs2.output_payload.tier !== 2) { violations++; console.log(`P5 violation: MFS 400000 is band ${mfs2.output_payload.tier}, want 2 (>= 391000)`); }
  if (mfs2.output_payload.part_b_total_monthly_usd_cents !== 68990) { violations++; console.log('P5 violation: MFS top-band Part B not 68990'); }
  return { name: 'P5 cliff contract (exclusive/inclusive edges, top-band nulls, MFS ladders)', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1Monotone(),
  checkP2BandRestated(),
  checkP3DeterminismShape(),
  checkP4DomainRefusal(),
  checkP5CliffContract(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
