// art-756-sales-ote-commission-analyzer.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the APEXPORT-89 porting payload
// (kernel + fixtures + VECTORS/DIFFERS/CITES records, GRADES PASS-PENDING-XV
// 2026-10-14, Tim 2026-10-18 "Extend ruling" Builder-verifies-at-land: 33/33
// payload vectors re-executed through compute() at land, APEX-PORT-89-LAND-1).
// kernel_digest_at_authoring: sha256:f361c429d001bdf5ecf33fefd6e9b23eac182d0d8f36bc44434867a90288bc9e
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: PARTIAL — the kernel deliberately keeps the Apex page's float
// arithmetic (`||` zero-coercion, baseCommRate=(ote-base)/quota with quota
// cancelling algebraically but not bit-exactly, `.toFixed(1)` payback rounding)
// so its outputs match the ported-from page to the digit (DIFFERS.md D-2/D-4).
// The properties below assert only relations that are exact under IEEE-754
// (monotone non-decreasing variable pay in attainment, equality of two compute()
// runs, refusal-code contracts, coercion bookkeeping, risk-label restatement,
// scenario-ladder shape and the exact non-accelerated closed form with identical
// operation order) or tolerance-bounded restatements where the payload itself
// documents last-ULP drift (quota sweep).
//
// Checks: fixture-oracle gate (all 33 APEXPORT-89 payload vectors — Apex live
// vectors, boundary pairs and the refusal/refusal-order cases — diffing BOTH
// output_payload and kernel_compliance_flags); P1 variable pay is non-decreasing
// in attainment_pct with the accelerator on and off; P2 the quota-cancellation
// restatement (D-4): variable_at_target is quota-flat within 1e-6 relative while
// base_commission_rate moves exactly as (ote-base)/quota; P3 the Apex `||`
// zero-coercion contract (D-2): an explicit 0 is replaced by the declared
// default, every substitution is reported in apex_zero_coercion_applied and the
// APEX_ZERO_COERCION_APPLIED flag is raised; P4 the refusal contract and its
// order: REFUSED_BAD_AS_OF for a non-calendar as_of, then OTE_NOT_ABOVE_BASE,
// then BASE_NOT_POSITIVE, each with ART756_INPUT_REFUSED and a nulls-shaped
// refused payload; P5 determinism (two runs agree byte-for-byte) and output
// shape (no undefined/NaN/non-finite anywhere in output_payload); P6 the risk
// label restated independently (>=60 high, >=40 moderate, else low) with a
// consistent risk_rank; P7 the scenario ladder shape and the exact
// non-accelerated closed form recomputed with the Apex operation order.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-756-sales-ote-commission-analyzer.proptest.mjs

import { compute } from '../art-756-sales-ote-commission-analyzer.kernel.mjs';
import { summarize, mulberry32 } from './_pbt-common.mjs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KERNEL_ID = 'art-756-sales-ote-commission-analyzer';
const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_PATH = join(HERE, '..', 'fixtures', `${KERNEL_ID}.fixtures.json`);

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const hasBadNumber = (x) => {
  if (typeof x === 'number') return !Number.isFinite(x);
  if (x === undefined) return true;
  if (x === null || typeof x !== 'object') return false;
  return Object.values(x).some(hasBadNumber);
};

// Apex page defaults (kernel APEX_INPUT_DEFAULTS, Apex L423-L432).
const DEFAULTS = {
  base_salary: 0, ote: 0, quota: 1, attainment_pct: 100,
  federal_tax_rate_pct: 32, accelerator_threshold_pct: 100,
  accelerator_multiplier: 1.5, draw_monthly: 0,
};

const basePP = () => ({
  as_of: '2026-10-13',
  base_salary: 75000, ote: 150000, quota: 1000000, attainment_pct: 100,
  federal_tax_rate_pct: 32, accelerator_threshold_pct: 100,
  accelerator_multiplier: 1.5, draw_monthly: 5000,
  has_accelerator: true, has_draw: false,
});

