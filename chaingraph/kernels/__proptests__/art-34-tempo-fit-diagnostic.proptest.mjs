// art-34-tempo-fit-diagnostic.proptest.mjs — class-A floor per
// FV-PBT-FLOOR-BUILD-SPEC.md §3: cheap invariant subset, NOT full enumeration.
// Family: "fit-diagnostic" raw-score + chain-routing (per
// research/FV-A-SIBLINGS-1-REPORT.md §3 family 2) — SCORE{yes:4,partial:2,no:0},
// raw-score grade thresholds (40/30/20/12), dim_results + primary_chain/primary_dim
// routing via a TIE_BREAK order. Own postcondition, not a template swap.
//
// kernel_digest_at_authoring: sha256:b9ed479a76b0cfcc9a781b741f7a696e6a3cfd4f0cb99ed6621677702cf2d82c
// human_sign_off: PENDING — manifest-style signing per FV-PBT-FLOOR-BUILD-SPEC.md §4 (revised);
// this shard does not sign (see manifest at research/FV-PROPFLOOR-SHARD-A-TERNARY-1-MANIFEST.md).

import { compute } from '../art-34-tempo-fit-diagnostic.kernel.mjs';
import { mulberry32, randomAnswers, allOf, findShapeViolations, runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-34-tempo-fit-diagnostic';
const DIMS = [
  { id: 'issue',    chain: 'tempo-issuance',        qs: ['q1_regulatory_approval', 'q2_reserve_management', 'q3_attestation_readiness'] },
  { id: 'payments', chain: 'tempo-payments',         qs: ['q4_payment_volume', 'q5_cross_border_volume', 'q6_settlement_latency_requirement'] },
  { id: 'agent',    chain: 'tempo-mpp-agent',        qs: ['q7_agent_payments_live', 'q8_mpp_integration', 'q9_api_key_management'] },
  { id: 'commerce', chain: 'tempo-agentic-checkout', qs: ['q10_merchant_acceptance', 'q11_checkout_flow', 'q12_refund_handling'] },
];
const QUESTION_KEYS = DIMS.flatMap((d) => d.qs);
const SCORE = { yes: 4, partial: 2, no: 0 };
const TIE_BREAK = ['agent', 'payments', 'commerce', 'issue'];
const TRIALS = 300;

function grade(score) {
  if (score >= 40) return 'A';
  if (score >= 30) return 'B';
  if (score >= 20) return 'C';
  if (score >= 12) return 'D';
  return 'F';
}

function expectedDimScore(pp, dim) {
  return dim.qs.reduce((acc, q) => acc + (SCORE[pp[q] ?? 'no'] ?? 0), 0);
}

function checkP1_shape() {
  const rng = mulberry32(0xA34001);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomAnswers(rng, QUESTION_KEYS);
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (findShapeViolations({ output_payload, compliance_flags }).length) violations++;
  }
  return { name: 'P1_shape_no_nan_undefined', checked, violations };
}

// P2 — boundedness: every dim score in [0, dim.max], total_score in [0, total_max].
function checkP2_bounded() {
  const rng = mulberry32(0xA34002);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomAnswers(rng, QUESTION_KEYS);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.total_score < 0 || output_payload.total_score > output_payload.total_max) violations++;
    for (const d of output_payload.dim_results) {
      if (d.score < 0 || d.score > d.max) violations++;
      if (d.pct < 0 || d.pct > 100) violations++;
    }
  }
  return { name: 'P2_boundedness_score_and_pct', checked, violations };
}

// P3 — declared-enum closure + routing well-formedness: primary_chain/primary_dim always
// point at a real dimension entry.
function checkP3_enumClosure() {
  const rng = mulberry32(0xA34003);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomAnswers(rng, QUESTION_KEYS);
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    const gradeOk = ['A', 'B', 'C', 'D', 'F'].includes(output_payload.verdict);
    const dimOk = DIMS.some((d) => d.id === output_payload.primary_dim);
    const chainOk = DIMS.some((d) => d.chain === output_payload.primary_chain);
    const flagsOk = Array.isArray(compliance_flags) && compliance_flags.length === 1;
    if (!gradeOk || !dimOk || !chainOk || !flagsOk) violations++;
  }
  return { name: 'P3_declared_enum_closure_and_routing', checked, violations };
}

// P4 — grade + per-dim-score + tie-break consistency, independently recomputed.
function checkP4_gradeAndDimConsistency() {
  const rng = mulberry32(0xA34004);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomAnswers(rng, QUESTION_KEYS);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.verdict !== grade(output_payload.total_score)) violations++;
    for (const d of DIMS) {
      const found = output_payload.dim_results.find((r) => r.id === d.id);
      if (!found || found.score !== expectedDimScore(pp, d)) violations++;
    }
    const sorted = [...DIMS.map((d) => ({ id: d.id, score: expectedDimScore(pp, d) }))].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return TIE_BREAK.indexOf(a.id) - TIE_BREAK.indexOf(b.id);
    });
    if (output_payload.primary_dim !== sorted[0].id) violations++;
  }
  return { name: 'P4_grade_and_dim_score_and_tiebreak_consistency', checked, violations };
}

function checkP5_determinism() {
  const rng = mulberry32(0xA34005);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomAnswers(rng, QUESTION_KEYS);
    const r1 = compute(pp), r2 = compute(pp);
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  return { name: 'P5_determinism', checked, violations };
}

function checkForcedBoundaries() {
  let checked = 0, violations = 0;
  const allYes = compute(allOf(QUESTION_KEYS, 'yes')).output_payload;
  checked++; if (allYes.total_score !== 48 || allYes.verdict !== 'A') violations++;
  const allNo = compute(allOf(QUESTION_KEYS, 'no')).output_payload;
  checked++; if (allNo.total_score !== 0 || allNo.verdict !== 'F') violations++;
  // exact-boundary forcing: all-yes in 'agent' dim only -> score 12 -> lowest grade 'D' (>=12); tie-break wins agent
  const agentOnly = allOf(QUESTION_KEYS, 'no');
  DIMS.find((d) => d.id === 'agent').qs.forEach((q) => { agentOnly[q] = 'yes'; });
  const r = compute(agentOnly).output_payload;
  checked++; if (r.total_score !== 12 || r.verdict !== 'D' || r.primary_dim !== 'agent') violations++;
  return { name: 'P6_forced_boundary_and_tiebreak_cases', checked, violations };
}

const oracleResult = runFixtureOracle(KERNEL_ID, compute);
const ok = summarize(KERNEL_ID, oracleResult, [
  checkP1_shape(), checkP2_bounded(), checkP3_enumClosure(), checkP4_gradeAndDimConsistency(), checkP5_determinism(), checkForcedBoundaries(),
]);
if (!ok) process.exit(1);
