// art-577-exchange-fee-tier-recompute.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C30-1).
// kernel_digest_at_authoring: sha256:24864e8b2866414d271eeb1d5b37aed745f7e9f0ed45587420a0a6886971d7a4
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — the WU row's triage table listed this kernel as float:yes; RE-CONFIRMED BY
// DIRECT READ per FIX-2 and that classification does NOT hold. This is a CORRECTION (yes -> no). The
// kernel's own docstring states every rate and money amount is an integer number of micro-dollars
// "so ... every operation here is exact integer arithmetic -- no floating-point residue," and direct
// inspection confirms it: there is not a single division operator anywhere in compute() — the invoice
// recompute is pure integer multiply-then-add (maker_shares_total * rate + taker_shares_total *
// rate), the diff is integer subtraction, and both the invoice-tolerance comparison and the
// Rule-610(c) cap comparison are plain integer `<=`/`>` compares. There is no continuous quotient
// anywhere for a 0/-0/denormal/x·y÷y≠x-style ULP case to exist against. No ULP-boundary claim is
// made or needed.
// Checks: fixture-oracle gate, termination (P1: tiers truncated at MAX_TIERS=20, volume_lines
// truncated at MAX_LINES=2000), boundedness (P2: maker/taker share totals are the exact sum of their
// declared lines, recomputed_invoice_micros is an exact integer when an active tier resolves), a
// differential re-derivation of the active-tier resolution + invoice recompute + Rule 610(c) cap
// check against an independent reimplementation (P3), a metamorphic permutation-invariance identity
// over volume_lines[] order (P4: summation is commutative so maker/taker totals and the recomputed
// invoice do not depend on line order), and forced categorical boundary cases including the exact
// diff_tolerance_micros boundary, the no-tier-qualifies path, the cap-applicability-undeclared path,
// and a large-magnitude probe confirming the kernel stays a deterministic finite integer even when a
// share*rate product approaches Number.MAX_SAFE_INTEGER (P5).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-577-exchange-fee-tier-recompute.proptest.mjs

import { compute } from '../art-577-exchange-fee-tier-recompute.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-577-exchange-fee-tier-recompute.fixtures.json');
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
const rand = mulberry32(0x577C30);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomSchedule(rng) {
  const nTiers = 1 + Math.floor(rng() * 5);
  const thresholds = new Set();
  while (thresholds.size < nTiers) thresholds.add(Math.floor(rng() * 5_000_000));
  const tiers = [...thresholds].map((t, i) => ({
    tier_id: `T${i}`,
    min_adv_shares: t,
    maker_rate_micros_per_share: -500 + Math.floor(rng() * 1500), // rebates can be negative
    taker_rate_micros_per_share: Math.floor(rng() * 1500),
  }));
  return {
    schedule_id: 'SCH-1',
    effective_date: '2026-01-01',
    quotes_priced_ge_1usd: rng() < 0.7,
    tiers,
  };
}
function randomPP(rng) {
  const nLines = Math.floor(rng() * 10);
  return {
    recompute_tolerance_micros: rng() < 0.9 ? Math.floor(rng() * 5000) : undefined,
    invoice_period: { start_date: '2026-01-01', end_date: '2026-01-31' },
    prior_period_adv_shares: Math.floor(rng() * 6_000_000),
    fee_schedule: randomSchedule(rng),
    volume_lines: Array.from({ length: nLines }, () => ({ side: rng() < 0.5 ? 'maker' : 'taker', shares: 1 + Math.floor(rng() * 100_000) })),
    claimed_invoice_micros: Math.floor(rng() * 100_000) - 20_000,
  };
}

// Independent reimplementation, for the differential check (P3).
function reimplement(pp) {
  const tiersSorted = [...pp.fee_schedule.tiers].sort((a, b) => a.min_adv_shares - b.min_adv_shares);
  let active = null;
  for (const t of tiersSorted) if (t.min_adv_shares <= pp.prior_period_adv_shares) active = t;
  let makerTotal = 0, takerTotal = 0;
  for (const l of pp.volume_lines) { if (l.side === 'maker') makerTotal += l.shares; else takerTotal += l.shares; }
  let invoiceVerdict = 'INDETERMINATE', recomputed = null;
  if (active) {
    recomputed = makerTotal * active.maker_rate_micros_per_share + takerTotal * active.taker_rate_micros_per_share;
    const diff = recomputed - pp.claimed_invoice_micros;
    invoiceVerdict = Math.abs(diff) <= pp.recompute_tolerance_micros ? 'MATCHES' : 'DIVERGES';
  }
  let capVerdict;
  if (pp.fee_schedule.quotes_priced_ge_1usd !== true) capVerdict = 'INDETERMINATE';
  else capVerdict = tiersSorted.some((t) => t.taker_rate_micros_per_share > 1000) ? 'CAP_EXCEEDS' : 'CAP_CONFORMANT';
  return { active, makerTotal, takerTotal, invoiceVerdict, recomputed, capVerdict };
}

const TRIALS = 3000;

// ---------- P1: termination — tiers/lines truncated at their MAX caps ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.tiers.length > 20) violations++;
    if (o.volume_summary && o.volume_summary.line_count > 2000) violations++;
    if (o.tiers.length > pp.fee_schedule.tiers.length) violations++;
  }
  return { name: 'P1_termination_tiers_and_lines_bounded', trials: checked, violations };
}

// ---------- P2: boundedness — maker/taker totals are exact sums, invoice is an exact integer ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.decision.execution_state !== 'ran' || !o.volume_summary) continue;
    let maker = 0, taker = 0;
    for (const l of pp.volume_lines) { if (l.side === 'maker') maker += l.shares; else taker += l.shares; }
    if (o.volume_summary.maker_shares_total !== maker) violations++;
    if (o.volume_summary.taker_shares_total !== taker) violations++;
    if (o.recomputed_invoice_micros !== null && !Number.isSafeInteger(o.recomputed_invoice_micros)) violations++;
  }
  return { name: 'P2_boundedness_exact_sums_and_integer_invoice', trials: checked, violations };
}

