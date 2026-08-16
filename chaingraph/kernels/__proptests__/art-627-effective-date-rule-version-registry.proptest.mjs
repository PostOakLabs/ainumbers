// art-627-effective-date-rule-version-registry — class-B PROPERTY-TEST FLOOR.
// kernel_digest_at_authoring: sha256:64836000e9e411175a31ce378e45f464cb8dc8f398ed04f409d94f764265cfe5
// spec: ACCT-INFRA-KERNELS-BUILD-SPEC.md Sec.2 (kernel spec) + Sec.4 (composition contract) +
//       workspace-root research/ACCT-RULEREG-K-1.spec.md +
//       research/clause-snapshots/ASU-2023-07-effective-date.excerpt.txt +
//       research/clause-snapshots/ASU-2023-09-effective-date.excerpt.txt
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md, class B — bounded date/enum resolution over a
// slice declared at max_slice_entries=32). NOT a proof, NOT Dafny. Internal engineering QC only.
//
// float_sensitive: NO (build spec Sec.2.4). This kernel does date and enum arithmetic only: integer
// arithmetic over parsed ISO components, no Date object, no locale, no timezone, no transcendental.
// The rounding property portfolio is therefore P6 (determinism) + P26-P29 (regulatory declaration /
// anti-fabrication / step-parity / field-completeness) ONLY. The float-specific groups do not apply
// and are deliberately NOT stamped on: a parameter_set value a downstream consumer treats as a float
// is THAT consumer's declaration, and this kernel transports it verbatim without rounding — P11
// below is the assertion that it does exactly that.
//
// ── THE INDEPENDENT ORACLE, stated plainly (STANDING-ORDERS.md #34) ──────────────────────────────
// P5 recomputes the slice digest with **node:crypto's createHash('sha256')** over its own
// independent key-sort canonicalizer — NOT the kernel's hand-rolled pure-JS SHA-256 and NOT its
// _rvCanon. P9 differentials the kernel's hand-rolled calendar arithmetic against **Date.UTC**.
// Both are real differential tests against a separate implementation, not a checker sharing code
// with the thing it checks.
//
// Checks: fixture-oracle gate (P0), totality over hostile inputs (P1), TOTAL RESOLUTION exhaustive
// over the closed filer-status enum crossed with the demonstrator standards and a date grid — every
// triple RESOLVED or explicitly NO_BINDING_ENTRY, never a silent undefined (P2, build spec Sec.2.4),
// FORCED boundary dates at day-before / day-of / day-after every effective_from and effective_to in
// the demonstrator slice (P3, forced not sampled), NON-OVERLAP asserted on the shipped entries and
// an injected overlap rejected (P4), independent-digest differential (P5), determinism (P6),
// anti-fabrication refusals — uncited entry, tampered digest, over-bound slice, closed-enum
// violation (P7), the max_slice_entries bound at exactly the boundary and one past it (P8),
// calendar arithmetic differentialled against Date.UTC including leap years and the Feb-29 clamp
// (P9), field completeness on every path (P10), and regulatory declaration — a resolved parameter is
// never a bare number (P11).
//
// Run: node chaingraph/kernels/__proptests__/art-627-effective-date-rule-version-registry.proptest.mjs

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compute } from '../art-627-effective-date-rule-version-registry.kernel.mjs';
import _ruleversion from '../_ruleversion.bundle.mjs';
import { runFixtureOracle, findShapeViolations, summarize, mulberry32, pickNasty, nullProtoClone } from './_pbt-common.mjs';

const KERNEL_ID = 'art-627-effective-date-rule-version-registry';
const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(HERE, '..', 'data', 'rule-registry');

const FILER_STATUSES = [
  'large_accelerated', 'accelerated', 'non_accelerated', 'smaller_reporting',
  'emerging_growth', 'private', 'non_public_business_entity',
];

const clone = (x) => JSON.parse(JSON.stringify(x));

// ── independent canonicalizer + SHA-256 (node:crypto, NOT the kernel's hand-rolled pure-JS one) ──
function indCanon(v) {
  if (Array.isArray(v)) return v.map(indCanon);
  if (v && typeof v === 'object') {
    const out = {};
    Object.keys(v).sort().forEach((k) => { out[k] = indCanon(v[k]); });
    return out;
  }
  return v;
}
function indSliceDigest(slice) {
  const stripped = Object.assign({}, slice);
  delete stripped.registry_digest;
  return createHash('sha256').update(JSON.stringify(indCanon(stripped)), 'utf8').digest('hex');
}

