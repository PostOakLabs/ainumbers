// kernel_digest_at_authoring: sha256:f089bd26d7542e03a9042da30e4d37ba6c95c91ea08f9ce1fe390793fbe73cb9
//
// DORA-CLOCK-REPAIR-1 — property-test floor for art-467-dora-incident-classifier
// (rewritten with the kernel: art-467 is the 2025/301 Art. 5 stage-clock kernel under the
// REVERSED D split; it no longer classifies). Class B (bounded-numeric), float:no — all
// time math is integer UTC millisecond arithmetic against fixed hour/month offsets;
// forced CATEGORICAL boundary cases stand in for ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md
// §3. Zero external dependencies. This file is READ-ONLY with respect to the kernel it
// imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-467-dora-incident-classifier.proptest.mjs

import { compute } from '../art-467-dora-incident-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-467-dora-incident-classifier.fixtures.json');
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
const rand = mulberry32(0xD04A1);
const H = 3600 * 1000;
function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
function isoAt(rng, day, hourBase) {
  const h = (hourBase + randInt(rng, 0, 20)) % 24;
  const m = randInt(rng, 0, 59);
  return `2026-07-${String(day).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}Z`;
}
const TRIALS = 5000;
const CLASSES = ['credit_institution', 'ccp', 'trading_venue', 'nis2_essential_important', 'nca_notified', 'other'];
const EXTENSION_DENIED = new Set(['credit_institution', 'ccp', 'trading_venue', 'nis2_essential_important', 'nca_notified']);
const STAGE_STATES = new Set(['not_yet_due', 'due', 'overdue', 'not_evaluable', 'no_final_report_yet']);
const SCHEDULE_STATES = new Set(['evaluable', 'not_evaluable', 'malformed']);

function mkPP(rng) {
  const day = randInt(rng, 5, 20);
  const withOffset = rng() > 0.05;
  const pp = {
    entity_class: CLASSES[randInt(rng, 0, CLASSES.length - 1)],
    awareness_at: withOffset ? isoAt(rng, day, 6) : '2026-07-05T06:00:00',
    classification_at: withOffset ? isoAt(rng, day, 7) : undefined,
    logical_date: isoAt(rng, day, 8),
  };
  if (rng() < 0.5) pp.initial_submitted_at = isoAt(rng, day + 1, 9);
  if (rng() < 0.4) pp.intermediate_submitted_at = isoAt(rng, day + 2, 10);
  if (rng() < 0.3) pp.latest_intermediate_update_at = isoAt(rng, day + 3, 11);
  return pp;
}

const parse = (s) => (s == null ? null : Date.parse(s));
const addMonthClamped = (ms) => {
  const d = new Date(ms); const y = d.getUTCFullYear(); const m = d.getUTCMonth(); const day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
  return Date.UTC(y, m + 1, Math.min(day, last), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
};
// The Art. 5 extension rule the properties assert against (weekend-only — the random
// generator declares no bank-holiday dates): a weekend deadline moves to noon UTC next
// working day when the stage+class allows it, and final reports always keep it.
const isNonWorking = (ms) => { const d = new Date(ms); return d.getUTCDay() === 0 || d.getUTCDay() === 6; };
function applyExtension(ms, stage, entityClass, withdrawn) {
  if (!isNonWorking(ms)) return ms;
  const allowed = stage === 'final_report' || (!withdrawn && !EXTENSION_DENIED.has(entityClass));
  if (!allowed) return ms;
  const d = new Date(ms);
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 12, 0, 0, 0);
  let guard = 0;
  while (isNonWorking(t) && guard < 30) { t += 24 * H; guard++; }
  return t;
}

