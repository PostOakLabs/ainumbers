// 798-assess-sandbox-application-readiness — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the pinned CBOB Guidance Note
// for Participation in the Regulatory Sandbox Framework (issued 8 Oct 2026;
// sha256 and paragraph map in research/SANDBOX-READINESS-PIN-2026-10-30.md).
// kernel_digest_at_authoring: sha256:1baf99ad45ac55bbd6ee95ff9e3f6cd47197a717cce1ab82bab0271f4df4a827
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

import { compute, buildArtifact } from '../798-assess-sandbox-application-readiness.kernel.mjs';
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
  const full = (over) => ({
    profile: 'generic',
    criteria: IDS.map((id) => ({ criterion_id: id, status: 'met' })),
    test_parameters: { duration_months: 6, customer_cap: 10 },
    safeguards: safeguardsAll(),
    exit_plan: exitOk(),
    ...over,
  });
  const UP = ['REFUSED_UNKNOWN_PROFILE', 'unknown_profile'];
  const II = ['REFUSED_INVALID_INPUT', 'invalid_input'];
  const cases = [
    { pp: { profile: 'bma' }, flag: UP[0], code: UP[1] },
    { pp: { profile: null }, flag: UP[0], code: UP[1] },
    // prototype names are never profile names
    { pp: full({ profile: 'constructor' }), flag: UP[0], code: UP[1] },
    { pp: full({ profile: '__proto__' }), flag: UP[0], code: UP[1] },
    { pp: full({ profile: 'toString' }), flag: UP[0], code: UP[1] },
    { pp: full({ profile: ['cbob'] }), flag: UP[0], code: UP[1] },
    { pp: full({ criteria: [{ criterion_id: 'tax_good_standing', status: 'met' }] }), flag: 'REFUSED_UNKNOWN_CRITERION', code: 'unknown_criterion' },
    { pp: full({ criteria: [{ criterion_id: 'constructor', status: 'met' }] }), flag: 'REFUSED_UNKNOWN_CRITERION', code: 'unknown_criterion' },
    { pp: full({ criteria: [{ criterion_id: '__proto__', status: 'met' }] }), flag: 'REFUSED_UNKNOWN_CRITERION', code: 'unknown_criterion' },
    { pp: full({ criteria: [{ criterion_id: 7, status: 'met' }] }), flag: 'REFUSED_UNKNOWN_CRITERION', code: 'unknown_criterion' },
    { pp: full({ criteria: [{ criterion_id: 'innovation', status: 'maybe' }] }), flag: 'REFUSED_INVALID_STATUS', code: 'invalid_status' },
    // a present null or wrong type on a required field refuses
    { pp: { profile: 'generic' }, flag: II[0], code: II[1] },
    { pp: full({ criteria: null }), flag: II[0], code: II[1] },
    { pp: full({ criteria: 'innovation' }), flag: II[0], code: II[1] },
    { pp: full({ criteria: [null] }), flag: II[0], code: II[1] },
    { pp: full({ test_parameters: null }), flag: II[0], code: II[1] },
    { pp: full({ test_parameters: { duration_months: '6', customer_cap: 10 } }), flag: II[0], code: II[1] },
    { pp: full({ test_parameters: { duration_months: null, customer_cap: 10 } }), flag: II[0], code: II[1] },
    { pp: full({ test_parameters: { duration_months: 6, customer_cap: -1 } }), flag: II[0], code: II[1] },
    { pp: full({ test_parameters: { duration_months: 6, customer_cap: 1e300 } }), flag: 'REFUSED_UNHASHABLE_INPUT', code: 'unhashable_input' },
    { pp: full({ test_parameters: { duration_months: 6, customer_cap: 10, aggregate_value_cap: null } }), flag: II[0], code: II[1] },
    { pp: full({ safeguards: null }), flag: II[0], code: II[1] },
    { pp: full({ safeguards: { ...safeguardsAll(), data_protection: { present: 'yes' } } }), flag: II[0], code: II[1] },
    { pp: full({ exit_plan: null }), flag: II[0], code: II[1] },
    { pp: full({ exit_plan: { present: 1 } }), flag: II[0], code: II[1] },
    // a criteria list that is empty, duplicated or extra-keyed is never READY
    { pp: full({ criteria: [] }), flag: II[0], code: II[1] },
    { pp: full({ criteria: [{ criterion_id: 'innovation', status: 'met' }, { criterion_id: 'innovation', status: 'met' }] }), flag: II[0], code: II[1] },
    { pp: full({ criteria: [{ criterion_id: 'innovation', status: 'met', note: 'x' }] }), flag: II[0], code: II[1] },
    // the two count fields are whole numbers inside an explicit bound
    { pp: full({ test_parameters: { duration_months: 1.5, customer_cap: 10 } }), flag: II[0], code: II[1] },
    { pp: full({ test_parameters: { duration_months: 6, customer_cap: 1.5 } }), flag: II[0], code: II[1] },
    { pp: full({ test_parameters: { duration_months: 1201, customer_cap: 10 } }), flag: II[0], code: II[1] },
    { pp: full({ test_parameters: { duration_months: 6, customer_cap: 1000000001 } }), flag: II[0], code: II[1] },
    { pp: full({ test_parameters: { duration_months: 2 ** 60, customer_cap: 10 } }), flag: 'REFUSED_UNHASHABLE_INPUT', code: 'unhashable_input' },
    // unhashable policy parameters refuse in compute() as well
    { pp: full({ extra: NaN }), flag: 'REFUSED_UNHASHABLE_INPUT', code: 'unhashable_input' },
    { pp: full({ extra: 2 ** 60 }), flag: 'REFUSED_UNHASHABLE_INPUT', code: 'unhashable_input' },
  ];
  for (const c of cases) {
    let raw;
    try { raw = compute(c.pp); } catch (e) { violations++; console.log(`P4 violation: threw for ${JSON.stringify(c.pp).slice(0, 60)}: ${e.message}`); continue; }
    checked++;
    if (raw.output_payload.verdict !== null || !raw.output_payload.refusal || raw.output_payload.refusal.code !== c.code || !raw.compliance_flags.includes(c.flag)) {
      violations++; console.log(`P4 violation: expected refusal ${c.code} with ${c.flag}`);
    }
  }
  return { name: 'P4 refusal totality (unknown profile/criterion, invalid status, null/wrong-type/prototype-name inputs) — verdict null, never throws', checked, violations };
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

