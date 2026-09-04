// art-674-eba-im-model-validation-tracker — class-K property-test floor.
// kernel_digest_at_authoring: sha256:9521fc1f815df0bdd6252148037398a0d0eb75111936058c17e74a864b8ee999
// spec: EBA-IM-TRACKER-BUILD-SPEC.md (EBA-IM-TRACKER-BUILD-1) — worked example is the parity pin
// d8f8d45f070f7c99249eb2877e2ac17606f0104ec7e67f99c056b80c59690436.
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-674-eba-im-model-validation-tracker.proptest.mjs

import { compute } from '../art-674-eba-im-model-validation-tracker.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = 'art-674-eba-im-model-validation-tracker';

const rand = mulberry32(0x674);

const STATUSES = ['submitted', 'approved', 'rejected'];

/** Whole days between two YYYY-MM-DD strings (UTC calendar-day difference). */
function dayDiff(from, to) {
  const a = new Date(from + 'T00:00:00Z');
  const b = new Date(to + 'T00:00:00Z');
  return Math.round((Number(b) - Number(a)) / 86400000);
}

/** Random VALID policy_parameters: unique ids, valid statuses, submitted not after as_of. */
function mkValidPP(rng, overrides = {}) {
  const asOf = '2026-09-03';
  const n = 1 + Math.floor(rng() * 6);
  const ids = new Set();
  while (ids.size < n) ids.add('M-' + (1 + Math.floor(rng() * 500)));
  const models = Array.from(ids, (id) => {
    const status = pick(rng, STATUSES);
    // submitted somewhere in the 720 days before as_of
    const back = 1 + Math.floor(rng() * 720);
    const d = new Date(Number(new Date(asOf + 'T00:00:00Z')) - back * 86400000);
    const pad = (x) => String(x).padStart(2, '0');
    return { id, status, submitted: d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) };
  });
  return { as_of: asOf, models, ...overrides };
}

// ---------- P1: determinism — compute() is a pure function of pp ----------
function checkP1_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 5000; i++) {
    const pp = mkValidPP(rand);
    const r1 = JSON.stringify(compute(pp).output_payload);
    const r2 = JSON.stringify(compute({ ...pp }).output_payload);
    checked++;
    if (r1 !== r2) violations++;
  }
  return { name: 'P1_determinism_same_pp_same_output', checked, violations };
}

// ---------- P2: roll-up invariants — counts match the declared statuses; ids unique; ages non-negative ----------
function checkP2_rollUpInvariants() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 8000; i++) {
    const pp = mkValidPP(rand);
    const { output_payload: op } = compute(pp);
    checked++;
    if (op.domain_errors) continue;
    const declaredSubmitted = pp.models.filter((m) => m.status === 'submitted');
    const declaredApproved = pp.models.filter((m) => m.status === 'approved');
    if (op.approved !== declaredApproved.length) violations++;
    if (op.pending !== declaredSubmitted.length) violations++;
    if (!deepEqual(op.pending_ids, declaredSubmitted.map((m) => m.id))) violations++;
    if (op.pending_ids.length !== Object.keys(op.pending_age_days).length) violations++;
    for (const id of op.pending_ids) {
      const age = op.pending_age_days[id];
      const m = pp.models.find((x) => x.id === id);
      if (age !== dayDiff(m.submitted, pp.as_of)) violations++;
      if (!(typeof age === 'number' && age >= 0 && Number.isSafeInteger(age))) violations++;
    }
  }
  return { name: 'P2_counts_ids_and_ages_match_declared_inventory', checked, violations };
}

