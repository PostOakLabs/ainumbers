// art-673-lending-recall-prioritizer — class-K property-test floor.
// kernel_digest_at_authoring: sha256:31d9a8356f9e3c350463c2c5b981a0d7bb78e11ba3d90412bb123ee4963b0719
// spec: RECALL-PRIORITIZER-BUILD-SPEC.md (RECALL-PRIORITIZER-BUILD-1) — worked example is the parity pin.
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-673-lending-recall-prioritizer.proptest.mjs

import { compute } from '../art-673-lending-recall-prioritizer.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = 'art-673-lending-recall-prioritizer';

const rand = mulberry32(0x673);

const IDS = ['R-A', 'R-B', 'R-C', 'R-D', 'R-E', 'R-F', 'R-G', 'R-H'];

/** Random YYYY-MM-DD a bounded number of civil days from a base day number (pure integer, no Date). */
function randDateStr(rng, baseDays, deltaLo, deltaHi) {
  const days = baseDays + deltaLo + Math.floor(rng() * (deltaHi - deltaLo + 1));
  return daysToIso(days);
}

function randDayNumber(rng) {
  // 2024-01-01 is day 19723; stay inside a ~6-year window.
  return 19723 + Math.floor(rng() * 2200);
}

function randIso(rng) { return randDateStr(rng, randDayNumber(rng), 0, 0); }

/** Random VALID policy_parameters: unique ids, valid calendar dates, positive integer qtys. */
function mkValidPP(rng, overrides = {}) {
  const n = 1 + Math.floor(rng() * 6);
  const ids = [...IDS].sort(() => rng() - 0.5).slice(0, n);
  const asOf = randIso(rng);
  return {
    as_of: asOf,
    recalls: ids.map((id) => ({
      id,
      due: randDateStr(rng, isoToDays(asOf), -3, 10),
      qty: 1 + Math.floor(rng() * 1000000),
    })),
    ...overrides,
  };
}

