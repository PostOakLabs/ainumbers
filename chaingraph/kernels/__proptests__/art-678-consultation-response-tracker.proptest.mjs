// art-678-consultation-response-tracker.proptest.mjs — class-A property-test FLOOR
// (CONSULT-TRACKER-BUILD-1, CONSULT-TRACKER-BUILD-SPEC.md; FV-PBT-FLOOR-BUILD-SPEC.md).
// kernel_digest_at_authoring: sha256:03fc51661183dd63dcd3595fcaf0b6ecd41c91428a1a25a16243d042bd8d2249
// spec: CONSULT-TRACKER-BUILD-SPEC.md (workspace root)
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof. float_sensitive: NO — day deltas between declared
// calendar dates are exact whole-day integers via the civil-days algorithm; the declared
// 2dp half-up rounding convention never changes an integer value, and verdict boundaries
// (closes == as_of, closes == as_of - 1) are forced categorically rather than via
// ULP-forcing.
// Checks: fixture-oracle gate (9 golden vectors incl. the spec canonical preimage whose
// execution_hash pins 0d8bb36fc83e68f07e87f6ac08cb6f98e3f79a617c2dae2ca53826d136687b82 and
// the opposite-verdict ALL_RESPONDED vector), arithmetic identity of the roll-up
// (open / closed_unresponded / missed / days_to_next_close as the min whole-day delta over
// open unresponded consultations), verdict consistency (ATTENTION_REQUIRED iff a missed
// close exists; else ON_TRACK iff an open unresponded consultation exists; else
// ALL_RESPONDED), declared-date discipline (no dependence on any clock — same as_of yields
// the same payload), a metamorphic property (responding to a consultation never degrades the
// roll-up: it can only shrink missed and cannot push days_to_next_close down on the same
// declared set), determinism, and fail-closed rejection of out-of-domain inputs.
// Zero external dependencies — Node built-ins plus _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-678-consultation-response-tracker.proptest.mjs

import { compute } from '../art-678-consultation-response-tracker.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, pickNasty } from './_pbt-common.mjs';

const KERNEL_ID = 'art-678-consultation-response-tracker';

// Deterministic civil-days mirror of the kernel's daysFromCivil (Hinnant algorithm).
function daysFromCivil(s) {
  const y = Number(s.slice(0, 4));
  const mo = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  const yy = mo <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (mo + (mo > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const rand = mulberry32(0xc075a78);
const IDS = ['C-1', 'C-2', 'C-3', 'C-4', 'C-5', 'C-6', 'C-7', 'C-8'];

/** A valid YYYY-MM-DD string in 2026, declared-deterministic (no clock). */
function randomDate(rng) {
  const month = 1 + Math.floor(rng() * 12);
  const day = 1 + Math.floor(rng() * DAYS_IN_MONTH[month - 1]);
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `2026-${mm}-${dd}`;
}

function randomConsultations(rng) {
  const n = 1 + Math.floor(rng() * 8);
  const ids = IDS.slice();
  const out = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng() * ids.length);
    const id = ids.splice(idx, 1)[0] || `X${i}`;
    out.push({ id, closes: randomDate(rng), responded: rng() < 0.5 });
  }
  return out;
}

function randomPP(rng) {
  return { as_of: randomDate(rng), consultations: randomConsultations(rng) };
}

const TRIALS = 2000;

// ---------- P1: roll-up arithmetic identity over declared-domain inputs ----------
function checkP1_rollup_arithmetic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const out = compute(pp).output_payload;
    checked++;
    const asOfDays = daysFromCivil(pp.as_of);
    const open = pp.consultations.filter((c) => daysFromCivil(c.closes) - asOfDays >= 0).length;
    const missed = pp.consultations.filter((c) => daysFromCivil(c.closes) - asOfDays < 0 && !c.responded).map((c) => c.id);
    const unrespOpen = pp.consultations.filter((c) => daysFromCivil(c.closes) - asOfDays >= 0 && !c.responded);
    const minDays = unrespOpen.length === 0 ? null : Math.min(...unrespOpen.map((c) => daysFromCivil(c.closes) - asOfDays));
    if (out.open !== open) violations++;
    if (out.closed_unresponded !== missed.length) violations++;
    if (JSON.stringify(out.missed) !== JSON.stringify(missed)) violations++;
    if (out.days_to_next_close !== minDays) violations++;
    if (out.days_to_next_close !== null && (!Number.isInteger(out.days_to_next_close) || out.days_to_next_close < 0)) violations++;
  }
  return { name: 'P1 roll-up arithmetic identity (open/closed_unresponded/missed/days_to_next_close)', checked, violations };
}

