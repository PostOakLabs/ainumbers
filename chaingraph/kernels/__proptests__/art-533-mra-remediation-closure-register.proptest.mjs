// art-533-mra-remediation-closure-register.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C27-1).
// kernel_digest_at_authoring: sha256:ccad868f81e724e7e30de59a9c955f7ba8c69d690fe04fbc6b3984f0e9352f5a
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — the WU row's triage table listed this kernel as float:yes; RE-CONFIRMED BY
// DIRECT READ per FIX-2 and that classification does NOT hold. The only division in the file is
// Math.floor((evalMs - committedMs) / 86400000) -- an exact-integer-millisecond difference divided by
// the fixed constant MS_PER_DAY, floored to a whole day count, then compared as a plain integer
// against overdue_grace_days. This is structurally identical to the day-count pattern already
// confirmed float:no elsewhere in this codebase (e.g. art-402-validate-regf-call-frequency,
// art-387-pqc-deadline-ladder-calculator): the numerator is always an exact integer and the
// denominator is a fixed constant, so the day-count/grace-window comparison sits nowhere near a
// genuine ULP-precision risk (the millisecond granularity is ~1e-5 of a day, vastly larger than a
// double's relative ULP at this magnitude). There is no other arithmetic in the file -- everything
// else is string/array/boolean/enum logic and a severity-ordinal reduce over a fixed lookup table.
// Forced categorical boundary cases are used in place of ULP forcing.
// Checks: fixture-oracle gate, termination (P1: determinations.length never exceeds issues.length,
// milestones per issue bounded by that issue's own declared milestones[] length), boundedness (P2:
// closed_count+overdue_count+open_count === determinations.length, milestones_valid_count <=
// milestones_total), a differential re-derivation of the per-issue gate_policy decision tree and the
// overdue-day arithmetic against an independent reimplementation (P3), a metamorphic
// permutation-invariance identity (P4: reordering issues[] never changes the rollup gate_policy, since
// it is an order-independent worst-of reduce), the two kill-condition checks named in the kernel's own
// docstring (P5: overdue_grace_days undeclared, and issue_id_commitment_scheme absent/wrong while
// issues were declared), and forced categorical boundary cases at the exact grace-window day-count
// boundary (overdue_days === overdue_grace_days vs one day over).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-533-mra-remediation-closure-register.proptest.mjs

import { compute } from '../art-533-mra-remediation-closure-register.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-533-mra-remediation-closure-register.fixtures.json');
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
const rand = mulberry32(0x533C27);

function hex64(rng) {
  let s = '';
  for (let i = 0; i < 64; i++) s += Math.floor(rng() * 16).toString(16);
  return 'sha256:' + s;
}
function isoPlusDays(base, days) { return new Date(Date.parse(base) + days * 86400000).toISOString(); }

function randomIssue(rng) {
  const issue_id = hex64(rng);
  const committedDays = Math.floor(rng() * 60);
  const nMilestones = 1 + Math.floor(rng() * 3);
  const milestones = Array.from({ length: nMilestones }, (_, i) => ({ milestone_id: `MS-${i}`, description: 'd', required_evidence_type: 'report' }));
  return { issue_id, commitment_text: 'remediate', committed_date: isoPlusDays('2026-01-01', committedDays), milestones, root_cause_identified: rng() < 0.9 };
}
function randomRemediation(issue, rng) {
  const out = [];
  for (const m of issue.milestones) {
    if (rng() < 0.7) {
      const closedDays = Math.floor(rng() * 90);
      const withEvidence = rng() < 0.8;
      const validEvidence = withEvidence && rng() < 0.8;
      out.push({ issue_id: issue.issue_id, milestone_id: m.milestone_id, closed_at: isoPlusDays('2026-01-01', closedDays), evidence: withEvidence ? [{ evidence_id: 'E1', evidence_type: validEvidence ? m.required_evidence_type : 'wrong_type' }] : [] });
    }
  }
  return out;
}
function randomPP(rng) {
  const nIssues = Math.floor(rng() * 5);
  const issues = Array.from({ length: nIssues }, () => randomIssue(rng));
  const remediation_status = issues.flatMap((iss) => randomRemediation(iss, rng));
  return {
    register_id: 'REG',
    evaluated_at: isoPlusDays('2026-01-01', 40 + Math.floor(rng() * 60)),
    overdue_grace_days: Math.floor(rng() * 30),
    issue_id_commitment_scheme: 'sha256-salted@1',
    issues, remediation_status,
  };
}

const GATE_SEVERITY = { hold: 4, escalate: 3, review_required: 2, auto_pass: 1 };

// Independent reimplementation of the per-issue gate_policy tree, for the differential check (P3).
function reimplement(pp) {
  const evalMs = Date.parse(pp.evaluated_at);
  const byIssue = new Map();
  for (const r of pp.remediation_status) {
    if (!byIssue.has(r.issue_id)) byIssue.set(r.issue_id, new Map());
    const bm = byIssue.get(r.issue_id);
    if (!bm.has(r.milestone_id)) bm.set(r.milestone_id, []);
    bm.get(r.milestone_id).push(r);
  }
  const dets = [];
  for (const iss of pp.issues) {
    const closureByKey = byIssue.get(iss.issue_id) || new Map();
    let validCount = 0;
    for (const m of iss.milestones) {
      const matches = (closureByKey.get(m.milestone_id) || []).filter((r) => Date.parse(r.closed_at));
      matches.sort((a, b) => Date.parse(a.closed_at) - Date.parse(b.closed_at));
      const closure = matches[0];
      if (closure && closure.evidence.length > 0 && closure.evidence.some((e) => e.evidence_type === m.required_evidence_type)) validCount++;
    }
    const allValid = iss.milestones.length > 0 && validCount === iss.milestones.length;
    const committedMs = Date.parse(iss.committed_date);
    const overdue = !allValid && evalMs > committedMs;
    const overdueDays = overdue ? Math.floor((evalMs - committedMs) / 86400000) : 0;
    const pastGrace = overdue && overdueDays > pp.overdue_grace_days;
    let gate;
    if (iss.root_cause_identified === false) gate = 'hold';
    else if (allValid) gate = 'auto_pass';
    else if (pastGrace) gate = 'escalate';
    else gate = 'review_required';
    dets.push(gate);
  }
  const rollup = dets.length === 0 ? 'auto_pass' : dets.reduce((w, d) => (GATE_SEVERITY[d] > GATE_SEVERITY[w] ? d : w), 'auto_pass');
  return { dets, rollup };
}