// ── the demonstrator slice, built from the row's OWN disjoint entry files and sealed with the ────
// ── INDEPENDENT digest, so every downstream property is exercised against a digest the kernel ───
// ── did not produce. If the kernel's hand-rolled SHA-256 disagreed with real SHA-256, every ─────
// ── property below would fail closed rather than quietly agreeing with itself. ──────────────────
function loadEntries(standardId) {
  return JSON.parse(readFileSync(resolve(DATA, `${standardId}.entry.json`), 'utf8')).entries;
}
const ENTRIES_07 = loadEntries('ASU-2023-07');
const ENTRIES_09 = loadEntries('ASU-2023-09');
function seal(entries) {
  const slice = { entries: clone(entries) };
  slice.registry_digest = indSliceDigest(slice);
  return slice;
}
const SLICE = seal([...ENTRIES_07, ...ENTRIES_09]);
const DEMO_STANDARDS = ['ASU-2023-07', 'ASU-2023-09'];

const OUTPUT_FIELDS = [
  'resolution_status', 'error_code', 'message', 'standard_id', 'filer_status', 'fiscal_year_end',
  'fiscal_year_begin', 'fiscal_year_begin_basis', 'effective_for_annual_periods_beginning',
  'effective_for_interim_periods_beginning', 'early_adoption_permitted',
  'binding_for_queried_annual_period', 'binding_for_queried_interim_periods',
  'first_binding_period_end', 'transition_method', 'parameter_set', 'parameter_set_as_of',
  'entry_digest', 'citation', 'registry_digest_recomputed', 'resolution_path', 'bounds',
  'closed_filer_status_enum', 'float_sensitive', 'scope_note',
];

// ── P1: TOTALITY over hostile inputs — never throws, never leaves a field undefined ─────────────
function checkP1_totality() {
  const rng = mulberry32(627001);
  let checked = 0, violations = 0;
  const hostile = [
    undefined, null, {}, { query: null, registry_slice: null }, { query: 42, registry_slice: 'x' },
    { query: { fiscal_year_end: '2024-12-31' }, registry_slice: { entries: [] } },
    { query: { fiscal_year_end: '2024-13-01', filer_status: 'private', standard_id: 'X' }, registry_slice: SLICE },
    { query: { fiscal_year_end: '2024-02-30', filer_status: 'private', standard_id: 'X' }, registry_slice: SLICE },
    { query: { fiscal_year_end: '24-12-31', filer_status: 'private', standard_id: 'X' }, registry_slice: SLICE },
    { registry_slice: { entries: [{}] } },
    nullProtoClone({ query: null, registry_slice: null }),
  ];
  for (const pp of hostile) {
    checked++;
    try {
      const { output_payload } = compute(pp);
      for (const f of OUTPUT_FIELDS) {
        if (output_payload[f] === undefined) { violations++; break; }
      }
    } catch { violations++; }
  }
  for (let i = 0; i < 300; i++) {
    checked++;
    const pp = { query: { fiscal_year_end: pickNasty(rng), filer_status: pickNasty(rng), standard_id: pickNasty(rng) }, registry_slice: pickNasty(rng) };
    try {
      const { output_payload } = compute(pp);
      if (OUTPUT_FIELDS.some((f) => output_payload[f] === undefined)) violations++;
    } catch { violations++; }
  }
  return { name: 'P1_totality_never_throws_never_undefined', checked, violations };
}

