// FAMILY A — Reg Z threshold family.
//
// SHARED REGULATORY SUBSTANCE. art-220 (lookup_reg_z_thresholds) is the estate's
// PUBLISHER of Reg Z dollar thresholds; art-218, art-234 and art-235 each APPLY a
// facet of the same rule set. art-234 and art-235 both declare `consumes: art-220`
// in their own output payloads while pinning a local copy of the same numbers for
// deterministic compute. That declared-consumer / local-copy pattern is precisely the
// shape a consistency property exists to police: nothing in the build makes the copy
// track the publisher.
//
// SELECTION RATIONALE. Enumerated from chaingraph/graph/chains/*.json by counting
// shared regulatory substance across each chain's resolvable kernels. The chain
// `mortgage-compliance-preflight` (art-220 -> art-217 -> art-218 -> art-219) was the
// single densest candidate in the estate: Reg Z cited by 4 of 4 steps and 38 distinct
// four-to-seven-digit constants appearing in two or more of its kernels. art-234 and
// art-235 join the family because they are the two kernels in the whole estate that
// declare art-220 as a consumed threshold source.
//
// INDEPENDENT DERIVATION (SO #34). Every expected value below is computed from
// art-220's PUBLISHED output_payload, never read out of the kernel under test. The
// probe loan amounts are themselves derived from art-220's row so that the property
// never needs to know art-218's internal tier boundaries.

import { compute as art218 } from '../art-218-qm-points-and-fees.kernel.mjs';
import { compute as art220 } from '../art-220-reg-z-threshold-lookup.kernel.mjs';
import { compute as art234 } from '../art-234-test-hoepa-high-cost.kernel.mjs';
import { compute as art235 } from '../art-235-test-hpml-escrow.kernel.mjs';
import { defineFamily, EXPECT, checker, near, r2 } from './_consistency-harness.mjs';

// The publisher's own declared year domain, read from art-220's output. Never a
// hardcoded year list — if art-220 gains 2027, every property below widens with it.
function publishedYears(lookup, table) {
  const { output_payload } = lookup({ year: 2026, table });
  return output_payload.available_years;
}

function row(lookup, table, year) {
  const { output_payload } = lookup({ year, table });
  return output_payload.data;
}

// ── P-A1 ────────────────────────────────────────────────────────────────────
// art-218's applied QM points-and-fees limit must equal the limit derivable from
// art-220's published qm_points_fees row, for every year art-220 publishes.
function pA1(env) {
  const lookup = env.art220 || art220;
  const c = checker();
  for (const year of publishedYears(lookup, 'qm_points_fees')) {
    const d = row(lookup, 'qm_points_fees', year);

    // Probe points chosen ONLY from art-220's published figures. Each names the tier
    // it lands in and the limit art-220's schedule implies there.
    const probes = [
      { loan: d.tier_1_min,      expected: r2(d.tier_1_min * d.tier_1_pct / 100),     tier: 'tier1_pct_at_floor' },
      { loan: d.tier_1_min * 3,  expected: r2(d.tier_1_min * 3 * d.tier_1_pct / 100), tier: 'tier1_pct_well_above' },
      { loan: d.tier_1_min - 1,  expected: d.tier_2_fixed,                            tier: 'tier2_fixed_just_below_tier1' },
      { loan: d.tier_3_min,      expected: r2(d.tier_3_min * d.tier_3_pct / 100),     tier: 'tier3_pct_at_floor' },
      { loan: d.tier_3_min * 2,  expected: r2(d.tier_3_min * 2 * d.tier_3_pct / 100), tier: 'tier3_pct_midband' },
      { loan: d.tier_3_min - 1,  expected: d.tier_4_fixed,                            tier: 'tier4_fixed_just_below_tier3' },
      { loan: 1000,              expected: r2(1000 * d.tier_5_pct / 100),             tier: 'tier5_pct_small_loan' },
    ];

    for (const p of probes) {
      // (a) The limit art-218 reports must be the limit art-220's schedule implies.
      const at = art218({ loan_amount: p.loan, points_and_fees: p.expected, year }).output_payload;
      c.check(near(at.limit, p.expected), {
        property: 'P-A1', year, tier: p.tier, loan_amount: p.loan,
        art220_implied_limit: p.expected, art218_applied_limit: at.limit,
        why: 'art-218 applied a limit art-220 does not publish for this year and tier',
      });

      // (b) Behavioural boundary — the same disagreement, observed through the verdict
      // rather than through a reported field. A points-and-fees figure exactly at
      // art-220's limit must PASS; two cents above it must FAIL.
      const above = art218({ loan_amount: p.loan, points_and_fees: p.expected + 0.02, year }).output_payload;
      c.check(at.pass === true && above.pass === false, {
        property: 'P-A1', year, tier: p.tier, loan_amount: p.loan,
        points_and_fees_at_limit: p.expected, pass_at_limit: at.pass,
        pass_two_cents_above: above.pass,
        why: 'art-218 verdict boundary does not sit at the limit art-220 publishes',
      });
    }
  }
  return c.result();
}

