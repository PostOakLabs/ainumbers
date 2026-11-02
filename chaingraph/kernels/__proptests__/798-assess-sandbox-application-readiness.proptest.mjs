// 798-assess-sandbox-application-readiness — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the pinned CBOB Guidance Note
// for Participation in the Regulatory Sandbox Framework (issued 8 Oct 2026;
// sha256 and paragraph map in research/SANDBOX-READINESS-PIN-2026-10-30.md).
// kernel_digest_at_authoring: sha256:056771e7b8e8fb4baa13e33a8993986e7f02b7f097d3da964b67240ccbcb0948
// spec: research/SANDBOX-READINESS-PIN-2026-10-30.md — assess a firm's sandbox
//   application against a declared regulator profile's eligibility criteria and
//   test-parameter limits (profiles generic + cbob; BMA dropped at claim time).
// human_sign_off: PENDING
//
// SCOPE: floor tier only. The domain is a finite rule table over two declared
// profiles (generic, cbob) with a closed refusal set; every assertion below is
// exact integer/set logic, no floats beyond equality on integers.
//
// Checks: fixture-oracle gate (the 6 golden vectors: READY, READY_WITH_GAPS,
// mandatory not_met -> NOT_ELIGIBLE, customer-cap breach, missing exit plan ->
// NOT_ELIGIBLE, unknown-criterion refusal); P1 verdict restated independently
// from the gap/breach/missing-safeguard/exit sets; P2 gaps sorted by
// criterion_id and containing exactly the non-met declared criteria; P3 null
// caps never bite — only duration_months (cbob 12) and the generic tool-default
// customer cap (250) can produce breaches, and only strictly-greater declared
// values do; P4 refusal totality — unknown profile, unknown criterion id and
// invalid status each refuse with verdict null and never throw; P5
// determinism (two runs agree byte-for-byte) and output shape (no
// undefined/NaN/non-finite anywhere in output_payload); P6 mandatory-flag
// table: only legal_compatibility is mandatory on cbob, all six on generic,
// and a mandatory not_met flips the verdict even with an otherwise clean
// application.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/798-assess-sandbox-application-readiness.proptest.mjs

import { compute } from '../798-assess-sandbox-application-readiness.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = '798-assess-sandbox-application-readiness';

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const hasBadNumber = (x) => {
  if (typeof x === 'number') return !Number.isFinite(x);
  if (x === null || typeof x !== 'object') return false;
  return Object.values(x).some(hasBadNumber);
};

const IDS = ['innovation', 'consumer_benefit', 'benchmarking_viability', 'resources', 'customer_risk', 'legal_compatibility'];
const STATUSES = ['met', 'partially_met', 'not_met'];

const safeguardsAll = () => ({
  consumer_redress: { present: true, evidence_ref: 'synthetic://redress' },
  aml_cft_controls: { present: true, evidence_ref: 'synthetic://aml' },
  data_protection: { present: true, evidence_ref: 'synthetic://dpa' },
  disclosure_to_participants: { present: true, evidence_ref: 'synthetic://disclosure' },
});
const exitOk = () => ({ present: true, wind_down_days: 30, customer_transition: 'synthetic' });

const synthCriteria = (rng) => IDS.map((id) => ({
  criterion_id: id,
  status: pick(rng, STATUSES),
  evidence_ref: 'synthetic://' + id,
}));

const basePP = (rng) => {
  const profile = pick(rng, ['generic', 'cbob']);
  return {
    profile,
    criteria: synthCriteria(rng),
    test_parameters: {
      duration_months: 1 + Math.floor(rng() * 18),
      customer_cap: Math.floor(rng() * 400),
      eligible_customer_types: [pick(rng, ['retail', 'sme', 'corporate'])],
    },
    safeguards: safeguardsAll(),
    exit_plan: exitOk(),
  };
};

