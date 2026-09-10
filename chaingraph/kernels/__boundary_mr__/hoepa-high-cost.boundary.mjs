// FAMILY 2 — HOEPA high-cost boundary family (art-234 consumer / art-220 supplier).
//
// SELECTION BASIS (mechanical, CONSUMES-EDGE-CHECK-1): the scan on origin/main reports
//   MISMATCH   art-234-test-hoepa-high-cost -> art-220-reg-z-threshold-lookup
// (declared MISMATCH while CCPP-FIX-ART234-1 is open: HOEPA_PF pins only 2025+2026 and
// compute() falls back silently to 2026 for 2021-2024). A value mismatch at the floor
// is necessarily a boundary-direction violation too: the consumer's flip point sits at
// its stale pinned floor, dollars away from the published one. This family converts
// that known value divergence into generated boundary pairs and DECLARES the violation.
//
// ORACLE COMPARATORS.
//   Floor:  art-234's own code and the rule treat the trigger as strictly above the
//           applicable limit (points_and_fees > limit + half-cent tolerance).
//           Oracle: fires(v) = v > published_floor. A small loan ($10,000; 5% = $500)
//           keeps the dollar floor governing.
//   APR:    the HOEPA APR trigger per §1026.32(a)(1)(i) as art-234 applies it fires when
//           the spread reaches the threshold (apr_spread > threshold - 1e-5, i.e. AT the
//           threshold fires). Oracle: fires(v) = v >= published_pp.

import { compute as art234 } from '../art-234-test-hoepa-high-cost.kernel.mjs';
import { compute as art220 } from '../art-220-reg-z-threshold-lookup.kernel.mjs';
import { defineFamily, EXPECT, checker, boundaryTriples, EPS_CENTS, EPS_PP } from './_mr-harness.mjs';

function publishedYears(lookup, table) {
  return lookup({ year: 2026, table }).output_payload.available_years;
}

function row(lookup, table, year) {
  return lookup({ year, table }).output_payload.data;
}

// ── P-B2 ────────────────────────────────────────────────────────────────────
// art-234's points-and-fees trigger must flip exactly at art-220's published floor.
// DECLARED VIOLATION while CCPP-FIX-ART234-1 is open: for 2021-2024 the consumer pins
// the 2026 floor and flips dollars above the published point.
function pB2(env) {
  const lookup = env.art220 || art220;
  const hoepa = env.art234 || art234;
  const c = checker();
  const small = { loan_amount: 10000, apr_pct: 0, apor_pct: 0 };
  for (const year of publishedYears(lookup, 'hoepa')) {
    const floor = row(lookup, 'hoepa', year).points_fees_floor;
    boundaryTriples(
      c,
      { relation: 'P-B2', threshold_name: 'hoepa_points_fees_floor', year },
      floor, EPS_CENTS,
      (v) => v > floor,
      (v) => hoepa({ ...small, points_and_fees: v, year }).output_payload.points_fees_trigger_met === true,
    );
  }
  return c.result();
}

// ── P-B3 ────────────────────────────────────────────────────────────────────
// art-234's APR spread trigger must flip exactly at art-220's published spread
// thresholds (6.5 pp first lien, 8.5 pp subordinate), firing AT the threshold.
function pB3(env) {
  const lookup = env.art220 || art220;
  const hoepa = env.art234 || art234;
  const c = checker();
  for (const year of publishedYears(lookup, 'hoepa')) {
    const d = row(lookup, 'hoepa', year);
    const liens = [
      { lien_type: 'first', key: 'rate_spread_first_lien_pp' },
      { lien_type: 'subordinate', key: 'rate_spread_sub_lien_pp' },
    ];
    for (const L of liens) {
      const t = d[L.key];
      boundaryTriples(
        c,
        { relation: 'P-B3', threshold_name: `hoepa_apr_spread/${L.lien_type}`, year },
        t, EPS_PP,
        (v) => v >= t,
        (v) => {
          const pp = { loan_amount: 100000, points_and_fees: 0, lien_type: L.lien_type, year };
          // spread = apr - apor = v exactly (both at 4dp)
          return hoepa({ ...pp, apr_pct: 5, apor_pct: 5 - v }).output_payload.apr_trigger_met === true;
        },
      );
    }
  }
  return c.result();
}

export default defineFamily({
  family: 'B2',
  title: 'HOEPA high-cost boundary family — art-234 flip-point/direction vs art-220 published thresholds',
  chain: 'mortgage-compliance-preflight',
  kernels: ['art-234-test-hoepa-high-cost', 'art-220-reg-z-threshold-lookup'],
  basis: 'CONSUMES-EDGE-CHECK-1 scan on origin/main: MISMATCH edge art-234 -> art-220 (declared while CCPP-FIX-ART234-1 open), 2026-09-07 run.',
  properties: [
    {
      id: 'P-B2-hoepa-floor-boundary-direction',
      statement: 'For every year art-220 publishes, art-234\'s points-and-fees trigger flips exactly at the published floor (firing strictly above it), on a floor-governed $10,000 loan.',
      // DECLARED BEFORE RUNNING: art-234 pins the 2026 floor (1380) and applies it to
      // 2021-2024, dollars above the published 1103/1148/1243/1309. Expect a violation.
      expect: EXPECT.VIOLATION,
      run: pB2,
    },
    {
      id: 'P-B3-hoepa-apr-spread-boundary-direction',
      statement: 'For every year art-220 publishes, art-234\'s APR spread trigger flips exactly at the published spread threshold for first-lien (6.5 pp) and subordinate-lien (8.5 pp), firing AT the threshold.',
      expect: EXPECT.HOLDS,
      run: pB3,
    },
  ],
});
