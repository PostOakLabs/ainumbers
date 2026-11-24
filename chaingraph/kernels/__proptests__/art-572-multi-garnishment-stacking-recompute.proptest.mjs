// art-572-multi-garnishment-stacking-recompute.proptest.mjs -- FV property-test FLOOR
// (FV-PROPFLOOR-SHARD-C29-1).
// kernel_digest_at_authoring: sha256:8c136d165c60f037c99acb56b103c599d56337090c9d99a2e14739af14ff7a0c
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md Sec3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES -- confirmed by direct source read (matches the WU row). `pctOf(minor, pct) =
// Math.round((minor * pct) / 100)` is real IEEE-754 arithmetic that sets every statutory cap
// (child-support tiers at 50/55/60/65%, the general CCPA 25% cap, the HEA AWG 15% cap), and
// `display()` repeats the same `Math.trunc(abs / MINOR_SCALE)` division the C25 shard kept float:yes
// for on art-509/art-508. Both feed the per-order withheld/shortfall amounts directly.
// Checks: fixture-oracle gate, termination (bounded by orders.length/legally_required_deductions.length,
// no unbounded loop), differential re-derivation of pctOf()-based statutory caps and the
// priority-order withholding walk, ULP-boundary forcing on pctOf()'s Math.round((minor*pct)/100)
// boundary and display()'s Math.trunc(abs/100) boundary, and a conservation metamorphic identity
// (total_withheld + employee_net always equals disposable_earnings, and total_withheld never exceeds
// the aggregate cap, for any random stack).
//
// Run: node chaingraph/kernels/__proptests__/art-572-multi-garnishment-stacking-recompute.proptest.mjs

import { compute, buildArtifact } from '../art-572-multi-garnishment-stacking-recompute.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-572-multi-garnishment-stacking-recompute.fixtures.json');
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
const rand = mulberry32(0x57200);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const ORDER_TYPES = ['child_support', 'federal_tax_levy', 'state_levy', 'hea_awg', 'creditor', 'other'];

function randomOrders(rng) {
  const n = 1 + Math.floor(rng() * 4);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ order_id: `O${i}`, type: pick(rng, ORDER_TYPES), arrears_over_12wk: rng() < 0.5, second_family: rng() < 0.5, claimed_amount_minor_units: Math.floor(rng() * 500000) });
  }
  return out;
}

function randomPP(rng) {
  return {
    employee_ref: 'E1', period_label: 'P1', currency: 'USD',
    gross_minor_units: 500000 + Math.floor(rng() * 2000000),
    legally_required_deductions: rng() < 0.7 ? [{ label: 'FICA', amount_minor_units: Math.floor(rng() * 100000) }] : [],
    orders: randomOrders(rng),
  };
}

const TRIALS = 3000;

// ---------- P1: termination -- bounded by orders.length/deductions.length ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.order_count !== pp.orders.length) violations++;
    if (output_payload.orders.length !== pp.orders.length) violations++;
  }
  return { name: 'P1_termination_bounded_by_order_count', trials: checked, violations };
}