// ---------- P1: initial = min(classification + 4h, awareness + 24h), origin recorded ----------
function checkP1_initialDualLimb() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const st = r.output_payload.reporting_clock.stages.initial_notification;
    if (r.output_payload.schedule_state !== 'evaluable') continue;
    if (st.reason_code === 'TIMESTAMP_ORDER_CONTRADICTION') {
      // Contradictory declared order (e.g. awareness after classification): no deadline, never.
      if (!(st.deadline === null && st.state === 'not_evaluable')) violations++;
      continue;
    }
    const limbClass = parse(pp.classification_at) + 4 * H;
    const limbAware = parse(pp.awareness_at) + 24 * H;
    const expectedRaw = Math.min(limbClass, limbAware);
    const expected = applyExtension(expectedRaw, 'initial_notification', pp.entity_class, pp.extension_withdrawn_by_nca === true);
    if (st.deadline !== new Date(expected).toISOString()) violations++;
    if (limbAware < limbClass && st.reason_code !== 'INITIAL_DEADLINE_AWARENESS_24H') violations++;
    if (limbClass < limbAware && st.reason_code !== 'INITIAL_DEADLINE_CLASSIFICATION_4H') violations++;
    if (limbClass === limbAware && st.reason_code !== 'INITIAL_DEADLINE_LIMBS_EQUAL') violations++;
    if (st.computed_from == null) violations++;
  }
  return { name: 'P1_initial_min_of_4h_and_24h_with_origin', trials: checked, violations };
}

// ---------- P2: intermediate = initial SUBMISSION + 72h; else not_evaluable, never derived from the deadline ----------
function checkP2_intermediateFromSubmission() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const st = r.output_payload.reporting_clock.stages.intermediate_report;
    if (r.output_payload.schedule_state !== 'evaluable') continue;
    if (st.reason_code === 'TIMESTAMP_ORDER_CONTRADICTION') {
      if (!(st.deadline === null && st.state === 'not_evaluable')) violations++;
      continue;
    }
    if (pp.initial_submitted_at == null) {
      if (!(st.deadline === null && st.state === 'not_evaluable' && st.reason_code === 'INTERMEDIATE_INITIAL_NOT_SUBMITTED')) violations++;
    } else {
      const expected = applyExtension(parse(pp.initial_submitted_at) + 72 * H, 'intermediate_report', pp.entity_class, pp.extension_withdrawn_by_nca === true);
      if (st.deadline !== new Date(expected).toISOString()) violations++;
      if (st.reason_code !== 'INTERMEDIATE_FROM_INITIAL_SUBMISSION_72H') violations++;
      if (st.computed_from !== new Date(parse(pp.initial_submitted_at)).toISOString()) violations++;
    }
  }
  return { name: 'P2_intermediate_from_initial_submission_only', trials: checked, violations };
}

// ---------- P3: final = max(intermediate sub, latest update) + 1 month; absent -> no_final_report_yet ----------
function checkP3_finalRebasing() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const st = r.output_payload.reporting_clock.stages.final_report;
    if (r.output_payload.schedule_state !== 'evaluable') continue;
    if (st.reason_code === 'TIMESTAMP_ORDER_CONTRADICTION') {
      if (!(st.deadline === null && st.state === 'not_evaluable')) violations++;
      continue;
    }
    if (pp.intermediate_submitted_at == null) {
      if (!(st.deadline === null && st.state === 'no_final_report_yet')) violations++;
    } else {
      const base = Math.max(parse(pp.intermediate_submitted_at), parse(pp.latest_intermediate_update_at) ?? 0);
      const expected = applyExtension(addMonthClamped(base), 'final_report', pp.entity_class, pp.extension_withdrawn_by_nca === true);
      if (st.deadline !== new Date(expected).toISOString()) violations++;
    }
  }
  return { name: 'P3_final_one_month_from_latest_submission_rebasing', trials: checked, violations };
}

// ---------- P4: extension per stage per entity class (initial/intermediate denied classes; final keeps it) ----------
function checkP4_extensionPolicy() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const ec = pp.entity_class;
    const s = r.output_payload.reporting_clock.stages;
    if (r.output_payload.schedule_state !== 'evaluable') continue;
    for (const stage of ['initial_notification', 'intermediate_report']) {
      const st = s[stage];
      if (st.extension && st.extension.applied === true && EXTENSION_DENIED.has(ec) && pp.extension_withdrawn_by_nca !== false) violations++;
      if (st.extension && st.extension.applied === true && st.extension.original_deadline == null) violations++;
    }
    if (s.final_report && s.final_report.deadline != null) {
      const dl = new Date(s.final_report.deadline);
      const dow = dl.getUTCDay();
      const applied = s.final_report.extension && s.final_report.extension.applied;
      if (applied === true && dl.getUTCHours() !== 12) violations++; // extension always lands at noon UTC
      if (!applied && (dow === 0 || dow === 6)) violations++; // a weekend final deadline without the extension is wrong
    }
  }
  return { name: 'P4_extension_per_stage_per_entity_class_final_keeps_it', trials: checked, violations };
}

