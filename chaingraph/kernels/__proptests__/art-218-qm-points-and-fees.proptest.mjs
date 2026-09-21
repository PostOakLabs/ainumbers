// kernel_digest_at_authoring: sha256:451c7b3b5ae225db716a4b46040eb80af02bf7aa2a2ac25a35f3da1e295700ce
//
// FV-PROPFLOOR-SHARD-B6-1 — property-test floor for art-218-qm-points-and-fees.
// Class B (bounded-numeric), FLOAT-SENSITIVE (pass/fail is a continuous points-and-fees
// vs computed-limit comparison with a 0.005 rounding-tolerance margin) — ULP-boundary
// forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays), same shape as B1-B5's float harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// ART218-MUTATION-FLOOR-1 (2026-09-21) — strengthened to the mutation-tier floor:
// the money-math tier measured 33.2% (61/184) at the fold's full preflight. Every
// addition below pins outcomes to literals derived ONLY from the kernel's OWN
// published QM_TIERS_BY_YEAR table values (2021-2026 tier thresholds, percentages,
// fixed limits, labels, fr_citation/effective strings) and the kernel's documented
// arithmetic semantics (r2 cent rounding, the `points_and_fees <= limit + 0.005`
// 0.5-cent tolerance, contiguous cent-bounded tier ranges, year fallback to 2026):
//   P5  year-table row selection — exact tier_label/limit/limit_pct/limit_fixed/
//       fr_citation/effective_date/pass/flags probed at every tier's threshold_min
//       and threshold_max, for ALL SIX pinned years (the 2021-2025 tables were
//       previously unexercised);
//   P6  year resolution — out-of-table years, year 0, negative years, fractional
//       years (Math.round), string years and the missing-year default each resolve
//       to the documented table (fr_citation pins the resolution);
//   P7  cent-gap loans — a loan one half-cent above a tier's threshold_max sits in
//       no published tier band, so the kernel's documented no_tier_matched error
//       payload + QM_TIER_LOOKUP_FAILED flag is pinned exactly (negative loans too);
//   P8  points-and-fees arithmetic edges — pass is true at limit + 0.005 and false
//       at limit + 0.006, for both pct and fixed tiers, with headroom and
//       compliance_flags pinned.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-218-qm-points-and-fees.proptest.mjs

import { compute } from '../art-218-qm-points-and-fees.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-218-qm-points-and-fees.fixtures.json');
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
const rand = mulberry32(0x2180A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 12000;
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);

function mkPP(rng, overrides = {}) {
  const loan_amount = randRange(rng, 1000, 2000000);
  return {
    loan_amount,
    points_and_fees: randRange(rng, 0, loan_amount * 0.1),
    year: 2026,
    ...overrides,
  };
}

// ---------- P1: monotone — pass is nonincreasing as points_and_fees increases (fixed loan_amount/year) ----------
function checkP1_monotonePass() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkPP(rand);
    const lo = { ...base, points_and_fees: Math.min(base.points_and_fees, 5000) };
    const hi = { ...base, points_and_fees: Math.max(lo.points_and_fees + 1, 5001) };
    const rLo = compute(lo);
    const rHi = compute(hi);
    checked++;
    if (rHi.output_payload.pass && !rLo.output_payload.pass) violations++;
  }
  return { name: 'P1_monotone_pass_nonincreasing_with_points_and_fees', trials: checked, violations };
}

// ---------- P2: fixed-threshold-tier agreement — pass matches points_and_fees <= limit + 0.005 exactly ----------
function checkP2_passAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { pass, points_and_fees, limit } = r.output_payload;
    const expected = points_and_fees <= limit + 0.005;
    if (pass !== expected) violations++;
  }
  return { name: 'P2_pass_matches_limit_plus_0005_tolerance_rule', trials: checked, violations };
}

// ---------- P3: round-trip identity — headroom equals r2(limit - points_and_fees) exactly ----------
function checkP3_headroomIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { limit, points_and_fees, headroom } = r.output_payload;
    const expected = r2(limit - points_and_fees);
    if (headroom !== expected) violations++;
  }
  return { name: 'P3_headroom_matches_r2_identity', trials: checked, violations };
}

