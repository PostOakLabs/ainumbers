// art-854-sukuk-tradability-composition — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:e55d83511ee3ee31dd6f667075e7ccb6ac981ada43a68bd7a78d9cc932cc3524
// spec: workspace research/ISLAMIC-FINANCE-BUILD-SPEC-2026-11 node E (sections 1, 6 and 9)
// human_sign_off: PENDING
//
// Checks: fixture-oracle gate (every golden vector); P1 determinism, output shape and the
// no-ruling marker; P2 the SC verdict of a period never depends on any other period's
// composition above zero (spec proptest: tenor drift between 0 and the issuance line cannot
// move a verdict); P3 exact at-least-33% threshold semantics on both profiles (boundary
// passes, one minor unit under fails); P4 mirrored warnings are truthy exactly when
// compliance_flags is non-empty; P5 refusal contract (wrong type, null, missing, wrong-type
// fields, negative amount, float amount, unsafe integer, prototype names, unpinned
// authorities, no issuance period, empty period); P6 buildArtifact_never_throws on
// unhashable input with a hash on clean input.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-854-sukuk-tradability-composition.proptest.mjs

import { compute, buildArtifact } from '../art-854-sukuk-tradability-composition.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-854-sukuk-tradability-composition';
const SEED = 854;
const N = 240;
const hasOwnLocal = (o, k) => Object.hasOwn(o, k);
const SUKUK_TYPES = ['wakalah_bi_al_istithmar', 'mixed_portfolio'];
const AUTHORITIES = ['sc_malaysia', 'sbp_pakistan'];
const VERDICTS = ['tradable_at_negotiated_price', 'sale_of_debt_rules_apply', 'issuance_test_failed'];

function randInput(rng) {
  const n = 1 + Math.floor(rng() * 5);
  const periods = [];
  let issuanceLeft = rng() < 0.9 ? 1 : 0;
  for (let i = 0; i < n; i++) {
    const nd = Math.floor(rng() * 100);
    const debt = Math.floor(rng() * (100 - nd));
    const cash = 100 - nd - debt;
    const isIssuance = issuanceLeft > 0 && (rng() < 0.3 || i === 0);
    if (isIssuance) issuanceLeft--;
    periods.push({
      non_debt_minor_units: nd * 1000,
      debt_minor_units: debt * 1000,
      cash_minor_units: cash * 1000,
      is_issuance_date: isIssuance,
    });
  }
  if (issuanceLeft > 0) {
    const i = Math.floor(rng() * periods.length);
    periods[i].is_issuance_date = true;
  }
  return {
    sukuk_type: SUKUK_TYPES[Math.floor(rng() * SUKUK_TYPES.length)],
    authorities: [AUTHORITIES[Math.floor(rng() * AUTHORITIES.length)]],
    commingled_entity: rng() < 0.5,
    periods,
  };
}

function checkP1Determinism() {
  const rng = mulberry32(SEED + 1); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randInput(rng);
    const a = compute(pp), b = compute(JSON.parse(JSON.stringify(pp)));
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) { violations++; console.log('P1 violation: nondeterministic'); }
    const sv = findShapeViolations(a.output_payload);
    if (sv.length) { violations++; console.log('P1 violation: ' + sv[0]); }
    if (a.output_payload.not_a_shariah_ruling !== true) { violations++; console.log('P1 violation: missing no-ruling marker'); }
  }
  return { name: 'P1 determinism, shape and no-ruling marker', checked, violations };
}

// P2 — the spec proptest: an SC verdict never depends on non-issuance periods above 0%.
// Resample every non-issuance period's positive non-debt share; every SC verdict must be
// unchanged (only that row's own display share moves, and only while it stays positive and
// non-issuance the verdict stays tradable).
function checkP2TenorDriftIndependence() {
  const rng = mulberry32(SEED + 2); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randInput(rng);
    if (pp.authorities[0] !== 'sc_malaysia') continue;
    const before = compute(pp).output_payload;
    if (before.valid_input !== true) continue;
    const drift = JSON.parse(JSON.stringify(pp));
    let moved = false;
    for (let p = 0; p < drift.periods.length; p++) {
      // Drift only positive non-issuance shares: 0 to positive is the semantic zero-case, not drift.
      if (drift.periods[p].is_issuance_date === true) continue;
      if (drift.periods[p].non_debt_minor_units === 0) continue;
      const old = drift.periods[p].non_debt_minor_units;
      const fresh = 1 + Math.floor(rng() * 99000);
      if (fresh === old) continue;
      drift.periods[p].non_debt_minor_units = fresh;
      moved = true;
    }
    if (!moved) continue;
    checked++;
    const after = compute(drift).output_payload;
    if (after.valid_input !== true) { violations++; console.log('P2 violation: drift refused: ' + after.domain_errors[0]); continue; }
    for (const r of before.results) {
      const got = after.results.find((x) => x.authority === r.authority);
      const bv = r.periods.map((x) => x.verdict).join('|');
      const av = got.periods.map((x) => x.verdict).join('|');
      if (bv !== av) { violations++; console.log('P2 violation: SC verdicts moved on tenor drift'); break; }
    }
  }
  return { name: 'P2 SC verdicts independent of non-issuance composition above zero', checked, violations };
}