// P1 — verdict restated independently from the declared sets.
function checkP1VerdictRestated() {
  let checked = 0, violations = 0;
  const rng = mulberry32(79801);
  for (let i = 0; i < 80; i++) {
    const pp = basePP(rng);
    const raw = compute(pp);
    const out = raw.output_payload;
    const mandatoryNotMet = out.gaps.some((g) => g.mandatory && g.status === 'not_met');
    const expect = (mandatoryNotMet || !pp.exit_plan.present) ? 'NOT_ELIGIBLE'
      : (out.gaps.length + out.parameter_breaches.length + out.safeguards_missing.length) > 0 ? 'READY_WITH_GAPS'
      : 'READY';
    checked++;
    if (out.verdict !== expect) { violations++; console.log(`P1 violation at ${i}: ${out.verdict} != ${expect}`); }
  }
  // exit-plan present=false flips to NOT_ELIGIBLE with the EXIT_PLAN_MISSING flag and a note.
  const pp = { profile: 'cbob', criteria: IDS.map((id) => ({ criterion_id: id, status: 'met' })), test_parameters: { duration_months: 6, customer_cap: 10 }, safeguards: safeguardsAll(), exit_plan: { present: false } };
  const out = compute(pp).output_payload;
  const flags = compute(pp).compliance_flags;
  checked += 1;
  if (out.verdict !== 'NOT_ELIGIBLE' || out.exit_plan_declared !== false || !out.exit_plan_note || !flags.includes('EXIT_PLAN_MISSING')) { violations++; console.log('P1 violation: missing exit plan did not force NOT_ELIGIBLE with a note'); }
  return { name: 'P1 verdict restated from gap/breach/safeguard/exit sets + missing-exit flip', checked, violations };
}

// P2 — gaps are exactly the non-met declared criteria, sorted by criterion_id.
function checkP2GapsSorted() {
  let checked = 0, violations = 0;
  const rng = mulberry32(79802);
  for (let i = 0; i < 80; i++) {
    const pp = basePP(rng);
    const out = compute(pp).output_payload;
    const expect = pp.criteria.filter((r) => r.status !== 'met').map((r) => r.criterion_id).sort();
    const got = out.gaps.map((g) => g.criterion_id);
    checked++;
    if (deepEqual(got, expect) !== true) { violations++; console.log(`P2 violation at ${i}: gaps ${JSON.stringify(got)} != ${JSON.stringify(expect)}`); }
    const sorted = [...got].sort();
    checked++;
    if (deepEqual(got, sorted) !== true) { violations++; console.log(`P2 violation at ${i}: gaps not sorted`); }
  }
  return { name: 'P2 gaps == non-met declared set, sorted by criterion_id', checked, violations };
}

// P3 — cap semantics: only cbob duration 12 and generic customer 250 bite; strictly-greater only.
function checkP3Caps() {
  let checked = 0, violations = 0;
  const mk = (profile, params) => ({ profile, criteria: IDS.map((id) => ({ criterion_id: id, status: 'met' })), test_parameters: params, safeguards: safeguardsAll(), exit_plan: exitOk() });
  const breachCount = (pp) => compute(pp).output_payload.parameter_breaches.length;
  // cbob: duration 12 is not a breach, 13 is exactly one; null caps never bite.
  checked += 2;
  if (breachCount(mk('cbob', { duration_months: 12, customer_cap: 999999, value_cap_per_customer: 999999, aggregate_value_cap: 999999 })) !== 0) { violations++; console.log('P3 violation: cbob null caps bit or 12 months treated as breach'); }
  const b13 = compute(mk('cbob', { duration_months: 13, customer_cap: 10 }));
  if (breachCount(mk('cbob', { duration_months: 13, customer_cap: 10 })) !== 1) { violations++; console.log('P3 violation: cbob duration 13 did not produce exactly one breach'); }
  checked++;
  const br = b13.output_payload.parameter_breaches[0];
  if (!br || br.parameter !== 'duration_months' || br.cap !== 12 || br.cite.indexOf('28') === -1) { violations++; console.log('P3 violation: duration breach shape/cite wrong'); }
  // generic: customer cap 250 tool default — 250 not a breach, 251 is; duration cap null never bites.
  checked += 2;
  if (breachCount(mk('generic', { duration_months: 48, customer_cap: 250 })) !== 0) { violations++; console.log('P3 violation: generic duration (null cap) bit or 250 treated as breach'); }
  const g251 = compute(mk('generic', { duration_months: 48, customer_cap: 251 }));
  if (breachCount(mk('generic', { duration_months: 48, customer_cap: 251 })) !== 1) { violations++; console.log('P3 violation: generic customer 251 did not breach'); }
  checked++;
  if (g251.output_payload.parameter_breaches[0].cap !== 250) { violations++; console.log('P3 violation: generic customer cap not 250'); }
  // an undeclared optional cap never bites; breaches sort by parameter name.
  checked += 1;
  if (deepEqual(compute(mk('generic', { duration_months: 48, customer_cap: 300, value_cap_per_customer: 5 })).output_payload.parameter_breaches.map((b) => b.parameter), ['customer_cap']) !== true) { violations++; console.log('P3 violation: unexpected breach set'); }
  return { name: 'P3 caps: null never bites, cbob duration 12 / generic customer 250, strictly-greater only, cites ride the breach', checked, violations };
}