// ── P-A2 ────────────────────────────────────────────────────────────────────
// art-234's HOEPA thresholds must equal art-220's published hoepa row, for every year
// art-220 publishes. art-234's own payload declares it consumes art-220's hoepa table.
function pA2(env) {
  const lookup = env.art220 || art220;
  const c = checker();
  for (const year of publishedYears(lookup, 'hoepa')) {
    const d = row(lookup, 'hoepa', year);

    // A small loan, so the dollar FLOOR governs rather than the percentage.
    // 5% of 10,000 is 500, below every published floor.
    const small = { loan_amount: 10000, points_and_fees: 0, year, apr_pct: 0, apor_pct: 0 };
    const o = art234(small).output_payload;

    c.check(near(o.points_fees_floor, d.points_fees_floor, 0.0001), {
      property: 'P-A2', year, art220_floor: d.points_fees_floor,
      art234_floor: o.points_fees_floor,
      why: 'art-234 applied a HOEPA points-and-fees floor art-220 does not publish for this year',
    });
    c.check(near(o.points_fees_limit_pct, d.points_fees_pct, 0.0001), {
      property: 'P-A2', year, art220_pct: d.points_fees_pct,
      art234_pct: o.points_fees_limit_pct,
      why: 'art-234 applied a HOEPA points-and-fees percentage art-220 does not publish',
    });

    // Behavioural boundary on the floor: at the published floor the trigger must not
    // fire; two cents above it, it must.
    const atFloor = art234({ ...small, points_and_fees: d.points_fees_floor }).output_payload;
    const overFloor = art234({ ...small, points_and_fees: d.points_fees_floor + 0.02 }).output_payload;
    c.check(atFloor.points_fees_trigger_met === false && overFloor.points_fees_trigger_met === true, {
      property: 'P-A2', year, art220_floor: d.points_fees_floor,
      trigger_at_floor: atFloor.points_fees_trigger_met,
      trigger_two_cents_above: overFloor.points_fees_trigger_met,
      why: 'art-234 HOEPA trigger boundary does not sit at the floor art-220 publishes',
    });

    // APR triggers — structural percentages, published by art-220 for every year.
    const first = art234({ ...small, lien_type: 'first' }).output_payload;
    const sub = art234({ ...small, lien_type: 'subordinate' }).output_payload;
    c.check(near(first.apr_threshold_pct, d.rate_spread_first_lien_pp, 0.0001), {
      property: 'P-A2', year, lien: 'first',
      art220_pp: d.rate_spread_first_lien_pp, art234_pp: first.apr_threshold_pct,
      why: 'art-234 first-lien APR spread threshold diverges from art-220',
    });
    c.check(near(sub.apr_threshold_pct, d.rate_spread_sub_lien_pp, 0.0001), {
      property: 'P-A2', year, lien: 'subordinate',
      art220_pp: d.rate_spread_sub_lien_pp, art234_pp: sub.apr_threshold_pct,
      why: 'art-234 subordinate-lien APR spread threshold diverges from art-220',
    });
  }
  return c.result();
}

// ── P-A3 ────────────────────────────────────────────────────────────────────
// art-235's applied HPML rate-spread threshold must equal art-220's published hpml row,
// for every year art-220 publishes and every lien/jumbo combination both express.
function pA3(env) {
  const lookup = env.art220 || art220;
  const c = checker();
  for (const year of publishedYears(lookup, 'hpml')) {
    const d = row(lookup, 'hpml', year);
    const combos = [
      { lien_type: 'first', is_jumbo: false, expected: d.first_lien_pp, basis: 'first_lien_standard' },
      { lien_type: 'first', is_jumbo: true, expected: d.first_lien_jumbo_pp, basis: 'first_lien_jumbo' },
      { lien_type: 'subordinate', is_jumbo: false, expected: d.sub_lien_pp, basis: 'subordinate_lien' },
    ];
    for (const combo of combos) {
      const o = art235({
        year, apr_pct: 5, apor_pct: 3,
        lien_type: combo.lien_type, is_jumbo: combo.is_jumbo,
      }).output_payload;
      c.check(near(o.spread_threshold_pct, combo.expected, 0.0001), {
        property: 'P-A3', year, basis: combo.basis,
        art220_pp: combo.expected, art235_pp: o.spread_threshold_pct,
        why: 'art-235 applied an HPML spread threshold art-220 does not publish for this year',
      });
    }
  }
  return c.result();
}

export default defineFamily({
  family: 'A',
  title: 'Reg Z threshold family — publisher art-220 vs appliers art-218 / art-234 / art-235',
  chains: ['mortgage-compliance-preflight'],
  kernels: [
    'art-220-reg-z-threshold-lookup',
    'art-218-qm-points-and-fees',
    'art-234-test-hoepa-high-cost',
    'art-235-test-hpml-escrow',
  ],
  properties: [
    {
      id: 'P-A1-qm-limit-tracks-lookup',
      statement: 'For every year art-220 publishes, the QM points-and-fees limit art-218 applies equals the limit art-220 publishes for the same loan amount, and art-218\'s pass/fail boundary sits at that limit.',
      expect: EXPECT.HOLDS,
      run: pA1,
    },
    {
      id: 'P-A2-hoepa-tracks-lookup',
      statement: 'For every year art-220 publishes, the HOEPA points-and-fees floor, percentage and APR spread thresholds art-234 applies equal the ones art-220 publishes, and art-234\'s trigger boundary sits at that floor.',
      // DECLARED BEFORE RUNNING: art-234 pins only 2025 and 2026 and falls back to 2026
      // for any other year, while art-220 publishes 2021-2026. Expect a violation.
      expect: EXPECT.VIOLATION,
      run: pA2,
    },
    {
      id: 'P-A3-hpml-spread-tracks-lookup',
      statement: 'For every year art-220 publishes, the HPML rate-spread threshold art-235 applies equals the one art-220 publishes, for standard first lien, jumbo first lien and subordinate lien.',
      expect: EXPECT.HOLDS,
      run: pA3,
    },
  ],
});
