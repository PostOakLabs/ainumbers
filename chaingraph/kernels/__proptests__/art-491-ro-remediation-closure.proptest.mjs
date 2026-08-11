// art-491-ro-remediation-closure.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C24-1).
// kernel_digest_at_authoring: sha256:3a605809e324af32ea025897ba46618e869f3a5701025e98ba5a7ff74a25847e
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — the only float op is
// Math.round((closed_count/total)*10000)/100 for a DISPLAY-ONLY closure_coverage_pct; it never
// feeds a branch or a threshold compare, so no ULP-boundary claim is made or needed). This
// matches the WU row's own float:no classification for this kernel — no correction needed.
// Checks: fixture-oracle gate, termination (determinations bounded by input notifications.length),
// differential re-derivation of per-notification closure_status/item_state/exception (earliest
// matching remediation_records entry by resubmitted_at, `pastCutoff` gate), boundedness (every
// closed/open/overdue count sums to notification_count, closure_coverage_pct in [0,100]),
// readiness_verdict differential, and metamorphic append-invariance (adding a matching
// remediation record for an open notification can only move it toward closed, never away).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-491-ro-remediation-closure.proptest.mjs

import { compute } from '../art-491-ro-remediation-closure.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-491-ro-remediation-closure.fixtures.json');
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
const rand = mulberry32(0x491A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomDate(rng, dayOffset) {
  const day = 1 + Math.floor(rng() * 26) + dayOffset;
  return `2026-01-${String(Math.max(1, Math.min(28, day))).padStart(2, '0')}`;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  const notifications = [];
  for (let i = 0; i < n; i++) {
    notifications.push({
      notification_id: rng() < 0.9 ? `NOTIF-${i}` : '',
      notification_code: pick(rng, ['ICMM-1', 'CRS-STATUS-2', null]),
      doc_ref_id: pick(rng, [`DOC-${i}`, null]),
    });
  }
  const rn = Math.floor(rng() * 6);
  const remediation_records = [];
  for (let i = 0; i < rn; i++) {
    remediation_records.push({
      notification_id: pick(rng, notifications.map((x) => x.notification_id).concat(['NOTIF-999', ''])),
      resubmitted_at: rng() < 0.85 ? `2026-01-${String(1 + Math.floor(rng() * 26)).padStart(2, '0')}T00:00:00Z` : null,
      resubmitted_doc_ref_id: `RESUB-${i}`,
    });
  }
  return {
    certification_period: pick(rng, ['2026-Q1', '2026-Q2', '']),
    cutoff_at: rng() < 0.85 ? '2026-01-20T00:00:00Z' : null,
    evaluated_at: rng() < 0.9 ? randomDate(rng, 0) + 'T00:00:00Z' : null,
    notifications,
    remediation_records,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — determinations.length === notifications.length exactly ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.determinations.length !== pp.notifications.length) violations++;
    if (output_payload.notification_count !== pp.notifications.length) violations++;
  }
  return { name: 'P1_termination_determinations_exact', trials: checked, violations };
}

// ---------- P2 (differential): per-notification closure_status/item_state re-derivation ----------
function checkP2_closure_status_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const cutoffMs = pp.cutoff_at ? Date.parse(pp.cutoff_at) : null;
    const evalMs = pp.evaluated_at ? Date.parse(pp.evaluated_at) : null;
    const pastCutoff = Number.isFinite(cutoffMs) && Number.isFinite(evalMs) && evalMs > cutoffMs;
    for (let j = 0; j < pp.notifications.length; j++) {
      const n = pp.notifications[j];
      const notification_id = typeof n.notification_id === 'string' && n.notification_id.trim().length > 0 ? n.notification_id : '';
      const matches = pp.remediation_records
        .filter((r) => r && r.notification_id === notification_id && Number.isFinite(Date.parse(r.resubmitted_at)))
        .map((r) => Date.parse(r.resubmitted_at))
        .sort((a, b) => a - b);
      const closed = matches.length > 0;
      const expected = closed ? 'closed' : (pastCutoff ? 'overdue' : 'open');
      const det = output_payload.determinations[j];
      if (det.closure_status !== expected) violations++;
      if (det.item_state !== (closed ? 'done' : 'pending_human')) violations++;
      if (!closed && pastCutoff && !det.exception) violations++;
      if ((closed || !pastCutoff) && det.exception !== null) violations++;
    }
  }
  return { name: 'P2_closure_status_differential', trials: checked, violations };
}

// ---------- P3: boundedness — closed+open+overdue === total, closure_coverage_pct in [0,100] ----------
function checkP3_counts_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.closed_count + output_payload.open_count + output_payload.overdue_count !== output_payload.notification_count) violations++;
    if (output_payload.closure_coverage_pct !== null && (output_payload.closure_coverage_pct < 0 || output_payload.closure_coverage_pct > 100)) violations++;
    if (output_payload.notification_count === 0 && output_payload.closure_coverage_pct !== null) violations++;
  }
  return { name: 'P3_counts_bounded_and_coverage_pct_range', trials: checked, violations };
}

// ---------- P4 (differential): readiness_verdict re-derivation ----------
function checkP4_readiness_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = output_payload.notification_count === 0
      ? 'NO_OPEN_NOTIFICATIONS'
      : (output_payload.overdue_count === 0 ? 'READY' : 'NOT_READY');
    if (output_payload.readiness_verdict !== expected) violations++;
  }
  return { name: 'P4_readiness_verdict_differential', trials: checked, violations };
}

// ---------- P5: metamorphic — adding a matching remediation record for an open notification
// can only close it or leave the rest unaffected, never regress a closed notification. ----------
function checkP5_add_remediation_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    if (pp.notifications.length === 0) continue;
    const targetIdx = Math.floor(rand() * pp.notifications.length);
    const target = pp.notifications[targetIdx];
    if (!target.notification_id) continue;
    const r1 = compute(pp).output_payload;
    const extended = {
      ...pp,
      remediation_records: [...pp.remediation_records, { notification_id: target.notification_id, resubmitted_at: '2026-01-01T00:00:00Z', resubmitted_doc_ref_id: 'RESUB-NEW' }],
    };
    const r2 = compute(extended).output_payload;
    checked++;
    // the target notification must be closed after the addition
    if (r2.determinations[targetIdx].closure_status !== 'closed') violations++;
    // closed_count can only increase or stay the same for other notifications' status
    if (r2.closed_count < r1.closed_count) violations++;
    // determination count is unaffected by adding a remediation record
    if (r2.determinations.length !== r1.determinations.length) violations++;
  }
  return { name: 'P5_add_remediation_record_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_closure_status_differential());
results.properties.push(checkP3_counts_bounded());
results.properties.push(checkP4_readiness_verdict_differential());
results.properties.push(checkP5_add_remediation_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-491-ro-remediation-closure',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