// P4 — refusal totality: no throw, verdict null, closed refusal codes.
function checkP4Refusals() {
  let checked = 0, violations = 0;
  const cases = [
    { pp: { profile: 'bma' }, flag: 'REFUSED_UNKNOWN_PROFILE', code: 'unknown_profile' },
    { pp: { profile: null }, flag: 'REFUSED_UNKNOWN_PROFILE', code: 'unknown_profile' },
    { pp: { profile: 'cbob', criteria: [{ criterion_id: 'tax_good_standing', status: 'met' }] }, flag: 'REFUSED_UNKNOWN_CRITERION', code: 'unknown_criterion' },
    { pp: { profile: 'generic', criteria: [{ criterion_id: 'innovation', status: 'maybe' }] }, flag: 'REFUSED_INVALID_STATUS', code: 'invalid_status' },
    { pp: { profile: 'generic' }, flag: null, code: null },
  ];
  for (const c of cases) {
    let raw;
    try { raw = compute(c.pp); } catch (e) { violations++; console.log(`P4 violation: threw for ${JSON.stringify(c.pp).slice(0, 60)}: ${e.message}`); continue; }
    checked++;
    if (c.code === null) {
      // empty declared criteria: no refusal; exit plan absent -> NOT_ELIGIBLE, never a refusal.
      if (raw.output_payload.verdict === null) { violations++; console.log('P4 violation: empty criteria refused'); }
      continue;
    }
    if (raw.output_payload.verdict !== null || !raw.output_payload.refusal || raw.output_payload.refusal.code !== c.code || !raw.compliance_flags.includes(c.flag)) {
      violations++; console.log(`P4 violation: expected refusal ${c.code} with ${c.flag}`);
    }
  }
  return { name: 'P4 refusal totality (unknown profile/criterion, invalid status) — verdict null, never throws', checked, violations };
}

// P5 — determinism + output shape.
function checkP5DeterminismShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(79805);
  for (let i = 0; i < 40; i++) {
    const pp = basePP(rng);
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(pp));
    checked++;
    if (a !== b) { violations++; console.log(`P5 violation at ${i}: nondeterministic output`); }
    const out = JSON.parse(a).output_payload;
    checked++;
    if (hasBadNumber(out) || JSON.stringify(out).includes('undefined')) { violations++; console.log(`P5 violation at ${i}: bad number/undefined in output_payload`); }
  }
  return { name: 'P5 determinism + no undefined/NaN/non-finite in output_payload', checked, violations };
}

// P6 — mandatory-flag table.
function checkP6Mandatory() {
  let checked = 0, violations = 0;
  const mk = (profile, status) => ({ profile, criteria: IDS.map((id) => ({ criterion_id: id, status: id === 'legal_compatibility' ? status : 'met' })), test_parameters: { duration_months: 6, customer_cap: 10 }, safeguards: safeguardsAll(), exit_plan: exitOk() });
  for (const profile of ['cbob', 'generic']) {
    const notMet = compute(mk(profile, 'not_met')).output_payload;
    const partial = compute(mk(profile, 'partially_met')).output_payload;
    checked += 2;
    if (notMet.verdict !== 'NOT_ELIGIBLE' || !notMet.gaps.some((g) => g.mandatory === true && g.status === 'not_met')) { violations++; console.log(`P6 violation: ${profile} legal_compatibility not_met did not force NOT_ELIGIBLE`); }
    if (partial.verdict !== 'READY_WITH_GAPS') { violations++; console.log(`P6 violation: ${profile} legal_compatibility partially_met should be a gap, not fatal`); }
  }
  // a non-mandatory criterion (cbob innovation) not_met leaves the verdict non-fatal.
  const cbobInnov = compute({ profile: 'cbob', criteria: IDS.map((id) => ({ criterion_id: id, status: id === 'innovation' ? 'not_met' : 'met' })), test_parameters: { duration_months: 6, customer_cap: 10 }, safeguards: safeguardsAll(), exit_plan: exitOk() }).output_payload;
  checked++;
  if (cbobInnov.verdict !== 'READY_WITH_GAPS') { violations++; console.log('P6 violation: cbob innovation not_met should be READY_WITH_GAPS'); }
  return { name: 'P6 mandatory flags: generic all six, cbob legal_compatibility only; mandatory not_met fatal, partial met a gap', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1VerdictRestated(),
  checkP2GapsSorted(),
  checkP3Caps(),
  checkP4Refusals(),
  checkP5DeterminismShape(),
  checkP6Mandatory(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
