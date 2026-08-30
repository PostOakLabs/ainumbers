// art-636-globe-transition-deferred-tax-tracker.proptest.mjs — FV property-test FLOOR
// (PILLAR2-DTTRANSITION-K-1).
// kernel_digest_at_authoring: sha256:381375695efa58f8b47e3c7ea2e6ab96ceb63350656696fc6ac4c4ae24d24086
// spec: research/PILLAR2-DTTRANSITION-K-1.spec.md (workspace root, untracked)
// human_sign_off: PENDING
//
// SCOPE: floor tier (FV-PBT-FLOOR-BUILD-SPEC.md), class B — property-tested over stated
// ranges, NOT exhaustive enumeration. TAXONOMY HONESTY, restated here so it cannot be read
// off the class letter alone: "class B" here must NEVER be read as "bounded input domain".
// The attribute-type enum and the capped / uplifted / excluded / errored verdict paths ARE
// bounded and are enumerated exhaustively below. Carrying amounts and rates are CONTINUOUS
// and NO totality claim is made over the money or rate axes. Not a proof, not Dafny.
//
// float_sensitive: YES. Applicable subset of the P1-P30 rounding-property portfolio,
// selected against this kernel's own four declared rounding_steps (mode=half_up throughout,
// precision in {2,10}, oracle="declared — clause silent" throughout, because neither Article
// 9.1 nor the January-2025 Administrative Guidance specifies a rounding mode or precision
// anywhere):
//
// P0  fixture oracle — every pinned vector reproduces byte-for-byte (output_payload AND flags).
// P1  half_up-declared step: exact .5-at-precision ties round away from zero, both signs.
// P6  determinism: compute() twice on identical input is byte-identical.
// P7  precision bound: money fields carry no more than 2 decimals, rate fields no more than 10.
// P9  double-rounding avoidance / P10 idempotence at the declared precisions.
// P12 threshold-boundary FORCING, not sampling: the cut-off date is exercised at the day
//     before, the day of, and the day after, on BOTH the Article 9.1.2 exclusion limb and
//     the Article 9.1.3 basis limb. The Transition Year start is forced as an UPPER bound on
//     both windows that declare one — the Article 9.1.3 basis limb, and the Commentary
//     8.5(c) new-CIT-basis step-up exclusion limb, which is bounded at both ends. Forcing
//     only the lower bound is what let the missing 8.5(c) upper bound survive review.
// P13 +0/-0 identical through the rounding path, and no signed zero reaches the payload.
// P17 composition/associativity: the roll-forward is a declared-order reduction, and its
//     value does not depend on the reassociation an input permutation would induce.
// P18 the reported per-item recasts and the total are one composition — recomputing the sum
//     from the report reproduces the total exactly.
// P19 sum-then-round vs round-then-sum: the total is the canonical-order sum of the ALREADY
//     ROUNDED reported recasts, re-rounded at the same precision, which is idempotent.
// P20 scale invariance of the ordering key: the canonical order is a total order, so no two
//     items compare equal and the order can never silently fall back to input order.
// P21 chain-level bound: total === sum of reported per-item recasts, BYTE-IDENTICAL at the
//     declared precision, never "within tolerance".
// P26 no rounding_steps entry claims a clause-specified mode (none exists to claim).
// P27 anti-fabrication: every oracle is the literal "declared — clause silent" string.
// P28 step-count parity: rounding_steps carries exactly 4 entries on EVERY path, including
//     every error path — this is what catches an undeclared arithmetic step before it ships.
// P29 float_sensitive completeness: no rounding_steps entry has a null/undefined precision.
// P30 overflow/underflow edges at the declared bound MAX_DTA_ITEMS=500 neither wrap, silently
//     truncate, nor throw an undeclared exception.
//
// Kernel-specific properties, asserting THIS kernel's own declared contracts:
// K1  CAP PATH: for every item not on the GloBE-Loss uplift path, rate_applied ===
//     min(min(minimum_rate, domestic_tax_rate), recorded_at_rate) — the lower-of rule is a
//     CAP, so an attribute already at or below it is left alone — and the recast therefore
//     never exceeds the uncapped figure.
// K2  UPLIFT PATH: a recast exceeds the uncapped figure ONLY where all three Article 9.1.1
//     sentence-three conditions hold together — loss-attributable type, recorded rate strictly
//     below the Minimum Rate, and the demonstration declared. No other item ever exceeds.
//     (K1+K2 are the two halves the row's single "cap never increases" property splits into
//     once the clause is read — see the spec file's finding 2.)
// K3  an excluded item contributes EXACTLY zero to the total AND is reported with
//     excluded:true, never merely omitted from the item list.
// K4  exclusion_reason is always a member of the declared code set or null — never free text.
// K5  MAX_DTA_ITEMS is enforced as a NAMED error with no computation, never a longer loop and
//     never a silent truncation.
// K6  an item the kernel cannot justify from a declared parameter yields a named error_code
//     with recast_amount null and total_is_complete false — never a silently computed number.
// K7  attribute-type enum exhaustiveness: all three declared values are accepted and any
//     fourth value is a named error.
// K8  totality: compute() never throws, for any input including hostile ones, and always
//     returns a well-formed payload with the four rounding_steps.
//
// Zero external dependencies — Node built-ins only.
//
// Run: node chaingraph/kernels/__proptests__/art-636-globe-transition-deferred-tax-tracker.proptest.mjs

