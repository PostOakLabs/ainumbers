// art-637-globe-de-minimis-exclusion — class-K property-test FLOOR.
//
// CLASS B — "Property-tested over stated ranges." TAXONOMY HONESTY, stated where a reader
// will trip over it: the Art 5.5.1 thresholds are CONTINUOUS euro amounts, so this node is
// NOT class-A and "class B" here must never be read as "bounded input domain". The YEAR
// WINDOW is bounded and its paths are enumerated exhaustively below. The MONEY AXIS is not
// bounded and NO totality claim is made over it.
//
// kernel_digest_at_authoring: sha256:6c793bc89b2393ccb5f62dc4970e46c0ca508f47b414fa7fe925237690106ec1
// spec: research/PILLAR2-DEMINIMIS-K-1.spec.md (Art 5.5, OECD GloBE Model Rules Dec 2021)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-637-globe-de-minimis-exclusion.proptest.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compute } from '../art-637-globe-de-minimis-exclusion.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-637-globe-de-minimis-exclusion';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = JSON.parse(
  fs.readFileSync(path.join(HERE, '..', 'fixtures', `${KERNEL_ID}.fixtures.json`), 'utf8'),
);

const REVENUE_THRESHOLD = 10000000;
const INCOME_THRESHOLD = 1000000;
const MODEL_RULES_DIGEST = 'sha256:796d1a16fad360204a76450f5246e038263ef4bc652356f25d367d4b9389e306';

function nextUp(x) {
  const b = new DataView(new ArrayBuffer(8));
  b.setFloat64(0, x);
  b.setBigUint64(0, b.getBigUint64(0) + 1n);
  return b.getFloat64(0);
}
function nextDown(x) {
  const b = new DataView(new ArrayBuffer(8));
  b.setFloat64(0, x);
  b.setBigUint64(0, b.getBigUint64(0) - 1n);
  return b.getFloat64(0);
}

/** Builds a well-formed pp so each property varies exactly one thing. */
function pp(years, overrides) {
  const o = overrides || {};
  const versioned = (value) => ({
    value,
    effective_from: '2021-12-20',
    effective_to: null,
    source: 'OECD GloBE Model Rules (Pillar Two), December 2021, Article 5.5',
    source_digest: MODEL_RULES_DIGEST,
  });
  const has = (k) => Object.prototype.hasOwnProperty.call(o, k);
  const base = {
    jurisdiction: 'PBT',
    fiscal_year: 2026,
    max_years: 3,
    years_jurisdiction_in_scope: years.filter((y) => !y.no_constituent_entities).length,
    election_made: true,
    stateless_and_investment_entities_excluded: true,
    de_minimis_parameters: {
      parameter_set_version: 'oecd-globe-model-rules-2021-12',
      averaging_window_years: versioned(3),
      revenue_threshold_eur: versioned(has('revenueThreshold') ? o.revenueThreshold : REVENUE_THRESHOLD),
      income_threshold_eur: versioned(has('incomeThreshold') ? o.incomeThreshold : INCOME_THRESHOLD),
    },
    years,
  };
  return Object.assign(base, o.pp || {});
}

/** Three full years whose revenue average is exactly `avg` and income average exactly 0. */
function yearsWithRevenueAverage(avg) {
  return [
    { fiscal_year: 2024, globe_revenue_eur: avg, globe_income_or_loss_eur: 0 },
    { fiscal_year: 2025, globe_revenue_eur: avg, globe_income_or_loss_eur: 0 },
    { fiscal_year: 2026, globe_revenue_eur: avg, globe_income_or_loss_eur: 0 },
  ];
}

function yearsWithIncomeAverage(avg) {
  return [
    { fiscal_year: 2024, globe_revenue_eur: 0, globe_income_or_loss_eur: avg },
    { fiscal_year: 2025, globe_revenue_eur: 0, globe_income_or_loss_eur: avg },
    { fiscal_year: 2026, globe_revenue_eur: 0, globe_income_or_loss_eur: avg },
  ];
}