// ---------- fixture-oracle gate (payload-vector shape, not the shard shape) --
function runPayloadFixtureOracle() {
  const fixtures = JSON.parse(readFileSync(FIXTURES_PATH, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    try {
      const { output_payload, compliance_flags } = compute(vec.inputs);
      const opOk = deepEqual(output_payload, vec.kernel_output);
      const flOk = deepEqual(compliance_flags, vec.kernel_compliance_flags);
      if (!opOk || !flOk) failures.push({ name: vec.id, opOk, flOk });
    } catch (e) {
      failures.push({ name: vec.id, threw: String(e).slice(0, 120) });
    }
  }
  return { total: fixtures.vectors.length, failures };
}

// P1 — variable pay non-decreasing in attainment_pct (accelerator on and off).
function checkP1Monotone() {
  let checked = 0, violations = 0;
  const ladder = [0, 25, 50, 74.9, 75, 99, 99.999, 100, 100.001, 125, 150, 199.9, 200, 500];
  for (const hasAccel of [false, true]) {
    for (const thresh of [50, 75, 100, 125]) {
      let prev = -Infinity;
      for (const att of ladder) {
        const pp = { ...basePP(), has_accelerator: hasAccel, accelerator_threshold_pct: thresh, attainment_pct: att };
        const v = compute(pp).output_payload.variable_at_target;
        checked++;
        if (!(v >= prev)) { violations++; console.log(`P1 violation: accel=${hasAccel} thresh=${thresh} att=${att} v=${v} prev=${prev}`); }
        prev = v;
      }
    }
  }
  return { name: 'P1 variable pay non-decreasing in attainment_pct (accel on/off, thresholds 50/75/100/125)', checked, violations };
}

// P2 — quota cancellation restated (DIFFERS D-4): variable_at_target is
// quota-flat within 1e-6 relative; base_commission_rate moves as (ote-base)/quota.
function checkP2QuotaCancellation() {
  let checked = 0, violations = 0;
  const quotas = [1, 10, 1000, 1e6, 1e9, 1e12];
  const ref = compute(basePP()).output_payload;
  for (const q of quotas) {
    const out = compute({ ...basePP(), quota: q }).output_payload;
    checked++;
    const rel = Math.abs(out.variable_at_target - ref.variable_at_target) / Math.max(1, Math.abs(ref.variable_at_target));
    if (!(rel <= 1e-6)) { violations++; console.log(`P2 violation: quota=${q} variable=${out.variable_at_target} ref=${ref.variable_at_target}`); }
    checked++;
    const expectedRate = (150000 - 75000) / q;
    if (out.base_commission_rate !== expectedRate) { violations++; console.log(`P2 violation: quota=${q} rate=${out.base_commission_rate} expected=${expectedRate}`); }
  }
  return { name: 'P2 quota cancellation restated (variable quota-flat 1e-6 rel; rate = (ote-base)/quota exactly)', checked, violations };
}

// P3 — Apex `||` zero-coercion contract (DIFFERS D-2).
function checkP3ZeroCoercion() {
  let checked = 0, violations = 0;
  const fields = ['attainment_pct', 'quota', 'federal_tax_rate_pct', 'accelerator_threshold_pct', 'accelerator_multiplier'];
  for (const f of fields) {
    const zero = compute({ ...basePP(), [f]: 0 });
    const def = compute({ ...basePP(), [f]: DEFAULTS[f] });
    checked += 2;
    // the arithmetic must be identical; the runs differ ONLY in the coercion
    // report itself (the zero-run records the substitution, the default run
    // records nothing) — strip that one field before comparing
    const strip = (o) => { const c = { ...o }; delete c.apex_zero_coercion_applied; return c; };
    if (!deepEqual(strip(zero.output_payload), strip(def.output_payload))) { violations++; console.log(`P3 violation: ${f}=0 output differs from the default run`); }
    const rep = zero.output_payload.apex_zero_coercion_applied.find((c) => c.field === f);
    if (!rep || rep.supplied !== 0 || rep.substituted !== DEFAULTS[f]) { violations++; console.log(`P3 violation: ${f} substitution not reported in apex_zero_coercion_applied`); }
    if (!zero.compliance_flags.includes('APEX_ZERO_COERCION_APPLIED')) { violations++; console.log(`P3 violation: ${f}=0 did not raise APEX_ZERO_COERCION_APPLIED`); }
  }
  return { name: 'P3 zero-coercion: explicit 0 replaced by default, reported per-field and flagged', checked, violations };
}

// P4 — refusal contract and Apex guard order.
function checkP4Refusals() {
  let checked = 0, violations = 0;
  const bad = (pp, code) => {
    const out = compute(pp);
    checked++;
    if (out.output_payload.refusal_reason !== code) { violations++; console.log(`P4 violation: expected ${code}, got ${out.output_payload.refusal_reason}`); }
    if (!out.compliance_flags.includes('ART756_INPUT_REFUSED')) { violations++; console.log(`P4 violation: ${code} did not raise ART756_INPUT_REFUSED`); }
    if (out.output_payload.total_w2_at_target !== null || out.output_payload.scope_note === undefined) { violations++; console.log(`P4 violation: ${code} refused payload not null-shaped`); }
  };
  bad({ ...basePP(), as_of: '2026-13-40' }, 'REFUSED_BAD_AS_OF');
  bad({ ...basePP(), as_of: 'not-a-date' }, 'REFUSED_BAD_AS_OF');
  bad({ ...basePP(), ote: 75000 }, 'OTE_NOT_ABOVE_BASE');       // ote === base
  bad({ ...basePP(), ote: 74999 }, 'OTE_NOT_ABOVE_BASE');       // ote < base
  bad({ ...basePP(), base_salary: 0 }, 'BASE_NOT_POSITIVE');    // after the ote guard
  bad({ ...basePP(), base_salary: -5 }, 'BASE_NOT_POSITIVE');
  // order: ote <= base AND base <= 0 must report OTE_NOT_ABOVE_BASE (Apex order)
  bad({ ...basePP(), base_salary: 0, ote: 0 }, 'OTE_NOT_ABOVE_BASE');
  return { name: 'P4 refusal codes, ART756_INPUT_REFUSED flag, null-shape and Apex guard order', checked, violations };
}

// P5 — determinism and output shape over random valid draws.
function checkP5DeterminismShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(756756);
  for (let i = 0; i < 200; i++) {
    const pp = {
      as_of: '2026-10-13',
      base_salary: 1000 + Math.floor(rng() * 200000),
      ote: 0, quota: 1 + Math.floor(rng() * 5000000),
      attainment_pct: rng() * 250, federal_tax_rate_pct: rng() * 60,
      accelerator_threshold_pct: 50 + rng() * 100,
      accelerator_multiplier: 1 + rng() * 3, draw_monthly: Math.floor(rng() * 20000),
      has_accelerator: rng() < 0.5, has_draw: rng() < 0.5,
    };
    pp.ote = pp.base_salary + 1 + Math.floor(rng() * 300000);
    const a = compute(pp), b = compute(pp);
    checked += 2;
    if (!deepEqual(a, b)) { violations++; console.log('P5 violation: compute() not deterministic'); }
    if (hasBadNumber(a.output_payload)) { violations++; console.log('P5 violation: non-finite/undefined in output_payload'); }
  }
  return { name: 'P5 determinism byte-for-byte and output shape (no NaN/undefined) over 200 random valid draws', checked, violations };
}

