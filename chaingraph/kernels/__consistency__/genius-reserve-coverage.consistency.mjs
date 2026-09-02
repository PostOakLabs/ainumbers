// FAMILY B — stablecoin reserve-coverage family.
//
// SHARED REGULATORY SUBSTANCE. art-06 and art-582 both implement the GENIUS Act
// S.394 §4(a) 1:1 reserve coverage requirement, and both compute the same quantity
// from the same three caller-supplied numbers: outstanding tokens, token price, and
// total reserves. art-512 implements the MiCA analogue of the same arithmetic and is
// included as the family's third voice on the degenerate-input question, because it
// states its treatment of that case explicitly in its own payload rationale.
//
// SELECTION RATIONALE. Enumerated from chaingraph/graph/chains/*.json: the chain
// `mica-register-crosscheck` (art-602 -> art-512 -> art-06 -> art-582) carries two
// independent reserve-coverage implementations plus a third disclosure checker over
// the same substance, and shared six distinct multi-digit constants across its
// kernels. It is the only chain in the estate where two kernels compute the SAME
// ratio from the SAME inputs under two different statutes, which makes the
// cross-kernel relationship unusually sharp: the numbers are not merely related, they
// must be equal.
//
// SCOPE NOTE, stated rather than assumed. art-06 and art-582 apply different statutes
// to the coverage figure and reach different overall determinations for legitimate
// reasons (art-06 folds in asset eligibility and an AICPA attestation score; art-582
// deliberately narrowed its scope to coverage arithmetic and attestation timeliness).
// The properties below therefore assert consistency of THE COVERAGE FINDING ONLY,
// never of the two overall determinations, which are not required to agree.

import { compute as art06 } from '../art-06-genius-act-reserve-attestation.kernel.mjs';
import { compute as art582 } from '../art-582-genius-reserve-disclosure-conformance-monitor.kernel.mjs';
import { defineFamily, EXPECT, checker, near } from './_consistency-harness.mjs';

// One reserve scenario expressed in each kernel's own input vocabulary. This mapping
// is the whole point of the family: the two kernels name the same facts differently,
// and nothing in the build checks that they then treat them the same way.
function asArt06(sc) {
  return {
    outstanding_tokens: sc.tokens,
    token_price: sc.price,
    // A single permitted, maturity-free asset class carries the whole reserve, so the
    // coverage finding is isolated from art-06's asset-eligibility dimension.
    assets: [{ type: 'fed_reserve_balance', usd: sc.reserves }],
    aicpa_answers: {},
  };
}

function asArt582(sc) {
  return {
    outstanding_tokens_reported: sc.tokens,
    token_price: sc.price,
    total_reserves_usd: sc.reserves,
    attestation_present: true,
    attestation_date: '2026-01-15',
    period_end_date: '2025-12-31',
    examiner_registered: true,
    examiner_name: 'Example LLP',
  };
}

// art-06 reports the coverage shortfall as an entry in failing_dimensions rather than
// as a named verdict, so the coverage finding is read out of that list.
function art06CoverageNotMet(out) {
  return (out.failing_dimensions || []).some((f) => f.dim === 'Coverage ratio < 100%');
}

// Exhaustive enumeration over the declared finite domain. Reserve levels bracket the
// 1:1 line from every side: short, exact, and over.
const POSITIVE_SCENARIOS = [];
for (const tokens of [1, 1000, 250000]) {
  for (const price of [1, 0.5, 2]) {
    const liabilities = tokens * price;
    for (const mult of [0, 0.5, 0.999999, 1, 1.000001, 1.25]) {
      POSITIVE_SCENARIOS.push({ tokens, price, reserves: liabilities * mult, mult });
    }
  }
}

// The degenerate domain: no tokens outstanding, so the ratio reserves/liabilities has
// no value. Enumerated separately because it is the case the two kernels answer with
// different KINDS of answer, not merely different numbers.
const DEGENERATE_SCENARIOS = [];
for (const tokens of [0, -5]) {
  for (const reserves of [0, 1000]) {
    DEGENERATE_SCENARIOS.push({ tokens, price: 1, reserves });
  }
}