// ---------- Published-table expectations (ART218-MUTATION-FLOOR-1) ----------
// Literal transcription of the kernel's OWN published QM_TIERS_BY_YEAR values (year,
// fr_citation, effective, per-tier threshold_min/threshold_max, limit_pct, limit_fixed,
// label). These constants are the independent oracle P5-P8 assert against — a mutated
// table number, label, citation or row-selection predicate cannot satisfy them.
const EXPECTED_QM_TABLES = {
  2021: {
    fr_citation: 'FR 2020-15900, 85 FR 50944',
    effective: '2021-01-01',
    tiers: [
      { threshold_min: 110260, limit_type: 'pct', limit_pct: 3.0, label: '>= $110,260: 3%' },
      { threshold_min: 66156, threshold_max: 110259.99, limit_type: 'fixed', limit_fixed: 3308, label: '$66,156 - $110,259.99: $3,308' },
      { threshold_min: 22052, threshold_max: 66155.99, limit_type: 'pct', limit_pct: 5.0, label: '$22,052 - $66,155.99: 5%' },
      { threshold_min: 13783, threshold_max: 22051.99, limit_type: 'fixed', limit_fixed: 1103, label: '$13,783 - $22,051.99: $1,103' },
      { threshold_max: 13782.99, limit_type: 'pct', limit_pct: 8.0, label: '< $13,783: 8%' },
    ],
  },
  2022: {
    fr_citation: 'FR 2021-23478, 86 FR 60357',
    effective: '2022-01-01',
    tiers: [
      { threshold_min: 114847, limit_type: 'pct', limit_pct: 3.0, label: '>= $114,847: 3%' },
      { threshold_min: 68908, threshold_max: 114846.99, limit_type: 'fixed', limit_fixed: 3445, label: '$68,908 - $114,846.99: $3,445' },
      { threshold_min: 22969, threshold_max: 68907.99, limit_type: 'pct', limit_pct: 5.0, label: '$22,969 - $68,907.99: 5%' },
      { threshold_min: 14356, threshold_max: 22968.99, limit_type: 'fixed', limit_fixed: 1148, label: '$14,356 - $22,968.99: $1,148' },
      { threshold_max: 14355.99, limit_type: 'pct', limit_pct: 8.0, label: '< $14,356: 8%' },
    ],
  },
  2023: {
    fr_citation: 'FR 2022-28023, 87 FR 78831',
    effective: '2023-01-01',
    tiers: [
      { threshold_min: 124331, limit_type: 'pct', limit_pct: 3.0, label: '>= $124,331: 3%' },
      { threshold_min: 74599, threshold_max: 124330.99, limit_type: 'fixed', limit_fixed: 3730, label: '$74,599 - $124,330.99: $3,730' },
      { threshold_min: 24866, threshold_max: 74598.99, limit_type: 'pct', limit_pct: 5.0, label: '$24,866 - $74,598.99: 5%' },
      { threshold_min: 15541, threshold_max: 24865.99, limit_type: 'fixed', limit_fixed: 1243, label: '$15,541 - $24,865.99: $1,243' },
      { threshold_max: 15540.99, limit_type: 'pct', limit_pct: 8.0, label: '< $15,541: 8%' },
    ],
  },
  2024: {
    fr_citation: 'FR 2023-20476, 88 FR 65113',
    effective: '2024-01-01',
    tiers: [
      { threshold_min: 130461, limit_type: 'pct', limit_pct: 3.0, label: '>= $130,461: 3%' },
      { threshold_min: 78277, threshold_max: 130460.99, limit_type: 'fixed', limit_fixed: 3914, label: '$78,277 - $130,460.99: $3,914' },
      { threshold_min: 26092, threshold_max: 78276.99, limit_type: 'pct', limit_pct: 5.0, label: '$26,092 - $78,276.99: 5%' },
      { threshold_min: 16308, threshold_max: 26091.99, limit_type: 'fixed', limit_fixed: 1305, label: '$16,308 - $26,091.99: $1,305' },
      { threshold_max: 16307.99, limit_type: 'pct', limit_pct: 8.0, label: '< $16,308: 8%' },
    ],
  },
  2025: {
    fr_citation: 'FR 2024-27553, 89 FR 95080',
    effective: '2025-01-01',
    tiers: [
      { threshold_min: 134841, limit_type: 'pct', limit_pct: 3.0, label: '>= $134,841: 3%' },
      { threshold_min: 80905, threshold_max: 134840.99, limit_type: 'fixed', limit_fixed: 4045, label: '$80,905 - $134,840.99: $4,045' },
      { threshold_min: 26968, threshold_max: 80904.99, limit_type: 'pct', limit_pct: 5.0, label: '$26,968 - $80,904.99: 5%' },
      { threshold_min: 16855, threshold_max: 26967.99, limit_type: 'fixed', limit_fixed: 1348, label: '$16,855 - $26,967.99: $1,348' },
      { threshold_max: 16854.99, limit_type: 'pct', limit_pct: 8.0, label: '< $16,855: 8%' },
    ],
  },
  2026: {
    fr_citation: 'FR 2025-22773, 90 FR 57890',
    effective: '2026-01-01',
    tiers: [
      { threshold_min: 137958, limit_type: 'pct', limit_pct: 3.0, label: '>= $137,958: 3%' },
      { threshold_min: 82775, threshold_max: 137957.99, limit_type: 'fixed', limit_fixed: 4139, label: '$82,775 - $137,957.99: $4,139' },
      { threshold_min: 27592, threshold_max: 82774.99, limit_type: 'pct', limit_pct: 5.0, label: '$27,592 - $82,774.99: 5%' },
      { threshold_min: 17245, threshold_max: 27591.99, limit_type: 'fixed', limit_fixed: 1380, label: '$17,245 - $27,591.99: $1,380' },
      { threshold_max: 17244.99, limit_type: 'pct', limit_pct: 8.0, label: '< $17,245: 8%' },
    ],
  },
};