// P6 — risk label restated independently from the split.
function checkP6RiskLabel() {
  let checked = 0, violations = 0;
  const rng = mulberry32(889001);
  for (let i = 0; i < 200; i++) {
    const pp = basePP();
    pp.base_salary = 1000 + Math.floor(rng() * 149000);
    pp.ote = pp.base_salary + 1 + Math.floor(rng() * (150000 - pp.base_salary));
    const out = compute(pp).output_payload;
    const vs = out.variable_split_pct;
    const expect = vs >= 60 ? 'high' : vs >= 40 ? 'moderate' : 'low';
    const rank = expect === 'high' ? 3 : expect === 'moderate' ? 2 : 1;
    checked += 2;
    if (out.risk_label !== expect) { violations++; console.log(`P6 violation: split=${vs} label=${out.risk_label} expected=${expect}`); }
    if (out.risk_rank !== rank) { violations++; console.log(`P6 violation: label=${expect} rank=${out.risk_rank} expected=${rank}`); }
  }
  return { name: 'P6 risk label/rank restated (>=60 high, >=40 moderate, else low)', checked, violations };
}

// P7 — scenario ladder shape and the exact non-accelerated closed form.
function checkP7Ladder() {
  let checked = 0, violations = 0;
  const levels = [50, 75, 100, 125, 150, 200];
  const rng = mulberry32(314159);
  for (let i = 0; i < 100; i++) {
    const pp = { ...basePP(), has_accelerator: false };
    pp.base_salary = 1000 + Math.floor(rng() * 149000);
    pp.ote = pp.base_salary + 1 + Math.floor(rng() * (150000 - pp.base_salary));
    pp.federal_tax_rate_pct = rng() * 60;
    const out = compute(pp).output_payload;
    checked++;
    if (out.attainment_scenarios.length !== 6 || out.attainment_scenarios.some((s, k) => s.attainment_pct !== levels[k])) {
      violations++; console.log('P7 violation: ladder levels wrong'); continue;
    }
    checked++;
    if (out.attainment_scenarios.find((s) => s.attainment_pct === 100).highlighted !== true) {
      violations++; console.log('P7 violation: the 100% row is not highlighted');
    }
    // exact closed form, Apex operation order: (att/100)*(ote-base); total=base+v;
    // afterTax=total*(1-fedTax/100)
    const targetVar = pp.ote - pp.base_salary;
    for (const s of out.attainment_scenarios) {
      const v = (s.attainment_pct / 100) * targetVar;
      const total = pp.base_salary + v;
      const afterTax = total * (1 - pp.federal_tax_rate_pct / 100);
      checked += 3;
      if (s.variable !== v || s.total_w2 !== total || s.after_tax !== afterTax) {
        violations++; console.log(`P7 violation at att=${s.attainment_pct}: closed form mismatch`);
      }
    }
  }
  return { name: 'P7 ladder shape and exact non-accelerated closed form (Apex op order)', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runPayloadFixtureOracle();
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1Monotone(),
  checkP2QuotaCancellation(),
  checkP3ZeroCoercion(),
  checkP4Refusals(),
  checkP5DeterminismShape(),
  checkP6RiskLabel(),
  checkP7Ladder(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