// ── P-B1 ────────────────────────────────────────────────────────────────────
// Fed the same reserve facts, the two kernels must report the same coverage ratio.
function pB1() {
  const c = checker();
  for (const sc of POSITIVE_SCENARIOS) {
    const a = art06(asArt06(sc)).output_payload;
    const b = art582(asArt582(sc)).output_payload;
    c.check(near(a.coverage_ratio_pct, b.coverage_ratio_pct, 0.0001), {
      property: 'P-B1', scenario: sc,
      art06_coverage_ratio_pct: a.coverage_ratio_pct,
      art582_coverage_ratio_pct: b.coverage_ratio_pct,
      why: 'two kernels computed different coverage ratios from identical reserve facts',
    });
  }
  return c.result();
}

// ── P-B2 ────────────────────────────────────────────────────────────────────
// Fed the same reserve facts, the two kernels must not contradict each other on
// whether the 1:1 requirement is met. One saying MET while the other records a
// coverage shortfall is a contradiction no caller can reconcile.
function pB2() {
  const c = checker();
  for (const sc of POSITIVE_SCENARIOS) {
    const a = art06(asArt06(sc)).output_payload;
    const b = art582(asArt582(sc)).output_payload;
    const aNotMet = art06CoverageNotMet(a);
    const bVerdict = (b.requirement_verdicts || [])
      .find((r) => r.requirement === 'coverage_arithmetic_1to1');
    const bNotMet = bVerdict && bVerdict.verdict === 'NOT_MET';
    c.check(aNotMet === bNotMet, {
      property: 'P-B2', scenario: sc,
      art06_coverage_shortfall_recorded: aNotMet,
      art582_coverage_verdict: bVerdict && bVerdict.verdict,
      why: 'one kernel found the 1:1 coverage requirement met and the other did not, on identical facts',
    });
  }
  return c.result();
}

// ── P-B3 ────────────────────────────────────────────────────────────────────
// With no tokens outstanding the coverage ratio is undefined. Neither kernel may
// assert a coverage DEFICIENCY on an undefined ratio: a ratio that cannot be computed
// is not a ratio of zero, and reporting it as zero manufactures a finding against an
// issuer about whom nothing was measured.
function pB3() {
  const c = checker();
  for (const sc of DEGENERATE_SCENARIOS) {
    const a = art06(asArt06(sc)).output_payload;
    const b = art582(asArt582(sc)).output_payload;
    const aNotMet = art06CoverageNotMet(a);
    const bVerdict = (b.requirement_verdicts || [])
      .find((r) => r.requirement === 'coverage_arithmetic_1to1');
    const bNotMet = bVerdict && bVerdict.verdict === 'NOT_MET';
    c.check(aNotMet === bNotMet, {
      property: 'P-B3', scenario: sc,
      art06_coverage_shortfall_recorded: aNotMet,
      art06_coverage_ratio_pct: a.coverage_ratio_pct,
      art582_coverage_verdict: bVerdict && bVerdict.verdict,
      why: 'kernels disagree on whether an uncomputable coverage ratio is a deficiency',
    });
  }
  return c.result();
}

export default defineFamily({
  family: 'B',
  title: 'Stablecoin reserve coverage — art-06 vs art-582 over the same 1:1 arithmetic',
  chains: ['mica-register-crosscheck'],
  kernels: [
    'art-06-genius-act-reserve-attestation',
    'art-582-genius-reserve-disclosure-conformance-monitor',
  ],
  properties: [
    {
      id: 'P-B1-coverage-ratio-agreement',
      statement: 'Fed identical reserve facts, art-06 and art-582 report the same coverage ratio.',
      expect: EXPECT.HOLDS,
      run: pB1,
    },
    {
      id: 'P-B2-coverage-verdict-agreement',
      statement: 'Fed identical reserve facts with tokens outstanding, art-06 and art-582 agree on whether the 1:1 coverage requirement is met.',
      expect: EXPECT.HOLDS,
      run: pB2,
    },
    {
      id: 'P-B3-degenerate-domain-agreement',
      statement: 'With no tokens outstanding the coverage ratio is undefined, and neither kernel asserts a coverage deficiency.',
      // DECLARED BEFORE RUNNING: art-06 collapses an uncomputable ratio to 0 and then
      // tests it against 1, while art-582 returns INDETERMINATE. Expect a violation.
      expect: EXPECT.VIOLATION,
      run: pB3,
    },
  ],
});