// P3 — exact threshold semantics: the at-least-33% comparisons are exact integer tests, so
// the boundary itself passes and one minor unit below fails, on either profile.
function checkP3ExactThreshold() {
  let checked = 0, violations = 0;
  const mk = (authority, nd, total) => ({
    sukuk_type: 'mixed_portfolio',
    authorities: [authority],
    commingled_entity: false,
    periods: [{ non_debt_minor_units: nd, debt_minor_units: total - nd, cash_minor_units: 0, is_issuance_date: true }],
  });
  const cases = [
    ['sc_malaysia', 33, 100, 'tradable_at_negotiated_price'],
    ['sc_malaysia', 3299, 10000, 'issuance_test_failed'],
    ['sbp_pakistan', 33, 100, 'tradable_at_negotiated_price'],
    ['sbp_pakistan', 3299, 10000, 'sale_of_debt_rules_apply'],
    ['sbp_pakistan', 326, 990, 'sale_of_debt_rules_apply'],
  ];
  for (const [authority, nd, total, want] of cases) {
    checked++;
    const o = compute(mk(authority, nd, total)).output_payload;
    if (o.valid_input !== true) { violations++; console.log('P3 violation: boundary refused: ' + o.domain_errors[0]); continue; }
    const got = o.results[0].periods[0].verdict;
    if (got !== want) { violations++; console.log('P3 violation: ' + authority + ' nd=' + nd + '/' + total + ' gave ' + got + ', wanted ' + want); }
  }
  return { name: 'P3 exact at-least-33% boundaries on both profiles', checked, violations };
}

// P4 — flag-mirror doctrine: warnings must be truthy exactly when compliance_flags is
// non-empty, on every observed run including refusals.
function checkP4WarningsMirror() {
  const rng = mulberry32(SEED + 4); let checked = 0, violations = 0;
  const clean = { sukuk_type: 'wakalah_bi_al_istithmar', authorities: ['sc_malaysia'], commingled_entity: false, periods: [{ non_debt_minor_units: 40000, debt_minor_units: 40000, cash_minor_units: 20000, is_issuance_date: true }] };
  const inputs = /** @type {any[]} */ ([clean, { ...clean, authorities: ['sbp_pakistan'] }]);
  for (let i = 0; i < N; i++) inputs.push(randInput(rng));
  inputs.push({ ...clean, sukuk_type: 'nope' }, { ...clean, authorities: ['cma'] }, null, 5);
  for (const pp of inputs) {
    checked++;
    const { output_payload, compliance_flags } = compute(pp);
    const truthyFlags = Array.isArray(compliance_flags) && compliance_flags.length > 0;
    const truthyWarn = Array.isArray(output_payload.warnings) && output_payload.warnings.length > 0;
    if (truthyFlags !== truthyWarn) { violations++; console.log('P4 violation: warnings mirror out of sync'); }
    if (JSON.stringify(output_payload.warnings) !== JSON.stringify(compliance_flags)) { violations++; console.log('P4 violation: warnings is not the flag mirror'); }
  }
  return { name: 'P4 warnings mirror truthy exactly when flags are present', checked, violations };
}