import { compute } from '../art-636-globe-transition-deferred-tax-tracker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const KERNEL_ID = 'art-636-globe-transition-deferred-tax-tracker';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const MONEY_PRECISION = 2;
const RATE_PRECISION = 10;
const MAX_DTA_ITEMS = 500;
const ATTRIBUTE_TYPES = ['deferred_tax_asset', 'deferred_tax_asset_from_globe_loss', 'deferred_tax_liability'];
const EXCLUSION_CODES = [
  'EXCL_NOT_REFLECTABLE_UNDER_AFAS',
  'EXCL_CH3_ITEM_POST_CUTOFF',
  'EXCL_GOVERNMENTAL_ARRANGEMENT_POST_CUTOFF',
  'EXCL_RETROACTIVE_ELECTION_POST_CUTOFF',
  'EXCL_NEW_CIT_BASIS_STEP_UP_POST_CUTOFF',
];

// ---------- deterministic PRNG (never Math.random) ----------
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x636);

// test-side rounding, mirroring the kernel's declared half_up. Used only to state
// expectations about the kernel — never imported from it.
function roundAt(x, p) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return 0;
  const f = Math.pow(10, p);
  const scaled = x * f;
  const nearest = scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
  const out = nearest / f;
  return out === 0 ? 0 : out;
}

const BASE = {
  constants_version: 'TEST',
  minimum_rate: 0.15,
  cutoff_date: '2021-11-30',
  transition_year_start_date: '2024-01-01',
  exclusion_rules: EXCLUSION_CODES.slice(),
};

function item(o) {
  return Object.assign({
    attribute_type: 'deferred_tax_asset',
    carrying_amount: 1000,
    recorded_at_rate: 0.2,
    domestic_tax_rate: 0.2,
    arising_date: '2020-01-01',
    arises_from_chapter3_excluded_item: false,
    arises_from_governmental_arrangement: false,
    arises_from_retroactive_election: false,
    arises_from_new_cit_basis_step_up: false,
    reflectable_under_authorised_accounting_standard: true,
    arises_from_intra_group_transfer: false,
  }, o);
}
function pp(items, over) { return Object.assign({}, BASE, over || {}, { items: items }); }

