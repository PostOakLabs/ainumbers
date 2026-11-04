// 733-servicing-compliance-clock — class-K property-test FLOOR.
//
// CLASS K — the declared domain is bounded (≤32 events per run, per-rule day
// offsets bounded by a 400-day step guard, closed refusal set enumerated in the
// sibling reachability fixtures), but the DATE axis is continuous, so no
// totality claim is made over it. Properties below run over a committed
// mulberry32 seed (deterministic) plus a fixed corpus of structural cases.
//
// kernel_digest_at_authoring: sha256:e7eac9a4322542b6e39434f60df84cdc6eb24ceee9887b282aadc16f319bb4ea
// spec: VALON reduction map §B2 item 1 (research/VALON-AI-INVENTORY-AND-AINUMBERS-REDUCTION-MAP-2026-10-05.md)
//   — servicing-compliance timeline checker: per-rule due dates and clock states
//   from event dates + values, every output carrying its paragraph citation;
//   built to the pinned primary text (12 CFR 1024.35/.36/.37/.41, 1026.36(c),
//   1026.20(c)/(d); post-IFR text only — the removed section 1024.39(e) branch
//   is absent by construction and asserted refused).
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/733-servicing-compliance-clock.proptest.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compute } from '../733-servicing-compliance-clock.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = '733-servicing-compliance-clock';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = JSON.parse(
  fs.readFileSync(path.join(HERE, '..', 'fixtures', KERNEL_ID + '.fixtures.json'), 'utf8'),
);
const REACH = JSON.parse(
  fs.readFileSync(path.join(HERE, '..', 'fixtures', KERNEL_ID + '.reachability.json'), 'utf8'),
);

const SEED = 20261014;
const N = 200;

// ---- independent oracle: Date-object civil/business-day engine (deliberately
// a different calendar engine from the kernel's day-count arithmetic).
function isoToDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function dateToIso(dt) { return dt.toISOString().slice(0, 10); }
const FED = (y) => {
  const nth = (m, dow, n) => { const d = new Date(Date.UTC(y, m - 1, 1)); const s = (dow - d.getUTCDay() + 7) % 7; return new Date(Date.UTC(y, m - 1, 1 + s + (n - 1) * 7)); };
  const last = (m, dow) => { const d = new Date(Date.UTC(y, m, 0)); const s = (d.getUTCDay() - dow + 7) % 7; return new Date(Date.UTC(y, m - 1, d.getUTCDate() - s)); };
  const fix = (m, dd) => { const d = new Date(Date.UTC(y, m - 1, dd)); const w = d.getUTCDay(); if (w === 6) d.setUTCDate(dd - 1); if (w === 0) d.setUTCDate(dd + 1); return d; };
  return new Set([fix(1, 1), nth(1, 1, 3), nth(2, 1, 3), last(5, 1), fix(6, 19), fix(7, 4), nth(9, 1, 1), nth(10, 1, 2), fix(11, 11), nth(11, 4, 4), fix(12, 25)].map((d) => d.toISOString().slice(0, 10)));
};
function isBD(dt) { const w = dt.getUTCDay(); if (w === 0 || w === 6) return false; return !FED(dt.getUTCFullYear()).has(dateToIso(dt)); }
function addBD(iso, n) {
  const d = isoToDate(iso); let left = n;
  for (let g = 0; g < 400; g++) {
    if (!isBD(d)) { d.setUTCDate(d.getUTCDate() + 1); continue; }
    if (left === 0) return dateToIso(d);
    d.setUTCDate(d.getUTCDate() + 1); left -= 1;
  }
  throw new Error('guard');
}

const BD_RULE_DAYS = [
  { rule: 'error_acknowledgment', days: 5 },
  { rule: 'payoff_statement', days: 7 },
  { rule: 'info_request_acknowledgment', days: 5 },
  { rule: 'loss_mit_acknowledgment', days: 5 },
];

/** Random VALID trigger date in 2026-2027 (windows where holiday density varies). */
function randomIso(rng) {
  const y = rng() < 0.5 ? 2026 : 2027;
  const month = 1 + Math.floor(rng() * 12);
  const day = 1 + Math.floor(rng() * 28);
  const p = (n) => (n < 10 ? '0' + n : String(n));
  return y + '-' + p(month) + '-' + p(day);
}