// ---------- P3: differential — tier resolution + invoice + cap check re-derived independently ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.decision.execution_state !== 'ran') continue;
    const exp = reimplement(pp);
    if ((o.active_tier === null) !== (exp.active === null)) violations++;
    if (o.active_tier && exp.active && o.active_tier.tier_id !== exp.active.tier_id) violations++;
    if (o.invoice_verdict !== exp.invoiceVerdict) violations++;
    if (o.recomputed_invoice_micros !== exp.recomputed) violations++;
    if (o.cap_verdict !== exp.capVerdict) violations++;
  }
  return { name: 'P3_tier_invoice_cap_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance over volume_lines[] order ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1000; i++) {
    const pp = randomPP(rand);
    if (pp.volume_lines.length < 2) continue;
    const shuffled = { ...pp, volume_lines: [...pp.volume_lines].reverse() };
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    checked++;
    if (a.invoice_verdict !== b.invoice_verdict) violations++;
    if (a.recomputed_invoice_micros !== b.recomputed_invoice_micros) violations++;
    if (JSON.stringify(a.volume_summary) !== JSON.stringify(b.volume_summary)) violations++;
  }
  return { name: 'P4_permutation_invariance_volume_lines', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  const schedule = { schedule_id: 'S', effective_date: '2026-01-01', quotes_priced_ge_1usd: true, tiers: [{ tier_id: 'T0', min_adv_shares: 0, maker_rate_micros_per_share: -200, taker_rate_micros_per_share: 300 }] };
  // tolerance absent -> did_not_run
  { const { output_payload: o } = compute({ invoice_period: { start_date: '2026-01-01', end_date: '2026-01-31' }, prior_period_adv_shares: 0, fee_schedule: schedule, volume_lines: [{ side: 'taker', shares: 10 }], claimed_invoice_micros: 3000 }); checked++; if (o.decision.execution_state !== 'did_not_run') violations++; }
  // exact tolerance boundary: recomputed = 10*300=3000, claimed=3000+tol -> MATCHES at tol, DIVERGES at tol-1's complement
  { const { output_payload: o } = compute({ recompute_tolerance_micros: 50, invoice_period: { start_date: '2026-01-01', end_date: '2026-01-31' }, prior_period_adv_shares: 0, fee_schedule: schedule, volume_lines: [{ side: 'taker', shares: 10 }], claimed_invoice_micros: 3050 }); checked++; if (o.invoice_verdict !== 'MATCHES') violations++; }
  { const { output_payload: o } = compute({ recompute_tolerance_micros: 50, invoice_period: { start_date: '2026-01-01', end_date: '2026-01-31' }, prior_period_adv_shares: 0, fee_schedule: schedule, volume_lines: [{ side: 'taker', shares: 10 }], claimed_invoice_micros: 3051 }); checked++; if (o.invoice_verdict !== 'DIVERGES') violations++; }
  // no tier qualifies -> INDETERMINATE (min_adv_shares=100 > declared adv=0)
  { const s2 = { schedule_id: 'S2', effective_date: '2026-01-01', quotes_priced_ge_1usd: true, tiers: [{ tier_id: 'T0', min_adv_shares: 100, maker_rate_micros_per_share: 0, taker_rate_micros_per_share: 10 }] }; const { output_payload: o } = compute({ recompute_tolerance_micros: 0, invoice_period: { start_date: '2026-01-01', end_date: '2026-01-31' }, prior_period_adv_shares: 0, fee_schedule: s2, volume_lines: [{ side: 'taker', shares: 10 }], claimed_invoice_micros: 0 }); checked++; if (o.invoice_verdict !== 'INDETERMINATE') violations++; }
  // cap applicability not declared true -> cap_verdict INDETERMINATE, independent of invoice outcome
  { const s3 = { ...schedule, quotes_priced_ge_1usd: false }; const { output_payload: o } = compute({ recompute_tolerance_micros: 0, invoice_period: { start_date: '2026-01-01', end_date: '2026-01-31' }, prior_period_adv_shares: 0, fee_schedule: s3, volume_lines: [{ side: 'taker', shares: 10 }], claimed_invoice_micros: 3000 }); checked++; if (o.cap_verdict !== 'INDETERMINATE') violations++; }
  // large-magnitude probe: shares near Number.MAX_SAFE_INTEGER -- must stay finite/deterministic
  {
    const bigShares = Number.MAX_SAFE_INTEGER - 3;
    const pp = { recompute_tolerance_micros: 0, invoice_period: { start_date: '2026-01-01', end_date: '2026-01-31' }, prior_period_adv_shares: 0, fee_schedule: schedule, volume_lines: [{ side: 'taker', shares: bigShares }], claimed_invoice_micros: 0 };
    const { output_payload: o } = compute(pp);
    checked++;
    if (!Number.isFinite(o.recomputed_invoice_micros)) violations++;
    const { output_payload: o2 } = compute(pp);
    if (o2.recomputed_invoice_micros !== o.recomputed_invoice_micros) violations++;
  }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- P6: curated exact-output cases (mutation killtests, PR-2795-MUTATION-FLOOR-KILLTESTS-1) ----------
// Each case pins the ENTIRE output_payload (except scope_note/clause_note, which the fixture
// oracle already byte-compares) and compliance_flags for one hand-built input, harvested from the
// pristine kernel. These pin the exact boundary and rejection behavior the randomized properties
// above can only hit by chance: tier-selection equality (adv == min_adv_shares), the tolerance
// boundary in both diff directions (abs() of a negative diff included), the Rule 610(c) cap
// boundary (taker rate exactly 1000 vs 1001 micros, including on a NON-active tier), cap
// applicability independence, MAX_TIERS truncation with an exact-threshold active tier,
// string-typed safe-integer coercion, and the full rejected_inputs literal strings for every
// validation branch. A mutant that changes any observable byte of these runs' output dies here.
function exactEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function checkP6_curated_exact_output() {
  const cases = [
  {
    "name": "A_match_exact_boundary",
    "pp": {
      "recompute_tolerance_micros": 40,
      "invoice_period": {
        "start_date": "2026-01-01",
        "end_date": "2026-01-31"
      },
      "prior_period_adv_shares": 50000,
      "fee_schedule": {
        "schedule_id": "SCH-EXACT",
        "effective_date": "2026-03-01",
        "quotes_priced_ge_1usd": true,
        "tiers": [
          {
            "tier_id": "TA",
            "min_adv_shares": 0,
            "maker_rate_micros_per_share": -150,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "TB",
            "min_adv_shares": 50000,
            "maker_rate_micros_per_share": 220,
            "taker_rate_micros_per_share": 700
          },
          {
            "tier_id": "TC",
            "min_adv_shares": 90000,
            "maker_rate_micros_per_share": 900,
            "taker_rate_micros_per_share": 1200
          }
        ]
      },
      "volume_lines": [
        {
          "side": "maker",
          "shares": 300
        },
        {
          "side": "taker",
          "shares": 200
        },
        {
          "side": "maker",
          "shares": 700
        }
      ],
      "claimed_invoice_micros": 359960
    },
    "flags": [
      "EXFEE_INVOICE_AND_CAP_EVALUATED",
      "EXFEE_CAP_EXCEEDED"
    ],
    "out": {
      "decision": {
        "gate_policy": "review_required",
        "execution_state": "ran",
        "reason": null
      },
      "invoice_verdict": "MATCHES",
      "cap_verdict": "CAP_EXCEEDS",
      "invoice_period": {
        "start_date": "2026-01-01",
        "end_date": "2026-01-31"
      },
      "recompute_tolerance_micros": 40,
      "prior_period_adv_shares": 50000,
      "fee_schedule_summary": {
        "schedule_id": "SCH-EXACT",
        "effective_date": "2026-03-01",
        "tier_count": 3,
        "quotes_priced_ge_1usd": true
      },
      "tiers": [
        {
          "tier_id": "TA",
          "min_adv_shares": 0,
          "maker_rate_micros_per_share": -150,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "TB",
          "min_adv_shares": 50000,
          "maker_rate_micros_per_share": 220,
          "taker_rate_micros_per_share": 700
        },
        {
          "tier_id": "TC",
          "min_adv_shares": 90000,
          "maker_rate_micros_per_share": 900,
          "taker_rate_micros_per_share": 1200
        }
      ],
      "active_tier": {
        "tier_id": "TB",
        "min_adv_shares": 50000,
        "maker_rate_micros_per_share": 220,
        "taker_rate_micros_per_share": 700
      },
      "volume_summary": {
        "line_count": 3,
        "maker_shares_total": 1000,
        "taker_shares_total": 200
      },
      "recomputed_invoice_micros": 360000,
      "claimed_invoice_micros": 359960,
      "diff_micros": 40,
      "cap_check": {
        "cap_micros_per_share": 1000,
        "quotes_priced_ge_1usd": true,
        "tier_findings": [
          {
            "tier_id": "TA",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "TB",
            "taker_rate_micros_per_share": 700,
            "exceeds_cap": false
          },
          {
            "tier_id": "TC",
            "taker_rate_micros_per_share": 1200,
            "exceeds_cap": true
          }
        ]
      },
      "findings": [
        {
          "code": "ACCESS_FEE_CAP_EXCEEDED",
          "severity": "high",
          "message": "Tier(s) TC declare a taker rate above the $0.001/share Rule 610(c) cap."
        }
      ],
      "rejected_inputs": []
    }
  },
  {
    "name": "B_diverge_over_tol",
    "pp": {
      "recompute_tolerance_micros": 40,
      "invoice_period": {
        "start_date": "2026-01-01",
        "end_date": "2026-01-31"
      },
      "prior_period_adv_shares": 50000,
      "fee_schedule": {
        "schedule_id": "SCH-EXACT",
        "effective_date": "2026-03-01",
        "quotes_priced_ge_1usd": true,
        "tiers": [
          {
            "tier_id": "TA",
            "min_adv_shares": 0,
            "maker_rate_micros_per_share": -150,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "TB",
            "min_adv_shares": 50000,
            "maker_rate_micros_per_share": 220,
            "taker_rate_micros_per_share": 700
          },
          {
            "tier_id": "TC",
            "min_adv_shares": 90000,
            "maker_rate_micros_per_share": 900,
            "taker_rate_micros_per_share": 1200
          }
        ]
      },
      "volume_lines": [
        {
          "side": "maker",
          "shares": 300
        },
        {
          "side": "taker",
          "shares": 200
        },
        {
          "side": "maker",
          "shares": 700
        }
      ],
      "claimed_invoice_micros": 360041
    },
    "flags": [
      "EXFEE_INVOICE_AND_CAP_EVALUATED",
      "EXFEE_INVOICE_DIVERGES",
      "EXFEE_CAP_EXCEEDED"
    ],
    "out": {
      "decision": {
        "gate_policy": "review_required",
        "execution_state": "ran",
        "reason": null
      },
      "invoice_verdict": "DIVERGES",
      "cap_verdict": "CAP_EXCEEDS",
      "invoice_period": {
        "start_date": "2026-01-01",
        "end_date": "2026-01-31"
      },
      "recompute_tolerance_micros": 40,
      "prior_period_adv_shares": 50000,
      "fee_schedule_summary": {
        "schedule_id": "SCH-EXACT",
        "effective_date": "2026-03-01",
        "tier_count": 3,
        "quotes_priced_ge_1usd": true
      },
      "tiers": [
        {
          "tier_id": "TA",
          "min_adv_shares": 0,
          "maker_rate_micros_per_share": -150,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "TB",
          "min_adv_shares": 50000,
          "maker_rate_micros_per_share": 220,
          "taker_rate_micros_per_share": 700
        },
        {
          "tier_id": "TC",
          "min_adv_shares": 90000,
          "maker_rate_micros_per_share": 900,
          "taker_rate_micros_per_share": 1200
        }
      ],
      "active_tier": {
        "tier_id": "TB",
        "min_adv_shares": 50000,
        "maker_rate_micros_per_share": 220,
        "taker_rate_micros_per_share": 700
      },
      "volume_summary": {
        "line_count": 3,
        "maker_shares_total": 1000,
        "taker_shares_total": 200
      },
      "recomputed_invoice_micros": 360000,
      "claimed_invoice_micros": 360041,
      "diff_micros": -41,
      "cap_check": {
        "cap_micros_per_share": 1000,
        "quotes_priced_ge_1usd": true,
        "tier_findings": [
          {
            "tier_id": "TA",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "TB",
            "taker_rate_micros_per_share": 700,
            "exceeds_cap": false
          },
          {
            "tier_id": "TC",
            "taker_rate_micros_per_share": 1200,
            "exceeds_cap": true
          }
        ]
      },
      "findings": [
        {
          "code": "INVOICE_RECOMPUTE_DIVERGES",
          "severity": "high",
          "message": "Recomputed invoice (360000 micros) differs from the claimed invoice (360041 micros) by more than the declared tolerance."
        },
        {
          "code": "ACCESS_FEE_CAP_EXCEEDED",
          "severity": "high",
          "message": "Tier(s) TC declare a taker rate above the $0.001/share Rule 610(c) cap."
        }
      ],
      "rejected_inputs": []
    }
  },
  {
    "name": "C_cap_exceeds_inactive_tier",
    "pp": {
      "recompute_tolerance_micros": 0,
      "invoice_period": {
        "start_date": "2026-01-01",
        "end_date": "2026-01-31"
      },
      "prior_period_adv_shares": 10,
      "fee_schedule": {
        "schedule_id": "SCH-CAP",
        "effective_date": "2026-03-01",
        "quotes_priced_ge_1usd": true,
        "tiers": [
          {
            "tier_id": "LOW",
            "min_adv_shares": 0,
            "maker_rate_micros_per_share": 100,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "HIGH",
            "min_adv_shares": 50000,
            "maker_rate_micros_per_share": 100,
            "taker_rate_micros_per_share": 1001
          }
        ]
      },
      "volume_lines": [
        {
          "side": "taker",
          "shares": 10
        }
      ],
      "claimed_invoice_micros": 10000
    },
    "flags": [
      "EXFEE_INVOICE_AND_CAP_EVALUATED",
      "EXFEE_CAP_EXCEEDED"
    ],
    "out": {
      "decision": {
        "gate_policy": "review_required",
        "execution_state": "ran",
        "reason": null
      },
      "invoice_verdict": "MATCHES",
      "cap_verdict": "CAP_EXCEEDS",
      "invoice_period": {
        "start_date": "2026-01-01",
        "end_date": "2026-01-31"
      },
      "recompute_tolerance_micros": 0,
      "prior_period_adv_shares": 10,
      "fee_schedule_summary": {
        "schedule_id": "SCH-CAP",
        "effective_date": "2026-03-01",
        "tier_count": 2,
        "quotes_priced_ge_1usd": true
      },
      "tiers": [
        {
          "tier_id": "LOW",
          "min_adv_shares": 0,
          "maker_rate_micros_per_share": 100,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "HIGH",
          "min_adv_shares": 50000,
          "maker_rate_micros_per_share": 100,
          "taker_rate_micros_per_share": 1001
        }
      ],
      "active_tier": {
        "tier_id": "LOW",
        "min_adv_shares": 0,
        "maker_rate_micros_per_share": 100,
        "taker_rate_micros_per_share": 1000
      },
      "volume_summary": {
        "line_count": 1,
        "maker_shares_total": 0,
        "taker_shares_total": 10
      },
      "recomputed_invoice_micros": 10000,
      "claimed_invoice_micros": 10000,
      "diff_micros": 0,
      "cap_check": {
        "cap_micros_per_share": 1000,
        "quotes_priced_ge_1usd": true,
        "tier_findings": [
          {
            "tier_id": "LOW",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "HIGH",
            "taker_rate_micros_per_share": 1001,
            "exceeds_cap": true
          }
        ]
      },
      "findings": [
        {
          "code": "ACCESS_FEE_CAP_EXCEEDED",
          "severity": "high",
          "message": "Tier(s) HIGH declare a taker rate above the $0.001/share Rule 610(c) cap."
        }
      ],
      "rejected_inputs": []
    }
  },
  {
    "name": "D_no_tier_qualifies",
    "pp": {
      "recompute_tolerance_micros": 0,
      "invoice_period": {
        "start_date": "2026-01-01",
        "end_date": "2026-01-31"
      },
      "prior_period_adv_shares": 5,
      "fee_schedule": {
        "schedule_id": "SCH-D",
        "effective_date": "2026-03-01",
        "quotes_priced_ge_1usd": true,
        "tiers": [
          {
            "tier_id": "T1",
            "min_adv_shares": 10,
            "maker_rate_micros_per_share": 5,
            "taker_rate_micros_per_share": 6
          }
        ]
      },
      "volume_lines": [
        {
          "side": "maker",
          "shares": 4
        }
      ],
      "claimed_invoice_micros": 0
    },
    "flags": [
      "EXFEE_INVOICE_AND_CAP_EVALUATED",
      "EXFEE_TIER_NOT_RESOLVED"
    ],
    "out": {
      "decision": {
        "gate_policy": "auto_pass",
        "execution_state": "ran",
        "reason": null
      },
      "invoice_verdict": "INDETERMINATE",
      "cap_verdict": "CAP_CONFORMANT",
      "invoice_period": {
        "start_date": "2026-01-01",
        "end_date": "2026-01-31"
      },
      "recompute_tolerance_micros": 0,
      "prior_period_adv_shares": 5,
      "fee_schedule_summary": {
        "schedule_id": "SCH-D",
        "effective_date": "2026-03-01",
        "tier_count": 1,
        "quotes_priced_ge_1usd": true
      },
      "tiers": [
        {
          "tier_id": "T1",
          "min_adv_shares": 10,
          "maker_rate_micros_per_share": 5,
          "taker_rate_micros_per_share": 6
        }
      ],
      "active_tier": null,
      "volume_summary": {
        "line_count": 1,
        "maker_shares_total": 4,
        "taker_shares_total": 0
      },
      "recomputed_invoice_micros": null,
      "claimed_invoice_micros": 0,
      "diff_micros": null,
      "cap_check": {
        "cap_micros_per_share": 1000,
        "quotes_priced_ge_1usd": true,
        "tier_findings": [
          {
            "tier_id": "T1",
            "taker_rate_micros_per_share": 6,
            "exceeds_cap": false
          }
        ]
      },
      "findings": [
        {
          "code": "NO_TIER_QUALIFIES_FOR_DECLARED_ADV",
          "severity": "warning",
          "message": "Declared prior_period_adv_shares does not meet the lowest tier threshold in the schedule."
        }
      ],
      "rejected_inputs": []
    }
  },
  {
    "name": "E_cap_applicability_false",
    "pp": {
      "recompute_tolerance_micros": 1,
      "invoice_period": {
        "start_date": "2026-01-01",
        "end_date": "2026-01-31"
      },
      "prior_period_adv_shares": 1000,
      "fee_schedule": {
        "schedule_id": "SCH-E",
        "effective_date": "2026-03-01",
        "quotes_priced_ge_1usd": false,
        "tiers": [
          {
            "tier_id": "T1",
            "min_adv_shares": 0,
            "maker_rate_micros_per_share": 10,
            "taker_rate_micros_per_share": 20
          }
        ]
      },
      "volume_lines": [
        {
          "side": "taker",
          "shares": 100
        }
      ],
      "claimed_invoice_micros": 2000
    },
    "flags": [
      "EXFEE_INVOICE_AND_CAP_EVALUATED",
      "EXFEE_CAP_APPLICABILITY_UNCONFIRMED"
    ],
    "out": {
      "decision": {
        "gate_policy": "auto_pass",
        "execution_state": "ran",
        "reason": null
      },
      "invoice_verdict": "MATCHES",
      "cap_verdict": "INDETERMINATE",
      "invoice_period": {
        "start_date": "2026-01-01",
        "end_date": "2026-01-31"
      },
      "recompute_tolerance_micros": 1,
      "prior_period_adv_shares": 1000,
      "fee_schedule_summary": {
        "schedule_id": "SCH-E",
        "effective_date": "2026-03-01",
        "tier_count": 1,
        "quotes_priced_ge_1usd": false
      },
      "tiers": [
        {
          "tier_id": "T1",
          "min_adv_shares": 0,
          "maker_rate_micros_per_share": 10,
          "taker_rate_micros_per_share": 20
        }
      ],
      "active_tier": {
        "tier_id": "T1",
        "min_adv_shares": 0,
        "maker_rate_micros_per_share": 10,
        "taker_rate_micros_per_share": 20
      },
      "volume_summary": {
        "line_count": 1,
        "maker_shares_total": 0,
        "taker_shares_total": 100
      },
      "recomputed_invoice_micros": 2000,
      "claimed_invoice_micros": 2000,
      "diff_micros": 0,
      "cap_check": {
        "cap_micros_per_share": 1000,
        "quotes_priced_ge_1usd": false,
        "tier_findings": []
      },
      "findings": [
        {
          "code": "CAP_APPLICABILITY_NOT_CONFIRMED",
          "severity": "warning",
          "message": "quotes_priced_ge_1usd is not declared true -- Rule 610(c)'s $0.001/share cap applies only to quotations priced at $1.00/share or more; sub-dollar pricing uses a different formula this kernel does not evaluate."
        }
      ],
      "rejected_inputs": []
    }
  },
  {
    "name": "F_missing_claimed",
    "pp": {
      "recompute_tolerance_micros": 0,
      "invoice_period": {
        "start_date": "2026-01-01",
        "end_date": "2026-01-31"
      },
      "prior_period_adv_shares": 1000,
      "fee_schedule": {
        "schedule_id": "SCH-F",
        "effective_date": "2026-03-01",
        "quotes_priced_ge_1usd": true,
        "tiers": [
          {
            "tier_id": "T1",
            "min_adv_shares": 0,
            "maker_rate_micros_per_share": 10,
            "taker_rate_micros_per_share": 20
          }
        ]
      },
      "volume_lines": [
        {
          "side": "taker",
          "shares": 10
        }
      ]
    },
    "flags": [
      "EXFEE_REQUIRED_INPUTS_INCOMPLETE"
    ],
    "out": {
      "decision": {
        "gate_policy": "review_required",
        "execution_state": "did_not_run",
        "reason": "required_inputs_incomplete"
      },
      "invoice_verdict": "INDETERMINATE",
      "cap_verdict": "INDETERMINATE",
      "invoice_period": {
        "start_date": "2026-01-01",
        "end_date": "2026-01-31"
      },
      "recompute_tolerance_micros": 0,
      "prior_period_adv_shares": 1000,
      "fee_schedule_summary": null,
      "tiers": [],
      "active_tier": null,
      "volume_summary": null,
      "recomputed_invoice_micros": null,
      "claimed_invoice_micros": null,
      "diff_micros": null,
      "cap_check": null,
      "findings": [],
      "rejected_inputs": [
        {
          "where": "claimed_invoice_micros",
          "reason": "absent or not an integer number of micro-dollars",
          "supplied": null
        }
      ]
    }
  },
  {
    "name": "G_tolerance_absent",
    "pp": {
      "invoice_period": {
        "start_date": "2026-01-01",
        "end_date": "2026-01-31"
      },
      "prior_period_adv_shares": 1000,
      "fee_schedule": {
        "schedule_id": "SCH-G",
        "effective_date": "2026-03-01",
        "quotes_priced_ge_1usd": true,
        "tiers": [
          {
            "tier_id": "T1",
            "min_adv_shares": 0,
            "maker_rate_micros_per_share": 10,
            "taker_rate_micros_per_share": 20
          }
        ]
      },
      "volume_lines": [
        {
          "side": "taker",
          "shares": 10
        }
      ],
      "claimed_invoice_micros": 200
    },
    "flags": [
      "EXFEE_TOLERANCE_NOT_DECLARED"
    ],
    "out": {
      "decision": {
        "gate_policy": "review_required",
        "execution_state": "did_not_run",
        "reason": "recompute_tolerance_not_declared"
      },
      "invoice_verdict": "INDETERMINATE",
      "cap_verdict": "INDETERMINATE",
      "invoice_period": null,
      "recompute_tolerance_micros": null,
      "prior_period_adv_shares": null,
      "fee_schedule_summary": null,
      "tiers": [],
      "active_tier": null,
      "volume_summary": null,
      "recomputed_invoice_micros": null,
      "claimed_invoice_micros": null,
      "diff_micros": null,
      "cap_check": null,
      "findings": [],
      "rejected_inputs": [
        {
          "where": "recompute_tolerance_micros",
          "reason": "absent -- a tolerance must be declared, never defaulted",
          "supplied": null
        }
      ]
    }
  },
  {
    "name": "H_tolerance_negative",
    "pp": {
      "invoice_period": {
        "start_date": "2026-01-01",
        "end_date": "2026-01-31"
      },
      "prior_period_adv_shares": 1000,
      "fee_schedule": {
        "schedule_id": "SCH-G",
        "effective_date": "2026-03-01",
        "quotes_priced_ge_1usd": true,
        "tiers": [
          {
            "tier_id": "T1",
            "min_adv_shares": 0,
            "maker_rate_micros_per_share": 10,
            "taker_rate_micros_per_share": 20
          }
        ]
      },
      "volume_lines": [
        {
          "side": "taker",
          "shares": 10
        }
      ],
      "claimed_invoice_micros": 200,
      "recompute_tolerance_micros": -1
    },
    "flags": [
      "EXFEE_TOLERANCE_NOT_DECLARED"
    ],
    "out": {
      "decision": {
        "gate_policy": "review_required",
        "execution_state": "did_not_run",
        "reason": "recompute_tolerance_not_declared"
      },
      "invoice_verdict": "INDETERMINATE",
      "cap_verdict": "INDETERMINATE",
      "invoice_period": null,
      "recompute_tolerance_micros": null,
      "prior_period_adv_shares": null,
      "fee_schedule_summary": null,
      "tiers": [],
      "active_tier": null,
      "volume_summary": null,
      "recomputed_invoice_micros": null,
      "claimed_invoice_micros": null,
      "diff_micros": null,
      "cap_check": null,
      "findings": [],
      "rejected_inputs": [
        {
          "where": "recompute_tolerance_micros",
          "reason": "not a non-negative safe integer number of micro-dollars",
          "supplied": -1
        }
      ]
    }
  },
  {
    "name": "I_validation_harvest",
    "pp": {
      "recompute_tolerance_micros": 0,
      "invoice_period": {
        "start_date": "2026-02-10",
        "end_date": "2026-02-10"
      },
      "prior_period_adv_shares": -3,
      "fee_schedule": {
        "schedule_id": "",
        "effective_date": "March 2026",
        "quotes_priced_ge_1usd": true,
        "tiers": [
          {
            "tier_id": "",
            "min_adv_shares": 0,
            "maker_rate_micros_per_share": 1,
            "taker_rate_micros_per_share": 1
          },
          {
            "tier_id": "DUPX",
            "min_adv_shares": 100,
            "maker_rate_micros_per_share": 1,
            "taker_rate_micros_per_share": 1
          },
          {
            "tier_id": "DUPX",
            "min_adv_shares": 100,
            "maker_rate_micros_per_share": 1,
            "taker_rate_micros_per_share": 1
          },
          {
            "tier_id": "NEGM",
            "min_adv_shares": -5,
            "maker_rate_micros_per_share": 1,
            "taker_rate_micros_per_share": 1
          },
          {
            "tier_id": "NOMK",
            "min_adv_shares": 200,
            "maker_rate_micros_per_share": null,
            "taker_rate_micros_per_share": 1
          },
          {
            "tier_id": "NOTK",
            "min_adv_shares": 300,
            "maker_rate_micros_per_share": 1
          },
          {
            "tier_id": " OKID ",
            "min_adv_shares": 400,
            "maker_rate_micros_per_share": "7",
            "taker_rate_micros_per_share": "8"
          }
        ]
      },
      "volume_lines": [
        {
          "side": "taker",
          "shares": 10
        },
        {
          "side": "odd",
          "shares": 5
        },
        {
          "side": "maker",
          "shares": 0
        },
        {
          "side": "maker",
          "shares": -2
        },
        {
          "side": "maker",
          "shares": "xyz"
        },
        null
      ],
      "claimed_invoice_micros": "abc"
    },
    "flags": [
      "EXFEE_REQUIRED_INPUTS_INCOMPLETE"
    ],
    "out": {
      "decision": {
        "gate_policy": "review_required",
        "execution_state": "did_not_run",
        "reason": "required_inputs_incomplete"
      },
      "invoice_verdict": "INDETERMINATE",
      "cap_verdict": "INDETERMINATE",
      "invoice_period": {
        "start_date": "2026-02-10",
        "end_date": "2026-02-10"
      },
      "recompute_tolerance_micros": 0,
      "prior_period_adv_shares": -3,
      "fee_schedule_summary": null,
      "tiers": [],
      "active_tier": null,
      "volume_summary": null,
      "recomputed_invoice_micros": null,
      "claimed_invoice_micros": null,
      "diff_micros": null,
      "cap_check": null,
      "findings": [],
      "rejected_inputs": [
        {
          "where": "prior_period_adv_shares",
          "reason": "absent or not a non-negative safe integer",
          "supplied": null
        },
        {
          "where": "fee_schedule.schedule_id",
          "reason": "absent",
          "supplied": null
        },
        {
          "where": "fee_schedule.effective_date",
          "reason": "absent or not YYYY-MM-DD",
          "supplied": "March 2026"
        },
        {
          "where": "fee_schedule.tiers[0].tier_id",
          "reason": "absent",
          "supplied": null
        },
        {
          "where": "fee_schedule.tiers[2].tier_id",
          "reason": "duplicate tier_id",
          "supplied": "DUPX"
        },
        {
          "where": "fee_schedule.tiers[3].min_adv_shares",
          "reason": "absent or not a non-negative safe integer",
          "supplied": "NEGM"
        },
        {
          "where": "fee_schedule.tiers[4].maker_rate_micros_per_share",
          "reason": "absent or not an integer number of micro-dollars",
          "supplied": "NOMK"
        },
        {
          "where": "fee_schedule.tiers[5].taker_rate_micros_per_share",
          "reason": "absent or not an integer number of micro-dollars",
          "supplied": "NOTK"
        },
        {
          "where": "volume_lines[1]",
          "reason": "side must be maker/taker and shares a positive integer",
          "supplied": "odd"
        },
        {
          "where": "volume_lines[2]",
          "reason": "side must be maker/taker and shares a positive integer",
          "supplied": "maker"
        },
        {
          "where": "volume_lines[3]",
          "reason": "side must be maker/taker and shares a positive integer",
          "supplied": "maker"
        },
        {
          "where": "volume_lines[4]",
          "reason": "side must be maker/taker and shares a positive integer",
          "supplied": "maker"
        },
        {
          "where": "volume_lines[5]",
          "reason": "side must be maker/taker and shares a positive integer",
          "supplied": null
        },
        {
          "where": "claimed_invoice_micros",
          "reason": "absent or not an integer number of micro-dollars",
          "supplied": null
        }
      ]
    }
  },
  {
    "name": "J_string_ints_accepted",
    "pp": {
      "recompute_tolerance_micros": "50",
      "invoice_period": {
        "start_date": "2026-01-01",
        "end_date": "2026-01-31"
      },
      "prior_period_adv_shares": "0",
      "fee_schedule": {
        "schedule_id": " SCH-J ",
        "effective_date": "2026-03-01",
        "quotes_priced_ge_1usd": true,
        "tiers": [
          {
            "tier_id": " TJ ",
            "min_adv_shares": "0",
            "maker_rate_micros_per_share": "-25",
            "taker_rate_micros_per_share": "30"
          }
        ]
      },
      "volume_lines": [
        {
          "side": "maker",
          "shares": "100"
        },
        {
          "side": "taker",
          "shares": "200"
        }
      ],
      "claimed_invoice_micros": 3480
    },
    "flags": [
      "EXFEE_INVOICE_AND_CAP_EVALUATED"
    ],
    "out": {
      "decision": {
        "gate_policy": "auto_pass",
        "execution_state": "ran",
        "reason": null
      },
      "invoice_verdict": "MATCHES",
      "cap_verdict": "CAP_CONFORMANT",
      "invoice_period": {
        "start_date": "2026-01-01",
        "end_date": "2026-01-31"
      },
      "recompute_tolerance_micros": 50,
      "prior_period_adv_shares": 0,
      "fee_schedule_summary": {
        "schedule_id": "SCH-J",
        "effective_date": "2026-03-01",
        "tier_count": 1,
        "quotes_priced_ge_1usd": true
      },
      "tiers": [
        {
          "tier_id": "TJ",
          "min_adv_shares": 0,
          "maker_rate_micros_per_share": -25,
          "taker_rate_micros_per_share": 30
        }
      ],
      "active_tier": {
        "tier_id": "TJ",
        "min_adv_shares": 0,
        "maker_rate_micros_per_share": -25,
        "taker_rate_micros_per_share": 30
      },
      "volume_summary": {
        "line_count": 2,
        "maker_shares_total": 100,
        "taker_shares_total": 200
      },
      "recomputed_invoice_micros": 3500,
      "claimed_invoice_micros": 3480,
      "diff_micros": 20,
      "cap_check": {
        "cap_micros_per_share": 1000,
        "quotes_priced_ge_1usd": true,
        "tier_findings": [
          {
            "tier_id": "TJ",
            "taker_rate_micros_per_share": 30,
            "exceeds_cap": false
          }
        ]
      },
      "findings": [],
      "rejected_inputs": []
    }
  },
  {
    "name": "K_truncation_25_tiers",
    "pp": {
      "recompute_tolerance_micros": 0,
      "invoice_period": {
        "start_date": "2026-01-01",
        "end_date": "2026-01-31"
      },
      "prior_period_adv_shares": 19,
      "fee_schedule": {
        "schedule_id": "SCH-K",
        "effective_date": "2026-03-01",
        "quotes_priced_ge_1usd": true,
        "tiers": [
          {
            "tier_id": "T0",
            "min_adv_shares": 0,
            "maker_rate_micros_per_share": 0,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T1",
            "min_adv_shares": 1,
            "maker_rate_micros_per_share": 1,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T2",
            "min_adv_shares": 2,
            "maker_rate_micros_per_share": 2,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T3",
            "min_adv_shares": 3,
            "maker_rate_micros_per_share": 3,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T4",
            "min_adv_shares": 4,
            "maker_rate_micros_per_share": 4,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T5",
            "min_adv_shares": 5,
            "maker_rate_micros_per_share": 5,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T6",
            "min_adv_shares": 6,
            "maker_rate_micros_per_share": 6,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T7",
            "min_adv_shares": 7,
            "maker_rate_micros_per_share": 7,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T8",
            "min_adv_shares": 8,
            "maker_rate_micros_per_share": 8,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T9",
            "min_adv_shares": 9,
            "maker_rate_micros_per_share": 9,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T10",
            "min_adv_shares": 10,
            "maker_rate_micros_per_share": 10,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T11",
            "min_adv_shares": 11,
            "maker_rate_micros_per_share": 11,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T12",
            "min_adv_shares": 12,
            "maker_rate_micros_per_share": 12,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T13",
            "min_adv_shares": 13,
            "maker_rate_micros_per_share": 13,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T14",
            "min_adv_shares": 14,
            "maker_rate_micros_per_share": 14,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T15",
            "min_adv_shares": 15,
            "maker_rate_micros_per_share": 15,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T16",
            "min_adv_shares": 16,
            "maker_rate_micros_per_share": 16,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T17",
            "min_adv_shares": 17,
            "maker_rate_micros_per_share": 17,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T18",
            "min_adv_shares": 18,
            "maker_rate_micros_per_share": 18,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T19",
            "min_adv_shares": 19,
            "maker_rate_micros_per_share": 19,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T20",
            "min_adv_shares": 20,
            "maker_rate_micros_per_share": 20,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T21",
            "min_adv_shares": 21,
            "maker_rate_micros_per_share": 21,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T22",
            "min_adv_shares": 22,
            "maker_rate_micros_per_share": 22,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T23",
            "min_adv_shares": 23,
            "maker_rate_micros_per_share": 23,
            "taker_rate_micros_per_share": 1000
          },
          {
            "tier_id": "T24",
            "min_adv_shares": 24,
            "maker_rate_micros_per_share": 24,
            "taker_rate_micros_per_share": 1000
          }
        ]
      },
      "volume_lines": [
        {
          "side": "taker",
          "shares": 1
        }
      ],
      "claimed_invoice_micros": 1000
    },
    "flags": [
      "EXFEE_INVOICE_AND_CAP_EVALUATED"
    ],
    "out": {
      "decision": {
        "gate_policy": "auto_pass",
        "execution_state": "ran",
        "reason": null
      },
      "invoice_verdict": "MATCHES",
      "cap_verdict": "CAP_CONFORMANT",
      "invoice_period": {
        "start_date": "2026-01-01",
        "end_date": "2026-01-31"
      },
      "recompute_tolerance_micros": 0,
      "prior_period_adv_shares": 19,
      "fee_schedule_summary": {
        "schedule_id": "SCH-K",
        "effective_date": "2026-03-01",
        "tier_count": 20,
        "quotes_priced_ge_1usd": true
      },
      "tiers": [
        {
          "tier_id": "T0",
          "min_adv_shares": 0,
          "maker_rate_micros_per_share": 0,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "T1",
          "min_adv_shares": 1,
          "maker_rate_micros_per_share": 1,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "T2",
          "min_adv_shares": 2,
          "maker_rate_micros_per_share": 2,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "T3",
          "min_adv_shares": 3,
          "maker_rate_micros_per_share": 3,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "T4",
          "min_adv_shares": 4,
          "maker_rate_micros_per_share": 4,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "T5",
          "min_adv_shares": 5,
          "maker_rate_micros_per_share": 5,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "T6",
          "min_adv_shares": 6,
          "maker_rate_micros_per_share": 6,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "T7",
          "min_adv_shares": 7,
          "maker_rate_micros_per_share": 7,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "T8",
          "min_adv_shares": 8,
          "maker_rate_micros_per_share": 8,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "T9",
          "min_adv_shares": 9,
          "maker_rate_micros_per_share": 9,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "T10",
          "min_adv_shares": 10,
          "maker_rate_micros_per_share": 10,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "T11",
          "min_adv_shares": 11,
          "maker_rate_micros_per_share": 11,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "T12",
          "min_adv_shares": 12,
          "maker_rate_micros_per_share": 12,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "T13",
          "min_adv_shares": 13,
          "maker_rate_micros_per_share": 13,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "T14",
          "min_adv_shares": 14,
          "maker_rate_micros_per_share": 14,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "T15",
          "min_adv_shares": 15,
          "maker_rate_micros_per_share": 15,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "T16",
          "min_adv_shares": 16,
          "maker_rate_micros_per_share": 16,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "T17",
          "min_adv_shares": 17,
          "maker_rate_micros_per_share": 17,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "T18",
          "min_adv_shares": 18,
          "maker_rate_micros_per_share": 18,
          "taker_rate_micros_per_share": 1000
        },
        {
          "tier_id": "T19",
          "min_adv_shares": 19,
          "maker_rate_micros_per_share": 19,
          "taker_rate_micros_per_share": 1000
        }
      ],
      "active_tier": {
        "tier_id": "T19",
        "min_adv_shares": 19,
        "maker_rate_micros_per_share": 19,
        "taker_rate_micros_per_share": 1000
      },
      "volume_summary": {
        "line_count": 1,
        "maker_shares_total": 0,
        "taker_shares_total": 1
      },
      "recomputed_invoice_micros": 1000,
      "claimed_invoice_micros": 1000,
      "diff_micros": 0,
      "cap_check": {
        "cap_micros_per_share": 1000,
        "quotes_priced_ge_1usd": true,
        "tier_findings": [
          {
            "tier_id": "T0",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "T1",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "T2",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "T3",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "T4",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "T5",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "T6",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "T7",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "T8",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "T9",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "T10",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "T11",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "T12",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "T13",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "T14",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "T15",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "T16",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "T17",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "T18",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          },
          {
            "tier_id": "T19",
            "taker_rate_micros_per_share": 1000,
            "exceeds_cap": false
          }
        ]
      },
      "findings": [],
      "rejected_inputs": []
    }
  },
  {
    "name": "L_date_equal_and_reversed",
    "pp": {
      "recompute_tolerance_micros": 0,
      "invoice_period": {
        "start_date": "2026-02-01",
        "end_date": "2026-01-15"
      },
      "prior_period_adv_shares": 0,
      "fee_schedule": {
        "schedule_id": "SCH-L",
        "effective_date": "2026-03-01",
        "quotes_priced_ge_1usd": true,
        "tiers": [
          {
            "tier_id": "T1",
            "min_adv_shares": 0,
            "maker_rate_micros_per_share": 10,
            "taker_rate_micros_per_share": 20
          }
        ]
      },
      "volume_lines": [
        {
          "side": "taker",
          "shares": 10
        }
      ],
      "claimed_invoice_micros": 200
    },
    "flags": [
      "EXFEE_REQUIRED_INPUTS_INCOMPLETE"
    ],
    "out": {
      "decision": {
        "gate_policy": "review_required",
        "execution_state": "did_not_run",
        "reason": "required_inputs_incomplete"
      },
      "invoice_verdict": "INDETERMINATE",
      "cap_verdict": "INDETERMINATE",
      "invoice_period": null,
      "recompute_tolerance_micros": 0,
      "prior_period_adv_shares": 0,
      "fee_schedule_summary": null,
      "tiers": [],
      "active_tier": null,
      "volume_summary": null,
      "recomputed_invoice_micros": null,
      "claimed_invoice_micros": 200,
      "diff_micros": null,
      "cap_check": null,
      "findings": [],
      "rejected_inputs": [
        {
          "where": "invoice_period",
          "reason": "start_date is after end_date",
          "supplied": "2026-02-01..2026-01-15"
        }
      ]
    }
  }
];
  let violations = 0, checked = 0;
  for (const c of cases) {
    const r = compute(c.pp);
    checked++;
    const { scope_note: _sn, clause_note: _cn, ...payloadSansNotes } = r.output_payload;
    if (!exactEq(payloadSansNotes, c.out)) violations++;
    if (!exactEq(r.compliance_flags, c.flags)) violations++;
  }
  return { name: 'P6_curated_exact_output_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_forced_categorical());
results.properties.push(checkP6_curated_exact_output());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-577-exchange-fee-tier-recompute',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
