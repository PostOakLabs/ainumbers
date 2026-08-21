// art-665-gl-tieout-recompute.proptest.mjs -- class-A property-test FLOOR (FV-PBT-FLOOR-BUILD-SPEC.md).
// kernel_digest_at_authoring: sha256:a584ec949403437257fff542b1a398296b05bd693748e96a1382329d3dff139c
// spec: CORE-VERIFY-BUILD-SPEC.md Sec0, Sec6.
// human_sign_off: PENDING
//
// SCOPE: floor tier only, NOT a proof, NOT Dafny. float_sensitive: NO -- all money math is
// integer minor-units arithmetic (no Math.round/floor of a fraction, no division feeding a
// threshold); display() is integer Math.trunc + string padding only.
//
// Checks: fixture-oracle gate, determinism, output-shape (no NaN/undefined anywhere),
// termination (per-account-code row count bounded by the union of codes seen), a
// money-conservation identity re-derived from the raw ledger rows independently of the
// kernel's own bucketing, and a differential re-derivation of the per_account_deltas
// "agrees" flag for both single-source and diff mode.
//
// Run: node chaingraph/kernels/__proptests__/art-665-gl-tieout-recompute.proptest.mjs

import { compute } from '../art-665-gl-tieout-recompute.kernel.mjs';
import { runFixtureOracle, summarize, findShapeViolations, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-665-gl-tieout-recompute';
const rand = mulberry32(0x665A11);

const PRODUCT_CODES = ['checking', 'savings', 'money_market', 'unmapped_code'];
const GL_MAPPING = { checking: 'GL-1010', savings: 'GL-1020', money_market: 'GL-1030' }; // 'unmapped_code' deliberately absent
function pad2(n) { return String(n).padStart(2, '0'); }
function randInt(rng, lo, hi) { return Math.floor(lo + rng() * (hi - lo + 1)); }

function randomLedger(rng, n) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const day = 1 + (i % 27);
    rows.push({
      account_token: `acct-fuzz-${i + 1}`,
      post_date: `2026-08-${pad2(day)}`,
      effective_date: `2026-08-${pad2(day)}`,
      txn_type: 'fee',
      amount: randInt(rng, -50000, 50000),
      running_balance: 0,
      product_code: pick(rng, PRODUCT_CODES),
      description_code: 'FUZZ',
    });
  }
  return rows;
}

function randomSinglePP(rng) {
  const n = randInt(rng, 0, 8);
  const ledger = randomLedger(rng, n);
  const reportBuckets = {};
  for (const code of Object.values(GL_MAPPING)) {
    if (rng() < 0.6) reportBuckets[code] = randInt(rng, -50000, 50000);
  }
  return {
    mode: 'single',
    period_label: '2026-08',
    ledger,
    gl_account_mapping: { ...GL_MAPPING },
    reported_trial_balance: Object.keys(reportBuckets).map((code) => ({ gl_account_code: code, amount_minor_units: reportBuckets[code] })),
  };
}

function randomDiffPP(rng) {
  const na = randInt(rng, 0, 6);
  const nb = randInt(rng, 0, 6);
  return {
    mode: 'diff',
    period_label: '2026-08',
    source_a: { label: 'legacy_core', ledger: randomLedger(rng, na), gl_account_mapping: { ...GL_MAPPING } },
    source_b: { label: 'new_core', ledger: randomLedger(rng, nb), gl_account_mapping: { ...GL_MAPPING } },
  };
}

// Occasionally exercise the mode-not-declared / malformed-mode branch so the floor covers it.
function randomPP(rng) {
  const r = rng();
  if (r < 0.1) return { period_label: '2026-08' }; // no mode
  if (r < 0.2) return { mode: 'not_a_real_mode', period_label: '2026-08' };
  if (r < 0.6) return randomSinglePP(rng);
  return randomDiffPP(rng);
}

const TRIALS = 1500;

// ---------- P1: determinism -- same policy_parameters -> byte-identical output_payload ----------
function checkP1_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const a = JSON.stringify(compute(pp).output_payload);
    const b = JSON.stringify(compute(pp).output_payload);
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P1_determinism', checked, violations };
}

// ---------- P2: output shape -- no NaN/undefined anywhere in output_payload ----------
function checkP2_output_shape() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (findShapeViolations(output_payload).length > 0) violations++;
  }
  return { name: 'P2_output_shape_no_nan_undefined', checked, violations };
}

// ---------- P3: termination -- per_account_deltas row count is bounded by the declared GL codes ----------
function checkP3_termination_bounded() {
  let violations = 0, checked = 0;
  const glCodeCount = new Set(Object.values(GL_MAPPING)).size;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.mode === 'single' && output_payload.single_source) {
      if (output_payload.single_source.mapped_row_count > output_payload.single_source.ledger_row_count) violations++;
      if (output_payload.single_source.per_account_deltas.length > glCodeCount) violations++;
    }
    if (output_payload.mode === 'diff' && output_payload.diff_sources) {
      const ds = output_payload.diff_sources;
      if (ds.source_a.mapped_row_count > ds.source_a.ledger_row_count) violations++;
      if (ds.source_b.mapped_row_count > ds.source_b.ledger_row_count) violations++;
      if (ds.per_account_deltas.length > glCodeCount) violations++;
    }
  }
  return { name: 'P3_termination_bounded_by_declared_gl_codes', checked, violations };
}

// ---------- P4 (differential): re-derive money conservation between raw mapped ledger rows and computed_totals ----------
function checkP4_money_conservation() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomSinglePP(rand); // single mode has a direct ledger -> computed_totals path
    const { output_payload } = compute(pp);
    checked++;
    const mapping = pp.gl_account_mapping;
    let expectedSum = 0;
    for (const row of pp.ledger) {
      const gl = mapping[row.product_code];
      if (gl) expectedSum += row.amount;
    }
    let gotSum = 0;
    for (const t of output_payload.single_source.computed_totals) gotSum += t.computed_total_minor_units;
    if (expectedSum !== gotSum) violations++;
  }
  return { name: 'P4_money_conservation_ledger_to_computed_totals', checked, violations };
}

// ---------- P5 (differential): re-derive the per_account_deltas "agrees" flag independently, both modes ----------
function checkP5_agrees_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.mode === 'single' && output_payload.single_source) {
      for (const d of output_payload.single_source.per_account_deltas) {
        const expectAgrees = (d.computed_total_minor_units - d.reported_total_minor_units) === 0;
        if (d.agrees !== expectAgrees) violations++;
        if (d.delta_minor_units !== d.computed_total_minor_units - d.reported_total_minor_units) violations++;
      }
    }
    if (output_payload.mode === 'diff' && output_payload.diff_sources) {
      for (const d of output_payload.diff_sources.per_account_deltas) {
        const expectAgrees = (d.source_a_total_minor_units - d.source_b_total_minor_units) === 0;
        if (d.agrees !== expectAgrees) violations++;
        if (d.delta_minor_units !== d.source_a_total_minor_units - d.source_b_total_minor_units) violations++;
      }
    }
  }
  return { name: 'P5_agrees_flag_differential_both_modes', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_determinism(),
  checkP2_output_shape(),
  checkP3_termination_bounded(),
  checkP4_money_conservation(),
  checkP5_agrees_differential(),
];
console.log(`[${KERNEL_ID}] class-A floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