// ---------- P3: domain rejection — invalid input is always refused, never silently computed ----------
function checkP3_domainRejection() {
  let violations = 0, checked = 0;
  const spoils = [
    (pp) => ({ ...pp, as_of: '2026-13-40' }),
    (pp) => ({ ...pp, as_of: 'not-a-date' }),
    (pp) => ({ ...pp, as_of: undefined }),
    (pp) => ({ ...pp, models: [] }),
    (pp) => ({ ...pp, models: 'inventory' }),
    (pp) => ({ ...pp, models: undefined }),
    (pp) => ({ ...pp, models: [...pp.models, { id: 'BAD', status: 'withdrawn', submitted: '2026-01-01' }] }),
    (pp) => ({ ...pp, models: [...pp.models, { id: 'BAD', status: 'submitted', submitted: '2026-99-01' }] }),
    (pp) => ({ ...pp, models: [...pp.models, { id: 'BAD', status: 'submitted', submitted: '2027-01-01' }] }),
    (pp) => ({ ...pp, models: pp.models.map((m) => ({ ...m, id: 42 })) }),
  ];
  for (let i = 0; i < 6000; i++) {
    const base = mkValidPP(rand);
    const pp = pick(rand, spoils)(base);
    const { output_payload: op, compliance_flags } = compute(pp);
    checked++;
    if (!Array.isArray(op.domain_errors) || op.domain_errors.length === 0) { violations++; continue; }
    if (!compliance_flags.includes('DOMAIN_ERROR')) violations++;
    if (op.approved !== null || op.pending !== null || op.overall !== 'FAIL_CLOSED') violations++;
    if (typeof op.trace !== 'string' || !op.trace.startsWith('fail-closed:')) violations++;
  }
  return { name: 'P3_invalid_input_always_fail_closed_never_computed', checked, violations };
}

// ---------- P4: verdict rule — the declared 180-day aging rule decides the overall verdict ----------
function checkP4_verdictRule() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 8000; i++) {
    const pp = mkValidPP(rand);
    const { output_payload: op } = compute(pp);
    checked++;
    if (op.domain_errors) continue;
    const ages = Object.values(op.pending_age_days);
    const expected = (op.pending === 0 && op.approved === 0)
      ? 'TRACKING_EMPTY'
      : (ages.some((a) => a > 180) ? 'TRACKING_AGED' : 'TRACKING_CURRENT');
    if (op.overall !== expected) violations++;
  }
  return { name: 'P4_overall_follows_declared_aging_and_empty_rules', checked, violations };
}

// ---------- P5: success payload shape — exactly the six canonical keys, no caveat carrier ----------
function checkP5_successShape() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 4000; i++) {
    const pp = mkValidPP(rand);
    const { output_payload: op, compliance_flags } = compute(pp);
    checked++;
    if (op.domain_errors) continue;
    const keys = Object.keys(op).sort().join(',');
    if (keys !== 'approved,overall,pending,pending_age_days,pending_ids,trace') violations++;
    if (compliance_flags.length !== 0) violations++; // no unconditional emissions: success raises no flag
    if (typeof op.trace !== 'string') violations++;
  }
  return { name: 'P5_success_payload_is_exactly_the_canonical_six_keys', checked, violations };
}

// ---------- P6: trace phrasing — exactly the pinned per-model sentence, in declared order ----------
function checkP6_tracePhrasing() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 4000; i++) {
    const pp = mkValidPP(rand);
    const { output_payload: op } = compute(pp);
    checked++;
    if (op.domain_errors) continue;
    const expected = pp.models
      .filter((m) => m.status === 'submitted')
      .map((m) => `${m.id} submitted ${m.submitted}, ${dayDiff(m.submitted, pp.as_of)} days to as_of`)
      .join('; ');
    if (op.trace !== expected) violations++;
  }
  return { name: 'P6_trace_is_pinned_sentence_per_pending_model_in_declared_order', checked, violations };
}

// ---------- P7 (mandatory, date-sensitive): pinned parity + boundary forcing ----------
const PINNED_WORKED_EXAMPLE = {
  pp: { as_of: '2026-09-03', models: [{ id: 'IM-1', status: 'submitted', submitted: '2026-06-01' }, { id: 'IM-2', status: 'approved', submitted: '2026-02-10' }] },
  out: {
    approved: 1,
    pending: 1,
    pending_ids: ['IM-1'],
    pending_age_days: { 'IM-1': 94 },
    trace: 'IM-1 submitted 2026-06-01, 94 days to as_of',
    overall: 'TRACKING_CURRENT',
  },
};