// ---------- P2 (differential): re-derive statutory caps and the priority-order withholding walk ----------
function checkP2_cap_and_withhold_differential() {
  let violations = 0, checked = 0;
  function pctOf(minor, pct) { return Math.round((minor * pct) / 100); }
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const disposable = output_payload.disposable_earnings_minor_units;
    const floor = output_payload.ccpa_floor_minor_units;
    const nonNegFloor = Math.max(disposable - floor, 0);
    let expectedAggregate = 0;
    const expectedCaps = pp.orders.map((o) => {
      let cap;
      if (o.type === 'child_support') { const pct = o.arrears_over_12wk ? (o.second_family ? 55 : 65) : (o.second_family ? 50 : 60); cap = pctOf(disposable, pct); }
      else if (o.type === 'federal_tax_levy') cap = disposable;
      else if (o.type === 'state_levy') cap = Math.min(pctOf(disposable, 25), nonNegFloor);
      else if (o.type === 'hea_awg') cap = Math.min(pctOf(disposable, 15), nonNegFloor);
      else cap = Math.min(pctOf(disposable, 25), nonNegFloor);
      if (cap > expectedAggregate) expectedAggregate = cap;
      return cap;
    });
    if (output_payload.aggregate_cap_minor_units !== expectedAggregate) violations++;
    for (let oi = 0; oi < pp.orders.length; oi++) {
      if (output_payload.orders[oi].cap_minor_units !== expectedCaps[oi]) violations++;
    }
    // Re-derive the priority-order withholding walk.
    let remDisposable = disposable, remAggregate = expectedAggregate, expectedTotal = 0;
    for (let oi = 0; oi < pp.orders.length; oi++) {
      const claim = Math.max(0, pp.orders[oi].claimed_amount_minor_units);
      const allowedByOrder = Math.min(claim, Math.max(0, expectedCaps[oi]));
      const allowed = Math.max(0, Math.min(allowedByOrder, remDisposable, remAggregate));
      if (output_payload.orders[oi].withheld_minor_units !== allowed) violations++;
      remDisposable -= allowed; remAggregate -= allowed; expectedTotal += allowed;
    }
    if (output_payload.total_withheld_minor_units !== expectedTotal) violations++;
  }
  return { name: 'P2_cap_and_withhold_walk_differential', trials: checked, violations };
}

// ---------- P3: ULP-boundary forcing on pctOf()'s Math.round((minor*pct)/100) and display() Math.trunc ----------
function checkP3_ulp_boundary_forcing() {
  let violations = 0, checked = 0;
  const disposables = [0, 1, 99, 100, 101, 100000, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1, 3333333333];
  // federal_minimum_wage defaults to the 725-cent prefill, so ccpa_floor = 30*725 = 21750; force it to
  // zero here so the hea_awg/creditor Math.min(pctOf(...), nonNegFloor) branch always resolves via the
  // pctOf() SIDE of the min (the one under test), never the unrelated floor side.
  for (const disp of disposables) {
    if (!Number.isSafeInteger(disp)) continue;
    // child_support tiers (50/55/60/65%) -- no floor min, pctOf() alone sets the cap.
    for (const pct of [50, 55, 60, 65]) {
      checked++;
      const arrears = pct === 55 || pct === 65, secondFamily = pct === 50 || pct === 55;
      const pp = { employee_ref: 'E', period_label: 'P', currency: 'USD', gross_minor_units: disp, legally_required_deductions: [], federal_minimum_wage_minor_units: 0, orders: [{ order_id: 'O1', type: 'child_support', arrears_over_12wk: arrears, second_family: secondFamily, claimed_amount_minor_units: disp }] };
      const { output_payload } = compute(pp);
      const expected = Math.round((disp * pct) / 100);
      if (output_payload.orders[0].cap_minor_units !== expected) violations++;
    }
    // hea_awg (15%) and the general CCPA cap (25%, via "other") -- with the floor forced to zero,
    // Math.min(pctOf(disposable, pct), nonNegFloor) resolves to pctOf() whenever disposable <= itself,
    // i.e. always here since nonNegFloor = disposable - 0 = disposable >= pctOf(disposable, pct).
    for (const row of [{ pct: 15, type: 'hea_awg' }, { pct: 25, type: 'other' }]) {
      checked++;
      const pp = { employee_ref: 'E', period_label: 'P', currency: 'USD', gross_minor_units: disp, legally_required_deductions: [], federal_minimum_wage_minor_units: 0, orders: [{ order_id: 'O1', type: row.type, claimed_amount_minor_units: disp }] };
      const { output_payload } = compute(pp);
      const expected = Math.round((disp * row.pct) / 100);
      if (output_payload.orders[0].cap_minor_units !== expected) violations++;
    }
  }
  // display() ULP: exact multiples of 100, boundary residues.
  for (const amt of [0, 1, 99, 100, 100001, Number.MAX_SAFE_INTEGER]) {
    checked++;
    const pp = { employee_ref: 'E', period_label: 'P', currency: 'USD', gross_minor_units: amt, legally_required_deductions: [], orders: [] };
    const { output_payload } = compute(pp);
    const whole = Math.trunc(amt / 100); const frac = amt - whole * 100;
    const expected = String(whole) + '.' + String(frac).padStart(2, '0');
    if (output_payload.gross_display !== expected) violations++;
  }
  return { name: 'P3_ulp_boundary_forcing_pctof_and_display', trials: checked, violations };
}

