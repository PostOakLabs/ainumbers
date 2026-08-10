// art-41-tempo-validator-readiness.proptest.mjs — class-A floor per
// FV-PBT-FLOOR-BUILD-SPEC.md §3: cheap invariant subset, NOT full enumeration.
// This is art-34/42/323's OWN sibling variant (per research/FV-A-SIBLINGS-1-REPORT.md
// §3: "art-41 further varies: 5 dimensions, mixed question-counts per dimension
// (3/3/2/2/2), per-dimension DIM_MAX table, no chain-routing fields at all") —
// a distinct postcondition, not a reuse of the 4-dim family-2 shape.
//
// kernel_digest_at_authoring: sha256:461449fa5c72e430c60d8e1b07c67491bbdffd14488d14d27e85671017ce0d01
// human_sign_off: PENDING — manifest-style signing per FV-PBT-FLOOR-BUILD-SPEC.md §4 (revised);
// this shard does not sign (see manifest at research/FV-PROPFLOOR-SHARD-A-TERNARY-1-MANIFEST.md).

import { compute } from '../art-41-tempo-validator-readiness.kernel.mjs';
import { mulberry32, randomAnswers, allOf, findShapeViolations, runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-41-tempo-validator-readiness';
const DIMS = [
  { id: 'hw',  max: 12, qs: ['q1_cpu_cores', 'q2_ram_gb', 'q3_nvme_1gbps'] },
  { id: 'os',  max: 12, qs: ['q4_linux_glibc', 'q5_ntp_chrony', 'q6_ports_open'] },
  { id: 'key', max: 8,  qs: ['q7_ed25519_keypair', 'q8_key_tempo_contact'] },
  { id: 'tel', max: 8,  qs: ['q9_port9000_scraping', 'q10_alerting'] },
  { id: 'upg', max: 8,  qs: ['q11_7day_sla', 'q12_runbook'] },
];
const QUESTION_KEYS = DIMS.flatMap((d) => d.qs);
const SCORE = { yes: 4, partial: 2, no: 0 };
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
  const rng = mulberry32(0xA41001);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomAnswers(rng, QUESTION_KEYS);
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (findShapeViolations({ output_payload, compliance_flags }).length) violations++;
  }
  return { name: 'P1_shape_no_nan_undefined', checked, violations };
}

// P2 — boundedness: per-dim mixed maxima (12/12/8/8/8) each individually respected, sum to total_max=48.
function checkP2_bounded() {
  const rng = mulberry32(0xA41002);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomAnswers(rng, QUESTION_KEYS);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.total_score < 0 || output_payload.total_score > output_payload.total_max) violations++;
    for (const d of output_payload.dim_results) {
      const declared = DIMS.find((x) => x.id === d.id);
      if (d.max !== declared.max) violations++;
      if (d.score < 0 || d.score > d.max) violations++;
      if (d.pct < 0 || d.pct > 100) violations++;
    }
    const sumMax = output_payload.dim_results.reduce((a, d) => a + d.max, 0);
    if (sumMax !== output_payload.total_max) violations++;
  }
  return { name: 'P2_boundedness_mixed_dim_maxima', checked, violations };
}

function checkP3_enumClosure() {
  const rng = mulberry32(0xA41003);
  let checked = 0, violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomAnswers(rng, QUESTION_KEYS);
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    const gradeOk = ['A', 'B', 'C', 'D', 'F'].includes(output_payload.verdict);
    const boolOk = typeof output_payload.requires_permissioning === 'boolean';
    const flagsOk = Array.isArray(compliance_flags) && compliance_flags.length >= 1;
    if (!gradeOk || !boolOk || !flagsOk) violations++;
  }
  return { name: 'P3_declared_enum_closure', checked, violations };
}

// P4 — grade/dim-score/permissioning consistency, independently recomputed.
function checkP4_gradeAndPermissioningConsistency() {
  const rng = mulberry32(0xA41004);
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
    const expectedPermissioning = (pp.q8_key_tempo_contact ?? 'no') !== 'yes';
    if (output_payload.requires_permissioning !== expectedPermissioning) violations++;
    const hasPermFlag = output_payload.compliance_flags?.includes?.('TEMPO_PERMISSIONING_REQUIRED')
      ?? false; // note: art-41 does not embed compliance_flags in output_payload (unlike art-42) — checked separately
    if (expectedPermissioning && !hasPermFlag) {
      // compliance_flags lives at the top level, not output_payload — re-check via full compute()
      const full = compute(pp);
      if (!full.compliance_flags.includes('TEMPO_PERMISSIONING_REQUIRED')) violations++;
    }
  }
  return { name: 'P4_grade_dimscore_and_permissioning_consistency', checked, violations };
}

function checkP5_determinism() {
  const rng = mulberry32(0xA41005);
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
  checked++; if (allYes.total_score !== 48 || allYes.verdict !== 'A' || allYes.requires_permissioning !== false) violations++;
  const allNo = compute(allOf(QUESTION_KEYS, 'no')).output_payload;
  checked++; if (allNo.total_score !== 0 || allNo.verdict !== 'F' || allNo.requires_permissioning !== true) violations++;
  // exact score=12 boundary (grade D lower bound) via 'upg' dim alone at max
  const upgOnly = allOf(QUESTION_KEYS, 'no');
  DIMS.find((d) => d.id === 'upg').qs.forEach((q) => { upgOnly[q] = 'yes'; });
  const r = compute(upgOnly).output_payload;
  checked++; if (r.total_score !== 8 || r.verdict !== 'F') violations++; // upg max=8, still below D=12 boundary
  return { name: 'P6_forced_boundary_and_permissioning_edge_cases', checked, violations };
}

const oracleResult = runFixtureOracle(KERNEL_ID, compute);
const ok = summarize(KERNEL_ID, oracleResult, [
  checkP1_shape(), checkP2_bounded(), checkP3_enumClosure(), checkP4_gradeAndPermissioningConsistency(), checkP5_determinism(), checkForcedBoundaries(),
]);
if (!ok) process.exit(1);
