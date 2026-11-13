// 838-control-frequency-sample — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:927bf69b1cbb198282cae6ac896ada21bbb1be94d8ad4ca3d609fef41e595df0
// spec: board/queued CONTROL-FREQ-SAMPLE-NODE-1 (SECOND-OPINION-ESTATE-REVIEW-2026-11-06 idea 3)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/838-control-frequency-sample.proptest.mjs

import { compute } from '../838-control-frequency-sample.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = '838-control-frequency-sample';

// Synthetic, illustrative table (the kernel ships none).
function table(min, max, sample) { return [{ frequency: 'f', min_population: min, max_population: max, sample_size: sample }]; }

function randomCase(rng) {
  const sample = 1 + Math.floor(rng() * 60);
  const population_size = sample + Math.floor(rng() * 5000);
  const hash = 'h' + Math.floor(rng() * 1e9).toString(16);
  return {
    control_frequency: 'f', population_size, population_hash: hash, period_days: 365,
    policy_table: table(1, 1e6, sample),
  };
}

// Selected indices are unique, in range, and the right count.
function checkIndicesUniqueInRange() {
  const rng = mulberry32(838);
  let checked = 0, violations = 0;
  for (let i = 0; i < 400; i++) {
    const pp = randomCase(rng);
    const out = compute(pp).output_payload;
    checked++;
    const idx = out.selected_indices;
    const unique = new Set(idx).size === idx.length;
    const inRange = idx.every((x) => Number.isInteger(x) && x >= 0 && x < pp.population_size);
    if (!unique || !inRange || idx.length !== pp.policy_table[0].sample_size) violations++;
  }
  return { name: 'indices_unique_in_range_and_counted', checked, violations };
}

// Same inputs (same hash) replay to the same selection; the offset stays under the interval.
function checkReplayable() {
  const rng = mulberry32(8381);
  let checked = 0, violations = 0;
  for (let i = 0; i < 300; i++) {
    const pp = randomCase(rng);
    const a = compute(pp), b = compute(JSON.parse(JSON.stringify(pp)));
    checked++;
    if (!deepEqual(a, b) || a.output_payload.start_offset >= a.output_payload.interval) violations++;
  }
  return { name: 'replayable_from_same_hash', checked, violations };
}

// A population outside the declared range is flagged, never corrected; the flag mirrors warnings.
function checkOutOfRangeFlagged() {
  const rng = mulberry32(8382);
  let checked = 0, violations = 0;
  for (let i = 0; i < 300; i++) {
    const pp = randomCase(rng);
    const lo = pp.population_size + 1 + Math.floor(rng() * 10);
    pp.policy_table = table(lo, lo + 5, pp.policy_table[0].sample_size);
    const r = compute(pp);
    checked++;
    const o = r.output_payload;
    if (o.within_expected_range !== false || o.population_size !== pp.population_size
      || !r.compliance_flags.includes('POPULATION_OUTSIDE_EXPECTED_RANGE')
      || !deepEqual(o.warnings, r.compliance_flags)) violations++;
  }
  return { name: 'outside_range_flagged_not_corrected', checked, violations };
}

// Invalid domains refuse with an explicit code and the INPUT_REFUSED flag, never a plan.
function checkRefusals() {
  const base = { control_frequency: 'f', population_size: 100, population_hash: 'h', period_days: 30, policy_table: table(1, 200, 5) };
  const cases = [
    [{ ...base, policy_table: undefined }, 'POLICY_TABLE_MISSING'],
    [{ ...base, policy_table: [] }, 'POLICY_TABLE_MISSING'],
    [{ ...base, control_frequency: 'zzz' }, 'FREQUENCY_ROW_MISSING'],
    [{ ...base, population_size: 3 }, 'SAMPLE_SIZE_EXCEEDS_POPULATION'],
    [{ ...base, population_size: 0 }, 'POPULATION_SIZE_INVALID'],
    [{ ...base, population_size: 10.5 }, 'POPULATION_SIZE_INVALID'],
    [{ ...base, period_days: 0 }, 'PERIOD_DAYS_INVALID'],
    [{ ...base, population_hash: '' }, 'POPULATION_HASH_MISSING'],
    [{ ...base, control_frequency: '' }, 'CONTROL_FREQUENCY_MISSING'],
    [{ ...base, policy_table: [{ ...base.policy_table[0], sample_size: 0 }] }, 'POLICY_TABLE_ROW_INVALID'],
    [{ ...base, policy_table: [base.policy_table[0], base.policy_table[0]] }, 'FREQUENCY_ROW_DUPLICATED'],
  ];
  let violations = 0;
  for (const [pp, code] of cases) {
    const r = compute(pp);
    if (!r.output_payload.refusal_reasons.includes(code) || !deepEqual(r.compliance_flags, ['INPUT_REFUSED'])
      || r.output_payload.sample_size !== null || r.output_payload.selected_indices.length !== 0) violations++;
  }
  for (const bad of [null, undefined, {}]) {
    const r = compute(bad);
    if (!deepEqual(r.compliance_flags, ['INPUT_REFUSED'])) violations++;
  }
  return { name: 'invalid_domains_refuse_with_code', checked: cases.length + 3, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkIndicesUniqueInRange(),
  checkReplayable(),
  checkOutOfRangeFlagged(),
  checkRefusals(),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