// The published tiers tile [0, Infinity) in cent-bounded bands: each non-top tier
// carries threshold_max = (next tier's threshold_min) - 0.01. A loan threshold_max
// + 0.005 (a half-cent above the band's ceiling) is in NO published band.
function expectedLimitFor(tier, loan) {
  return tier.limit_type === 'pct' ? r2(loan * tier.limit_pct / 100) : tier.limit_fixed;
}

function flagsEqual(flags, expected) {
  return JSON.stringify(flags) === JSON.stringify(expected);
}

// ---------- P5: year-table row selection — every pinned year resolves every tier band exactly ----------
function checkP5_yearTableSelectionExact() {
  let violations = 0, checked = 0;
  const mismatches = [];
  for (const yearStr of Object.keys(EXPECTED_QM_TABLES)) {
    const year = Number(yearStr);
    const table = EXPECTED_QM_TABLES[yearStr];
    for (const tier of table.tiers) {
      const probes = [];
      if (typeof tier.threshold_min === 'number') probes.push(tier.threshold_min);
      if (typeof tier.threshold_max === 'number') probes.push(tier.threshold_max);
      for (const loan of probes) {
        const limit = expectedLimitFor(tier, loan);
        for (const [pf, expectPass, expectFlags] of [
          [limit + 0.005, true, []],
          [limit + 0.01, false, ['QM_POINTS_AND_FEES_EXCEEDED']],
        ]) {
          const r = compute({ loan_amount: loan, points_and_fees: pf, year });
          const op = r.output_payload;
          checked++;
          const bad = (acc) => { violations++; mismatches.push({ year, loan, pf, ...acc }); };
          if (op.pass !== expectPass) bad({ field: 'pass', got: op.pass, want: expectPass });
          if (op.tier_label !== tier.label) bad({ field: 'tier_label', got: op.tier_label, want: tier.label });
          if (op.limit_type !== tier.limit_type) bad({ field: 'limit_type', got: op.limit_type, want: tier.limit_type });
          if (op.limit !== limit) bad({ field: 'limit', got: op.limit, want: limit });
          if (op.limit_pct !== (tier.limit_type === 'pct' ? tier.limit_pct : null)) bad({ field: 'limit_pct', got: op.limit_pct });
          if (op.limit_fixed !== (tier.limit_type === 'fixed' ? tier.limit_fixed : null)) bad({ field: 'limit_fixed', got: op.limit_fixed });
          if (op.loan_amount !== r2(loan)) bad({ field: 'loan_amount', got: op.loan_amount, want: r2(loan) });
          if (op.points_and_fees !== r2(pf)) bad({ field: 'points_and_fees', got: op.points_and_fees, want: r2(pf) });
          if (op.year !== year) bad({ field: 'year', got: op.year, want: year });
          if (op.headroom !== r2(limit - pf)) bad({ field: 'headroom', got: op.headroom, want: r2(limit - pf) });
          if (op.fr_citation !== table.fr_citation) bad({ field: 'fr_citation', got: op.fr_citation, want: table.fr_citation });
          if (op.effective_date !== table.effective) bad({ field: 'effective_date', got: op.effective_date, want: table.effective });
          if (!flagsEqual(r.compliance_flags, expectFlags)) bad({ field: 'compliance_flags', got: r.compliance_flags, want: expectFlags });
        }
      }
    }
  }
  if (mismatches.length > 0) console.error('P5 sample mismatches:', JSON.stringify(mismatches.slice(0, 5), null, 2));
  return { name: 'P5_year_table_row_selection_exact_all_six_years', trials: checked, violations };
}

