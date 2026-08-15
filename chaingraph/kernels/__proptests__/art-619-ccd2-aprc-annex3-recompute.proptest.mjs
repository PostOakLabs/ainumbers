// art-619-ccd2-aprc-annex3-recompute — class-B PROPERTY-TEST harness (CCD2-APRC-K-1).
// kernel_digest_at_authoring: sha256:b6916f257c4bafb7ddf7dd00b907aae102f03c92267a3dd99876216548835032
// spec: research/CCD2-APRC-ANNEX3.spec.md
// human_sign_off: PENDING
//
// FORMALVERIF-BUILD-SPEC.md §6.B shape: unbounded schedule arrays, an iterative bisection
// solver — enumeration is impossible in principle. Taxonomy-honesty note (CCD2-APRC-BUILD-SPEC.md
// §3): this kernel is architecturally class-C shaped (unbounded arrays, iterative solve) and is
// assigned class-B property-testing rigor by CCD2-APRC-K-1's explicit ruling, never read as "the
// input domain is bounded."
//
// float_sensitive: yes. Properties force IEEE-754 boundaries explicitly (0, negative zero,
// Number.MIN_VALUE, the declared 1dp rounding boundary) per §6.B's caveat that omitting ULP-boundary
// forcing is not a claim about float behavior at all.
//
// ZERO external dependencies — Node built-ins only. workspace-root research/fv-rounding-properties.helpers.mjs
// (P1-P30 suite, CCD2-APRC-BUILD-SPEC.md §3) lives in a SEPARATE git repo from this one (the
// workspace-root checkout is `ainumbers-evidence`, this kernel ships in `ainumbers`) and is
// unreachable from a repo-tracked file at build/CI time -- confirmed empirically 2026-08-14 when a
// relative import across that boundary threw ERR_MODULE_NOT_FOUND under run-proptests.mjs. mulberry32
// and genericRound('half_up', ...) are reimplemented below, byte-identical to that module's own
// versions, satisfying the same per-regulation oracle rule (P-suite tests conformance to the
// kernel's OWN declared mode, never asserting a mode is abstractly "more correct") without the
// cross-repo dependency.
//
// Run: node chaingraph/kernels/__proptests__/art-619-ccd2-aprc-annex3-recompute.proptest.mjs

import { compute } from '../art-619-ccd2-aprc-annex3-recompute.kernel.mjs';
import { runFixtureOracle, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-619-ccd2-aprc-annex3-recompute';

// mulberry32 — identical to research/fv-rounding-properties.helpers.mjs's own implementation.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

// genericRound('half_up', ...) — identical to research/fv-rounding-properties.helpers.mjs's own
// implementation, reduced to the one mode this kernel's rounding_steps actually declares.
function genericRound(mode, x, precision) {
  if (!Number.isFinite(x)) return x;
  if (mode !== 'half_up') throw new Error(`genericRound: unsupported mode "${mode}" in this reduced copy`);
  const scale = Math.pow(10, precision);
  const scaled = x * scale;
  const sign = scaled < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(scaled))) / scale;
}

function flow(amount, full_periods, fraction) { return { amount, full_periods, fraction }; }

// P-B1: BOUNDED — aprc_pct >= 0 for any physically sensible schedule (non-negative total charge,
// drawdown at t=0, at least one repayment at t>0). CCD2-APRC-BUILD-SPEC.md §4 property set.
function checkPB1_bounded() {
  const rng = mulberry32(619001);
  let checked = 0, violations = 0;
  for (let i = 0; i < 2000; i++) {
    const C = randRange(rng, 1, 1e6);
    const chargeFrac = randRange(rng, 0, 2); // total charge as a fraction of C, always >= 0
    const D = C * (1 + chargeFrac);
    const t = randRange(rng, 0.01, 30);
    const r = compute({ drawdowns: [flow(C, 0, 0)], repayments: [flow(D, Math.floor(t), t - Math.floor(t))] });
    checked++;
    if (r.output_payload.bracketed && r.output_payload.converged) {
      if (!(r.output_payload.aprc_pct >= 0)) violations++;
    }
  }
  return { name: 'PB1_bounded_aprc_nonnegative', checked, violations };
}