// ---------------------------------------------------------------------------------------
// P12/P13 — THRESHOLD BOUNDARY, forced EXACTLY at each threshold and at +/- 1 ULP, each
// classified on the correct side of Art 5.5.1's STRICT "less than".
// ---------------------------------------------------------------------------------------
function checkThresholdBoundaryExactAndUlp() {
  let checked = 0;
  let violations = 0;
  const detail = [];

  const cases = [
    {
      label: 'revenue',
      threshold: REVENUE_THRESHOLD,
      build: yearsWithRevenueAverage,
      readVerdict: (o) => o.revenue_test_met,
      readAvg: (o) => o.average_globe_revenue_eur,
    },
    {
      label: 'income',
      threshold: INCOME_THRESHOLD,
      build: yearsWithIncomeAverage,
      readVerdict: (o) => o.income_test_met,
      readAvg: (o) => o.average_globe_income_eur,
    },
  ];

  for (const c of cases) {
    const trials = [
      { value: nextDown(c.threshold), want: true, why: `${c.label} average 1 ULP BELOW threshold must MEET the strict < condition` },
      { value: c.threshold, want: false, why: `${c.label} average EXACTLY AT threshold must NOT meet the strict < condition` },
      { value: nextUp(c.threshold), want: false, why: `${c.label} average 1 ULP ABOVE threshold must NOT meet the condition` },
    ];
    for (const t of trials) {
      const out = compute(pp(c.build(t.value))).output_payload;
      // Guard: the constructed average must actually land on the intended point, otherwise
      // the boundary was never exercised and a green result would prove nothing.
      const gotAvg = c.readAvg(out);
      checked++;
      if (!Object.is(gotAvg, t.value)) {
        violations++;
        detail.push(`${t.why}: average did not land on the boundary (wanted ${t.value}, computed ${gotAvg})`);
        continue;
      }
      checked++;
      if (c.readVerdict(out) !== t.want) {
        violations++;
        detail.push(`${t.why}: got ${c.readVerdict(out)}`);
      }
    }
  }
  return { name: 'P12/P13_threshold_boundary_exact_and_1ulp', checked, violations, detail };
}

// ---------------------------------------------------------------------------------------
// P12 — SIGNED ZERO. +0 and -0 must classify identically and must not be read as a loss.
// ---------------------------------------------------------------------------------------
function checkSignedZeroIdentical() {
  let checked = 0;
  let violations = 0;
  const detail = [];
  const pos = compute(pp(yearsWithIncomeAverage(0))).output_payload;
  const neg = compute(pp(yearsWithIncomeAverage(-0))).output_payload;
  for (const f of ['income_test_met', 'de_minimis_available', 'deemed_zero_topup', 'average_globe_income_is_loss']) {
    checked++;
    if (pos[f] !== neg[f]) {
      violations++;
      detail.push(`+0 and -0 income diverge on ${f}: ${pos[f]} vs ${neg[f]}`);
    }
  }
  checked++;
  if (pos.average_globe_income_is_loss !== false || neg.average_globe_income_is_loss !== false) {
    violations++;
    detail.push('a zero average income must not be reported as a loss');
  }
  return { name: 'P12_signed_zero_identical', checked, violations, detail };
}