// ---------- P5: boundedness — schedule_state and every stage state within the declared enums ----------
function checkP5_boundedStates() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!SCHEDULE_STATES.has(r.output_payload.schedule_state)) violations++;
    const s = r.output_payload.reporting_clock.stages;
    for (const stage of ['initial_notification', 'intermediate_report', 'final_report']) {
      if (!STAGE_STATES.has(s[stage].state)) violations++;
      if (s[stage].deadline != null && Number.isNaN(Date.parse(s[stage].deadline))) violations++;
    }
    if (typeof r.output_payload.reporting_clock.classification_at !== 'string' && r.output_payload.reporting_clock.classification_at !== null) violations++;
  }
  return { name: 'P5_states_bounded_to_declared_enums', trials: checked, violations };
}

// ---------- P6 (mandatory, float:no exception): forced categorical boundary cases ----------
const BASE = { entity_class: 'other', awareness_at: '2026-08-01T09:00:00Z', classification_at: '2026-08-01T10:00:00Z', logical_date: '2026-08-01T11:00:00Z' };
const BOUNDARY_CASES = [
  [{ ...BASE }, '4h limb vs 24h limb — classification+4h (14:00) earlier than awareness+24h — 4h binds'],
  [{ ...BASE, awareness_at: '2026-07-31T11:00:00Z' }, 'awareness+24h (11:00) exactly one hour earlier than classification+4h (14:00) — 24h binds (strict earlier)'],
  [{ ...BASE, classification_at: '2026-08-01T07:00:00Z' }, 'limbs EQUAL at 2026-08-01T11:00Z — reason INITIAL_DEADLINE_LIMBS_EQUAL'],
  [{ ...BASE, initial_submitted_at: '2026-08-04T14:00:00Z' }, 'intermediate = submission+72h = 2026-08-07T14:00Z (from submission, never from the 13:00/14:00 deadline)'],
  [{ ...BASE, initial_submitted_at: '2026-08-06T11:00:00Z' }, 'intermediate limb lands Saturday 2026-08-08T11:00Z — class other: extension to Monday noon 2026-08-10T12:00Z'],
  [{ ...BASE, entity_class: 'credit_institution', initial_submitted_at: '2026-08-06T11:00:00Z' }, 'weekend intermediate limb, credit_institution — extension DENIED, deadline stays Saturday 11:00'],
  [{ ...BASE, intermediate_submitted_at: '2026-08-31T16:00:00Z' }, 'final = 2026-08-31 + 1 month clamped to 2026-09-30T16:00Z (end-of-month, Regulation 1182/71)'],
  [{ ...BASE, awareness_at: '2026-08-01T09:00:00' }, 'missing explicit offset on awareness_at — schedule_state malformed, no deadline'],
  [{ ...BASE, classification_at: undefined }, 'classification_at absent — schedule_state not_evaluable, no stage deadline'],
  [{ ...BASE, awareness_at: '2026-08-02T09:00:00Z' }, 'awareness AFTER classification — contradictory order, initial not_evaluable TIMESTAMP_ORDER_CONTRADICTION'],
];

function checkP6_forced() {
  const rows = [];
  for (const [pp, label] of BOUNDARY_CASES) {
    const r = compute(pp);
    const s = r.output_payload.reporting_clock.stages;
    const plausible = SCHEDULE_STATES.has(r.output_payload.schedule_state)
      && ['initial_notification', 'intermediate_report', 'final_report'].every((k) => STAGE_STATES.has(s[k].state));
    rows.push({ label, input: pp, schedule_state: r.output_payload.schedule_state, stages: s, flags: r.compliance_flags, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_initialDualLimb());
results.properties.push(checkP2_intermediateFromSubmission());
results.properties.push(checkP3_finalRebasing());
results.properties.push(checkP4_extensionPolicy());
results.properties.push(checkP5_boundedStates());
results.boundary_forced = checkP6_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
