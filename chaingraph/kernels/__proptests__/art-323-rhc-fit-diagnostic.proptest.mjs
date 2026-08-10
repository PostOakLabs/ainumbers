// art-323-rhc-fit-diagnostic.proptest.mjs — class-A floor per
// FV-PBT-FLOOR-BUILD-SPEC.md §3: cheap invariant subset, NOT full enumeration.
// Family: "fit-diagnostic" raw-score + chain-routing, same shape as art-34/art-42
// EXCEPT routing is a flattened routed_workflows list (every path with score>0,
// highest-first, chains flatMapped) rather than a single primary_chain — per
// research/FV-A-SIBLINGS-1-REPORT.md §3, a rewritten postcondition.
//
// kernel_digest_at_authoring: sha256:e09470ce920af00e8494502ae75b0a5986c163b2150f95ec58478d93c87e1a47
// human_sign_off: PENDING — manifest-style signing per FV-PBT-FLOOR-BUILD-SPEC.md §4 (revised);
// this shard does not sign (see manifest at research/FV-PROPFLOOR-SHARD-A-TERNARY-1-MANIFEST.md).

import { compute } from '../art-323-rhc-fit-diagnostic.kernel.mjs';
import { mulberry32, randomAnswers, allOf, findShapeViolations, runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-323-rhc-fit-diagnostic';
const PATHS = [
  { id: 'stock_app',        chains: ['rhc-multiplier-reconciliation', 'rhc-valuation-lint'], qs: ['q1_holds_or_custodies_stock_tokens', 'q2_tracks_corporate_actions', 'q3_computes_usd_valuation'] },
  { id: 'collateral_venue', chains: ['rhc-collateral-haircut'],                                qs: ['q4_accepts_stock_tokens_as_collateral', 'q5_needs_staleness_halt_checks', 'q6_off_hours_settlement_exposure'] },
  { id: 'index_basket',     chains: ['rhc-regime-mapping'],                                    qs: ['q7_builds_index_or_basket_product', 'q8_needs_regulatory_characterization', 'q9_assumed_mica_genius_applies'] },
  { id: 'agent_settlement', chains: ['rhc-bold-finality-classification', 'rhc-ap-redemption-stress'], qs: ['q10_asserts_settlement_finality', 'q11_relies_on_redemption_reachability', 'q12_automates_settlement_decisions'] },
];
const QUESTION_KEYS = PATHS.flatMap((p) => p.qs);
const SCORE = { yes: 4, partial: 2, no: 0 };
const TIE_BREAK = ['agent_settlement', 'collateral_venue', 'stock_app', 'index_basket'];
const TRIALS = 300;

function grade(score) {
  if (score >= 40) return 'A';
  if (score >= 30) return 'B';
  if (score >= 20) return 'C';
  if (score >= 12) return 'D';
  return 'F';
}

function expectedPathScore(pp, path) {
  return path.qs.reduce((acc, q) => acc + (SCORE[pp[q] ?? 'no'] ?? 0), 0);
}

function expectedSortedAndRouted(pp) {
  const scored = PATHS.map((p) => ({ id: p.id, chains: p.chains, score: expectedPathScore(pp, p) }));
  const sorted = [...scored].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return TIE_BREAK.indexOf(a.id) - TIE_BREAK.indexOf(b.id);
  });
  const routed = sorted.filter((p) => p.score > 0).flatMap((p) => p.chains);
  return { sorted, routed };
}

function checkP1_shape() {
  const rng = mulberry32(0xA323001);
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
  const rng = mulberry32(0xA323002);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomAnswers(rng, QUESTION_KEYS);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.total_score < 0 || output_payload.total_score > output_payload.total_max) violations++;
    for (const p of output_payload.path_results) {
      if (p.score < 0 || p.score > p.max) violations++;
      if (p.pct < 0 || p.pct > 100) violations++;
    }
  }
  return { name: 'P2_boundedness_score_and_pct', checked, violations };
}

function checkP3_enumClosure() {
  const rng = mulberry32(0xA323003);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomAnswers(rng, QUESTION_KEYS);
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    const gradeOk = ['A', 'B', 'C', 'D', 'F'].includes(output_payload.verdict);
    const pathOk = PATHS.some((p) => p.id === output_payload.primary_path);
    const flagsOk = Array.isArray(compliance_flags) && compliance_flags.length === 1;
    const routedOk = Array.isArray(output_payload.routed_workflows)
      && output_payload.routed_workflows.every((c) => typeof c === 'string');
    if (!gradeOk || !pathOk || !flagsOk || !routedOk) violations++;
  }
  return { name: 'P3_declared_enum_closure_and_routed_workflows_shape', checked, violations };
}

function checkP4_gradeAndRoutingConsistency() {
  const rng = mulberry32(0xA323004);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomAnswers(rng, QUESTION_KEYS);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.verdict !== grade(output_payload.total_score)) violations++;
    for (const p of PATHS) {
      const found = output_payload.path_results.find((r) => r.id === p.id);
      if (!found || found.score !== expectedPathScore(pp, p)) violations++;
    }
    const { sorted, routed } = expectedSortedAndRouted(pp);
    if (output_payload.primary_path !== sorted[0].id) violations++;
    if (JSON.stringify(output_payload.routed_workflows) !== JSON.stringify(routed)) violations++;
  }
  return { name: 'P4_grade_path_score_and_routed_workflows_consistency', checked, violations };
}

function checkP5_determinism() {
  const rng = mulberry32(0xA323005);
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
  checked++; if (allYes.total_score !== 48 || allYes.verdict !== 'A' || allYes.routed_workflows.length !== 6) violations++;
  const allNo = compute(allOf(QUESTION_KEYS, 'no')).output_payload;
  checked++; if (allNo.total_score !== 0 || allNo.verdict !== 'F' || allNo.routed_workflows.length !== 0) violations++;
  return { name: 'P6_forced_boundary_cases', checked, violations };
}

const oracleResult = runFixtureOracle(KERNEL_ID, compute);
const ok = summarize(KERNEL_ID, oracleResult, [
  checkP1_shape(), checkP2_bounded(), checkP3_enumClosure(), checkP4_gradeAndRoutingConsistency(), checkP5_determinism(), checkForcedBoundaries(),
]);
if (!ok) process.exit(1);