// ---------------------------------------------------------------------------------------
// THE LOSS-YEAR RULE — a loss year moves the average in the DECLARED direction (down, as a
// signed negative per Art 5.5.3(b) and Commentary paras 84/91), NEVER silently to zero.
// ---------------------------------------------------------------------------------------
function checkLossYearMovesAverageDownNotToZero() {
  let checked = 0;
  let violations = 0;
  const detail = [];

  const base = [
    { fiscal_year: 2024, globe_revenue_eur: 1000, globe_income_or_loss_eur: 600000 },
    { fiscal_year: 2025, globe_revenue_eur: 1000, globe_income_or_loss_eur: 600000 },
    { fiscal_year: 2026, globe_revenue_eur: 1000, globe_income_or_loss_eur: 600000 },
  ];
  const a = compute(pp(base)).output_payload.average_globe_income_eur;

  for (const mag of [1, 1000, 250000, 900000, 5000000, 12345678.9]) {
    const withLoss = [
      base[0],
      base[1],
      { fiscal_year: 2026, globe_revenue_eur: 1000, globe_income_or_loss_eur: -mag },
    ];
    const b = compute(pp(withLoss)).output_payload.average_globe_income_eur;

    checked++;
    if (!(b < a)) {
      violations++;
      detail.push(`a loss year of ${mag} did not move the income average DOWN (${a} -> ${b})`);
    }

    // The zero-coercion control: read as zero, the average would be exactly
    // (600000 + 600000 + 0)/3 = 400000. It must NOT be.
    checked++;
    if (Object.is(b, 400000)) {
      violations++;
      detail.push(`a loss year of ${mag} was coerced to zero (average landed on the zero-coercion value 400000)`);
    }

    checked++;
    const want = (600000 + 600000 - mag) / 3;
    if (!Object.is(b, want)) {
      violations++;
      detail.push(`signed loss arithmetic diverged: wanted ${want}, got ${b}`);
    }
  }
  return { name: 'loss_year_signed_negative_never_zero', checked, violations, detail };
}

// ---------------------------------------------------------------------------------------
// PARTIAL WINDOW — exhaustive over the BOUNDED year axis. Art 5.5.2 excludes a preceding
// year with no Constituent Entities, shrinking the DIVISOR. Two claims:
//   (a) the divisor is the count of INCLUDED years, never the window length;
//   (b) a partial window never produces a higher pass rate than the full window at the same
//       per-year amounts — the clause states no such widening, so none is implemented.
// ---------------------------------------------------------------------------------------
function checkPartialWindowExhaustive() {
  let checked = 0;
  let violations = 0;
  const detail = [];

  const REV = 3000000;
  const INC = 400000;
  const fullYears = [
    { fiscal_year: 2024, globe_revenue_eur: REV, globe_income_or_loss_eur: INC },
    { fiscal_year: 2025, globe_revenue_eur: REV, globe_income_or_loss_eur: INC },
    { fiscal_year: 2026, globe_revenue_eur: REV, globe_income_or_loss_eur: INC },
  ];
  const full = compute(pp(fullYears)).output_payload;

  // Every subset of the two PRECEDING years being excluded (the current year may never be
  // excluded). The window is 3, so this is the complete path set: 2^2 = 4.
  for (const excl2024 of [false, true]) {
    for (const excl2025 of [false, true]) {
      const years = [
        excl2024 ? { fiscal_year: 2024, no_constituent_entities: true } : fullYears[0],
        excl2025 ? { fiscal_year: 2025, no_constituent_entities: true } : fullYears[1],
        fullYears[2],
      ];
      const out = compute(pp(years)).output_payload;
      const expectedIncluded = 3 - (excl2024 ? 1 : 0) - (excl2025 ? 1 : 0);
      const tag = `excluded(2024=${excl2024},2025=${excl2025})`;

      checked++;
      if (out.years_included !== expectedIncluded) {
        violations++;
        detail.push(`${tag}: years_included ${out.years_included} != ${expectedIncluded}`);
      }

      // (a) The divisor shrank: with identical per-year amounts the average is UNCHANGED,
      // which holds only if the divisor is the INCLUDED count. Carrying an excluded year as
      // a zero would drag the average down instead.
      checked++;
      if (!Object.is(out.average_globe_revenue_eur, REV)) {
        violations++;
        detail.push(`${tag}: revenue average ${out.average_globe_revenue_eur} != ${REV} — the divisor did not shrink, an excluded year was carried as a zero`);
      }
      checked++;
      if (!Object.is(out.average_globe_income_eur, INC)) {
        violations++;
        detail.push(`${tag}: income average ${out.average_globe_income_eur} != ${INC} — the divisor did not shrink`);
      }

      checked++;
      const wantPartial = expectedIncluded < 3;
      if (out.partial_window_used !== wantPartial) {
        violations++;
        detail.push(`${tag}: partial_window_used ${out.partial_window_used} != ${wantPartial}`);
      }

      // (b) No pass-rate widening relative to the full window at identical amounts.
      checked++;
      if (out.de_minimis_available === true && full.de_minimis_available === false) {
        violations++;
        detail.push(`${tag}: a partial window passed where the full window at identical amounts failed — the clause states no such widening`);
      }
    }
  }
  return { name: 'partial_window_exhaustive_over_bounded_year_axis', checked, violations, detail };
}