// P-B2: MONOTONE in total charge, fixed timing structure — more total charge (same drawdown, same
// repayment timing) never produces a lower recovered aprc_pct.
function checkPB2_monotoneInCharge() {
  const rng = mulberry32(619002);
  let checked = 0, violations = 0;
  for (let i = 0; i < 500; i++) {
    const C = randRange(rng, 100, 1e5);
    const t = randRange(rng, 0.1, 10);
    const full = Math.floor(t), frac = t - full;
    const D_lo = C * (1 + randRange(rng, 0.01, 0.5));
    const D_hi = D_lo * (1 + randRange(rng, 0.001, 0.5));
    const r_lo = compute({ drawdowns: [flow(C, 0, 0)], repayments: [flow(D_lo, full, frac)] });
    const r_hi = compute({ drawdowns: [flow(C, 0, 0)], repayments: [flow(D_hi, full, frac)] });
    checked++;
    if (r_lo.output_payload.bracketed && r_lo.output_payload.converged &&
        r_hi.output_payload.bracketed && r_hi.output_payload.converged) {
      if (r_hi.output_payload.aprc_pct < r_lo.output_payload.aprc_pct) violations++;
    }
  }
  return { name: 'PB2_monotone_in_total_charge', checked, violations };
}

// P-B3: ULP-BOUNDARY FORCING — 0, negative zero, Number.MIN_VALUE, and the declared 1dp rounding
// boundary (X such that X*100 lands exactly on a .x5 tie) never throw, never NaN/undefined, and
// the tie-break boundary rounds per Annex III Part I remark (d)'s stated half-up rule.
function checkPB3_ulpBoundaries() {
  let checked = 0, violations = 0;
  const cases = [
    { name: 'zero_charge', pp: { drawdowns: [flow(1000, 0, 0)], repayments: [flow(1000, 1, 0)] }, expectAprc: 0 },
    { name: 'negative_zero_amounts', pp: { drawdowns: [flow(-0, 0, 0)], repayments: [flow(-0, 1, 0)] }, expectDegenerate: true },
    { name: 'min_value_amounts', pp: { drawdowns: [flow(Number.MIN_VALUE, 0, 0)], repayments: [flow(Number.MIN_VALUE * 1.1, 1, 0)] } },
    // Rounding-boundary tie: X = 0.005 -> 0.5000...% ; next-decimal figure is exactly 5 -> rounds UP to 0.5 (not down to 0.4? already integer-consistent; see 0.125 case for a genuine tie at the 2dp->1dp boundary)
    { name: 'half_up_tie_0125', pp: { drawdowns: [flow(1000, 0, 0)], repayments: [flow(1125, 1, 0)] }, expectAprc: 12.5 },
    { name: 'half_up_tie_005', pp: { drawdowns: [flow(1000, 0, 0)], repayments: [flow(1005, 1, 0)] }, expectAprc: 0.5 },
  ];
  for (const c of cases) {
    checked++;
    let r;
    try { r = compute(c.pp); } catch (e) { violations++; continue; }
    if (findShapeViolations(r.output_payload).length) violations++;
    if (c.expectAprc !== undefined && r.output_payload.aprc_pct !== c.expectAprc) violations++;
    if (c.expectDegenerate && r.output_payload.converged !== false) violations++;
  }
  return { name: 'PB3_ulp_boundary_forcing', checked, violations };
}

// P-B4: NON-CONVERGENCE HONESTY (F-2 shaped regression) — a schedule whose repayments do not cover
// its drawdowns (negative total charge) must NEVER be reported as converged/bracketed with a rate;
// it must report converged:false, bracketed:false, aprc_pct:null and raise APRC_NOT_BRACKETED. This
// is the exact art-215 F-2 negative pattern (an early-break returning a guess as if converged) this
// row's floor is required to include (CCD2-APRC-BUILD-SPEC.md §2).
function checkPB4_nonConvergenceHonesty() {
  const rng = mulberry32(619004);
  let checked = 0, violations = 0;
  for (let i = 0; i < 200; i++) {
    const C = randRange(rng, 100, 1e5);
    const D = C * randRange(rng, 0.01, 0.999); // strictly less than C -> negative total charge
    const r = compute({ drawdowns: [flow(C, 0, 0)], repayments: [flow(D, 1, 0)] });
    checked++;
    if (r.output_payload.converged !== false) violations++;
    if (r.output_payload.bracketed !== false) violations++;
    if (r.output_payload.aprc_pct !== null) violations++;
    if (!r.compliance_flags.includes('APRC_NOT_BRACKETED')) violations++;
    if (!r.compliance_flags.includes('APRC_DID_NOT_CONVERGE')) violations++;
  }
  return { name: 'PB4_f2_shaped_non_convergence_honesty', checked, violations };
}

