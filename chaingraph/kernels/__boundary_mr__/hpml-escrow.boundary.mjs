// FAMILY 3 — HPML escrow boundary family (art-235 consumer / art-220 supplier).
//
// SELECTION BASIS (mechanical, CONSUMES-EDGE-CHECK-1): the scan on origin/main reports
//   BYTE-EQUAL  art-235-test-hpml-escrow -> art-220-reg-z-threshold-lookup
// as one of exactly three edge measurements in the estate (art-235 is the only kernel
// in the estate that DECLARES art-220 as its spread-table supplier). This family
// converts that value agreement into the boundary-direction relation on the three
// published spread tiers.
//
// ORACLE COMPARATOR. art-220's hpml row publishes 1.5 / 2.5 / 3.5 pp. The HPML test
// (§1026.35(a)(4), as art-235 applies it: apr_spread >= spread_threshold - 1e-5) is
// inclusive AT the threshold: a spread exactly at 1.5 pp IS higher-priced. Oracle:
// fires(v) = v >= published_pp.

import { compute as art235 } from '../art-235-test-hpml-escrow.kernel.mjs';
import { compute as art220 } from '../art-220-reg-z-threshold-lookup.kernel.mjs';
import { defineFamily, EXPECT, checker, boundaryTriples, EPS_PP } from './_mr-harness.mjs';

function publishedYears(lookup, table) {
  return lookup({ year: 2026, table }).output_payload.available_years;
}

function row(lookup, table, year) {
  return lookup({ year, table }).output_payload.data;
}

// ── P-B4 ────────────────────────────────────────────────────────────────────
// art-235's higher-priced verdict must flip exactly at art-220's published spread
// threshold for standard first lien (1.5), jumbo first lien (2.5) and subordinate
// lien (3.5), firing AT the threshold, for every published year.
function pB4(env) {
  const lookup = env.art220 || art220;
  const hpml = env.art235 || art235;
  const c = checker();
  for (const year of publishedYears(lookup, 'hpml')) {
    const d = row(lookup, 'hpml', year);
    const combos = [
      { lien_type: 'first', is_jumbo: false, key: 'first_lien_pp' },
      { lien_type: 'first', is_jumbo: true, key: 'first_lien_jumbo_pp' },
      { lien_type: 'subordinate', is_jumbo: false, key: 'sub_lien_pp' },
    ];
    for (const k of combos) {
      const t = d[k.key];
      boundaryTriples(
        c,
        { relation: 'P-B4', threshold_name: `hpml_spread/${k.lien_type}${k.is_jumbo ? '_jumbo' : ''}`, year },
        t, EPS_PP,
        (v) => v >= t,
        (v) => {
          const pp = { year, apr_pct: 5, apor_pct: 5 - v, lien_type: k.lien_type, is_jumbo: k.is_jumbo };
          return hpml(pp).output_payload.is_hpml === true;
        },
      );
    }
  }
  return c.result();
}

export default defineFamily({
  family: 'B3',
  title: 'HPML escrow boundary family — art-235 flip-point/direction vs art-220 published spread tiers',
  chain: 'mortgage-compliance-preflight',
  kernels: ['art-235-test-hpml-escrow', 'art-220-reg-z-threshold-lookup'],
  basis: 'CONSUMES-EDGE-CHECK-1 scan on origin/main: BYTE-EQUAL edge art-235 -> art-220 (the estate\'s only declared consumes: spread-table edge), 2026-09-07 run.',
  properties: [
    {
      id: 'P-B4-hpml-spread-boundary-direction',
      statement: 'For every year art-220 publishes, art-235\'s higher-priced verdict flips exactly at the published spread threshold (1.5 pp standard first lien, 2.5 pp jumbo first lien, 3.5 pp subordinate lien), firing AT the threshold.',
      expect: EXPECT.HOLDS,
      run: pB4,
    },
  ],
});