// ── P2: TOTAL RESOLUTION (build spec Sec.2.4) ───────────────────────────────────────────────────
// Every (fiscal_year_end, filer_status, standard_id) triple in the DECLARED domain resolves to
// exactly one entry or to an explicit NO_BINDING_ENTRY. Exhaustive over the closed enum and the
// demonstrator standards, crossed with a dense date grid. Never a silent undefined, never an error.
function checkP2_totalResolution() {
  let checked = 0, violations = 0;
  const dates = [];
  for (let y = 2022; y <= 2028; y++) {
    for (const md of ['-01-01', '-06-30', '-12-15', '-12-16', '-12-31']) dates.push(String(y) + md);
  }
  for (const sid of DEMO_STANDARDS) {
    for (const fs of FILER_STATUSES) {
      for (const d of dates) {
        checked++;
        const { output_payload: o } = compute({ query: { fiscal_year_end: d, filer_status: fs, standard_id: sid }, registry_slice: SLICE });
        if (o.error_code !== null) { violations++; continue; }
        if (o.resolution_status !== 'RESOLVED' && o.resolution_status !== 'NO_BINDING_ENTRY') { violations++; continue; }
        if (o.resolution_status === 'RESOLVED') {
          // Exactly ONE entry: the resolved standard_id must be the queried one and the entry must
          // actually declare the queried filer status.
          const matches = SLICE.entries.filter((e) => e.standard_id === sid && e.applies_to_filer_statuses.includes(fs));
          if (matches.length !== 1) violations++;
          else if (o.standard_id !== sid) violations++;
          else if (o.entry_digest === null) violations++;
        } else {
          const matches = SLICE.entries.filter((e) => e.standard_id === sid && e.applies_to_filer_statuses.includes(fs));
          if (matches.length !== 0) violations++;
        }
      }
    }
  }
  // A standard absent from the slice entirely is still total.
  for (const fs of FILER_STATUSES) {
    checked++;
    const { output_payload: o } = compute({ query: { fiscal_year_end: '2026-12-31', filer_status: fs, standard_id: 'IFRS-18' }, registry_slice: SLICE });
    if (o.resolution_status !== 'NO_BINDING_ENTRY' || o.error_code !== null) violations++;
  }
  return { name: 'P2_total_resolution_exhaustive_over_closed_enum', checked, violations };
}

// ── P3: BOUNDARY DATES FORCED, NOT SAMPLED (build spec Sec.2.4) ─────────────────────────────────
// For every effective_from and effective_to appearing anywhere in the demonstrator slice, force the
// day before, the day of, and the day after — as the fiscal year's BEGINNING, since that is the
// measurement the source text keys on — and assert the inclusive/exclusive semantics exactly.
function isoAddDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n)); // independent oracle: Date.UTC, not the kernel's arithmetic
  return t.toISOString().slice(0, 10);
}
function collectBoundaryDates() {
  const set = new Set();
  for (const e of SLICE.entries) {
    set.add(e.effective_for_annual_periods_beginning);
    if (e.effective_for_interim_periods_beginning) set.add(e.effective_for_interim_periods_beginning);
    for (const name of Object.keys(e.parameter_set)) {
      for (const v of e.parameter_set[name]) {
        set.add(v.effective_from);
        if (v.effective_to) set.add(v.effective_to);
      }
    }
  }
  return Array.from(set).sort();
}
function checkP3_forcedBoundaryDates() {
  let checked = 0, violations = 0;
  const boundaries = collectBoundaryDates();
  // Guard: if the demonstrator slice ever stops carrying distinct effective dates, this property
  // would silently check nothing. Fail loudly instead of reporting a vacuous pass.
  if (boundaries.length < 3) return { name: 'P3_boundary_dates_forced_not_sampled', checked: 0, violations: 1 };
  for (const b of boundaries) {
    for (const offset of [-1, 0, 1]) {
      const begin = isoAddDays(b, offset);
      const end = isoAddDays(begin, 364);
      for (const sid of DEMO_STANDARDS) {
        for (const fs of FILER_STATUSES) {
          checked++;
          const { output_payload: o } = compute({
            query: { fiscal_year_end: end, filer_status: fs, standard_id: sid, fiscal_year_begin: begin },
            registry_slice: SLICE,
          });
          if (o.error_code !== null) { violations++; continue; }
          if (o.resolution_status !== 'RESOLVED') continue;
          // Annual binding is INCLUSIVE of the effective date: begin >= effective.
          const expectAnnual = begin >= o.effective_for_annual_periods_beginning;
          if (o.binding_for_queried_annual_period !== expectAnnual) { violations++; continue; }
          const expectInterim = o.effective_for_interim_periods_beginning === null
            ? false
            : begin >= o.effective_for_interim_periods_beginning;
          if (o.binding_for_queried_interim_periods !== expectInterim) { violations++; continue; }
          // Parameter windows are HALF-OPEN [from, to): the day a window ends belongs to the NEXT one.
          for (const pname of Object.keys(o.parameter_set)) {
            const p = o.parameter_set[pname];
            if (p.status !== 'IN_FORCE') continue;
            if (!(begin >= p.effective_from)) { violations++; break; }
            if (p.effective_to !== null && !(begin < p.effective_to)) { violations++; break; }
          }
        }
      }
    }
  }
  return { name: 'P3_boundary_dates_forced_not_sampled', checked, violations };
}