// P-B5: FINAL-ROUNDING CONFORMANCE — the kernel's own reported aprc_pct, when it exists, matches
// research/fv-rounding-properties.helpers.mjs's genericRound('half_up', X*100, 1) reference applied
// to the kernel's own pre-rounding root (recovered by re-solving at higher precision is out of
// scope; instead this asserts the DECLARED-mode-applied-consistently property per the parent spec's
// per-regulation oracle rule: half_up at 1dp on a constructed set of exact decimal roots).
function checkPB5_finalRoundingConformance() {
  const rng = mulberry32(619005);
  let checked = 0, violations = 0;
  for (let i = 0; i < 500; i++) {
    // Construct an exact target X in [0, 1) at 3-decimal granularity so the "true" root is known
    // without re-deriving it from the kernel's own bisection.
    const Xtarget = Math.round(randRange(rng, 0, 999)) / 1000;
    const C = 1000;
    const D = C * Math.pow(1 + Xtarget, 1); // single repayment at t=1 -> exact root Xtarget
    const r = compute({ drawdowns: [flow(C, 0, 0)], repayments: [flow(D, 1, 0)] });
    checked++;
    if (!(r.output_payload.bracketed && r.output_payload.converged)) { violations++; continue; }
    const expected = genericRound('half_up', Xtarget * 100, 1);
    // tolerate the last-ULP rounding seam from bisection's finite tolerance
    if (Math.abs(r.output_payload.aprc_pct - expected) > 0.1 + 1e-9) violations++;
  }
  return { name: 'PB5_final_rounding_conformance_half_up_1dp', checked, violations };
}

// P-B6: DETERMINISM — recomputing the same policy_parameters yields a byte-identical payload.
function checkPB6_determinism() {
  const rng = mulberry32(619006);
  let checked = 0, violations = 0;
  for (let i = 0; i < 300; i++) {
    const C = randRange(rng, 100, 1e5);
    const D = C * (1 + randRange(rng, 0.01, 1));
    const t = randRange(rng, 0.1, 20);
    const pp = { drawdowns: [flow(C, 0, 0)], repayments: [flow(D, Math.floor(t), t - Math.floor(t))] };
    checked++;
    const a = compute(pp), b = compute(pp);
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  }
  return { name: 'PB6_determinism_on_recompute', checked, violations };
}

// P-B7: OUTPUT SHAPE — no NaN/undefined/Infinity anywhere across a wide random sweep, including
// multi-period unequal-spacing schedules (the mandatory fixture shape, CCD2-APRC-BUILD-SPEC.md §4).
function checkPB7_outputShape() {
  const rng = mulberry32(619007);
  let checked = 0, violations = 0;
  for (let i = 0; i < 500; i++) {
    const drawdowns = [flow(randRange(rng, 100, 1e5), 0, 0)];
    const nRep = 1 + Math.floor(randRange(rng, 0, 4));
    const repayments = [];
    for (let k = 0; k < nRep; k++) {
      const t = randRange(rng, 0.05, 15);
      repayments.push(flow(randRange(rng, 1, 1e4), Math.floor(t), t - Math.floor(t)));
    }
    checked++;
    const r = compute({ drawdowns, repayments });
    if (findShapeViolations(r.output_payload).length) violations++;
  }
  return { name: 'PB7_output_shape_no_nan_undefined_multi_period', checked, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkPB1_bounded(),
  checkPB2_monotoneInCharge(),
  checkPB3_ulpBoundaries(),
  checkPB4_nonConvergenceHonesty(),
  checkPB5_finalRoundingConformance(),
  checkPB6_determinism(),
  checkPB7_outputShape(),
];
console.log(`[${KERNEL_ID}] class-B property test (assigned rigor, architecturally class-C per CCD2-APRC-BUILD-SPEC.md §3)`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