// ---------- P4: conservation metamorphic -- total_withheld + net === disposable; withheld <= aggregate cap ----------
function checkP4_conservation_identity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.total_withheld_minor_units + output_payload.employee_net_minor_units !== output_payload.disposable_earnings_minor_units) violations++;
    if (output_payload.total_withheld_minor_units > output_payload.aggregate_cap_minor_units) violations++;
    if (output_payload.total_withheld_minor_units > output_payload.disposable_earnings_minor_units) violations++;
    if (output_payload.total_withheld_minor_units < 0) violations++;
  }
  return { name: 'P4_withheld_plus_net_equals_disposable_conservation', trials: checked, violations };
}

// ---------- P6: fail-closed -- every required field deleted, nulled, empty or whitespace-only on a positive vector never stays positive ----------
// Differential mirror of the kernel's own fail-closed entry scan (missingAtEntry): the expected
// missing list is re-derived here from the mutated pp and compared against the kernel's reported
// missing_required_fields AND the GARNISH_REQUIRED_INPUTS_MISSING flag, so a mutant that drops the
// sort, drops a field, or stops raising the flag is killed, not merely observed via the verdict.
function expectedMissingAtEntry(pp) {
  const required = ['currency', 'employee_ref', 'gross_minor_units', 'orders', 'period_label'];
  const blankOnly = ['federal_minimum_wage_dated', 'federal_minimum_wage_minor_units', 'legally_required_deductions', 'noticed_amounts', 'state_overlay'];
  const isFilled = (v) => v != null && !(typeof v === 'string' && v.trim() === '');
  const isBlank = (v) => typeof v === 'string' && v.trim() === '';
  const out = required.filter((f) => !isFilled(pp[f]));
  for (const f of blankOnly) if (Object.prototype.hasOwnProperty.call(pp, f) && isBlank(pp[f])) out.push(f);
  return out.sort();
}
function checkP6_required_field_never_positive() {
  const fixtures = JSON.parse(readFileSync(path.join(__dirname, '..', 'fixtures', 'art-572-multi-garnishment-stacking-recompute.fixtures.json'), 'utf8'));
  const required = ['currency', 'employee_ref', 'gross_minor_units', 'orders', 'period_label'];
  // These five have a defined no-value behavior: absent and null stay identical (R4 ratchet), so
  // only the empty-string and whitespace-only forms are asserted to fail closed here.
  const blankOnly = ['federal_minimum_wage_dated', 'federal_minimum_wage_minor_units', 'legally_required_deductions', 'noticed_amounts', 'state_overlay'];
  const positive = new Set(['MATCHES', 'RECONCILED', 'CONSISTENT', 'VERIFIED']);
  let violations = 0, checked = 0, positives = 0;
  for (const vec of fixtures.vectors) {
    if (!positive.has(compute(vec.policy_parameters).output_payload.verdict)) continue;
    positives++;
    const base = compute(vec.policy_parameters);
    checked++;
    // A positive vector reports NO missing fields and NO missing-inputs flag.
    if (base.output_payload.missing_required_fields !== undefined) violations++;
    if (Array.isArray(base.compliance_flags) && base.compliance_flags.includes('GARNISH_REQUIRED_INPUTS_MISSING')) violations++;
    if (!Array.isArray(base.compliance_flags) || !base.compliance_flags.includes('GARNISH_STACK_MATCHES')) violations++;
    for (const f of required) {
      for (const mode of ['delete', 'null', 'empty', 'blank']) {
        const pp = JSON.parse(JSON.stringify(vec.policy_parameters));
        if (mode === 'delete') {
          if (!(f in pp)) continue;
          delete pp[f];
        } else pp[f] = mode === 'null' ? null : mode === 'empty' ? '' : '   ';
        checked++;
        const res = compute(pp);
        if (positive.has(res.output_payload.verdict)) violations++;
        const want = expectedMissingAtEntry(pp);
        const gotMissing = res.output_payload.missing_required_fields || [];
        if (JSON.stringify(gotMissing) !== JSON.stringify(want)) violations++;
        const flags = Array.isArray(res.compliance_flags) ? res.compliance_flags : [];
        if (flags.includes('GARNISH_REQUIRED_INPUTS_MISSING') !== (want.length > 0)) violations++;
        if (!flags.includes('GARNISH_STACK_INDETERMINATE')) violations++;
        if (flags.includes('GARNISH_STACK_MATCHES') || flags.includes('GARNISH_STACK_DIVERGES')) violations++;
      }
    }
    for (const f of blankOnly) {
      for (const value of ['', '   ']) {
        const pp = JSON.parse(JSON.stringify(vec.policy_parameters));
        pp[f] = value;
        checked++;
        const res = compute(pp);
        if (positive.has(res.output_payload.verdict)) violations++;
        const want = expectedMissingAtEntry(pp);
        const gotMissing = res.output_payload.missing_required_fields || [];
        if (JSON.stringify(gotMissing) !== JSON.stringify(want)) violations++;
        const flags = Array.isArray(res.compliance_flags) ? res.compliance_flags : [];
        if (flags.includes('GARNISH_REQUIRED_INPUTS_MISSING') !== (want.length > 0)) violations++;
        if (!flags.includes('GARNISH_STACK_INDETERMINATE')) violations++;
        if (flags.includes('GARNISH_STACK_MATCHES') || flags.includes('GARNISH_STACK_DIVERGES')) violations++;
      }
    }
  }
  if (positives === 0) violations++;
  return { name: 'P6_required_field_never_positive', positive_base_vectors: positives, trials: checked, violations };
}