// ── P4: NON-OVERLAP asserted, never assumed (build spec Sec.2.4) ────────────────────────────────
function checkP4_nonOverlap() {
  let checked = 0, violations = 0;
  // (a) the shipped demonstrator entries genuinely have non-overlapping windows, checked here by an
  //     independent pairwise sweep rather than by trusting the kernel's own validator.
  for (const e of SLICE.entries) {
    for (const name of Object.keys(e.parameter_set)) {
      const vs = e.parameter_set[name];
      for (let a = 0; a < vs.length; a++) {
        for (let b = a + 1; b < vs.length; b++) {
          checked++;
          const aEnd = vs[a].effective_to === null ? '9999-12-31' : vs[a].effective_to;
          const bEnd = vs[b].effective_to === null ? '9999-12-31' : vs[b].effective_to;
          if (vs[a].effective_from < bEnd && vs[b].effective_from < aEnd) violations++;
        }
      }
    }
  }
  // (b) an INJECTED overlap must be REJECTED, not silently first-wins. Without this half, (a) only
  //     says the shipped data happens to be clean.
  const bad = clone(SLICE);
  bad.entries[0].parameter_set.segment_disclosure_scope[1].effective_from = '2024-06-01';
  bad.registry_digest = indSliceDigest(bad);
  checked++;
  const { output_payload: o } = compute({ query: { fiscal_year_end: '2024-12-31', filer_status: 'large_accelerated', standard_id: 'ASU-2023-07' }, registry_slice: bad });
  if (o.error_code !== 'SLICE_PARAMETER_WINDOWS_OVERLAP') violations++;
  // (c) abutting windows [a,b) [b,c) must NOT be flagged — an over-strict check is also a defect.
  checked++;
  const { output_payload: ok } = compute({ query: { fiscal_year_end: '2024-12-31', filer_status: 'large_accelerated', standard_id: 'ASU-2023-07' }, registry_slice: SLICE });
  if (ok.error_code !== null) violations++;
  return { name: 'P4_parameter_window_non_overlap_asserted', checked, violations };
}

// ── P5: INDEPENDENT DIGEST DIFFERENTIAL (SO #34) ────────────────────────────────────────────────
function checkP5_independentDigestDifferential() {
  const rng = mulberry32(627005);
  let checked = 0, violations = 0;
  for (let i = 0; i < 60; i++) {
    const s = clone(SLICE);
    // Perturb the slice in a structure-preserving way so many distinct byte strings are hashed.
    s.entries[0].transition_method = 'retrospective_' + Math.floor(rng() * 1e9);
    const independent = indSliceDigest(s);
    s.registry_digest = independent;
    checked++;
    const { output_payload: o } = compute({ query: { fiscal_year_end: '2024-12-31', filer_status: 'large_accelerated', standard_id: 'ASU-2023-07' }, registry_slice: s });
    if (o.registry_digest_recomputed !== independent) violations++;
    else if (o.error_code === 'SLICE_DIGEST_MISMATCH') violations++;
  }
  // Non-ASCII must agree too: the hand-rolled UTF-8 encoder is part of what is being differentialled.
  for (const suffix of ['é', '€', '😀', '中文']) {
    const s = clone(SLICE);
    s.entries[0].transition_method = 'retrospective' + suffix;
    const independent = indSliceDigest(s);
    s.registry_digest = independent;
    checked++;
    const { output_payload: o } = compute({ query: { fiscal_year_end: '2024-12-31', filer_status: 'large_accelerated', standard_id: 'ASU-2023-07' }, registry_slice: s });
    if (o.registry_digest_recomputed !== independent) violations++;
  }
  return { name: 'P5_independent_digest_differential_node_crypto', checked, violations };
}