function randomValidPp(rng) {
  const pick = BD_RULE_DAYS[Math.floor(rng() * BD_RULE_DAYS.length)];
  const pp = { events: [{ rule: pick.rule, trigger_date: randomIso(rng) }] };
  if (pick.rule === 'loss_mit_acknowledgment') pp.events[0].foreclosure_sale_date = '2028-06-01'; // keep the 45-day gate open
  return pp;
}

// P1 — DETERMINISM: identical inputs, identical payload, byte-for-byte.
function checkDeterminism() {
  const rng = mulberry32(SEED);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(pp));
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P1-determinism-committed-seed', checked, violations };
}

// P2 — BUSINESS-DAY ORACLE PARITY: for every business-day rule the kernel due
// date equals the independent Date-object counter's due date, AND the due date
// itself is always a business day (never a weekend or federal holiday — the
// idempotence face of the shift: landing the clock on due leaves it valid).
function checkBusinessDayOracleParity() {
  const rng = mulberry32(SEED + 1);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const o = compute(pp).output_payload.obligations[0];
    const days = BD_RULE_DAYS.find((r) => r.rule === o.rule).days;
    const want = addBD(o.trigger_date, days);
    checked += 2;
    if (o.due_date !== want) violations++;
    if (!isBD(isoToDate(o.due_date))) violations++;
  }
  return { name: 'P2-business-day-oracle-parity-and-landing', checked, violations };
}

// P3 — DUE-DATE MONOTONICITY in trigger dates: shifting the trigger one
// calendar day later can never move the due date earlier (business-day shift is
// monotone across weekends and holidays), and shifting by a whole week moves it
// strictly later but never more than 13 calendar days (the 7-day shift plus
// up to 2 days of weekend anchor plus up to 2 federal holidays inside the
// span (Christmas/New Year cluster) — a weekend-anchored trigger starts its count on the next business day.
function checkMonotonicity() {
  const rng = mulberry32(SEED + 2);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const t = pp.events[0].trigger_date;
    const a = compute(pp).output_payload.obligations[0].due_date;
    const d1 = isoToDate(t); d1.setUTCDate(d1.getUTCDate() + 1);
    pp.events[0].trigger_date = dateToIso(d1);
    const b = compute(pp).output_payload.obligations[0].due_date;
    checked++;
    if (!(b >= a)) violations++;
    const d7 = isoToDate(t); d7.setUTCDate(d7.getUTCDate() + 7);
    pp.events[0].trigger_date = dateToIso(d7);
    const c = compute(pp).output_payload.obligations[0].due_date;
    const dd = isoToDate(a); dd.setUTCDate(dd.getUTCDate() + 13);
    checked += 2;
    if (!(c > b)) violations++;
    if (!(c <= dateToIso(dd))) violations++;
  }
  return { name: 'P3-due-date-monotone-in-trigger', checked, violations };
}

// P4 — STATE BOUNDARY EXACTNESS: an action exactly on the due date is MET; one
// calendar day later is BREACHED; a missing action stays WITHIN (clock running).
function checkStateBoundary() {
  const rng = mulberry32(SEED + 3);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const due = compute(pp).output_payload.obligations[0].due_date;
    const onTime = JSON.parse(JSON.stringify(pp)); onTime.events[0].action_date = due;
    const late = JSON.parse(JSON.stringify(pp));
    const dl = isoToDate(due); dl.setUTCDate(dl.getUTCDate() + 1);
    late.events[0].action_date = dateToIso(dl);
    const r0 = compute(pp).output_payload.obligations[0];
    const r1 = compute(onTime).output_payload.obligations[0];
    const r2 = compute(late).output_payload.obligations[0];
    checked += 3;
    if (r0.state !== 'within') violations++;
    if (r1.state !== 'met') violations++;
    if (r2.state !== 'breached') violations++;
  }
  return { name: 'P4-state-boundary-exactness', checked, violations };
}