// ---------- P7: fail-closed + flag goldens (mutation-floor heal, measured 2026-11-24) ----------
// Fixed deterministic vectors pinning verdict, indeterminate_reason, missing_required_fields,
// rejected_inputs and the FULL compliance_flags array for the branches no fixture vector reaches:
// plural missing fields, blank-only refusals, zero/absent/string gross, the levy and state-levy
// default flags, and the empty stack. Measured against the live kernel at authoring time; a
// mutant that degrades any of these strings or branches cannot survive them.
function checkP7_failClosed_and_flag_goldens() {
  const fixtures = JSON.parse(readFileSync(path.join(__dirname, '..', 'fixtures', 'art-572-multi-garnishment-stacking-recompute.fixtures.json'), 'utf8'));
  const basePP = JSON.parse(JSON.stringify(fixtures.vectors.find((v) => compute(v.policy_parameters).output_payload.verdict === 'MATCHES').policy_parameters));
  const oneOrder = () => JSON.parse(JSON.stringify(basePP.orders.slice(0, 1)));
  const DISPOSABLE_NEGATIVE_REJECTED = { where: 'disposable_earnings', reason: 'legally-required deductions exceed gross earnings; disposable earnings floored at zero', supplied: -26650 };
  const cases = [
    ['two_missing_fields', (() => { const pp = JSON.parse(JSON.stringify(basePP)); delete pp.currency; delete pp.employee_ref; return pp; })(), {
      verdict: 'INDETERMINATE',
      reason: 'Required input fields missing or blank: currency, employee_ref. The stack cannot be certified without the caller-declared evidence the contract requires.',
      missing: ['currency', 'employee_ref'],
      rejected: [],
      flags: ['GARNISH_STACK_RECOMPUTED', 'GARNISH_STACK_INDETERMINATE', 'GARNISH_STACK_SHORTFALL', 'GARNISH_REQUIRED_INPUTS_MISSING'],
    }],
    ['two_blank_only_fields', (() => { const pp = JSON.parse(JSON.stringify(basePP)); pp.state_overlay = ''; pp.legally_required_deductions = '   '; return pp; })(), {
      verdict: 'INDETERMINATE',
      reason: 'Required input fields missing or blank: legally_required_deductions, state_overlay. The stack cannot be certified without the caller-declared evidence the contract requires.',
      missing: ['legally_required_deductions', 'state_overlay'],
      rejected: [],
      flags: ['GARNISH_STACK_RECOMPUTED', 'GARNISH_STACK_INDETERMINATE', 'GARNISH_STACK_SHORTFALL', 'GARNISH_REQUIRED_INPUTS_MISSING'],
    }],
    ['zero_gross_with_order', (() => { const pp = JSON.parse(JSON.stringify(basePP)); pp.gross_minor_units = 0; pp.legally_required_deductions = []; pp.orders = oneOrder(); return pp; })(), {
      verdict: 'INDETERMINATE',
      reason: 'No gross earnings were supplied, so disposable earnings could not be established.',
      missing: null,
      rejected: [],
      flags: ['GARNISH_STACK_RECOMPUTED', 'GARNISH_STACK_INDETERMINATE', 'GARNISH_STACK_SHORTFALL'],
    }],
    ['gross_absent', (() => { const pp = JSON.parse(JSON.stringify(basePP)); delete pp.gross_minor_units; pp.orders = oneOrder(); return pp; })(), {
      verdict: 'INDETERMINATE',
      reason: 'Required input field missing or blank: gross_minor_units. The stack cannot be certified without the caller-declared evidence the contract requires.',
      missing: ['gross_minor_units'],
      rejected: [{ where: 'gross_minor_units', reason: 'absent', supplied: null }, DISPOSABLE_NEGATIVE_REJECTED],
      flags: ['GARNISH_STACK_RECOMPUTED', 'GARNISH_STACK_INDETERMINATE', 'GARNISH_STACK_SHORTFALL', 'GARNISH_DISPOSABLE_NEGATIVE', 'GARNISH_STACK_INPUTS_REJECTED', 'GARNISH_REQUIRED_INPUTS_MISSING'],
    }],
    ['gross_string_rejected', (() => { const pp = JSON.parse(JSON.stringify(basePP)); pp.gross_minor_units = 'abc'; pp.orders = oneOrder(); return pp; })(), {
      verdict: 'DIVERGES',
      reason: null,
      missing: null,
      rejected: [{ where: 'gross_minor_units', reason: 'expected an integer number of minor units, got string', supplied: 'abc' }, DISPOSABLE_NEGATIVE_REJECTED],
      flags: ['GARNISH_STACK_RECOMPUTED', 'GARNISH_STACK_DIVERGES', 'GARNISH_STACK_SHORTFALL', 'ESCALATION_RAISED', 'GARNISH_DISPOSABLE_NEGATIVE', 'GARNISH_STACK_INPUTS_REJECTED'],
    }],
    ['levy_and_state_levy_default', { employee_ref: 'E7', period_label: 'P7', currency: 'USD', gross_minor_units: 400000, legally_required_deductions: [{ label: 'FICA', amount_minor_units: 50000 }], orders: [{ order_id: 'L1', type: 'federal_tax_levy', claimed_amount_minor_units: 100000 }, { order_id: 'S1', type: 'state_levy', claimed_amount_minor_units: 100000 }] }, {
      verdict: 'INDETERMINATE',
      reason: 'No noticed withholding amounts were supplied, so the recomputed stack has nothing to compare against.',
      missing: null,
      rejected: [{ where: 'orders[1] (state_levy)', reason: 'no state_overlay.state_levy_cap_percent declared; defaulted to the general CCPA cap, which may not be the governing state figure', supplied: null }],
      flags: ['GARNISH_STACK_RECOMPUTED', 'GARNISH_STACK_INDETERMINATE', 'GARNISH_STACK_SHORTFALL', 'GARNISH_TAX_LEVY_NOT_CCPA_CAPPED', 'GARNISH_STATE_LEVY_DEFAULTED_TO_CCPA', 'GARNISH_STACK_INPUTS_REJECTED'],
      rationaleIncludes: ['1 supplied value was not usable and was treated as zero, ignored, or defaulted. Each one is named in rejected_inputs rather than silently dropped.'],
    }],
    ['state_levy_with_overlay_pct', { employee_ref: 'E7', period_label: 'P7', currency: 'USD', gross_minor_units: 400000, legally_required_deductions: [], federal_minimum_wage_minor_units: 0, state_overlay: { state_levy_cap_percent: 20 }, orders: [{ order_id: 'S1', type: 'state_levy', claimed_amount_minor_units: 100000 }] }, {
      verdict: 'INDETERMINATE',
      reason: 'No noticed withholding amounts were supplied, so the recomputed stack has nothing to compare against.',
      missing: null,
      rejected: [],
      flags: ['GARNISH_STACK_RECOMPUTED', 'GARNISH_STACK_INDETERMINATE', 'GARNISH_STACK_SHORTFALL'],
    }],
    ['empty_orders', (() => { const pp = JSON.parse(JSON.stringify(basePP)); pp.orders = []; return pp; })(), {
      verdict: 'INDETERMINATE',
      reason: 'No garnishment orders were supplied, so no stack could be recomputed.',
      missing: null,
      rejected: [],
      flags: ['GARNISH_STACK_RECOMPUTED', 'GARNISH_STACK_INDETERMINATE', 'GARNISH_ORDER_STACK_EMPTY'],
    }],
  ];
  let violations = 0; const failed = [];
  for (const [name, pp, want] of cases) {
    const r = compute(pp);
    const bad = [];
    if (r.output_payload.verdict !== want.verdict) bad.push('verdict');
    if (r.output_payload.indeterminate_reason !== want.reason) bad.push('reason');
    if (JSON.stringify(r.output_payload.missing_required_fields || null) !== JSON.stringify(want.missing)) bad.push('missing');
    if (JSON.stringify(r.output_payload.rejected_inputs) !== JSON.stringify(want.rejected)) bad.push('rejected');
    if (JSON.stringify(r.compliance_flags) !== JSON.stringify(want.flags)) bad.push('flags');
    if (want.rationaleIncludes) {
      const rationale = JSON.stringify(r.output_payload.rationale || []);
      for (const frag of want.rationaleIncludes) if (!rationale.includes(frag)) bad.push('rationale');
    }
    if (bad.length > 0) { violations++; failed.push({ name, bad }); }
  }
  return { name: 'P7_failClosed_and_flag_goldens', trials: cases.length, violations, failed };
}