const TRIALS = 3000;

// ---------- P1: termination — determinations/milestones bounded by declared array lengths ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.determinations.length > pp.issues.length) violations++;
    for (let idx = 0; idx < o.determinations.length; idx++) {
      const d = o.determinations[idx];
      if (d.milestones.length !== pp.issues[idx].milestones.length) violations++;
    }
  }
  return { name: 'P1_termination_determinations_bounded_by_issues_length', trials: checked, violations };
}

// ---------- P2: boundedness — status counts sum exactly, milestones_valid_count <= milestones_total ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.closed_count + o.overdue_count + o.open_count !== o.determinations.length) violations++;
    for (const d of o.determinations) { if (d.milestones_valid_count > d.milestones_total) violations++; }
  }
  return { name: 'P2_boundedness_status_counts_sum_exactly', trials: checked, violations };
}

// ---------- P3: differential — gate_policy tree re-derived against an independent reimplementation ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const expected = reimplement(pp);
    for (let idx = 0; idx < o.determinations.length; idx++) {
      if (o.determinations[idx].decision !== expected.dets[idx]) violations++;
    }
    if (o.decision.gate_policy !== expected.rollup) violations++;
  }
  return { name: 'P3_gate_policy_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of issues[] order for the rollup gate_policy ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 800; i++) {
    const pp = randomPP(rand);
    if (pp.issues.length < 2) continue;
    const reversedIssues = [...pp.issues].reverse();
    const a = compute(pp).output_payload;
    const b = compute({ ...pp, issues: reversedIssues }).output_payload;
    checked++;
    if (a.decision.gate_policy !== b.decision.gate_policy) violations++;
    if (a.closed_count !== b.closed_count || a.overdue_count !== b.overdue_count || a.open_count !== b.open_count) violations++;
  }
  return { name: 'P4_permutation_invariance_rollup_metamorphic', trials: checked, violations };
}

// ---------- P5: kill conditions ----------
function checkP5_kill_conditions() {
  let violations = 0, checked = 0;
  // overdue_grace_days undeclared
  {
    const { output_payload: o } = compute({ register_id: 'R', evaluated_at: '2026-01-01T00:00:00Z', issues: [] });
    checked++;
    if (o.decision.execution_state !== 'did_not_run') violations++;
    if (o.decision.reason !== 'overdue_grace_days_not_declared') violations++;
  }
  // commitment scheme missing while issues declared
  {
    const pp = randomPP(rand);
    if (pp.issues.length === 0) pp.issues.push(randomIssue(rand));
    delete pp.issue_id_commitment_scheme;
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.decision.execution_state !== 'did_not_run') violations++;
    if (o.decision.reason !== 'issue_id_commitment_scheme_missing_or_invalid') violations++;
  }
  // malformed issue_id (not a well-formed commitment) is excluded and rejected
  {
    const pp = { register_id: 'R', evaluated_at: '2026-01-01T00:00:00Z', overdue_grace_days: 5, issue_id_commitment_scheme: 'sha256-salted@1', issues: [{ issue_id: 'not-a-commitment', commitment_text: 'x', committed_date: '2026-01-01T00:00:00Z', milestones: [] }], remediation_status: [] };
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.determinations.length !== 0) violations++;
    if (!o.rejected_inputs.some((r) => r.where === 'issues[0].issue_id')) violations++;
  }
  return { name: 'P5_kill_conditions_and_malformed_commitment', trials: checked, violations };
}

// ---------- P6: forced categorical boundary — overdue_days exactly at grace vs one day over ----------
function checkP6_forced_categorical_grace_boundary() {
  let violations = 0, checked = 0;
  const graceDays = 10;
  function buildPP(overdueDays) {
    const committed = '2026-01-01T00:00:00Z';
    const evaluated = isoPlusDays(committed, overdueDays);
    return {
      register_id: 'R', evaluated_at: evaluated, overdue_grace_days: graceDays, issue_id_commitment_scheme: 'sha256-salted@1',
      issues: [{ issue_id: hex64(rand), commitment_text: 'x', committed_date: committed, milestones: [{ milestone_id: 'M1', description: 'd', required_evidence_type: 'report' }], root_cause_identified: true }],
      remediation_status: [],
    };
  }
  // exactly at grace boundary -> NOT past grace (strict >) -> review_required, not escalate
  { const { output_payload: o } = compute(buildPP(graceDays)); checked++; if (o.determinations[0].decision !== 'review_required') violations++; if (o.determinations[0].overdue_days !== graceDays) violations++; }
  // one day past grace -> escalate
  { const { output_payload: o } = compute(buildPP(graceDays + 1)); checked++; if (o.determinations[0].decision !== 'escalate') violations++; }
  return { name: 'P6_forced_categorical_grace_boundary', trials: checked, violations };
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
results.properties.push(checkP5_kill_conditions());
results.properties.push(checkP6_forced_categorical_grace_boundary());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-533-mra-remediation-closure-register',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