// ── P6: DETERMINISM (portfolio P6) ──────────────────────────────────────────────────────────────
function checkP6_determinism() {
  const rng = mulberry32(627006);
  let checked = 0, violations = 0;
  for (let i = 0; i < 200; i++) {
    const fs = FILER_STATUSES[Math.floor(rng() * FILER_STATUSES.length)];
    const sid = DEMO_STANDARDS[Math.floor(rng() * DEMO_STANDARDS.length)];
    const y = 2022 + Math.floor(rng() * 7);
    const m = 1 + Math.floor(rng() * 12);
    const d = 1 + Math.floor(rng() * 28);
    const pp = { query: { fiscal_year_end: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, filer_status: fs, standard_id: sid }, registry_slice: SLICE };
    checked++;
    const a = compute(clone(pp));
    const b = compute(clone(pp));
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  }
  return { name: 'P6_determinism_on_recompute', checked, violations };
}

// ── P7: ANTI-FABRICATION (portfolio P27) — every named hazard REFUSES, fail-closed ──────────────
function checkP7_antiFabrication() {
  let checked = 0, violations = 0;
  const base = { fiscal_year_end: '2024-12-31', filer_status: 'large_accelerated', standard_id: 'ASU-2023-07' };

  // (a) tampered slice: bytes changed after sealing -> digest no longer matches.
  const tampered = clone(SLICE);
  tampered.entries[0].effective_for_annual_periods_beginning = '2020-01-01';
  checked++;
  if (compute({ query: base, registry_slice: tampered }).output_payload.error_code !== 'SLICE_DIGEST_MISMATCH') violations++;

  // (b) declared digest absent entirely -> refused, not defaulted to "trust it".
  const noDigest = clone(SLICE);
  delete noDigest.registry_digest;
  checked++;
  if (compute({ query: base, registry_slice: noDigest }).output_payload.error_code !== 'SLICE_DIGEST_MISMATCH') violations++;

  // (c) an entry with no citation digest -> REJECTED, not warned about.
  const uncited = clone(SLICE);
  delete uncited.entries[0].citation.source_digest;
  uncited.registry_digest = indSliceDigest(uncited);
  checked++;
  if (compute({ query: base, registry_slice: uncited }).output_payload.error_code !== 'SLICE_UNCITED_ENTRY') violations++;

  // (d) a bare-number parameter -> REJECTED (a parameter is ALWAYS a versioned tuple).
  const bare = clone(SLICE);
  bare.entries[0].parameter_set.segment_disclosure_scope = 5;
  bare.registry_digest = indSliceDigest(bare);
  checked++;
  if (compute({ query: base, registry_slice: bare }).output_payload.error_code !== 'SLICE_INVALID_PARAMETER') violations++;

  // (e) two entries covering the same triple -> REJECTED (total resolution needs exactly one).
  const dup = clone(SLICE);
  dup.entries.push(clone(SLICE.entries[0]));
  dup.registry_digest = indSliceDigest(dup);
  checked++;
  if (compute({ query: base, registry_slice: dup }).output_payload.error_code !== 'SLICE_DUPLICATE_ENTRY_KEY') violations++;

  // (f) a filer status outside the closed enum -> REFUSED, never coerced.
  for (const bogus of ['quasi_public', 'LARGE_ACCELERATED', '', null, 0, {}]) {
    checked++;
    const o = compute({ query: { ...base, filer_status: bogus }, registry_slice: SLICE }).output_payload;
    if (o.error_code !== 'QUERY_INVALID_FILER_STATUS') violations++;
  }

  // (g) a fiscal_year_end that is not a real calendar date -> REFUSED, never coerced.
  for (const bogus of ['2023-02-30', '2023-13-01', '2023-00-10', '2023-1-1', '20231231', '2023-02-29']) {
    checked++;
    const o = compute({ query: { ...base, fiscal_year_end: bogus }, registry_slice: SLICE }).output_payload;
    if (o.error_code !== 'QUERY_INVALID_FISCAL_YEAR_END') violations++;
  }
  // ...and a real leap day IS accepted, so (g) is not passing by rejecting everything.
  checked++;
  if (compute({ query: { ...base, fiscal_year_end: '2024-02-29' }, registry_slice: SLICE }).output_payload.error_code !== null) violations++;

  return { name: 'P7_anti_fabrication_named_refusals_fail_closed', checked, violations };
}