// ---------- P5: buildArtifact_never_throws + the full refusal envelope shape ----------
// The reason/detail/envelope asserts are exact-string (measured against the live kernel) so a
// mutant that swaps a refusal reason, shifts a detail path, or degrades the envelope shape is
// killed, not merely observed. now:'' is deliberate: `now ?? null` must KEEP a falsy caller value,
// so the asserted empty string kills the ??->|| mutants a truthy stamp cannot.
async function checkP5_buildArtifactNeverThrows() {
  let deep = {}; let cur = deep;
  for (let i = 0; i < 511; i++) { cur.n = {}; cur = cur.n; }
  const CLASSES = [
    ['junk_1e300', { employee_ref: 1e300 }, 'REFUSED_INPUT_UNSAFE_NUMBER', 'pp.employee_ref: unsafe_integer'],
    ['nan', { employee_ref: NaN }, 'REFUSED_INPUT_UNSAFE_NUMBER', 'pp.employee_ref: non_finite'],
    ['neg_infinity', { employee_ref: -Infinity }, 'REFUSED_INPUT_UNSAFE_NUMBER', 'pp.employee_ref: non_finite'],
    ['depth_511', { employee_ref: deep }, 'REFUSED_INPUT_HASH_LIMIT', 'pp.employee_ref' + '.n'.repeat(511) + ': too_deep'],
    ['over_1e6_values', { employee_ref: new Array(1000001).fill(0) }, 'REFUSED_INPUT_HASH_LIMIT', 'pp.employee_ref[999998]: too_many_values'],
  ];
  let violations = 0; const rows = [];
  for (const [label, pp, wantReason, wantDetail] of CLASSES) {
    try {
      const a = await buildArtifact(pp, { now: '', parent_hashes: ['ph'], parent_tool_ids: ['pt'], chain_depth: 7 });
      const ok = a.execution_hash === null
        && a.policy_parameters === null
        && !!a.hash_refusal && a.hash_refusal.reason === wantReason && a.hash_refusal.detail === wantDetail
        && !!a.output_payload && a.output_payload.verdict === 'REFUSED' && a.output_payload.refusal === wantReason
        && Array.isArray(a.compliance_flags) && a.compliance_flags.length === 1 && a.compliance_flags[0] === 'INPUT_REFUSED'
        && a.generated_at === ''
        && !!a.chain && a.chain.parent_hashes[0] === 'ph' && a.chain.parent_tool_ids[0] === 'pt' && a.chain.chain_depth === 7
        && a['@context'] === 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld'
        && a.chaingraph_version === '0.4.0'
        && a.compute_mode === 'server'
        && !!a.audit_signature && a.audit_signature.payloadType === 'application/vnd.openchain.graph+json;version=0.4'
        && a.audit_signature.payload === '' && Array.isArray(a.audit_signature.signatures) && a.audit_signature.signatures.length === 0;
      if (!ok) violations++;
      rows.push({ label, refused: !!ok });
    } catch (e) { violations++; rows.push({ label, threw: String(e && e.message).slice(0, 80) }); }
  }
  // The valid path must still hash: branch-inversion mutants that refuse EVERYTHING, or drop the
  // caller context, are killed here against a real MATCHES fixture vector.
  try {
    const fixtures = JSON.parse(readFileSync(path.join(__dirname, '..', 'fixtures', 'art-572-multi-garnishment-stacking-recompute.fixtures.json'), 'utf8'));
    const vec = fixtures.vectors.find((v) => compute(v.policy_parameters).output_payload.verdict === 'MATCHES');
    const a = await buildArtifact(vec.policy_parameters, { now: 'NOW2', parent_hashes: [], parent_tool_ids: [], chain_depth: 0 });
    const ok = typeof a.execution_hash === 'string' && /^[0-9a-f]{64}$/.test(a.execution_hash)
      && a.hash_refusal === undefined
      && a.policy_parameters === vec.policy_parameters
      && a.output_payload.verdict === 'MATCHES'
      && a.generated_at === 'NOW2'
      && a.chain.chain_depth === 0;
    if (!ok) violations++;
    rows.push({ label: 'valid_path_hashes', ok });
  } catch (e) { violations++; rows.push({ label: 'valid_path_hashes', threw: String(e && e.message).slice(0, 80) }); }
  return { name: 'buildArtifact_never_throws', trials: CLASSES.length + 1, violations, rows };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_cap_and_withhold_differential());
results.properties.push(checkP3_ulp_boundary_forcing());
results.properties.push(checkP4_conservation_identity());
results.properties.push(checkP6_required_field_never_positive());
results.properties.push(checkP7_failClosed_and_flag_goldens());
results.properties.push(await checkP5_buildArtifactNeverThrows());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-572-multi-garnishment-stacking-recompute',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
