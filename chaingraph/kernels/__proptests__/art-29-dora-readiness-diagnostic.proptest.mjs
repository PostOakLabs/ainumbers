// art-29-dora-readiness-diagnostic.proptest.mjs — class-A floor per
// FV-PBT-FLOOR-BUILD-SPEC.md §3: cheap invariant subset, NOT full enumeration.
// Family: "readiness-diagnostic" pct-grade, same shape as art-28 EXCEPT input is
// nested under pp.answers.qN (not flat pp.qN) — per research/FV-A-SIBLINGS-1-REPORT.md
// §3, this is a rewritten postcondition, not a 4-param template swap.
//
// kernel_digest_at_authoring: sha256:2fc2a970c1e7b9f554cbc414c18f307b5b950e11931a9861c342ced9253b8f71
// human_sign_off: PENDING — manifest-style signing per FV-PBT-FLOOR-BUILD-SPEC.md §4 (revised);
// this shard does not sign (see manifest at research/FV-PROPFLOOR-SHARD-A-TERNARY-1-MANIFEST.md).

import { compute } from '../art-29-dora-readiness-diagnostic.kernel.mjs';
import { mulberry32, randomAnswers, findShapeViolations, runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-29-dora-readiness-diagnostic';
const QUESTION_KEYS = Array.from({ length: 12 }, (_, i) => `q${i + 1}`);
const TRIALS = 300;

function grade(pct) {
  return pct >= 85 ? 'A' : pct >= 70 ? 'B' : pct >= 55 ? 'C' : pct >= 40 ? 'D' : 'F';
}
const GRADE_TITLES = { A: 'Review-ready', B: 'Nearly there', C: 'Exposed', D: 'Not ready', F: 'Stop' };

function wrap(answers) { return { answers }; }
function randomPP(rng) { return wrap(randomAnswers(rng, QUESTION_KEYS)); }

function checkP1_shape() {
  const rng = mulberry32(0xA29001);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const { output_payload, compliance_flags } = compute(randomPP(rng));
    checked++;
    if (findShapeViolations({ output_payload, compliance_flags }).length) violations++;
  }
  return { name: 'P1_shape_no_nan_undefined', checked, violations };
}

function checkP2_bounded() {
  const rng = mulberry32(0xA29002);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const { output_payload } = compute(randomPP(rng));
    checked++;
    const pcts = [output_payload.score_pct, ...output_payload.domain_scores.map((d) => d.pct)];
    if (pcts.some((p) => p < 0 || p > 100)) violations++;
    if (output_payload.gaps_count !== output_payload.gaps.length) violations++;
  }
  return { name: 'P2_boundedness_pct_0_100_and_gaps_count', checked, violations };
}

function checkP3_enumClosure() {
  const rng = mulberry32(0xA29003);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const { output_payload, compliance_flags } = compute(randomPP(rng));
    checked++;
    const gradeOk = ['A', 'B', 'C', 'D', 'F'].includes(output_payload.grade);
    const titleOk = output_payload.grade_title === GRADE_TITLES[output_payload.grade];
    const flagsOk = Array.isArray(compliance_flags) && compliance_flags.length > 0;
    if (!gradeOk || !titleOk || !flagsOk) violations++;
  }
  return { name: 'P3_declared_enum_closure_and_grade_title', checked, violations };
}

function checkP4_gradeConsistency() {
  const rng = mulberry32(0xA29004);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const { output_payload } = compute(randomPP(rng));
    checked++;
    if (output_payload.grade !== grade(output_payload.score_pct)) violations++;
    if (output_payload.supervisory_exposure !== (output_payload.score_pct < 70)) violations++;
    if (output_payload.immediate_action_required !== (output_payload.score_pct < 40)) violations++;
  }
  return { name: 'P4_grade_threshold_and_flag_consistency', checked, violations };
}

function checkP5_determinism() {
  const rng = mulberry32(0xA29005);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rng);
    const r1 = compute(pp), r2 = compute(pp);
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  return { name: 'P5_determinism', checked, violations };
}

function checkForcedBoundaries() {
  let checked = 0, violations = 0;
  const allYes = compute(wrap(Object.fromEntries(QUESTION_KEYS.map((k) => [k, 'yes'])))).output_payload;
  checked++; if (allYes.score_pct !== 100 || allYes.grade !== 'A') violations++;
  const allNo = compute(wrap(Object.fromEntries(QUESTION_KEYS.map((k) => [k, 'no'])))).output_payload;
  checked++; if (allNo.score_pct !== 0 || allNo.grade !== 'F') violations++;
  const empty = compute(wrap({})).output_payload; // unanswered -> treated as 'no', all_answered=false
  checked++; if (empty.score_pct !== 0 || empty.all_answered !== false) violations++;
  return { name: 'P6_forced_boundary_and_unanswered_defaults', checked, violations };
}

const oracleResult = runFixtureOracle(KERNEL_ID, compute);
const ok = summarize(KERNEL_ID, oracleResult, [
  checkP1_shape(), checkP2_bounded(), checkP3_enumClosure(), checkP4_gradeConsistency(), checkP5_determinism(), checkForcedBoundaries(),
]);
if (!ok) process.exit(1);