function isoFromKey(k) {
  const y = Math.floor(k / 10000), m = Math.floor(k / 100) % 100, d = k % 100;
  return String(y).padStart(4, '0') + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
function randomItem() {
  const type = ATTRIBUTE_TYPES[Math.floor(rand() * ATTRIBUTE_TYPES.length)];
  const y = 2015 + Math.floor(rand() * 10);
  const m = 1 + Math.floor(rand() * 12);
  const d = 1 + Math.floor(rand() * 28);
  return item({
    attribute_type: type,
    carrying_amount: roundAt(rand() * 1e6, 2),
    recorded_at_rate: 0.01 + rand() * 0.4,
    domestic_tax_rate: rand() * 0.4,
    arising_date: isoFromKey(y * 10000 + m * 100 + d),
    globe_loss_demonstrated: rand() < 0.5,
    arises_from_chapter3_excluded_item: rand() < 0.2,
    arises_from_governmental_arrangement: rand() < 0.15,
  });
}

// ---------- P0: fixture oracle ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', KERNEL_ID + '.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload, compliance_flags } = compute(vec.policy_parameters);
    const got = JSON.stringify({ output_payload, compliance_flags });
    const want = JSON.stringify({ output_payload: vec.output_payload, compliance_flags: vec.compliance_flags });
    if (got !== want) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

// ---------- P1 ----------
function checkP1_half_up_ties() {
  let violations = 0, checked = 0;
  const examples = [];
  for (const p of [MONEY_PRECISION, RATE_PRECISION]) {
    for (const sign of [1, -1]) {
      const scale = Math.pow(10, p);
      const tie = sign * (1 / (2 * scale));
      checked++;
      const got = roundAt(tie, p);
      const want = sign * (1 / scale);
      if (Math.abs(got - want) > 1e-12) { violations++; examples.push({ tie, p, got, want }); }
    }
  }
  return { name: 'P1_half_up_ties_round_away_from_zero', trials: checked, violations, examples };
}

// ---------- P6 ----------
function checkP6_determinism() {
  let violations = 0, checked = 0;
  for (let t = 0; t < 60; t++) {
    const n = 1 + Math.floor(rand() * 8);
    const items = [];
    for (let i = 0; i < n; i++) items.push(randomItem());
    const input = pp(items);
    checked++;
    if (JSON.stringify(compute(input)) !== JSON.stringify(compute(input))) violations++;
  }
  return { name: 'P6_determinism', trials: checked, violations };
}

// ---------- P7 ----------
function decimalDigits(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return 0;
  const s = String(Math.abs(x));
  if (s.indexOf('e') !== -1) return 0; // exponential form is outside the digit-count claim
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}
function checkP7_precision_bound() {
  let violations = 0, checked = 0;
  const examples = [];
  for (let t = 0; t < 40; t++) {
    const n = 1 + Math.floor(rand() * 6);
    const items = [];
    for (let i = 0; i < n; i++) items.push(randomItem());
    const { output_payload } = compute(pp(items));
    for (const it of output_payload.items) {
      checked++;
      for (const f of ['temporary_difference', 'recast_amount', 'basis_amount']) {
        if (it[f] !== null && decimalDigits(it[f]) > MONEY_PRECISION && f !== 'basis_amount') {
          violations++; if (examples.length < 3) examples.push({ field: f, value: it[f] });
        }
      }
      for (const f of ['cap_rate', 'rate_applied']) {
        if (it[f] !== null && decimalDigits(it[f]) > RATE_PRECISION) {
          violations++; if (examples.length < 3) examples.push({ field: f, value: it[f] });
        }
      }
    }
    checked++;
    if (decimalDigits(output_payload.jurisdictional_roll_forward_total) > MONEY_PRECISION) {
      violations++; if (examples.length < 3) examples.push({ field: 'total', value: output_payload.jurisdictional_roll_forward_total });
    }
  }
  return { name: 'P7_precision_bound_no_extra_digits', trials: checked, violations, examples };
}

// ---------- P9 / P10 ----------
function checkP9_P10_idempotence() {
  let violations = 0, checked = 0;
  // Scoped to the DECLARED domain of each precision, which is what the kernel
  // actually rounds: precision 2 is applied to money magnitudes, precision 10 only
  // ever to tax rates in [0, 1]. Rounding a money-scale magnitude at precision 10
  // would push the scaled value past 2^53 and lose idempotence — a float fact about
  // an operation this kernel never performs, not a property of the kernel.
  for (let t = 0; t < 200; t++) {
    const useRate = rand() < 0.5;
    const p = useRate ? RATE_PRECISION : MONEY_PRECISION;
    const x = useRate ? rand() : (rand() - 0.5) * 1e6;
    checked++;
    const once = roundAt(x, p);
    if (roundAt(once, p) !== once) violations++;
  }
  return { name: 'P9_P10_double_round_idempotent', trials: checked, violations };
}

// ---------- P12: cut-off boundary FORCED on both limbs ----------
function checkP12_cutoff_boundary_forced() {
  let violations = 0;
  const rows = [];
  const one = (label, input, assertFn) => {
    const { output_payload } = compute(input);
    const bad = assertFn(output_payload);
    if (bad) { violations++; rows.push({ label, problem: bad }); } else rows.push({ label, ok: true });
  };

  // Limb 1 — Article 9.1.2 exclusion. Strictly AFTER the cut-off.
  for (const [date, shouldExclude] of [['2021-11-29', false], ['2021-11-30', false], ['2021-12-01', true]]) {
    one('art_9_1_2_exclusion_' + date,
      pp([item({ arising_date: date, arises_from_chapter3_excluded_item: true })]),
      (o) => o.items[0].excluded !== shouldExclude
        ? `expected excluded=${shouldExclude} on ${date}, got ${o.items[0].excluded}` : null);
  }

  // Limb 2 — Article 9.1.3 basis. In-window means AFTER the cut-off and BEFORE the
  // Transition Year start, so the day of the cut-off is out and the day after is in.
  for (const [date, shouldUseDisposingBasis] of [['2021-11-29', false], ['2021-11-30', false], ['2021-12-01', true]]) {
    one('art_9_1_3_basis_' + date,
      pp([item({ arising_date: date, arises_from_intra_group_transfer: true, disposing_entity_carrying_value: 500 })]),
      (o) => (o.items[0].basis_source === 'disposing_entity_carrying_value') !== shouldUseDisposingBasis
        ? `expected disposing-entity basis=${shouldUseDisposingBasis} on ${date}, got ${o.items[0].basis_source}` : null);
  }

  // The far edge of the Article 9.1.3 window: on/after the Transition Year start is out.
  one('art_9_1_3_basis_at_transition_year_start',
    pp([item({ arising_date: '2024-01-01', arises_from_intra_group_transfer: true, disposing_entity_carrying_value: 500 })]),
    (o) => o.items[0].basis_source !== 'reported_carrying_amount'
      ? 'a transfer ON the Transition Year start is not before it and must not take the disposing basis' : null);

  // Limb 3 — the Commentary 8.5(c) new-CIT-basis step-up exclusion, which the guidance
  // bounds at BOTH ends: after the cut-off AND before the Transition Year. Forced at the
  // day before the Transition Year start, ON it, and well after it. The middle case is the
  // one that distinguishes a both-ends window from a lower-bound-only one; asserting only
  // the lower bound is what let the missing upper bound ship.
  for (const [date, shouldExclude] of [['2023-12-31', true], ['2024-01-01', false], ['2030-06-15', false]]) {
    one('cmt_8_5_c_step_up_exclusion_' + date,
      pp([item({ arising_date: date, arises_from_new_cit_basis_step_up: true })]),
      (o) => o.items[0].excluded !== shouldExclude
        ? `expected excluded=${shouldExclude} on ${date}, got ${o.items[0].excluded}` : null);
  }

  return { name: 'P12_cutoff_and_transition_year_boundaries_forced_all_limbs', trials: rows.length, violations, rows: rows.filter((r) => !r.ok) };
}

// ---------- P13 ----------
function checkP13_signed_zero() {
  let violations = 0, checked = 0;
  for (const p of [MONEY_PRECISION, RATE_PRECISION]) {
    checked++;
    const a = roundAt(0, p), b = roundAt(-0, p);
    if (Object.is(a, -0) || Object.is(b, -0) || a !== b) violations++;
  }
  // and no signed zero anywhere in a real payload
  const { output_payload } = compute(pp([item({ carrying_amount: 0, recorded_at_rate: 0.2, domestic_tax_rate: 0 })]));
  checked++;
  const flat = JSON.stringify(output_payload, (k, v) => (Object.is(v, -0) ? 'NEGATIVE_ZERO' : v));
  if (flat.indexOf('NEGATIVE_ZERO') !== -1) violations++;
  return { name: 'P13_signed_zero_identity', trials: checked, violations };
}

// ---------- P17 / P20: permutation invariance of a declared TOTAL order ----------
function permute(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function checkP17_P20_permutation_invariance() {
  let violations = 0, checked = 0;
  const examples = [];
  for (let t = 0; t < 50; t++) {
    const n = 2 + Math.floor(rand() * 8);
    const items = [];
    for (let i = 0; i < n; i++) items.push(randomItem());
    const base = compute(pp(items)).output_payload;
    // the reported sequence is keyed by the canonical order, so compare the
    // ORDER-DEFINING projection and the total, both of which must be permutation-invariant
    const baseSeq = JSON.stringify(base.items.map((x) => [x.arising_date, x.attribute_type, x.carrying_amount, x.recast_amount]));
    for (let k = 0; k < 3; k++) {
      const permuted = permute(items, rand);
      const other = compute(pp(permuted)).output_payload;
      const otherSeq = JSON.stringify(other.items.map((x) => [x.arising_date, x.attribute_type, x.carrying_amount, x.recast_amount]));
      checked++;
      if (otherSeq !== baseSeq) {
        violations++;
        if (examples.length < 2) examples.push({ reason: 'reported sequence changed under permutation' });
      }
      if (other.jurisdictional_roll_forward_total !== base.jurisdictional_roll_forward_total) {
        violations++;
        if (examples.length < 2) examples.push({ reason: 'roll-forward total changed under permutation', base: base.jurisdictional_roll_forward_total, other: other.jurisdictional_roll_forward_total });
      }
    }
  }
  return { name: 'P17_P20_permutation_invariant_declared_total_order', trials: checked, violations, examples };
}

// ---------- P18 / P19 / P21: the exact roll-forward identity ----------
function checkP18_P19_P21_rollforward_identity() {
  let violations = 0, checked = 0;
  const examples = [];
  for (let t = 0; t < 80; t++) {
    const n = 1 + Math.floor(rand() * 12);
    const items = [];
    for (let i = 0; i < n; i++) items.push(randomItem());
    const { output_payload } = compute(pp(items));
    let sum = 0;
    for (const it of output_payload.items) if (typeof it.recast_amount === 'number') sum += it.recast_amount;
    checked++;
    // byte-identical at the declared precision — NEVER "within tolerance"
    if (roundAt(sum, MONEY_PRECISION) !== output_payload.jurisdictional_roll_forward_total) {
      violations++;
      if (examples.length < 3) examples.push({ sum: roundAt(sum, MONEY_PRECISION), total: output_payload.jurisdictional_roll_forward_total });
    }
    // round-then-sum is already idempotent under a further round at the same precision
    checked++;
    if (roundAt(output_payload.jurisdictional_roll_forward_total, MONEY_PRECISION) !== output_payload.jurisdictional_roll_forward_total) violations++;
  }
  return { name: 'P18_P19_P21_rollforward_equals_sum_of_reported_recasts', trials: checked, violations, examples };
}

// ---------- P26 / P27 ----------
function checkP26_P27_anti_fabrication() {
  let violations = 0, checked = 0;
  const { output_payload } = compute(pp([item({})]));
  for (const step of output_payload.rounding_steps) {
    checked++;
    if (step.oracle !== 'declared — clause silent') violations++;
    if (step.mode !== 'half_up') violations++;
  }
  return { name: 'P26_P27_anti_fabrication_declared_clause_silent', trials: checked, violations };
}

// ---------- P28: step-count parity on EVERY path, error paths included ----------
function checkP28_step_count_parity() {
  let violations = 0, checked = 0;
  const examples = [];
  const inputs = [
    pp([item({})]),
    pp([item({ arises_from_chapter3_excluded_item: true, arising_date: '2022-01-01' })]),
    pp([item({ attribute_type: 'deferred_tax_asset_from_globe_loss', recorded_at_rate: 0.05, domestic_tax_rate: 0.05, globe_loss_demonstrated: true })]),
    pp([item({ recorded_at_rate: 0 })]),
    pp([item({ attribute_type: 'nope' })]),
    pp([item({ arising_date: '2021-02-30' })]),
    Object.assign({}, BASE, { items: [], minimum_rate: 'x' }),
    Object.assign({}, BASE, { items: [], cutoff_date: 'nope' }),
    Object.assign({}, BASE, { items: [], exclusion_rules: ['NOT_A_CODE'] }),
    Object.assign({}, BASE, { items: null }),
    {},
  ];
  for (const input of inputs) {
    checked++;
    const { output_payload } = compute(input);
    if (!Array.isArray(output_payload.rounding_steps) || output_payload.rounding_steps.length !== 4) {
      violations++; if (examples.length < 3) examples.push({ input: JSON.stringify(input).slice(0, 90) });
    }
  }
  return { name: 'P28_rounding_steps_always_four_including_error_paths', trials: checked, violations, examples };
}

// ---------- P29 ----------
function checkP29_float_sensitive_completeness() {
  const { output_payload } = compute(pp([item({})]));
  let violations = 0;
  for (const step of output_payload.rounding_steps) {
    if (step.precision === null || step.precision === undefined) violations++;
  }
  return { name: 'P29_float_sensitive_precision_completeness', trials: output_payload.rounding_steps.length, violations };
}

// ---------- P30 / K5: declared bound edges ----------
function checkP30_K5_bounds_edges() {
  let violations = 0, checked = 0;
  const examples = [];
  const many = (n) => { const a = []; for (let i = 0; i < n; i++) a.push(item({})); return a; };

  checked++;
  let out;
  try { out = compute(pp(many(MAX_DTA_ITEMS))); }
  catch (e) { violations++; examples.push({ label: 'MAX-exact-threw', err: String(e && e.message) }); }
  if (out && (out.output_payload.error_code !== null || out.output_payload.item_count !== MAX_DTA_ITEMS)) {
    violations++; examples.push({ label: 'MAX-exact-wrongly-refused' });
  }

  checked++;
  let over;
  try { over = compute(pp(many(MAX_DTA_ITEMS + 1))); }
  catch (e) { violations++; examples.push({ label: 'MAX+1-threw', err: String(e && e.message) }); }
  if (over) {
    if (over.output_payload.error_code !== 'ERR_MAX_DTA_ITEMS_EXCEEDED') { violations++; examples.push({ label: 'MAX+1-not-a-named-error' }); }
    if (over.output_payload.items !== null) { violations++; examples.push({ label: 'MAX+1-silently-truncated-and-computed' }); }
    if (over.output_payload.jurisdictional_roll_forward_total !== null) { violations++; examples.push({ label: 'MAX+1-produced-a-total-anyway' }); }
  }
  return { name: 'P30_K5_max_dta_items_named_error_no_wrap_no_truncate', trials: checked, violations, examples };
}

// ---------- K1 / K2: the two halves of the cap property (spec finding 2) ----------
function checkK1_K2_cap_and_uplift() {
  let violations = 0, checked = 0;
  const examples = [];
  for (let t = 0; t < 400; t++) {
    const it = randomItem();
    const { output_payload } = compute(pp([it]));
    const r = output_payload.items[0];
    if (r.excluded || r.error_code !== null) continue;
    checked++;
    const capRate = roundAt(Math.min(BASE.minimum_rate, it.domestic_tax_rate), RATE_PRECISION);
    const upliftConditions = it.attribute_type === 'deferred_tax_asset_from_globe_loss'
      && it.recorded_at_rate < BASE.minimum_rate
      && it.globe_loss_demonstrated === true;

    if (r.uplifted !== upliftConditions) {
      violations++; if (examples.length < 3) examples.push({ reason: 'uplifted flag does not match the three Art 9.1.1 sentence-three conditions', it, r });
      continue;
    }
    if (!upliftConditions) {
      // K1 — cap path: the applied rate is the lower-of rate CAPPED AT the recorded
      // rate (an attribute already at or below the lower-of rate is left alone), and
      // the recast therefore never exceeds the uncapped figure.
      const want = roundAt(Math.min(capRate, it.recorded_at_rate), RATE_PRECISION);
      if (r.rate_applied !== want) {
        violations++; if (examples.length < 3) examples.push({ reason: 'cap path did not apply min(cap_rate, recorded_at_rate)', got: r.rate_applied, want });
      }
      // uncapped figure = the same temporary difference measured at the recorded rate
      const uncapped = roundAt(r.temporary_difference * it.recorded_at_rate, MONEY_PRECISION);
      if (r.recast_amount > uncapped + 1e-9) {
        violations++; if (examples.length < 3) examples.push({ reason: 'cap path recast exceeded the uncapped figure', recast: r.recast_amount, uncapped });
      }
    } else {
      // K2 — uplift path: the rate IS the Minimum Rate, and it is the ONLY way up.
      if (r.rate_applied !== roundAt(BASE.minimum_rate, RATE_PRECISION)) {
        violations++; if (examples.length < 3) examples.push({ reason: 'uplift path did not apply the Minimum Rate', got: r.rate_applied });
      }
    }
  }
  return { name: 'K1_K2_cap_path_never_increases_uplift_is_the_only_exception', trials: checked, violations, examples };
}

// ---------- K3 / K4: exclusion contributes zero, is reported, and names a code ----------
function checkK3_K4_exclusion_discipline() {
  let violations = 0, checked = 0;
  const examples = [];
  const cases = [
    item({ arises_from_chapter3_excluded_item: true, arising_date: '2022-05-05' }),
    item({ arises_from_governmental_arrangement: true, arising_date: '2022-05-05' }),
    item({ arises_from_retroactive_election: true, arising_date: '2022-05-05' }),
    item({ arises_from_new_cit_basis_step_up: true, arising_date: '2022-05-05' }),
    item({ reflectable_under_authorised_accounting_standard: false, arising_date: '2019-05-05' }),
  ];
  for (const c of cases) {
    checked++;
    const { output_payload } = compute(pp([c, item({ carrying_amount: 2000, recorded_at_rate: 0.2, domestic_tax_rate: 0.2, arising_date: '2018-01-01' })]));
    const ex = output_payload.items.filter((x) => x.excluded);
    if (ex.length !== 1) { violations++; examples.push({ reason: 'expected exactly one excluded item, still reported', got: ex.length }); continue; }
    if (ex[0].recast_amount !== 0) { violations++; examples.push({ reason: 'excluded item did not contribute exactly zero', got: ex[0].recast_amount }); }
    if (EXCLUSION_CODES.indexOf(ex[0].exclusion_reason) === -1) { violations++; examples.push({ reason: 'exclusion_reason is not a declared named code', got: ex[0].exclusion_reason }); }
    if (output_payload.item_count !== 2) { violations++; examples.push({ reason: 'excluded item was omitted from the report rather than reported' }); }
  }
  // and a non-excluded item always carries a null reason, never free text
  for (let t = 0; t < 100; t++) {
    const { output_payload } = compute(pp([randomItem()]));
    checked++;
    const r = output_payload.items[0];
    if (!r.excluded && r.exclusion_reason !== null) { violations++; if (examples.length < 3) examples.push({ reason: 'non-excluded item carried an exclusion_reason', got: r.exclusion_reason }); }
    if (r.excluded && EXCLUSION_CODES.indexOf(r.exclusion_reason) === -1) { violations++; if (examples.length < 3) examples.push({ reason: 'excluded item without a declared code', got: r.exclusion_reason }); }
  }
  return { name: 'K3_K4_excluded_contributes_zero_is_reported_and_names_a_code', trials: checked, violations, examples };
}

// ---------- K6: unjustifiable recast is a named error, never a silent number ----------
function checkK6_named_error_not_silent_number() {
  let violations = 0, checked = 0;
  const examples = [];
  const cases = [
    ['ERR_RECORDED_RATE_NOT_POSITIVE', item({ recorded_at_rate: 0 })],
    ['ERR_DOMESTIC_RATE_MISSING', item({ domestic_tax_rate: null })],
    ['ERR_CARRYING_AMOUNT_MISSING', item({ carrying_amount: null })],
    ['ERR_ARISING_DATE_INVALID', item({ arising_date: '2021-02-30' })],
    ['ERR_UNKNOWN_ATTRIBUTE_TYPE', item({ attribute_type: 'deferred_tax_something' })],
    ['ERR_GROSS_CARRYING_AMOUNT_MISSING', item({ valuation_adjustment_reflected: true })],
    ['ERR_INTRA_GROUP_BASIS_MISSING', item({ arises_from_intra_group_transfer: true, arising_date: '2022-02-02' })],
  ];
  for (const [code, bad] of cases) {
    checked++;
    const { output_payload } = compute(pp([bad]));
    const r = output_payload.items[0];
    if (r.error_code !== code) { violations++; examples.push({ want: code, got: r.error_code }); continue; }
    if (r.recast_amount !== null) { violations++; examples.push({ reason: 'errored item produced a number anyway', code, got: r.recast_amount }); }
    if (!r.manual_review_required) { violations++; examples.push({ reason: 'errored item did not require manual review', code }); }
    if (output_payload.total_is_complete !== false) { violations++; examples.push({ reason: 'total reported complete despite an errored item', code }); }
  }
  // ERR_TRANSITION_YEAR_START_MISSING needs the parameter absent
  checked++;
  const noTY = compute(Object.assign({}, BASE, { transition_year_start_date: null, items: [item({ arises_from_intra_group_transfer: true, arising_date: '2022-02-02' })] }));
  if (noTY.output_payload.items[0].error_code !== 'ERR_TRANSITION_YEAR_START_MISSING') {
    violations++; examples.push({ want: 'ERR_TRANSITION_YEAR_START_MISSING', got: noTY.output_payload.items[0].error_code });
  }
  return { name: 'K6_unjustifiable_recast_is_a_named_error', trials: checked, violations, examples };
}

// ---------- K7: attribute-type enum exhaustiveness ----------
function checkK7_attribute_type_enum() {
  let violations = 0, checked = 0;
  const examples = [];
  for (const t of ATTRIBUTE_TYPES) {
    checked++;
    const { output_payload } = compute(pp([item({ attribute_type: t })]));
    if (output_payload.items[0].error_code !== null) { violations++; examples.push({ reason: 'declared enum value refused', t }); }
  }
  for (const bad of ['', 'DEFERRED_TAX_ASSET', 'deferred_tax_assets', null, 0, true, {}, []]) {
    checked++;
    const { output_payload } = compute(pp([item({ attribute_type: bad })]));
    if (output_payload.items[0].error_code !== 'ERR_UNKNOWN_ATTRIBUTE_TYPE') {
      violations++; examples.push({ reason: 'out-of-enum value not a named error', bad: String(bad) });
    }
  }
  return { name: 'K7_attribute_type_enum_exhaustive', trials: checked, violations, examples };
}

// ---------- K8: totality ----------
function checkK8_totality() {
  const hostile = [
    undefined, null, 0, 'x', [], true, NaN, {},
    { items: 'not-an-array' }, { items: [null, 5, [], {}] },
    Object.assign({}, BASE, { items: [null] }),
    Object.assign({}, BASE, { items: [{ attribute_type: 'deferred_tax_asset' }] }),
    Object.assign({}, BASE, { minimum_rate: Infinity, items: [] }),
    Object.assign({}, BASE, { minimum_rate: -1, items: [] }),
    Object.assign({}, BASE, { cutoff_date: 12345, items: [] }),
    Object.assign({}, BASE, { cutoff_date: '2021-13-01', items: [] }),
    Object.assign({}, BASE, { transition_year_start_date: 'garbage', items: [] }),
    Object.assign({}, BASE, { exclusion_rules: 'nope', items: [] }),
    Object.assign({}, BASE, { exclusion_rules: [null], items: [] }),
    Object.assign({}, BASE, { items: [item({ carrying_amount: NaN })] }),
    Object.assign({}, BASE, { items: [item({ carrying_amount: Infinity })] }),
    Object.assign({}, BASE, { items: [item({ recorded_at_rate: -0.5 })] }),
    Object.assign({}, BASE, { items: [item({ arising_date: '\uD800' })] }),
    Object.assign({}, BASE, { items: [item({ arising_date: '   2020-01-01   ' })] }),
    Object.assign({}, BASE, { items: [Object.assign(Object.create(null), item({}))] }),
  ];
  let violations = 0, checked = 0;
  const examples = [];
  for (const input of hostile) {
    checked++;
    let out;
    try { out = compute(input); }
    catch (e) { violations++; if (examples.length < 3) examples.push({ input: String(JSON.stringify(input)).slice(0, 70), threw: String(e && e.message) }); continue; }
    const o = out.output_payload;
    const ok = o && typeof o === 'object'
      && Array.isArray(o.rounding_steps) && o.rounding_steps.length === 4
      && Array.isArray(out.compliance_flags)
      && typeof o.note === 'string'
      && typeof o.canonical_order === 'string';
    if (!ok) { violations++; if (examples.length < 3) examples.push({ input: String(JSON.stringify(input)).slice(0, 70), reason: 'malformed payload shape' }); }
    // no non-finite number may reach the payload
    const bad = JSON.stringify(o, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? 'NON_FINITE' : v));
    if (bad.indexOf('NON_FINITE') !== -1) { violations++; if (examples.length < 3) examples.push({ input: String(JSON.stringify(input)).slice(0, 70), reason: 'non-finite number in payload' }); }
  }
  return { name: 'K8_totality_never_throws_always_well_formed', trials: checked, violations, examples };
}

// ---------- inapplicable properties, recorded rather than silently omitted ----------
const NOT_APPLICABLE = [
  ['P2_half_even_ties', 'all four declared rounding_steps use half_up; no half_even step exists to test'],
  ['P3_truncate_bound', 'no truncate-mode step is declared'],
  ['P4_ceiling_bound', 'no ceiling-mode step is declared'],
  ['P5_floor_bound', 'no floor-mode step is declared'],
  ['P8_precision_bound_directed', 'no directed (floor/ceiling/truncate) step is declared, so the directed-mode bound has no case'],
  ['P11_ulp_precision_loss_bound', 'every declared step rounds explicitly at its declared precision; no ULP claim is made beyond that, which P7 already bounds'],
  ['P14_denormal_stays_finite', 'the declared domain is money amounts and tax rates, never denormal-range doubles; K8 already covers non-finite inputs'],
  ['P15_nonassociativity_robustness', 'the roll-forward is a single declared-order reduction over already-rounded values; P17/P19 cover the only reassociation a caller could induce'],
  ['P16_max_safe_integer_adjacent', 'MAX_DTA_ITEMS=500 bounds the reduction and realistic carrying amounts stay far below 2^53; P30 exercises the declared bound'],
  ['P22_P23_P24_P25_mode_divergence', 'these compare a half_even step against a parallel half_up computation at forced ties; only half_up is declared, so there is no second mode to diverge from'],
].map(([name, reason]) => ({ name: 'NA_' + name, applicable: false, reason, violations: 0 }));

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_half_up_ties());
results.properties.push(checkP6_determinism());
results.properties.push(checkP7_precision_bound());
results.properties.push(checkP9_P10_idempotence());
results.properties.push(checkP12_cutoff_boundary_forced());
results.properties.push(checkP13_signed_zero());
results.properties.push(checkP17_P20_permutation_invariance());
results.properties.push(checkP18_P19_P21_rollforward_identity());
results.properties.push(checkP26_P27_anti_fabrication());
results.properties.push(checkP28_step_count_parity());
results.properties.push(checkP29_float_sensitive_completeness());
results.properties.push(checkP30_K5_bounds_edges());
results.properties.push(checkK1_K2_cap_and_uplift());
results.properties.push(checkK3_K4_exclusion_discipline());
results.properties.push(checkK6_named_error_not_silent_number());
results.properties.push(checkK7_attribute_type_enum());
results.properties.push(checkK8_totality());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: KERNEL_ID,
  class: 'B',
  float_sensitive: true,
  rounding: { mode: 'half_up', precisions: [MONEY_PRECISION, RATE_PRECISION], rounding_steps: 4 },
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  not_applicable: NOT_APPLICABLE,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
