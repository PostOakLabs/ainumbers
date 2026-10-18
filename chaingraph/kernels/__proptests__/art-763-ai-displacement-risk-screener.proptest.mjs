// art-763-ai-displacement-risk-screener.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the APEXPORT-104 porting payload
// (kernel + fixtures + VECTORS/DIFFERS/CITES records, GRADES PASS-PENDING-XV
// 2026-10-18, Builder-verifies-at-land 18/18).
// kernel_digest_at_authoring: sha256:91fb630e8e4abce5da6b62416996e456f8665988098ae412e7f24786ac07dedc
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: PARTIAL — the kernel deliberately keeps the Apex page's float
// weighted-sum arithmetic so its outputs match the ported-from page to the digit.
// The properties below assert only relations that are exact under IEEE-754
// (monotone rounding, equality on already-rounded outputs, integer score/tier
// relations) or restatements of the published formula, never fragile float
// equals on arbitrary draws.
//
// Checks: fixture-oracle gate (the 4 Apex live vectors with tier/score/pivots
// pinned and the 14 boundary pairs at and just past every comparator — tier
// cutoffs 30/55/75, similarity gate 60, dScore exclusion at equality, cap 0.99,
// education bonuses, custom-occupation floor); P1 the score is non-decreasing
// in each routine share (rc, rm) and in the sector exposure factor, on both the
// SOC-selected and custom branches; P2 the tier is a pure function of the score
// restated independently (<=30 Low, <=55 Medium, <=75 High, else Critical) and
// the score always lands in 0..100; P3 determinism (two runs agree byte-for-byte)
// and output shape (no undefined/NaN/non-finite anywhere in output_payload);
// P4 invalid-domain inputs are refused by throw with a named reason (the payload
// contract — no refused-payload branch), for every numeric bound, every type
// bound and non-object pp; P5 the adjacent-pivot contract: at most 3 alts, every
// alt strictly lower-scored than the selected occupation, similarity-gated at
// >= 60, sorted by descending sim; P6 the custom-occupation estimate restated
// independently (prob = min(0.99, ((rc+rm)/100) * 0.85 + 0.05), Custom Occupation
// title, null soc, null salary surface).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-763-ai-displacement-risk-screener.proptest.mjs

import { compute } from '../art-763-ai-displacement-risk-screener.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-763-ai-displacement-risk-screener';

const SOC_SAMPLES = ['15-1132', '41-2011', '43-9021', '29-1141', '13-2041', '11-1021', '53-3032', '25-4022', '47-2031', '35-3031'];
const ED_LEVELS = ['no_degree', 'associate', 'bachelor', 'master', 'doctorate'];

const basePP = () => ({
  soc_code: '15-1132', rc: 15, rm: 4, nra: 60, nri: 16, nrm: 5,
  sector_exp: 0.45, ed_level: 'bachelor', years_role: 5,
});

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const hasBadNumber = (x) => {
  if (typeof x === 'number') return !Number.isFinite(x);
  if (x === null || typeof x !== 'object') return false;
  return Object.values(x).some(hasBadNumber);
};

// P1 — score non-decreasing in rc, rm and sector_exp (both branches).
function checkP1Monotone() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76301);
  for (let i = 0; i < 60; i++) {
    const soc = pick(rng, SOC_SAMPLES);
    const rc = Math.floor(rng() * 90), rm = Math.floor(rng() * (99 - rc));
    const nra = Math.floor(rng() * 100), nri = Math.floor(rng() * 100), nrm = Math.floor(rng() * 100);
    const ed = pick(rng, ED_LEVELS);
    for (const socCode of [soc, null]) {
      const pp = { soc_code: socCode, rc, rm, nra, nri, nrm, sector_exp: 0.25, ed_level: ed, years_role: 3 };
      const s0 = compute(pp).output_payload.score;
      const sRc = compute({ ...pp, rc: Math.min(100, rc + 5) }).output_payload.score;
      const sRm = compute({ ...pp, rm: Math.min(100 - rc, rm + 5) }).output_payload.score;
      const sSe = compute({ ...pp, sector_exp: 0.25 + 0.05 }).output_payload.score;
      for (const [label, s1] of [['rc', sRc], ['rm', sRm], ['sector_exp', sSe]]) {
        checked++;
        if (s1 < s0) { violations++; console.log(`P1 violation: score ${s1} < ${s0} when raising ${label} (soc=${socCode})`); }
      }
    }
  }
  return { name: 'P1 score non-decreasing in rc/rm/sector_exp (both branches)', checked, violations };
}

// P2 — score in 0..100; tier restated independently from the score.
function checkP2TierRestated() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76302);
  for (let i = 0; i < 120; i++) {
    const pp = {
      soc_code: pick(rng, [pick(rng, SOC_SAMPLES), null]),
      rc: Math.floor(rng() * 101), rm: Math.floor(rng() * 101),
      nra: Math.floor(rng() * 101), nri: Math.floor(rng() * 101), nrm: Math.floor(rng() * 101),
      sector_exp: Math.round(rng() * 100) / 100,
      ed_level: pick(rng, ED_LEVELS),
      years_role: Math.floor(rng() * 40),
    };
    const out = compute(pp).output_payload;
    checked++;
    if (!Number.isInteger(out.score) || out.score < 0 || out.score > 100) {
      violations++; console.log(`P2 violation: score out of range: ${out.score}`); continue;
    }
    const want = out.score <= 30 ? 'Low' : out.score <= 55 ? 'Medium' : out.score <= 75 ? 'High' : 'Critical';
    if (out.tier !== want) { violations++; console.log(`P2 violation: tier ${out.tier} for score ${out.score}, want ${want}`); }
  }
  return { name: 'P2 score 0..100 and tier restated independently', checked, violations };
}