// ── P8: the declared bound, at the boundary and one past it (build spec Sec.2.3) ────────────────
function checkP8_sliceBound() {
  let checked = 0, violations = 0;
  const MAX = _ruleversion.MAX_SLICE_ENTRIES;
  if (MAX !== 32) violations++; // the bound is DECLARED as 32; a silent raise is a defect
  checked++;
  for (const n of [MAX - 1, MAX, MAX + 1]) {
    const s = { entries: [] };
    for (let i = 0; i < n; i++) {
      const e = clone(ENTRIES_07[0]);
      e.standard_id = 'SYNTH-' + String(i).padStart(3, '0');
      s.entries.push(e);
    }
    s.registry_digest = indSliceDigest(s);
    checked++;
    const o = compute({ query: { fiscal_year_end: '2026-12-31', filer_status: 'large_accelerated', standard_id: 'SYNTH-000' }, registry_slice: s }).output_payload;
    if (n <= MAX) { if (o.error_code !== null) violations++; }
    else if (o.error_code !== 'SLICE_MAX_ENTRIES_EXCEEDED') violations++;
  }
  // The bound is also REPORTED, so a consumer can see it without reading the source.
  checked++;
  const o = compute({ query: { fiscal_year_end: '2024-12-31', filer_status: 'large_accelerated', standard_id: 'ASU-2023-07' }, registry_slice: SLICE }).output_payload;
  if (o.bounds.max_slice_entries !== MAX) violations++;
  return { name: 'P8_max_slice_entries_bound_at_boundary', checked, violations };
}

// ── P9: calendar arithmetic differentialled against Date.UTC (an independent implementation) ────
function checkP9_calendarArithmetic() {
  let checked = 0, violations = 0;
  const { addDays, addYears, formatISODate, parseISODate, isLeapYear, daysInMonth } = _ruleversion;

  // Leap-year rule, including the 100/400 exceptions, against Date.UTC.
  for (let y = 1896; y <= 2404; y++) {
    checked++;
    const oracle = new Date(Date.UTC(y, 1, 29)).getUTCMonth() === 1;
    if (isLeapYear(y) !== oracle) violations++;
    for (let m = 1; m <= 12; m++) {
      checked++;
      const oracleDim = new Date(Date.UTC(y, m, 0)).getUTCDate();
      if (daysInMonth(y, m) !== oracleDim) violations++;
    }
  }
  // addDays(+/-1) against Date.UTC across every month boundary in a leap and a non-leap year.
  for (const y of [2023, 2024]) {
    for (let m = 1; m <= 12; m++) {
      for (const d of [1, 15, 28, daysInMonth(y, m)]) {
        const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        for (const n of [-1, 0, 1]) {
          checked++;
          const got = formatISODate(addDays(parseISODate(iso), n));
          const want = new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
          if (got !== want) violations++;
        }
      }
    }
  }
  // The Feb-29 clamp is DECLARED behaviour, not an accident: addYears(2024-02-29, 1) = 2025-02-28.
  checked++;
  if (formatISODate(addYears(parseISODate('2024-02-29'), 1)) !== '2025-02-28') violations++;
  checked++;
  if (formatISODate(addYears(parseISODate('2024-02-29'), 4)) !== '2028-02-29') violations++;
  checked++;
  if (formatISODate(addYears(parseISODate('2024-02-29'), -1)) !== '2023-02-28') violations++;
  return { name: 'P9_calendar_arithmetic_vs_date_utc_oracle', checked, violations };
}

// ── P10: FIELD COMPLETENESS (portfolio P29) — the same field set on every path ──────────────────
function checkP10_fieldCompleteness() {
  let checked = 0, violations = 0;
  const cases = [
    { query: { fiscal_year_end: '2024-12-31', filer_status: 'large_accelerated', standard_id: 'ASU-2023-07' }, registry_slice: SLICE },
    { query: { fiscal_year_end: '2024-12-31', filer_status: 'private', standard_id: 'ASU-2023-07' }, registry_slice: SLICE },
    { query: { fiscal_year_end: '2024-12-31', filer_status: 'private', standard_id: 'NOT-IN-SLICE' }, registry_slice: SLICE },
    { query: { fiscal_year_end: '2023-02-30', filer_status: 'private', standard_id: 'ASU-2023-07' }, registry_slice: SLICE },
    {},
  ];
  for (const pp of cases) {
    checked++;
    const { output_payload: o } = compute(pp);
    if (findShapeViolations(o).length) { violations++; continue; }
    const keys = Object.keys(o).sort();
    if (keys.join(',') !== OUTPUT_FIELDS.slice().sort().join(',')) { violations++; continue; }
    if (!Array.isArray(o.closed_filer_status_enum) || o.closed_filer_status_enum.length !== 7) { violations++; continue; }
    if (o.float_sensitive !== false) { violations++; continue; }
    if (typeof o.scope_note !== 'string' || o.scope_note.length === 0) { violations++; continue; }
    if (!Array.isArray(o.resolution_path)) violations++;
  }
  return { name: 'P10_field_completeness_same_shape_every_path', checked, violations };
}