function checkP5Refusals() {
  const base = { sukuk_type: 'wakalah_bi_al_istithmar', authorities: ['sc_malaysia'], commingled_entity: false, periods: [{ non_debt_minor_units: 40000, debt_minor_units: 40000, cash_minor_units: 20000, is_issuance_date: true }] };
  let checked = 0, violations = 0;
  for (const bad of [null, undefined, 5, 'x', [], true]) {
    checked++;
    const o = compute(bad).output_payload;
    if (o.valid_input !== false || !/^REFUSED_INPUT_WRONG_TYPE/.test(o.domain_errors[0])) { violations++; console.log('P5 violation: non-object not refused'); }
  }
  const deltas = [
    { sukuk_type: null }, { sukuk_type: 5 }, { sukuk_type: 'ijarah' },
    { authorities: null }, { authorities: [] }, { authorities: ['cma'] }, { authorities: ['aaoifi_ss_62'] }, { authorities: ['sc_malaysia', 'sc_malaysia'] }, { authorities: [3] },
    { commingled_entity: null }, { commingled_entity: 'no' },
    { periods: null }, { periods: [] }, { periods: {} },
    { periods: [{ non_debt_minor_units: -1, debt_minor_units: 50, cash_minor_units: 50, is_issuance_date: true }] },
    { periods: [{ non_debt_minor_units: 50.5, debt_minor_units: 50, cash_minor_units: 0, is_issuance_date: true }] },
    { periods: [{ non_debt_minor_units: 50, debt_minor_units: 50, cash_minor_units: 0 }] },
    { periods: [{ non_debt_minor_units: 50, debt_minor_units: 50, cash_minor_units: 0, is_issuance_date: 'yes' }] },
    { periods: [{ non_debt_minor_units: 0, debt_minor_units: 0, cash_minor_units: 0, is_issuance_date: true }] },
    { periods: [{ non_debt_minor_units: 100, debt_minor_units: 0, cash_minor_units: 0, is_issuance_date: false }] },
    { periods: Array.from({ length: 121 }, () => ({ non_debt_minor_units: 10, debt_minor_units: 10, cash_minor_units: 10, is_issuance_date: true })) },
  ];
  for (const delta of deltas) {
    checked++;
    const o = compute({ ...base, ...delta }).output_payload;
    if (o.valid_input !== false || o.refusal_code === null) { violations++; console.log('P5 violation: accepted ' + JSON.stringify(delta)); }
  }
  // Unsafe integer: unhashable input refuses before validation.
  checked++;
  const unsafe = compute({ ...base, periods: [{ non_debt_minor_units: 9007199254740992, debt_minor_units: 0, cash_minor_units: 0, is_issuance_date: true }] }).output_payload;
  if (!/^REFUSED_INPUT_UNSAFE_NUMBER/.test(unsafe.domain_errors[0])) { violations++; console.log('P5 violation: unsafe integer not refused'); }
  // Non-finite numbers refuse.
  for (const value of [Infinity, NaN, 1e300]) {
    checked++;
    const o = compute({ ...base, periods: [{ non_debt_minor_units: value, debt_minor_units: 0, cash_minor_units: 0, is_issuance_date: true }] }).output_payload;
    if (!/^REFUSED_INPUT_UNSAFE_NUMBER/.test(o.domain_errors[0])) { violations++; console.log('P5 violation: non-finite accepted'); }
  }
  // Prototype-name keys change nothing.
  checked++;
  const poisoned = JSON.parse(JSON.stringify(base).slice(0, -1) + ',"constructor":5,"__proto__":{"sukuk_type":"x"},"toString":"y"}');
  if (JSON.stringify(compute(poisoned).output_payload) !== JSON.stringify(compute(base).output_payload)) {
    violations++; console.log('P5 violation: prototype-name keys changed the output');
  }
  // Wrong-typed nested fields.
  checked++;
  const nested = compute({ ...base, periods: ['nope'] }).output_payload;
  if (!/^REFUSED_INPUT_TYPE/.test(nested.domain_errors[0])) { violations++; console.log('P5 violation: non-object period accepted'); }
  return { name: 'P5 refusal contract, prototype names and hostile numerics', checked, violations };
}

async function checkP6BuildArtifactNeverThrows() {
  let checked = 0, violations = 0;
  /** @type {any} */ let deep = 1; for (let i = 0; i < 600; i++) deep = [deep];
  const wide = new Array(1000001).fill(0);
  const rng = mulberry32(SEED + 6);
  const clean = { sukuk_type: 'wakalah_bi_al_istithmar', authorities: ['sc_malaysia'], commingled_entity: false, periods: [{ non_debt_minor_units: 40000, debt_minor_units: 40000, cash_minor_units: 20000, is_issuance_date: true }] };
  for (const delta of [{ zzz: 1e300 }, { zzz: Infinity }, { zzz: NaN }, { zzz: { a: [Number.MAX_SAFE_INTEGER + 2] } }, { zzz: deep }, { zzz: wide }]) {
    checked++;
    try {
      const art = await buildArtifact({ ...clean, ...delta });
      const r = art.hash_refusal;
      if (art.execution_hash !== null || !r || !/^REFUSED_INPUT_(UNSAFE_NUMBER|HASH_LIMIT)$/.test(r.reason)) { violations++; console.log('P6 violation: artifact shape'); }
      if (art.output_payload.valid_input !== false) { violations++; console.log('P6 violation: compute accepted hostile input'); }
    } catch (e) { violations++; console.log('P6 violation: buildArtifact threw: ' + String(e && e.message).slice(0, 80)); }
  }
  for (const pp of [clean, { ...clean, authorities: ['sbp_pakistan'] }, null, 5, []]) {
    checked++;
    try {
      const art = await buildArtifact(pp);
      if (!/^[0-9a-f]{64}$/.test(art.execution_hash) || art.hash_refusal !== undefined) { violations++; console.log('P6 violation: clean input lost its hash'); }
    } catch (e) { violations++; console.log('P6 violation: buildArtifact threw on clean input: ' + String(e && e.message).slice(0, 80)); }
  }
  return { name: 'buildArtifact_never_throws (null hash + hash_refusal on unhashable, hash on clean)', checked, violations };
}

let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1Determinism(), checkP2TenorDriftIndependence(), checkP3ExactThreshold(),
  checkP4WarningsMirror(), checkP5Refusals(), await checkP6BuildArtifactNeverThrows(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