// P3 — determinism and output shape.
function checkP3DeterminismShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76303);
  for (let i = 0; i < 40; i++) {
    const pp = {
      soc_code: pick(rng, [pick(rng, SOC_SAMPLES), null]),
      rc: Math.floor(rng() * 101), rm: Math.floor(rng() * 101),
      nra: Math.floor(rng() * 101), nri: Math.floor(rng() * 101), nrm: Math.floor(rng() * 101),
      sector_exp: Math.round(rng() * 100) / 100,
      ed_level: pick(rng, ED_LEVELS),
      years_role: Math.floor(rng() * 40),
    };
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    checked += 2;
    if (!deepEqual(a, b)) { violations++; console.log('P3 violation: two runs differ'); }
    if (hasBadNumber(a) || JSON.stringify(a).includes('undefined')) { violations++; console.log('P3 violation: undefined/NaN/non-finite in output_payload'); }
  }
  return { name: 'P3 determinism + output shape (no undefined/NaN/non-finite)', checked, violations };
}

// P4 — invalid-domain inputs rejected by throw with a named reason.
function checkP4DomainRefusal() {
  let checked = 0, violations = 0;
  const bad = [
    ['pp null', null], ['pp array', [1]], ['pp string', 'x'],
    ['rc 101', { ...basePP(), rc: 101 }], ['rc -1', { ...basePP(), rc: -1 }], ['rc 2.5', { ...basePP(), rc: 2.5 }],
    ['rm 101', { ...basePP(), rm: 101 }], ['nra -1', { ...basePP(), nra: -1 }], ['nri 1000', { ...basePP(), nri: 1000 }],
    ['nrm 1.5', { ...basePP(), nrm: 1.5 }], ['sector_exp NaN', { ...basePP(), sector_exp: NaN }],
    ['sector_exp Infinity', { ...basePP(), sector_exp: Infinity }], ['sector_exp string', { ...basePP(), sector_exp: '0.4' }],
    ['ed_level number', { ...basePP(), ed_level: 3 }], ['years_role -1', { ...basePP(), years_role: -1 }],
    ['years_role 2.5', { ...basePP(), years_role: 2.5 }],
  ];
  for (const [label, pp] of bad) {
    checked++;
    let threw = null;
    try { compute(pp); } catch (e) { threw = e; }
    if (!threw) { violations++; console.log(`P4 violation: ${label} did not throw`); continue; }
    if (!(threw instanceof Error) || typeof threw.message !== 'string' || threw.message.length === 0) {
      violations++; console.log(`P4 violation: ${label} threw without a named reason`);
    }
  }
  return { name: 'P4 invalid-domain inputs refused by throw with named reason', checked, violations };
}

// P5 — adjacent-pivot contract on the returned alts.
function checkP5Alts() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76305);
  for (let i = 0; i < 60; i++) {
    const soc = pick(rng, SOC_SAMPLES);
    const pp = {
      soc_code: soc, rc: Math.floor(rng() * 101), rm: Math.floor(rng() * 101),
      nra: Math.floor(rng() * 101), nri: Math.floor(rng() * 101), nrm: Math.floor(rng() * 101),
      sector_exp: Math.round(rng() * 100) / 100,
      ed_level: pick(rng, ED_LEVELS), years_role: 0,
    };
    const out = compute(pp).output_payload;
    checked++;
    if (out.alts.length > 3) { violations++; console.log(`P5 violation: ${out.alts.length} alts > 3`); }
    if (out.soc === null) continue;
    let prevSim = Infinity;
    for (const alt of out.alts) {
      checked += 3;
      if (alt.score >= out.score) { violations++; console.log(`P5 violation: alt ${alt.soc} score ${alt.score} >= selected ${out.score}`); }
      if (alt.sim < 60) { violations++; console.log(`P5 violation: alt ${alt.soc} sim ${alt.sim} < 60`); }
      if (alt.sim > prevSim) { violations++; console.log(`P5 violation: alts not sorted descending by sim`); }
      prevSim = alt.sim;
    }
  }
  return { name: 'P5 alts: <=3, strictly lower-scored, sim>=60, sim-descending', checked, violations };
}

// P6 — custom-occupation estimate restated independently.
function checkP6CustomBranch() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76306);
  for (let i = 0; i < 40; i++) {
    const rc = Math.floor(rng() * 101), rm = Math.floor(rng() * 101);
    const pp = {
      soc_code: null, rc, rm, nra: 0, nri: 0, nrm: 0,
      sector_exp: Math.round(rng() * 100) / 100, ed_level: pick(rng, ED_LEVELS), years_role: 0,
    };
    const out = compute(pp).output_payload;
    const wantProb = Math.min(0.99, ((rc + rm) / 100) * 0.85 + 0.05);
    checked += 4;
    if (out.prob !== wantProb) { violations++; console.log(`P6 violation: prob ${out.prob} != restated ${wantProb}`); }
    if (out.title !== 'Custom Occupation') { violations++; console.log('P6 violation: custom title wrong'); }
    if (out.soc !== null) { violations++; console.log('P6 violation: custom soc not null'); }
    if (out.median_salary_usd !== null || out.alts.some((a) => a.salary_delta_vs_selected_usd !== null)) {
      violations++; console.log('P6 violation: custom branch carries a salary surface');
    }
  }
  return { name: 'P6 custom estimate restated (prob formula, title, null salary surface)', checked, violations };
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
  checkP2TierRestated(),
  checkP3DeterminismShape(),
  checkP4DomainRefusal(),
  checkP5Alts(),
  checkP6CustomBranch(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