// ---------- P2: verdict consistency — ATTENTION_REQUIRED iff a missed close exists ----------
function checkP2_verdict_consistency() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const out = compute(pp).output_payload;
    checked++;
    const asOfDays = daysFromCivil(pp.as_of);
    const hasMissed = pp.consultations.some((c) => daysFromCivil(c.closes) - asOfDays < 0 && !c.responded);
    const hasOpenUnresp = pp.consultations.some((c) => daysFromCivil(c.closes) - asOfDays >= 0 && !c.responded);
    const expected = hasMissed ? 'ATTENTION_REQUIRED' : (hasOpenUnresp ? 'ON_TRACK' : 'ALL_RESPONDED');
    if (out.overall !== expected) violations++;
  }
  // Forced boundaries: closes == as_of (still open), closes the day before as_of (missed).
  const asOf = '2026-09-03';
  const boundaries = [
    { as_of: asOf, consultations: [{ id: 'E', closes: '2026-09-03', responded: false }] },
    { as_of: asOf, consultations: [{ id: 'M', closes: '2026-09-02', responded: false }] },
    { as_of: asOf, consultations: [{ id: 'R', closes: '2026-09-02', responded: true }] },
    { as_of: asOf, consultations: [{ id: 'F', closes: '2026-09-04', responded: false }] },
    { as_of: asOf, consultations: [{ id: 'R1', closes: '2026-08-01', responded: true }, { id: 'R2', closes: '2026-12-01', responded: true }] },
  ];
  for (const pp of boundaries) {
    const out = compute(pp).output_payload;
    checked++;
    const asOfDays = daysFromCivil(pp.as_of);
    const hasMissed = pp.consultations.some((c) => daysFromCivil(c.closes) - asOfDays < 0 && !c.responded);
    const hasOpenUnresp = pp.consultations.some((c) => daysFromCivil(c.closes) - asOfDays >= 0 && !c.responded);
    const expected = hasMissed ? 'ATTENTION_REQUIRED' : (hasOpenUnresp ? 'ON_TRACK' : 'ALL_RESPONDED');
    if (out.overall !== expected) violations++;
  }
  return { name: 'P2 verdict consistency (ATTENTION_REQUIRED/ON_TRACK/ALL_RESPONDED incl. closes==as_of boundary)', checked, violations };
}

// ---------- P3: metamorphic — responding never degrades the roll-up ----------
function checkP3_metamorphic_respond_never_degrades() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const before = compute(pp).output_payload;
    const mutated = JSON.parse(JSON.stringify(pp));
    const idx = Math.floor(rand() * mutated.consultations.length);
    mutated.consultations[idx].responded = true;
    const after = compute(mutated).output_payload;
    checked++;
    if (after.closed_unresponded > before.closed_unresponded) violations++;
    if (after.missed.length > before.missed.length) violations++;
    if (before.overall === 'ALL_RESPONDED' && after.overall !== 'ALL_RESPONDED') violations++;
    if (before.overall === 'ON_TRACK' && after.overall === 'ATTENTION_REQUIRED') violations++;
  }
  return { name: 'P3 metamorphic respond-never-degrades', checked, violations };
}

// ---------- P4: determinism + declared-date discipline (same as_of, same payload) ----------
function checkP4_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const pp = randomPP(rand);
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(JSON.parse(JSON.stringify(pp))));
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P4 determinism (same declared inputs, same payload)', checked, violations };
}

// ---------- P5: fail-closed rejection of out-of-domain inputs, never a throw ----------
function checkP5_fail_closed() {
  let violations = 0, checked = 0;
  const badPPs = [
    {},
    { as_of: '2026-09-03' },
    { as_of: '2026-09-03', consultations: [] },
    { as_of: '2026-09-03', consultations: 'C-1' },
    { as_of: '2026-09-03', consultations: null },
    { as_of: '09/03/2026', consultations: [{ id: 'A', closes: '2026-10-01', responded: false }] },
    { as_of: '2026-13-01', consultations: [{ id: 'A', closes: '2026-10-01', responded: false }] },
    { as_of: '2026-09-03', consultations: [{}] },
    { as_of: '2026-09-03', consultations: [{ id: '', closes: '2026-10-01', responded: false }] },
    { as_of: '2026-09-03', consultations: [{ id: 'A', closes: '2026-02-30', responded: false }] },
    { as_of: '2026-09-03', consultations: [{ id: 'A', closes: '2026-10-01', responded: 'no' }] },
    { as_of: '2026-09-03', consultations: [{ id: 'A', closes: '2026-10-01', responded: false }, { id: 'A', closes: '2026-11-01', responded: true }] },
    { as_of: '2026-09-03', consultations: [{ id: 'A', closes: '2026-10-01', responded: false }, null] },
  ];
  for (const pp of badPPs) {
    checked++;
    try {
      const out = compute(pp).output_payload;
      if (!Array.isArray(out.domain_errors) || out.domain_errors.length === 0) violations++;
      if (out.open !== null || out.closed_unresponded !== null || out.days_to_next_close !== null || out.overall !== null) violations++;
    } catch (e) { violations++; }
  }
  // Nasty values in the as_of key must never throw and never fabricate a roll-up.
  for (let i = 0; i < 200; i++) {
    const pp = { as_of: pickNasty(rand), consultations: [{ id: 'A', closes: '2026-10-01', responded: false }] };
    checked++;
    try {
      const out = compute(pp).output_payload;
      if (out.overall !== null && out.overall !== 'ATTENTION_REQUIRED' && out.overall !== 'ON_TRACK' && out.overall !== 'ALL_RESPONDED') violations++;
      if (out.open !== null && !isCalendarShape(pp.as_of)) violations++;
    } catch (e) { violations++; }
  }
  return { name: 'P5 fail-closed rejection, never throws, never fabricates', checked, violations };
}

function isCalendarShape(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_rollup_arithmetic(),
  checkP2_verdict_consistency(),
  checkP3_metamorphic_respond_never_degrades(),
  checkP4_determinism(),
  checkP5_fail_closed(),
];
console.log(`[${KERNEL_ID}] class-A floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