// pure ISO<->day helpers mirroring the kernel's civil arithmetic (for independent recomputation)
function isoToDays(s) {
  const y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
  const y2 = m <= 2 ? y - 1 : y;
  const era = Math.floor(y2 / 400);
  const yoe = y2 - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function daysToIso(days) {
  let z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  let y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  y = m <= 2 ? y + 1 : y;
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(y)}-${pad(m)}-${pad(d)}`;
}
function diffDays(a, b) { return isoToDays(b) - isoToDays(a); }

// ---------- P1: determinism — compute() is a pure function of pp ----------
function checkP1_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 5000; i++) {
    const pp = mkValidPP(rand);
    const r1 = JSON.stringify(compute(pp).output_payload);
    const r2 = JSON.stringify(compute(JSON.parse(JSON.stringify(pp))).output_payload);
    checked++;
    if (r1 !== r2) violations++;
  }
  return { name: 'P1_determinism_same_pp_same_output', checked, violations };
}

// ---------- P2: ranking invariant — queue sorted by due then qty, invariant under input permutation ----------
function checkP2_rankOrder() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 8000; i++) {
    const pp = mkValidPP(rand);
    const { output_payload: op } = compute(pp);
    checked++;
    if (op.domain_errors) continue;
    if (op.queue.length !== pp.recalls.length) { violations++; continue; }
    const byId = new Map(pp.recalls.map((r) => [r.id, r]));
    let prev = null;
    for (const id of op.queue) {
      const r = byId.get(id);
      if (!r) { violations++; break; }
      if (prev) {
        if (diffDays(prev.due, r.due) < 0) violations++;
        else if (r.due === prev.due && r.qty < prev.qty) violations++;
      }
      prev = r;
    }
    const shuffled = { as_of: pp.as_of, recalls: [...pp.recalls].sort(() => rand() - 0.5) };
    const op2 = compute(shuffled).output_payload;
    if (!deepEqual(op.queue, op2.queue) || !deepEqual(op.urgent, op2.urgent)) violations++;
  }
  return { name: 'P2_queue_sorted_by_due_then_qty_input_order_invariant', checked, violations };
}

// ---------- P3: domain rejection — invalid input is always refused, never silently computed ----------
function checkP3_domainRejection() {
  let violations = 0, checked = 0;
  const spoils = [
    (pp) => ({ ...pp, as_of: 'not-a-date' }),
    (pp) => ({ ...pp, as_of: '2026-13-01' }),
    (pp) => ({ ...pp, as_of: '2026-02-30' }),
    (pp) => ({ ...pp, as_of: undefined }),
    (pp) => ({ ...pp, recalls: [] }),
    (pp) => ({ ...pp, recalls: 'all of them' }),
    (pp) => ({ ...pp, recalls: undefined }),
  ];
  const entrySpoils = [
    (r) => ({ ...r, id: '' }),
    (r) => ({ ...r, id: 42 }),
    (r) => ({ ...r, due: '2026-09-00' }),
    (r) => ({ ...r, due: '09/04/2026' }),
    (r) => ({ ...r, due: undefined }),
    (r) => ({ ...r, qty: 0 }),
    (r) => ({ ...r, qty: -100 }),
    (r) => ({ ...r, qty: 12.5 }),
    (r) => ({ ...r, qty: '10000' }),
    (r) => ({ ...r, qty: undefined }),
  ];
  for (let i = 0; i < 6000; i++) {
    const base = mkValidPP(rand);
    const pp = pick(rand, spoils)(base);
    if (rand() < 0.5) {
      const idx = Math.floor(rand() * base.recalls.length);
      pp.recalls = [...base.recalls];
      pp.recalls[idx] = pick(rand, entrySpoils)({ ...base.recalls[idx] });
    }
    const { output_payload: op, compliance_flags } = compute(pp);
    checked++;
    if (!Array.isArray(op.domain_errors) || op.domain_errors.length === 0) { violations++; continue; }
    if (!compliance_flags.includes('DOMAIN_ERROR')) violations++;
    if (op.queue !== null || op.urgent !== null || op.overall !== 'INPUT_REFUSED') violations++;
    if (typeof op.trace !== 'string' || !op.trace.startsWith('fail-closed:')) violations++;
  }
  return { name: 'P3_invalid_input_always_fail_closed_never_computed', checked, violations };
}

// ---------- P4: urgency rule — urgent iff 0 <= due-as_of <= 1 day; flag mirrors output ----------
function checkP4_urgencyRule() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 8000; i++) {
    const asOf = randIso(rand);
    const gap = -3 + Math.floor(rand() * 7); // -3..3 days from as_of
    const due = randDateStr(rand, isoToDays(asOf), gap, gap);
    const pp = { as_of: asOf, recalls: [{ id: 'R-A', due, qty: 100 }] };
    const { output_payload: op, compliance_flags } = compute(pp);
    checked++;
    if (op.domain_errors) continue;
    const isUrgent = op.urgent.includes('R-A');
    const expected = gap >= 0 && gap <= 1;
    if (isUrgent !== expected) violations++;
    if (isUrgent !== compliance_flags.includes('RECALLS_URGENT')) violations++; // flag-mirror
    if (isUrgent && !/is [01] day(s)? from as_of -> urgent/.test(op.trace)) violations++;
    if (!isUrgent && op.urgent.length !== 0) violations++;
    if (gap < 0 && isUrgent) violations++; // past-due is ranked, never urgent
  }
  return { name: 'P4_urgent_iff_due_within_one_day_of_as_of', checked, violations };
}

// ---------- P5: success payload shape — exactly the four canonical keys ----------
function checkP5_successShape() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 4000; i++) {
    const pp = mkValidPP(rand);
    const { output_payload: op } = compute(pp);
    checked++;
    if (op.domain_errors) continue;
    const keys = Object.keys(op).sort().join(',');
    if (keys !== 'overall,queue,trace,urgent') violations++;
    if (op.overall !== 'QUEUE_RANKED') violations++;
    if (!Array.isArray(op.queue) || !Array.isArray(op.urgent)) violations++;
    if (typeof op.trace !== 'string' || op.trace.length === 0) violations++;
  }
  return { name: 'P5_success_payload_is_exactly_the_canonical_four_keys', checked, violations };
}

// ---------- P6: opposite-verdict — urgency follows the DECLARED as_of, not a constant ----------
function checkP6_oppositeVerdict() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 4000; i++) {
    const due = randIso(rand);
    const recalls = [{ id: 'R-A', due, qty: 100 }];
    const asOf = randDateStr(rand, isoToDays(due) - 1, 0, 0); // due is exactly 1 day out -> urgent
    const op = compute({ as_of: asOf, recalls }).output_payload;
    if (op.domain_errors) continue;
    checked++;
    if (!op.urgent.includes('R-A')) violations++;
    // shift as_of 5 days past due: the SAME recall must drop out of urgent — verdict flips
    const op2 = compute({ as_of: daysToIso(isoToDays(due) + 5), recalls }).output_payload;
    if (op2.domain_errors) { violations++; continue; }
    if (op2.urgent.includes('R-A')) violations++;
    if (!op2.trace.includes('none due within 1 day')) violations++;
  }
  return { name: 'P6_urgency_verdict_follows_declared_as_of_not_a_constant', checked, violations };
}

// ---------- P7 (mandatory): pinned parity + boundary forcing ----------
const PINNED_WORKED_EXAMPLE = {
  pp: { as_of: '2026-09-03', recalls: [{ id: 'R-A', due: '2026-09-04', qty: 10000 }, { id: 'R-B', due: '2026-09-08', qty: 2000 }] },
  out: {
    queue: ['R-A', 'R-B'],
    urgent: ['R-A'],
    trace: 'R-A due 2026-09-04 is 1 day from as_of -> urgent; rank by due date then qty',
    overall: 'QUEUE_RANKED',
  },
};

/** @type {[string, () => boolean][]} */
const BOUNDARY_CASES = [
  ['pinned worked example byte-identical (spec parity pin f6b72079...)', () => {
    const { output_payload } = compute(PINNED_WORKED_EXAMPLE.pp);
    return deepEqual(output_payload, PINNED_WORKED_EXAMPLE.out);
  }],
  ['due exactly ON as_of (0 days) is urgent, clause reads "0 days"', () => {
    const { output_payload } = compute({ as_of: '2026-09-03', recalls: [{ id: 'R-S', due: '2026-09-03', qty: 1 }] });
    return deepEqual(output_payload.urgent, ['R-S']) && output_payload.trace.includes('R-S due 2026-09-03 is 0 days from as_of -> urgent');
  }],
  ['due 1 day after as_of IS urgent (boundary included)', () => {
    const { output_payload } = compute({ as_of: '2026-09-03', recalls: [{ id: 'R-U', due: '2026-09-04', qty: 1 }] });
    return deepEqual(output_payload.urgent, ['R-U']);
  }],
  ['due 2 days after as_of is ranked but NOT urgent (boundary excluded)', () => {
    const { output_payload } = compute({ as_of: '2026-09-03', recalls: [{ id: 'R-T', due: '2026-09-05', qty: 1 }] });
    return deepEqual(output_payload.urgent, []) && deepEqual(output_payload.queue, ['R-T']);
  }],
  ['past-due recall is ranked, never urgent', () => {
    const { output_payload } = compute({ as_of: '2026-09-03', recalls: [{ id: 'R-P', due: '2026-08-30', qty: 1 }] });
    return deepEqual(output_payload.queue, ['R-P']) && deepEqual(output_payload.urgent, []);
  }],
  ['same due date — smaller declared qty ranks first', () => {
    const { output_payload } = compute({ as_of: '2026-09-03', recalls: [{ id: 'R-BIG', due: '2026-09-05', qty: 9000 }, { id: 'R-sm', due: '2026-09-05', qty: 1 }] });
    return deepEqual(output_payload.queue, ['R-sm', 'R-BIG']);
  }],
  ['same due AND same qty — id ascending breaks the tie deterministically', () => {
    const { output_payload } = compute({ as_of: '2026-09-03', recalls: [{ id: 'R-Z', due: '2026-09-05', qty: 10 }, { id: 'R-A', due: '2026-09-05', qty: 10 }] });
    return deepEqual(output_payload.queue, ['R-A', 'R-Z']);
  }],
  ['leap-day due 2028-02-29 parses and ranks; 2029-02-29 fails closed', () => {
    const okLeap = compute({ as_of: '2028-02-28', recalls: [{ id: 'R-L', due: '2028-02-29', qty: 1 }] });
    const badLeap = compute({ as_of: '2029-02-28', recalls: [{ id: 'R-L', due: '2029-02-29', qty: 1 }] });
    return !okLeap.output_payload.domain_errors && Array.isArray(badLeap.output_payload.domain_errors)
      && badLeap.output_payload.domain_errors.includes('INVALID_RECALL_DUE');
  }],
  ['empty input {} — fail closed naming every required field, never throws', () => {
    const { output_payload, compliance_flags } = compute({});
    return Array.isArray(output_payload.domain_errors) && output_payload.domain_errors.length >= 2
      && compliance_flags.includes('DOMAIN_ERROR');
  }],
  ['513 recalls — over the 512-entry bound must fail closed', () => {
    const recalls = Array.from({ length: 513 }, (_, i) => ({ id: 'R-' + i, due: '2026-09-04', qty: 1 }));
    const { output_payload } = compute({ as_of: '2026-09-03', recalls });
    return Array.isArray(output_payload.domain_errors) && output_payload.domain_errors.includes('INVALID_RECALLS');
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
  checkP2_rankOrder(),
  checkP3_domainRejection(),
  checkP4_urgencyRule(),
  checkP5_successShape(),
  checkP6_oppositeVerdict(),
];
const boundaryForced = checkP7_forced();
const ok = summarize(KERNEL_ID, oracle, properties) && boundaryForced.every((b) => b.pass);
if (boundaryForced.some((b) => !b.pass)) {
  console.log('BOUNDARY-FORCED FAILURES:');
  for (const b of boundaryForced.filter((b) => !b.pass)) console.log('  ✗ ' + b.label);
}
process.exit(ok ? 0 : 1);
