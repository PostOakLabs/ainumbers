// art-842-soc-report-coverage-gap — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:cec65d5341087b8568d3736ff418a994c1b1fd26503e4d8e6ae55f2c62ea6a33
// spec: SOC-BRIDGE-GAP-NODE-1 board row (coverage and gap arithmetic from declared values)
// human_sign_off: PENDING
//
// Properties: bridge gap never negative; covered implies zero gap; uncovered plus mapped equals total;
// independent Date.UTC recompute parity of the gap; permuting the lists leaves the output unchanged;
// id-like free text is refused with an explicit code; missing facts are INDETERMINATE; deterministic
// and the warnings mirror the flags.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-842-soc-report-coverage-gap.proptest.mjs

import { compute } from '../art-842-soc-report-coverage-gap.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-842-soc-report-coverage-gap';
const N_CASES = 400;
const OPINIONS = ['unmodified', 'qualified', 'adverse', 'disclaimer'];

function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const DAY = 86400000;
const EPOCH = Date.UTC(2015, 0, 1);

function genCase(rng) {
  const startMs = EPOCH + randInt(rng, 0, 3650) * DAY;
  const endMs = startMs + randInt(rng, 0, 400) * DAY;
  const fyeMs = startMs + randInt(rng, -200, 700) * DAY;
  const asOfMs = endMs + randInt(rng, 0, 500) * DAY;
  const nc = randInt(rng, 0, 12);
  const cuecs = [];
  for (let i = 0; i < nc; i++) cuecs.push({ id: `cuec-${i}`, mapped_control_id: rng() < 0.6 ? `ctl-${i}` : null });
  const ns = randInt(rng, 0, 6);
  const subs = [];
  for (let i = 0; i < ns; i++) subs.push({ id: `sub-${i}`, treatment: rng() < 0.5 ? 'carved_out' : 'inclusive' });
  return {
    report_type: pick(rng, ['type1', 'type2']),
    period_start: iso(startMs),
    period_end: iso(endMs),
    opinion_type: pick(rng, OPINIONS),
    exception_count: randInt(rng, 0, 4),
    fiscal_year_end: iso(fyeMs),
    as_of_date: iso(asOfMs),
    cuecs,
    subservice_orgs: subs,
  };
}

function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function checkGapNeverNegativeAndCoveredZero(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const { output_payload: o } = compute(genCase(rng));
    if (o.indeterminate || o.refusal_code) { violations++; continue; }
    if (o.bridge_gap_days < 0 || !Number.isInteger(o.bridge_gap_days)) violations++;
    if (o.covers_fiscal_year_end && o.bridge_gap_days !== 0) violations++;
  }
  return { name: 'gap_never_negative_and_covered_implies_zero_gap', checked: N_CASES, violations };
}

function checkCountsAddUp(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genCase(rng);
    const { output_payload: o } = compute(pp);
    if (o.cuec_uncovered_count + o.cuec_mapped_count !== o.cuec_total || o.cuec_total !== pp.cuecs.length) violations++;
    if (o.uncovered_cuec_ids.length !== o.cuec_uncovered_count) violations++;
    if (o.carved_out_subservice_ids.length !== o.carved_out_count) violations++;
    const carvedDeclared = pp.subservice_orgs.filter((s) => s.treatment === 'carved_out').length;
    if (o.carved_out_count !== carvedDeclared) violations++;
  }
  return { name: 'uncovered_plus_mapped_equals_total', checked: N_CASES, violations };
}

function checkDateReference(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genCase(rng);
    const { output_payload: o } = compute(pp);
    const s = Date.parse(`${pp.period_start}T00:00:00Z`);
    const e = Date.parse(`${pp.period_end}T00:00:00Z`);
    const f = Date.parse(`${pp.fiscal_year_end}T00:00:00Z`);
    const a = Date.parse(`${pp.as_of_date}T00:00:00Z`);
    const gap = f > e ? Math.round((f - e) / DAY) : 0;
    if (o.bridge_gap_days !== gap) violations++;
    if (o.covers_fiscal_year_end !== (s <= f && f <= e)) violations++;
    if (o.days_since_period_end !== Math.round((a - e) / DAY)) violations++;
  }
  return { name: 'independent_date_utc_recompute_parity', checked: N_CASES, violations };
}

function checkPermutationInvariance(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genCase(rng);
    const shuffled = { ...pp, cuecs: shuffle(rng, pp.cuecs), subservice_orgs: shuffle(rng, pp.subservice_orgs) };
    if (JSON.stringify(compute(pp)) !== JSON.stringify(compute(shuffled))) violations++;
  }
  return { name: 'permuting_lists_leaves_output_unchanged', checked: N_CASES, violations };
}

function checkIdRefusals(rng) {
  let violations = 0;
  const bad = [['jane@example.com', 'ID_EMAIL_LIKE'], ['Jane Doe', 'ID_NAME_LIKE'], ['J', 'ID_NAME_LIKE'], ['a.b', 'ID_PATTERN_INVALID']];
  for (let i = 0; i < N_CASES; i++) {
    const pp = genCase(rng);
    pp.cuecs.push({ id: 'x', mapped_control_id: null });
    const [value, code] = bad[i % bad.length];
    if (i % 2 === 0) pp.cuecs[pp.cuecs.length - 1].id = value;
    else pp.subservice_orgs.push({ id: value, treatment: 'inclusive' });
    const { output_payload: o, compliance_flags } = compute(pp);
    if (o.refusal_code !== code || !compliance_flags.includes('INPUT_REFUSED') || o.uncovered_cuec_ids.length !== 0) violations++;
  }
  return { name: 'id_like_free_text_is_refused_with_explicit_code', checked: N_CASES, violations };
}

function checkMissingFacts(rng) {
  let violations = 0;
  const fields = ['report_type', 'period_start', 'period_end', 'opinion_type', 'exception_count', 'fiscal_year_end', 'as_of_date', 'cuecs', 'subservice_orgs'];
  for (let i = 0; i < N_CASES; i++) {
    const pp = genCase(rng);
    const f = fields[i % fields.length];
    delete pp[f];
    const { output_payload: o, compliance_flags } = compute(pp);
    if (!o.indeterminate || !compliance_flags.includes('INDETERMINATE') || !o.missing_facts.includes(f) || o.bridge_gap_days !== null) violations++;
  }
  return { name: 'missing_required_fact_is_indeterminate_never_guessed', checked: N_CASES, violations };
}

function checkDeterminismAndWarningsMirror(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genCase(rng);
    const a = compute(pp);
    const b = compute(JSON.parse(JSON.stringify(pp)));
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
    if ((a.output_payload.warnings.length > 0) !== (a.compliance_flags.length > 0)) violations++;
  }
  return { name: 'deterministic_and_warnings_mirror_flags', checked: N_CASES, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkGapNeverNegativeAndCoveredZero(mulberry32(1)),
  checkCountsAddUp(mulberry32(2)),
  checkDateReference(mulberry32(3)),
  checkPermutationInvariance(mulberry32(4)),
  checkIdRefusals(mulberry32(5)),
  checkMissingFacts(mulberry32(6)),
  checkDeterminismAndWarningsMirror(mulberry32(7)),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