// ---------------------------------------------------------------------------------------
// P17–P21 — COMPOSITION across the two averages. The conjunction is Commentary para 81's
// "aggregate and cumulative": de_minimis_available holds only when BOTH conditions hold.
// ---------------------------------------------------------------------------------------
function checkConjunctionAcrossBothAverages() {
  let checked = 0;
  let violations = 0;
  const detail = [];

  for (const r of [0, 5000000, REVENUE_THRESHOLD, 50000000]) {
    for (const i of [-2000000, 0, 500000, INCOME_THRESHOLD, 9000000]) {
      const out = compute(pp([
        { fiscal_year: 2024, globe_revenue_eur: r, globe_income_or_loss_eur: i },
        { fiscal_year: 2025, globe_revenue_eur: r, globe_income_or_loss_eur: i },
        { fiscal_year: 2026, globe_revenue_eur: r, globe_income_or_loss_eur: i },
      ])).output_payload;

      const wantRev = r < REVENUE_THRESHOLD;
      const wantInc = i < 0 || i < INCOME_THRESHOLD;

      checked++;
      if (out.revenue_test_met !== wantRev) {
        violations++;
        detail.push(`rev ${r}: revenue_test_met ${out.revenue_test_met} != ${wantRev}`);
      }
      checked++;
      if (out.income_test_met !== wantInc) {
        violations++;
        detail.push(`inc ${i}: income_test_met ${out.income_test_met} != ${wantInc}`);
      }
      checked++;
      if (out.de_minimis_available !== (wantRev && wantInc)) {
        violations++;
        detail.push(`rev ${r} inc ${i}: de_minimis_available is not the conjunction of the two conditions`);
      }
      // Deemed-zero is gated on the declared election as well as on the conjunction; the
      // election is declared true throughout this property.
      checked++;
      if (out.deemed_zero_topup !== (wantRev && wantInc)) {
        violations++;
        detail.push(`rev ${r} inc ${i}: deemed_zero_topup diverged from availability under a declared election`);
      }
    }
  }
  return { name: 'P17-P21_conjunction_composition_across_both_averages', checked, violations, detail };
}