// ---------- P6: year resolution — out-of-table, zero, negative, fractional, string and missing years ----------
function checkP6_yearResolutionAndFallback() {
  let violations = 0, checked = 0;
  // Each entry: policy year -> the year whose published table must resolve.
  // Out-of-table and non-finite-band years fall back to 2026; fractional years are
  // Math.round-ed first (2024.5 rounds to 2025); numeric strings coerce via Number().
  const CASES = [
    { pp: { year: 2027 }, resolved: 2026, label: 'year exactly 1 past the pinned range falls back to 2026' },
    { pp: { year: 2020 }, resolved: 2026, label: 'year exactly 1 before the pinned range falls back to 2026' },
    { pp: { year: 0 }, resolved: 2026, label: 'year exactly zero falls back to 2026' },
    { pp: { year: -3 }, resolved: 2026, label: 'negative year falls back to 2026' },
    { pp: { year: 2026.4 }, resolved: 2026, label: 'fractional year 2026.4 rounds to 2026' },
    { pp: { year: 2024.5 }, resolved: 2025, label: 'fractional year 2024.5 rounds to 2025' },
    { pp: { year: '2023' }, resolved: 2023, label: 'numeric string year coerces to the 2023 table' },
    { pp: {}, resolved: 2026, label: 'missing year defaults to 2026' },
  ];
  for (const { pp, resolved, label } of CASES) {
    const table = EXPECTED_QM_TABLES[String(resolved)];
    // Probe loan inside the resolved table's 5% band so the resolved tier itself pins the table.
    const tier = table.tiers[2];
    const loan = tier.threshold_min;
    const pf = expectedLimitFor(tier, loan);
    const r = compute({ loan_amount: loan, points_and_fees: pf, ...pp });
    const op = r.output_payload;
    checked++;
    if (op.fr_citation !== table.fr_citation) { violations++; console.error('P6 fr_citation:', label, op.fr_citation, 'want', table.fr_citation); }
    if (op.effective_date !== table.effective) { violations++; console.error('P6 effective_date:', label, op.effective_date, 'want', table.effective); }
    if (op.tier_label !== tier.label) { violations++; console.error('P6 tier_label:', label, op.tier_label, 'want', tier.label); }
    if (op.limit !== pf) { violations++; console.error('P6 limit:', label, op.limit, 'want', pf); }
    if (op.pass !== true) { violations++; console.error('P6 pass:', label, op.pass, 'want true'); }
  }
  return { name: 'P6_year_resolution_fallback_and_coercion_exact', trials: checked, violations };
}