// ── P11: REGULATORY DECLARATION (portfolio P26) + step-parity (P28) ─────────────────────────────
// A resolved parameter is NEVER a bare number: it always arrives with its own window, source and
// source_digest, and the value is transported VERBATIM — byte-identical to the entry file, never
// rounded or reformatted. And the resolution_path records the steps actually taken.
function checkP11_regulatoryDeclaration() {
  let checked = 0, violations = 0;
  for (const sid of DEMO_STANDARDS) {
    for (const fs of FILER_STATUSES) {
      for (const fye of ['2024-12-31', '2025-12-31', '2026-12-31', '2027-12-31']) {
        checked++;
        const { output_payload: o } = compute({ query: { fiscal_year_end: fye, filer_status: fs, standard_id: sid }, registry_slice: SLICE });
        if (o.resolution_status !== 'RESOLVED') continue;
        if (!o.citation || typeof o.citation.source_digest !== 'string' || o.citation.source_digest.length === 0) { violations++; continue; }
        if (typeof o.entry_digest !== 'string' || o.entry_digest.length !== 64) { violations++; continue; }
        const src = SLICE.entries.find((e) => e.standard_id === sid && e.applies_to_filer_statuses.includes(fs));
        let bad = false;
        for (const pname of Object.keys(o.parameter_set)) {
          const p = o.parameter_set[pname];
          if (p.status === 'IN_FORCE') {
            if (typeof p.source !== 'string' || !p.source) { bad = true; break; }
            if (typeof p.source_digest !== 'string' || !p.source_digest) { bad = true; break; }
            if (p.effective_from === null) { bad = true; break; }
            // VERBATIM transport: the emitted value must be byte-identical to the entry file's.
            const version = src.parameter_set[pname].find((v) => v.effective_from === p.effective_from);
            if (!version || JSON.stringify(version.value) !== JSON.stringify(p.value)) { bad = true; break; }
          } else if (p.status === 'NO_VERSION_IN_FORCE') {
            if (p.value !== null) { bad = true; break; }
          } else { bad = true; break; }
        }
        if (bad) { violations++; continue; }
        // Step-parity: the path records the steps that were actually taken, in order.
        const path = o.resolution_path;
        if (path[0] !== 'query_validated') { violations++; continue; }
        if (!path.some((s) => s === 'slice_digest_verified')) { violations++; continue; }
        if (!path.some((s) => s.startsWith('entry_matched:'))) { violations++; continue; }
        if (!path.some((s) => s.startsWith('parameter_set_resolved_as_of:'))) { violations++; continue; }
        if (!path.includes('parameter_set_resolved_as_of:' + o.parameter_set_as_of)) violations++;
      }
    }
  }
  // A NO_BINDING_ENTRY result carries the named step too, never an empty path.
  checked++;
  const { output_payload: nb } = compute({ query: { fiscal_year_end: '2026-12-31', filer_status: 'private', standard_id: 'ASU-2023-07' }, registry_slice: SLICE });
  if (!nb.resolution_path.includes('no_entry_for_triple')) violations++;
  return { name: 'P11_regulatory_declaration_verbatim_transport_step_parity', checked, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_totality(),
  checkP2_totalResolution(),
  checkP3_forcedBoundaryDates(),
  checkP4_nonOverlap(),
  checkP5_independentDigestDifferential(),
  checkP6_determinism(),
  checkP7_antiFabrication(),
  checkP8_sliceBound(),
  checkP9_calendarArithmetic(),
  checkP10_fieldCompleteness(),
  checkP11_regulatoryDeclaration(),
];
console.log(`[${KERNEL_ID}] class-B property floor — P5 differentials the kernel's hand-rolled SHA-256/canon against node:crypto, P9 differentials its calendar arithmetic against Date.UTC; P2 is the total-resolution proof over the closed filer-status enum and P3 forces every boundary date rather than sampling`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