/** @type {[string, () => boolean][]} */
const BOUNDARY_CASES = [
  ['pinned worked example byte-identical (spec parity pin d8f8d45f...)', () => {
    const { output_payload } = compute(PINNED_WORKED_EXAMPLE.pp);
    return deepEqual(output_payload, PINNED_WORKED_EXAMPLE.out);
  }],
  ['exactly 180 days pending — at the threshold, not over it, stays TRACKING_CURRENT', () => {
    const { output_payload } = compute({ as_of: '2026-09-03', models: [{ id: 'T-180', status: 'submitted', submitted: '2026-03-07' }] });
    return !output_payload.domain_errors && output_payload.pending_age_days['T-180'] === 180 && output_payload.overall === 'TRACKING_CURRENT';
  }],
  ['exactly 181 days pending — one over the threshold flags TRACKING_AGED', () => {
    const { output_payload } = compute({ as_of: '2026-09-03', models: [{ id: 'T-181', status: 'submitted', submitted: '2026-03-06' }] });
    return !output_payload.domain_errors && output_payload.overall === 'TRACKING_AGED';
  }],
  ['submitted date equal to as_of — age 0, valid, TRACKING_CURRENT', () => {
    const { output_payload } = compute({ as_of: '2026-09-03', models: [{ id: 'T-0', status: 'submitted', submitted: '2026-09-03' }] });
    return !output_payload.domain_errors && output_payload.pending_age_days['T-0'] === 0 && output_payload.overall === 'TRACKING_CURRENT';
  }],
  ['submitted date after as_of must fail closed, never a negative age', () => {
    const { output_payload } = compute({ as_of: '2026-09-03', models: [{ id: 'T-F', status: 'submitted', submitted: '2026-09-10' }] });
    return Array.isArray(output_payload.domain_errors) && output_payload.domain_errors.includes('SUBMITTED_AFTER_AS_OF');
  }],
  ['invalid calendar date 2026-02-30 must fail closed', () => {
    const { output_payload } = compute({ as_of: '2026-09-03', models: [{ id: 'T-D', status: 'submitted', submitted: '2026-02-30' }] });
    return Array.isArray(output_payload.domain_errors) && output_payload.domain_errors.includes('INVALID_SUBMITTED_DATE');
  }],
  ['rejected-only inventory — TRACKING_EMPTY with zero counts and empty trace', () => {
    const { output_payload } = compute({ as_of: '2026-09-03', models: [{ id: 'R-1', status: 'rejected', submitted: '2026-03-01' }] });
    return !output_payload.domain_errors && output_payload.overall === 'TRACKING_EMPTY'
      && output_payload.approved === 0 && output_payload.pending === 0 && output_payload.trace === '';
  }],
  ['empty input {} — fail closed naming every required field, never throws', () => {
    const { output_payload, compliance_flags } = compute({});
    return Array.isArray(output_payload.domain_errors) && output_payload.domain_errors.length >= 2
      && compliance_flags.includes('DOMAIN_ERROR');
  }],
  ['duplicate ids must fail closed even when both entries are individually well-formed', () => {
    const { output_payload } = compute({ as_of: '2026-09-03', models: [{ id: 'D', status: 'submitted', submitted: '2026-06-01' }, { id: 'D', status: 'approved', submitted: '2026-02-10' }] });
    return Array.isArray(output_payload.domain_errors) && output_payload.domain_errors.includes('DUPLICATE_MODEL_ID');
  }],
];

function checkP7_forced() {
  const rows = [];
  for (const [label, fn] of BOUNDARY_CASES) {
    let pass = false;
    try { pass = fn(); } catch (e) { pass = false; }
    rows.push({ label, pass });
  }
  return rows;
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_determinism(),
  checkP2_rollUpInvariants(),
  checkP3_domainRejection(),
  checkP4_verdictRule(),
  checkP5_successShape(),
  checkP6_tracePhrasing(),
];
const boundaryForced = checkP7_forced();
const ok = summarize(KERNEL_ID, oracle, properties) && boundaryForced.every((b) => b.pass);
if (boundaryForced.some((b) => !b.pass)) {
  console.log('BOUNDARY-FORCED FAILURES:');
  for (const b of boundaryForced.filter((b) => !b.pass)) console.log('  ✗ ' + b.label);
}
process.exit(ok ? 0 : 1);
