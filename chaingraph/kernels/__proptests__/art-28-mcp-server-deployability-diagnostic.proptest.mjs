// art-28-mcp-server-deployability-diagnostic.proptest.mjs — class-A floor per
// FV-PBT-FLOOR-BUILD-SPEC.md §3: cheap invariant subset, NOT full enumeration
// (research/FV-A-SIBLINGS-1-REPORT.md already ran full 3^12 enumeration for this
// kernel as a separate research artifact — this floor file does not duplicate that
// or claim totality). Family: "readiness-diagnostic" pct-grade, flat pp.qN keys.
//
// kernel_digest_at_authoring: sha256:9cb70b02e660f0da7401030929a6059c40e2e3fd4868b86226b71eaf9d1d7394
// human_sign_off: PENDING — manifest-style signing per FV-PBT-FLOOR-BUILD-SPEC.md §4 (revised);
// this shard does not sign (see manifest at research/FV-PROPFLOOR-SHARD-A-TERNARY-1-MANIFEST.md).

import { compute } from '../art-28-mcp-server-deployability-diagnostic.kernel.mjs';
import { mulberry32, randomAnswers, allOf, findShapeViolations, runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-28-mcp-server-deployability-diagnostic';
const QUESTION_KEYS = Array.from({ length: 12 }, (_, i) => `q${i + 1}`);
const TRIALS = 300;

function grade(pct) {
  return pct >= 85 ? 'A' : pct >= 70 ? 'B' : pct >= 55 ? 'C' : pct >= 40 ? 'D' : 'F';
}

// P1 — output shape: no NaN/undefined anywhere in the artifact (spec §3 mandatory floor invariant).
function checkP1_shape() {
  const rng = mulberry32(0xA28001);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomAnswers(rng, QUESTION_KEYS);
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    const v = findShapeViolations({ output_payload, compliance_flags });
    if (v.length) violations++;
  }
  return { name: 'P1_shape_no_nan_undefined', checked, violations };
}

// P2 — boundedness: score_pct and every domain pct stay within [0,100].
function checkP2_bounded() {
  const rng = mulberry32(0xA28002);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomAnswers(rng, QUESTION_KEYS);
    const { output_payload } = compute(pp);
    checked++;
    const pcts = [output_payload.score_pct, ...Object.values(output_payload.domain_scores).map((d) => d.pct)];
    if (pcts.some((p) => p < 0 || p > 100)) violations++;
  }
  return { name: 'P2_boundedness_pct_0_100', checked, violations };
}

// P3 — declared-enum closure: over the declared yes/partial/no domain, verdict is always a known grade
// letter and compliance_flags is a non-empty string array (§3: "declared-enum inputs only").
function checkP3_enumClosure() {
  const rng = mulberry32(0xA28003);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomAnswers(rng, QUESTION_KEYS);
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    const gradeOk = ['A', 'B', 'C', 'D', 'F'].includes(output_payload.verdict);
    const flagsOk = Array.isArray(compliance_flags) && compliance_flags.length > 0 && compliance_flags.every((f) => typeof f === 'string');
    if (!gradeOk || !flagsOk) violations++;
  }
  return { name: 'P3_declared_enum_closure', checked, violations };
}

// P4 — grade/tier consistency: the returned verdict matches the independently-declared grade()
// thresholds applied to the returned score_pct (kernel_digest_at_authoring binds this to the source above).
function checkP4_gradeConsistency() {
  const rng = mulberry32(0xA28004);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomAnswers(rng, QUESTION_KEYS);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.verdict !== grade(output_payload.score_pct)) violations++;
  }
  return { name: 'P4_grade_threshold_consistency', checked, violations };
}

// P5 — determinism: same input twice yields byte-identical output (no hidden clock/random state).
function checkP5_determinism() {
  const rng = mulberry32(0xA28005);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomAnswers(rng, QUESTION_KEYS);
    const r1 = compute(pp);
    const r2 = compute(pp);
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  return { name: 'P5_determinism', checked, violations };
}

// Forced boundary cases (declared-domain extremes) — deliberate, not random.
function checkForcedBoundaries() {
  const cases = [allOf(QUESTION_KEYS, 'yes'), allOf(QUESTION_KEYS, 'partial'), allOf(QUESTION_KEYS, 'no')];
  let checked = 0, violations = 0;
  for (const pp of cases) {
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.verdict !== grade(output_payload.score_pct)) violations++;
  }
  // known exact boundary values
  const allYes = compute(allOf(QUESTION_KEYS, 'yes')).output_payload;
  if (allYes.score_pct !== 100 || allYes.verdict !== 'A') violations++;
  const allNo = compute(allOf(QUESTION_KEYS, 'no')).output_payload;
  if (allNo.score_pct !== 0 || allNo.verdict !== 'F') violations++;
  checked += 2;
  return { name: 'P6_forced_boundary_cases', checked, violations };
}

const oracleResult = runFixtureOracle(KERNEL_ID, compute);
const ok = summarize(KERNEL_ID, oracleResult, [
  checkP1_shape(), checkP2_bounded(), checkP3_enumClosure(), checkP4_gradeConsistency(), checkP5_determinism(), checkForcedBoundaries(),
]);
if (!ok) process.exit(1);
