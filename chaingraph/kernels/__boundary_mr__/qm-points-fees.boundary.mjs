// FAMILY 1 — QM points-and-fees boundary family (art-218 consumer / art-220 supplier).
//
// SELECTION BASIS (mechanical, CONSUMES-EDGE-CHECK-1): `node scripts/check-consumes-edges.mjs`
// on origin/main reports the edge
//   BYTE-EQUAL  art-218-qm-points-and-fees -> art-220-reg-z-threshold-lookup
//              [UNDECLARED-CONSUMER, calibration-only]
// as one of exactly three edge measurements in the estate. This family converts that
// measured value-level agreement into the tighter boundary-direction relation.
//
// ORACLE COMPARATOR. The supplier row gives (loan, limit). The QM test (Reg Z
// §1026.43(e)(3), as art-218 itself states: "points_and_fees <= limit") is inclusive at
// the limit: fire strictly above, not at. Oracle: fires(v) = v > limit.

import { compute as art218 } from '../art-218-qm-points-and-fees.kernel.mjs';
import { compute as art220 } from '../art-220-reg-z-threshold-lookup.kernel.mjs';
import { defineFamily, EXPECT, checker, boundaryTriples, EPS_CENTS } from './_mr-harness.mjs';

function publishedYears(lookup, table) {
  const { output_payload } = lookup({ year: 2026, table });
  return output_payload.available_years;
}

function row(lookup, table, year) {
  return lookup({ year, table }).output_payload.data;
}

// ── P-B1 ────────────────────────────────────────────────────────────────────
// For every year and every tier art-220 publishes, art-218's pass/fail verdict must
// flip exactly at the published limit, not before and not after, in the direction
// (fail above the limit) the QM test implies.
function pB1(env) {
  const lookup = env.art220 || art220;
  const qm = env.art218 || art218;
  const c = checker();
  for (const year of publishedYears(lookup, 'qm_points_fees')) {
    const d = row(lookup, 'qm_points_fees', year);
    const probes = [
      { loan: d.tier_1_min, name: 'tier1_pct_at_floor' },
      { loan: d.tier_1_min * 3, name: 'tier1_pct_well_above' },
      { loan: d.tier_1_min - 1, name: 'tier2_fixed_just_below_tier1' },
      { loan: d.tier_3_min, name: 'tier3_pct_at_floor' },
      { loan: d.tier_3_min * 2, name: 'tier3_pct_midband' },
      { loan: d.tier_3_min - 1, name: 'tier4_fixed_just_below_tier3' },
      { loan: 1000, name: 'tier5_pct_small_loan' },
    ];
    for (const p of probes) {
      const limit = qm({ loan_amount: p.loan, points_and_fees: 0, year }).output_payload.limit;
      boundaryTriples(
        c,
        { relation: 'P-B1', threshold_name: `qm_limit/${p.name}`, year },
        limit, EPS_CENTS,
        (v) => v > limit,
        (v) => qm({ loan_amount: p.loan, points_and_fees: v, year }).output_payload.pass === false,
      );
    }
  }
  return c.result();
}

export default defineFamily({
  family: 'B1',
  title: 'QM points-and-fees boundary family — art-218 flip-point/direction vs art-220 published limits',
  chain: 'mortgage-compliance-preflight',
  kernels: ['art-218-qm-points-and-fees', 'art-220-reg-z-threshold-lookup'],
  basis: 'CONSUMES-EDGE-CHECK-1 scan on origin/main: BYTE-EQUAL edge art-218 -> art-220 (UNDECLARED-CONSUMER calibration measurement), 2026-09-07 run.',
  properties: [
    {
      id: 'P-B1-qm-limit-boundary-direction',
      statement: 'For every year and tier art-220 publishes, art-218\'s pass/fail verdict flips exactly at the published limit, inclusive at the limit and failing above it (QM test §1026.43(e)(3): points_and_fees <= limit passes).',
      expect: EXPECT.HOLDS,
      run: pB1,
    },
  ],
});