// ---------- P7: cent-gap loans — between-band loans match no published tier, ever ----------
function checkP7_tierGapNoTierMatched() {
  let violations = 0, checked = 0;
  const mismatches = [];
  for (const yearStr of Object.keys(EXPECTED_QM_TABLES)) {
    const year = Number(yearStr);
    const table = EXPECTED_QM_TABLES[yearStr];
    for (const tier of table.tiers) {
      if (typeof tier.threshold_max !== 'number') continue; // the top band has no ceiling
      const gapLoan = tier.threshold_max + 0.005; // half a cent above the band ceiling
      const r = compute({ loan_amount: gapLoan, points_and_fees: 100, year });
      const op = r.output_payload;
      checked++;
      const bad = (acc) => { violations++; mismatches.push({ year, gapLoan, ...acc }); };
      if (op.pass !== false) bad({ field: 'pass', got: op.pass, want: false });
      if (op.error !== 'no_tier_matched') bad({ field: 'error', got: op.error, want: 'no_tier_matched' });
      if (op.loan_amount !== r2(gapLoan)) bad({ field: 'loan_amount', got: op.loan_amount, want: r2(gapLoan) });
      if (op.points_and_fees !== 100) bad({ field: 'points_and_fees', got: op.points_and_fees, want: 100 });
      if (op.year !== year) bad({ field: 'year', got: op.year, want: year });
      if ('limit' in op || 'tier_label' in op || 'headroom' in op) bad({ field: 'unexpected tier fields', got: Object.keys(op) });
      if (!flagsEqual(r.compliance_flags, ['QM_TIER_LOOKUP_FAILED'])) bad({ field: 'compliance_flags', got: r.compliance_flags, want: ['QM_TIER_LOOKUP_FAILED'] });
    }
  }
  // Negative loans are in no published band either (the lowest band starts at 0).
  for (const loan of [-1, -0.01, -137958]) {
    const r = compute({ loan_amount: loan, points_and_fees: 0, year: 2026 });
    const op = r.output_payload;
    checked++;
    if (op.pass !== false || op.error !== 'no_tier_matched') { violations++; mismatches.push({ loan, got: op }); }
    if (!flagsEqual(r.compliance_flags, ['QM_TIER_LOOKUP_FAILED'])) { violations++; mismatches.push({ loan, got: r.compliance_flags }); }
  }
  if (mismatches.length > 0) console.error('P7 sample mismatches:', JSON.stringify(mismatches.slice(0, 5), null, 2));
  return { name: 'P7_cent_gap_and_negative_loans_exact_no_tier_matched', trials: checked, violations };
}