// ---------------------------------------------------------------------------------------
// P26–P30 — REGULATORY DECLARATION, FIELD COMPLETENESS. A missing year or a missing
// threshold parameter must raise manual_review_required and must NEVER be silently
// defaulted into a verdict.
// ---------------------------------------------------------------------------------------
function checkNoSilentDefaults() {
  let checked = 0;
  let violations = 0;
  const detail = [];

  const good = [
    { fiscal_year: 2024, globe_revenue_eur: 1000, globe_income_or_loss_eur: 1000 },
    { fiscal_year: 2025, globe_revenue_eur: 1000, globe_income_or_loss_eur: 1000 },
    { fiscal_year: 2026, globe_revenue_eur: 1000, globe_income_or_loss_eur: 1000 },
  ];

  // Baseline: these amounts comfortably meet both conditions. If this is not clean, the
  // degradations below prove nothing.
  const base = compute(pp(good)).output_payload;
  checked++;
  if (base.de_minimis_available !== true || base.manual_review_required !== false) {
    violations++;
    detail.push('baseline vector did not produce a clean available verdict, so the degradations below prove nothing');
  }

  const degradations = [
    { label: 'year absent entirely', params: pp([good[0], { fiscal_year: 2025 }, good[2]]) },
    { label: 'year amounts null', params: pp([good[0], { fiscal_year: 2025, globe_revenue_eur: null, globe_income_or_loss_eur: null }, good[2]]) },
    { label: 'year income NaN', params: pp([good[0], { fiscal_year: 2025, globe_revenue_eur: 1000, globe_income_or_loss_eur: NaN }, good[2]]) },
    { label: 'year income Infinity', params: pp([good[0], { fiscal_year: 2025, globe_revenue_eur: 1000, globe_income_or_loss_eur: Infinity }, good[2]]) },
    { label: 'year income a numeric string', params: pp([good[0], { fiscal_year: 2025, globe_revenue_eur: 1000, globe_income_or_loss_eur: '1000' }, good[2]]) },
    { label: 'revenue threshold missing', params: pp(good, { revenueThreshold: null }) },
    { label: 'income threshold missing', params: pp(good, { incomeThreshold: null }) },
    { label: 'election undeclared', params: pp(good, { pp: { election_made: null } }) },
    { label: 'max_years undeclared', params: pp(good, { pp: { max_years: null } }) },
    { label: 'current fiscal year missing from years', params: pp([good[0], good[1]]) },
    { label: 'current year wrongly declared excluded', params: pp([good[0], good[1], { fiscal_year: 2026, no_constituent_entities: true }]) },
    { label: 'Art 5.5.4 upstream exclusion undeclared', params: pp(good, { pp: { stateless_and_investment_entities_excluded: false } }) },
  ];

  for (const d of degradations) {
    const out = compute(d.params).output_payload;
    checked++;
    if (out.manual_review_required !== true) {
      violations++;
      detail.push(`${d.label}: manual_review_required was not raised`);
    }
    checked++;
    if (out.de_minimis_available !== false) {
      violations++;
      detail.push(`${d.label}: de_minimis_available was granted despite an incomplete input`);
    }
    checked++;
    if (out.deemed_zero_topup !== false) {
      violations++;
      detail.push(`${d.label}: deemed_zero_topup was reported despite an incomplete input`);
    }
  }

  // A missing year must never be read as a zero.
  const withMissing = compute(pp([good[0], { fiscal_year: 2025 }, good[2]])).output_payload;
  checked++;
  if (Object.is(withMissing.average_globe_revenue_eur, (1000 + 0 + 1000) / 3)) {
    violations++;
    detail.push('a missing year was averaged in as a zero');
  }

  return { name: 'P26-P30_no_silent_defaults_field_completeness', checked, violations, detail };
}

// ---------------------------------------------------------------------------------------
// P26/P28 — DECLARATION PARITY. The thresholds applied must be the ones supplied as
// versioned policy parameters (never a kernel constant), and every arithmetic step this
// kernel performs must map to exactly one rounding_steps entry in the node shard.
// ---------------------------------------------------------------------------------------
function checkVersionedParametersDriveTheMath() {
  let checked = 0;
  let violations = 0;
  const detail = [];

  const years = yearsWithRevenueAverage(7000000);
  const wide = compute(pp(years, { revenueThreshold: 8000000 })).output_payload;
  const narrow = compute(pp(years, { revenueThreshold: 6000000 })).output_payload;
  checked++;
  if (wide.revenue_test_met !== true || narrow.revenue_test_met !== false) {
    violations++;
    detail.push('the revenue verdict did not follow the supplied threshold parameter — a constant may be baked into kernel math');
  }
  checked++;
  if (wide.thresholds_applied.revenue_threshold_eur !== 8000000) {
    violations++;
    detail.push('thresholds_applied did not echo the supplied revenue threshold');
  }
  checked++;
  if (!wide.thresholds_applied.revenue_threshold_provenance
      || wide.thresholds_applied.revenue_threshold_provenance.source_digest !== MODEL_RULES_DIGEST) {
    violations++;
    detail.push('the versioned parameter tuple provenance was not carried into the output');
  }

  // rounding_steps parity (P28): the shard must declare exactly the arithmetic steps this
  // kernel performs — the revenue average, the income average, the threshold comparison.
  const shardPath = path.join(HERE, '..', '..', 'graph', 'nodes', `${KERNEL_ID}.json`);
  let shard = null;
  try {
    shard = JSON.parse(fs.readFileSync(shardPath, 'utf8'));
  } catch (e) {
    checked++;
    violations++;
    detail.push(`could not read the node shard to check rounding_steps parity: ${String((e && e.message) || e)}`);
  }
  if (shard) {
    const steps = Array.isArray(shard.rounding_steps) ? shard.rounding_steps : [];
    checked++;
    if (steps.length < 3) {
      violations++;
      detail.push(`rounding_steps declares ${steps.length} entries; this kernel performs three arithmetic steps (P28)`);
    }
    checked++;
    if (shard.float_sensitive !== 'yes') {
      violations++;
      detail.push('float_sensitive must be "yes" — the averages and the threshold comparison are binary64');
    }
    for (const s of steps) {
      checked++;
      if (!s || typeof s.oracle !== 'string' || s.oracle.length === 0) {
        violations++;
        detail.push(`a rounding_steps entry carries no oracle string: ${JSON.stringify(s)}`);
      }
    }
  }

  return { name: 'P26-P28_versioned_parameters_and_rounding_step_parity', checked, violations, detail };
}