// P5 — POST-IFR ABSENCE BY CONSTRUCTION: the rescinded COVID forbearance
// branch (former section 1024.39(e)) is refused for ANY trigger date, never
// computed against rescinded text.
function checkRemovedBranchAlwaysRefused() {
  const rng = mulberry32(SEED + 4);
  let checked = 0; let violations = 0;
  for (let i = 0; i < 40; i++) {
    const pp = { events: [{ rule: 'covid_forbearance_request', trigger_date: randomIso(rng) }] };
    const r = compute(pp);
    checked += 2;
    if (r.compliance_flags.indexOf('RULE_REMOVED_BY_2025_IFR_REFUSED') === -1) violations++;
    if (r.output_payload.verdict !== 'refused' || r.output_payload.obligations.length !== 0) violations++;
  }
  return { name: 'P5-removed-1024-39e-branch-refused', checked, violations };
}

// P6 — REFUSAL PATHS: every committed reachability vector fires its declared
// flag, refuses with manual_review_required true, and never emits a computed
// obligation on the refused run.
function checkRefusalPaths() {
  let checked = 0; let violations = 0;
  for (const vec of REACH.vectors) {
    const r = compute(vec.policy_parameters);
    checked++;
    const allFire = vec.observed_flags.every((f) => r.compliance_flags.indexOf(f) !== -1);
    if (!allFire || r.output_payload.verdict !== 'refused' || r.output_payload.manual_review_required !== true) violations++;
    checked++;
    if (r.output_payload.obligations.length !== 0) violations++;
  }
  return { name: 'P6-refusal-paths-reachable-no-echo', checked, violations };
}

// P7 — EVERY OBLIGATION CARRIES ITS PARAGRAPH CITATION: each emitted obligation
// names a 12-CFR cited_paragraph, a day basis, and a state from the closed
// {within, met, breached} enum; calendar-based outputs name their calendar
// assumption as null and business-day outputs name the federal-holiday calendar.
function checkCitationBasisState() {
  const rng = mulberry32(SEED + 5);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = { events: [{ rule: BD_RULE_DAYS[Math.floor(rng() * BD_RULE_DAYS.length)].rule, trigger_date: randomIso(rng) }] };
    const o = compute(pp).output_payload.obligations[0];
    checked += 4;
    if (typeof o.cited_paragraph !== 'string' || o.cited_paragraph.indexOf('12 CFR') !== 0) violations++;
    if (['within', 'met', 'breached'].indexOf(o.state) === -1) violations++;
    if (o.basis.indexOf('business_days') !== 0) violations++;
    if (o.calendar !== 'us_federal_holidays_observed') violations++;
  }
  return { name: 'P7-obligations-carry-citation-basis-state', checked, violations };
}

// P0b — CONFORMANCE FIXTURE PROVENANCE: every conformance vector carries an
// independent_oracle (source + source_digest + derivation) — a golden master
// without an oracle is a regression vector and does not belong in this file.
function checkFixtureProvenance() {
  let checked = 0; let violations = 0;
  for (const vec of FIXTURES.vectors) {
    checked++;
    const o = vec.independent_oracle;
    if (!o || !o.source || !o.source_digest || !o.derivation) violations++;
  }
  return { name: 'P0b-every-conformance-vector-has-independent-oracle', checked, violations };
}

// P8 — SHAPE: no NaN / undefined / non-finite anywhere in any output over the
// corpus plus structural edge inputs (empty pp, unknown rule, bad date).
function checkShape() {
  const rng = mulberry32(SEED + 6);
  let checked = 0; let violations = 0;
  const paths = [
    randomValidPp(rng),
    {},
    { events: [] },
    { events: [{ rule: 'nope', trigger_date: '2026-01-01' }] },
    { events: [{ rule: 'error_acknowledgment', trigger_date: 'not-a-date' }] },
  ];
  for (let i = 0; i < N; i++) paths.push(randomValidPp(rng));
  for (const pp of paths) {
    const { output_payload } = compute(pp);
    checked++;
    violations += findShapeViolations(output_payload).length;
  }
  return { name: 'P8-output-shape-no-nonfinite', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkFixtureProvenance(),
  checkDeterminism(),
  checkBusinessDayOracleParity(),
  checkMonotonicity(),
  checkStateBoundary(),
  checkRemovedBranchAlwaysRefused(),
  checkRefusalPaths(),
  checkCitationBasisState(),
  checkShape(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — servicing-compliance clock (event dates + values, cited obligations).`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