// ---------- P8: tolerance arithmetic edges — pass flips exactly between limit+0.005 and limit+0.006 ----------
function checkP8_passToleranceEdges() {
  let violations = 0, checked = 0;
  // 3% pct tier and the $4,139 fixed tier, year 2026.
  const EDGES = [
    { loan: 500000, limit: 15000, tierLabel: '>= $137,958: 3%' },
    { loan: 137957.99, limit: 4139, tierLabel: '$82,775 - $137,957.99: $4,139' },
  ];
  for (const { loan, limit, tierLabel } of EDGES) {
    const EDGES_AT = [
      { pf: limit + 0.005, wantPass: true, wantHeadroom: r2(limit - (limit + 0.005)) },
      { pf: limit + 0.006, wantPass: false, wantHeadroom: r2(limit - (limit + 0.006)) },
      { pf: limit + 0.004, wantPass: true, wantHeadroom: r2(limit - (limit + 0.004)) },
      { pf: limit, wantPass: true, wantHeadroom: 0 },
    ];
    for (const { pf, wantPass, wantHeadroom } of EDGES_AT) {
      const r = compute({ loan_amount: loan, points_and_fees: pf, year: 2026 });
      const op = r.output_payload;
      checked++;
      if (op.pass !== wantPass) { violations++; console.error('P8 pass:', loan, pf, op.pass, 'want', wantPass); }
      if (op.tier_label !== tierLabel) { violations++; console.error('P8 tier_label:', loan, op.tier_label, 'want', tierLabel); }
      if (op.limit !== limit) { violations++; console.error('P8 limit:', loan, op.limit, 'want', limit); }
      if (op.headroom !== wantHeadroom) { violations++; console.error('P8 headroom:', loan, pf, op.headroom, 'want', wantHeadroom); }
      const wantFlags = wantPass ? [] : ['QM_POINTS_AND_FEES_EXCEEDED'];
      if (!flagsEqual(r.compliance_flags, wantFlags)) { violations++; console.error('P8 flags:', loan, pf, JSON.stringify(r.compliance_flags), 'want', JSON.stringify(wantFlags)); }
    }
  }
  return { name: 'P8_pass_tolerance_edges_pct_and_fixed_tiers_exact', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing, each row pinned to the kernel's published values ----------
const ULP_BOUNDARY_CASES = [
  { pp: { loan_amount: 137958, points_and_fees: 137958 * 0.03 }, want: { pass: true, tier_label: '>= $137,958: 3%', limit: r2(137958 * 0.03) }, label: 'loan_amount exactly at the 3% tier boundary — resolves to the published >= $137,958: 3% band' },
  { pp: { loan_amount: 137957.99, points_and_fees: 4139 }, want: { pass: true, tier_label: '$82,775 - $137,957.99: $4,139', limit: 4139 }, label: 'loan_amount 1 cent below the 3% tier boundary — resolves to the published $4,139 fixed band' },
  { pp: { loan_amount: 500000, points_and_fees: 500000 * 0.03 + 0.005 }, want: { pass: true, tier_label: '>= $137,958: 3%', limit: 15000 }, label: 'points_and_fees exactly at limit + 0.005 rounding tolerance — pass stays true' },
  { pp: { loan_amount: 500000, points_and_fees: 500000 * 0.03 + 0.006 }, want: { pass: false, tier_label: '>= $137,958: 3%', limit: 15000 }, label: 'points_and_fees 0.001 beyond the tolerance edge — pass is false' },
  { pp: { loan_amount: 500000, points_and_fees: 500000 * 0.01 * 3 }, want: { pass: true, tier_label: '>= $137,958: 3%', limit: 15000 }, label: 'points_and_fees = loan*0.01*3 (rounding-artifact double) — equals the published limit exactly' },
  { pp: { loan_amount: 0, points_and_fees: 0 }, want: { pass: true, tier_label: '< $17,245: 8%', limit: 0 }, label: 'loan_amount exactly zero — resolves to the lowest band, limit is 0' },
  { pp: { loan_amount: 27592, points_and_fees: 27592 * 0.05 }, want: { pass: true, tier_label: '$27,592 - $82,774.99: 5%', limit: r2(27592 * 0.05) }, label: 'loan_amount exactly at the published 5%-tier lower boundary — resolves to the 5% band' },
  { pp: { loan_amount: 27591.99, points_and_fees: 1380 }, want: { pass: true, tier_label: '$17,245 - $27,591.99: $1,380', limit: 1380 }, label: 'loan_amount 1 cent below the 5%-tier — resolves to the published $1,380 fixed band' },
  { pp: { loan_amount: 17245, points_and_fees: 17245 * 0.05 }, want: { pass: true, tier_label: '$17,245 - $27,591.99: $1,380', limit: 1380 }, label: 'loan_amount exactly at the published fixed/pct seam ($17,245) — resolves to the $1,380 band' },
  { pp: { loan_amount: 17244.99, points_and_fees: 17244.99 * 0.08 }, want: { pass: true, tier_label: '< $17,245: 8%', limit: r2(17244.99 * 0.08) }, label: 'loan_amount 1 cent below the $1,380 band — resolves to the published 8% band' },
];

function checkP4_forced() {
  const rows = [];
  for (const { pp, want, label } of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const finite = typeof op.pass === 'boolean' && Number.isFinite(op.limit) && Number.isFinite(op.headroom);
    const pinned = op.pass === want.pass && op.tier_label === want.tier_label && op.limit === want.limit;
    rows.push({ label, pp, pass: op.pass, tier_label: op.tier_label, limit: op.limit, finite, pinned, plausible: finite && pinned });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotonePass());
results.properties.push(checkP2_passAgreement());
results.properties.push(checkP3_headroomIdentity());
results.properties.push(checkP5_yearTableSelectionExact());
results.properties.push(checkP6_yearResolutionAndFallback());
results.properties.push(checkP7_tierGapNoTierMatched());
results.properties.push(checkP8_passToleranceEdges());
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