// ---------------------------------------------------------------------------------------
// FIXTURE ORACLE INDEPENDENCE (SO #34) — assert each fixture against the EXTERNALLY-derived
// independent_oracle.expect block, never against itself.
// ---------------------------------------------------------------------------------------
function checkFixturesMatchIndependentOracle() {
  let checked = 0;
  let violations = 0;
  const detail = [];
  for (const v of FIXTURES.vectors) {
    const oracle = v.independent_oracle;
    checked++;
    if (!oracle || !oracle.expect || !oracle.source_digest) {
      violations++;
      detail.push(`${v.name}: no independent_oracle block — the fixture would be its own oracle`);
      continue;
    }
    // Recompute from the kernel rather than trusting the recorded payload (SO #34).
    const live = compute(v.policy_parameters).output_payload;
    for (const [k, want] of Object.entries(oracle.expect)) {
      checked++;
      if (!Object.is(live[k], want)) {
        violations++;
        detail.push(`${v.name}: ${k} — oracle wants ${want}, kernel computed ${live[k]}`);
      }
      checked++;
      if (!Object.is(v.output_payload[k], want)) {
        violations++;
        detail.push(`${v.name}: ${k} — recorded output_payload ${v.output_payload[k]} diverges from the oracle ${want}`);
      }
    }
  }
  return { name: 'fixtures_match_independent_oracle', checked, violations, detail };
}

// ---------------------------------------------------------------------------------------
// DETERMINISM — same pp in, byte-identical payload out.
// ---------------------------------------------------------------------------------------
function checkDeterminism() {
  let checked = 0;
  let violations = 0;
  const detail = [];
  for (const v of FIXTURES.vectors) {
    checked++;
    const a = JSON.stringify(compute(v.policy_parameters));
    const b = JSON.stringify(compute(v.policy_parameters));
    if (a !== b) {
      violations++;
      detail.push(`${v.name}: two runs on identical inputs diverged`);
    }
  }
  return { name: 'determinism', checked, violations, detail };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkThresholdBoundaryExactAndUlp(),
  checkSignedZeroIdentical(),
  checkLossYearMovesAverageDownNotToZero(),
  checkPartialWindowExhaustive(),
  checkConjunctionAcrossBothAverages(),
  checkNoSilentDefaults(),
  checkVersionedParametersDriveTheMath(),
  checkFixturesMatchIndependentOracle(),
  checkDeterminism(),
];
console.log(`[${KERNEL_ID}] class-K floor — Art 5.5 GloBE de minimis EXCLUSION (not art-456's transitional test).`);
console.log('  Year window: bounded, enumerated exhaustively. Money axis: continuous, NO totality claim.');
const ok = summarize(KERNEL_ID, oracle, properties);
for (const p of properties) {
  if (p.violations > 0 && Array.isArray(p.detail)) {
    for (const d of p.detail) console.log(`      - ${p.name}: ${d}`);
  }
}
process.exit(ok ? 0 : 1);
