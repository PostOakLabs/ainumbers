// art-42-arc-fit-diagnostic.proptest.mjs — class-A floor per
// FV-PBT-FLOOR-BUILD-SPEC.md §3: cheap invariant subset, NOT full enumeration.
// Family: "fit-diagnostic" raw-score + chain-routing, same shape as art-34 EXCEPT
// grade thresholds (40/32/24/12, not 40/30/20/12) and an extra cctp_branch flag
// (>=2 dims with score>0) — per research/FV-A-SIBLINGS-1-REPORT.md §3, a rewritten
// postcondition, not a template swap.
//
// kernel_digest_at_authoring: sha256:84cf3e4b4dd77ad8ed4f6425d9a623c51ae75b4855e2fb629505f1485387cee1
// human_sign_off: PENDING — manifest-style signing per FV-PBT-FLOOR-BUILD-SPEC.md §4 (revised);
// this shard does not sign (see manifest at research/FV-PROPFLOOR-SHARD-A-TERNARY-1-MANIFEST.md).

import { compute } from '../art-42-arc-fit-diagnostic.kernel.mjs';
import { mulberry32, randomAnswers, allOf, findShapeViolations, runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-42-arc-fit-diagnostic';
const DIMS = [
  { id: 'cpn',      chain: 'arc-cpn-payment',       qs: ['q1_cpn_connectivity', 'q2_corridor_volume', 'q3_settlement_cutoff_pain'] },
  { id: 'stablefx', chain: 'arc-stablefx',          qs: ['q4_fx_margin_pressure', 'q5_herstatt_exposure', 'q6_24_7_settlement_need'] },
  { id: 'dvp',      chain: 'arc-dvp-settlement',    qs: ['q7_dvp_trade_type', 'q8_usyc_collateral_interest', 'q9_prefunding_cost'] },
  { id: 'commerce', chain: 'arc-agentic-commerce',  qs: ['q10_agent_payment_volume', 'q11_gas_sensitivity', 'q12_x402_ap2_adoption'] },
];
const QUESTION_KEYS = DIMS.flatMap((d) => d.qs);
const SCORE = { yes: 4, partial: 2, no: 0 };
const TIE_BREAK = ['cpn', 'stablefx', 'commerce', 'dvp'];
const TRIALS = 300;

function grade(score) {
  if (score >= 40) return 'A';
  if (score >= 32) return 'B';
  if (score >= 24) return 'C';
  if (score >= 12) return 'D';
  return 'F';
}

function expectedDimScore(pp, dim) {
  return dim.qs.reduce((acc, q) => acc + (SCORE[pp[q] ?? 'no'] ?? 0), 0);
}

function checkP1_shape() {
  const rng = mulberry32(0xA42001);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomAnswers(rng, QUESTION_KEYS);
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (findShapeViolations({ output_payload, compliance_flags }).length) violations++;
  }
  return { name: 'P1_shape_no_nan_undefined', checked, violations };
}

function checkP2_bounded() {
  const rng = mulberry32(0xA42002);
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

function checkP3_enumClosure() {
  const rng = mulberry32(0xA42003);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomAnswers(rng, QUESTION_KEYS);
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    const gradeOk = ['A', 'B', 'C', 'D', 'F'].includes(output_payload.verdict);
    const dimOk = DIMS.some((d) => d.id === output_payload.primary_dim);
    const chainOk = DIMS.some((d) => d.chain === output_payload.primary_chain);
    const flagsOk = Array.isArray(compliance_flags) && compliance_flags.length >= 1
      && JSON.stringify(compliance_flags) === JSON.stringify(output_payload.compliance_flags);
    if (!gradeOk || !dimOk || !chainOk || !flagsOk) violations++;
  }
  return { name: 'P3_declared_enum_closure_and_routing', checked, violations };
}

function checkP4_gradeAndCctpConsistency() {
  const rng = mulberry32(0xA42004);
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
    const nPositive = output_payload.dim_results.filter((d) => d.score > 0).length;
    if (output_payload.cctp_branch !== (nPositive >= 2)) violations++;
    const sorted = [...DIMS.map((d) => ({ id: d.id, score: expectedDimScore(pp, d) }))].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return TIE_BREAK.indexOf(a.id) - TIE_BREAK.indexOf(b.id);
    });
    if (output_payload.primary_dim !== sorted[0].id) violations++;
  }
  return { name: 'P4_grade_dim_and_cctp_branch_consistency', checked, violations };
}

function checkP5_determinism() {
  const rng = mulberry32(0xA42005);
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
  checked++; if (allYes.total_score !== 48 || allYes.verdict !== 'A' || allYes.cctp_branch !== true) violations++;
  const allNo = compute(allOf(QUESTION_KEYS, 'no')).output_payload;
  checked++; if (allNo.total_score !== 0 || allNo.verdict !== 'F' || allNo.cctp_branch !== false) violations++;
  // exactly one dim positive -> cctp_branch must be false (boundary of the >=2 rule)
  const oneDimOnly = allOf(QUESTION_KEYS, 'no');
  DIMS[0].qs.forEach((q) => { oneDimOnly[q] = 'yes'; });
  const r = compute(oneDimOnly).output_payload;
  checked++; if (r.cctp_branch !== false) violations++;
  return { name: 'P6_forced_boundary_and_cctp_edge_cases', checked, violations };
}

const oracleResult = runFixtureOracle(KERNEL_ID, compute);
const ok = summarize(KERNEL_ID, oracleResult, [
  checkP1_shape(), checkP2_bounded(), checkP3_enumClosure(), checkP4_gradeAndCctpConsistency(), checkP5_determinism(), checkForcedBoundaries(),
]);
if (!ok) process.exit(1);