// buildArtifact_never_throws: buildArtifact mints an artifact for every input. An
// unhashable preimage gets execution_hash null plus hash_refusal; a hashable one
// gets a 64-hex hash and no hash_refusal.
async function checkBuildArtifactNeverThrows() {
  let checked = 0, violations = 0;
  const nest = (n) => { const o = {}; let c = o; for (let i = 0; i < n; i++) { c.a = {}; c = c.a; } return o; };
  const base = () => ({
    profile: 'generic',
    criteria: IDS.map((id) => ({ criterion_id: id, status: 'met' })),
    test_parameters: { duration_months: 6, customer_cap: 10 },
    safeguards: safeguardsAll(),
    exit_plan: exitOk(),
  });
  const withExtra = (extra) => ({ ...base(), extra });
  const cases = [
    { name: 'NaN', pp: withExtra(NaN), hashable: false },
    { name: 'Infinity', pp: withExtra(Infinity), hashable: false },
    { name: 'unsafe integer', pp: withExtra(2 ** 60), hashable: false },
    { name: 'NaN in test_parameters', pp: { ...base(), test_parameters: { duration_months: NaN, customer_cap: 10 } }, hashable: false },
    { name: 'depth 600', pp: withExtra(nest(600)), hashable: false },
    { name: 'depth 100000 profile', pp: { ...base(), profile: nest(100000) }, hashable: false },
    { name: 'over 1,000,000 values', pp: withExtra(new Array(1000001).fill(0)), hashable: false },
    { name: 'depth 100 (hashable)', pp: withExtra(nest(100)), hashable: true },
    { name: 'null pp', pp: null, hashable: true },
    { name: 'undefined pp', pp: undefined, hashable: null },
    { name: 'string pp', pp: 'x', hashable: true },
    { name: 'plain valid', pp: base(), hashable: true },
  ];
  for (const c of cases) {
    checked++;
    let a;
    try { a = await buildArtifact(c.pp); } catch (e) { violations++; console.log(`buildArtifact_never_throws violation: ${c.name} threw ${String(e.message).slice(0, 80)}`); continue; }
    if (c.hashable === null) continue;
    const hasHash = typeof a.execution_hash === 'string' && /^[0-9a-f]{64}$/.test(a.execution_hash);
    if (c.hashable && (!hasHash || a.hash_refusal !== undefined)) { violations++; console.log(`buildArtifact_never_throws violation: ${c.name} expected a hash`); }
    if (!c.hashable && (a.execution_hash !== null || !a.hash_refusal || typeof a.hash_refusal.reason !== 'string')) { violations++; console.log(`buildArtifact_never_throws violation: ${c.name} expected null hash plus hash_refusal`); }
  }
  return { name: 'buildArtifact_never_throws: unhashable policy parameters mint a null-hash refusal artifact, never throw', checked, violations };
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
  await checkBuildArtifactNeverThrows(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
