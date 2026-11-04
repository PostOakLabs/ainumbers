// art-826-authenticator-assurance-level.proptest.mjs — class-K property-test FLOOR (FV-PBT-FLOOR-BUILD-SPEC.md).
// kernel_digest_at_authoring: sha256:ed871635b70259bba55d86d4df84a064ecc7ec98ce1ae2332b5f6b5060ba20cc
// human_sign_off: PENDING
//
// spec: research/AUTHENTICATOR-ASSURANCE-PIN-2026-10-30.md (criterion→source-section map for the
// example frameworks) + research/bahamas-bermuda-gap-rows-2026-10-30.md §2–§3 (row anchor).
//
// SCOPE: floor tier. NOT a proof. float_sensitive: YES -- the session-interval compares
// (`found > max_reauth_interval_minutes`, `found > max_idle_minutes`) are unguarded numeric
// threshold compares on safeNum-coerced caller values (the art-523 pattern), so ULP-boundary
// forcing is MANDATORY (P6).
// Checks: fixture-oracle gate; output-shape ({criterion, required, found} keys on every
// unmet_criteria entry, undecidable_count bounded by criteria_evaluated, every unmet criterion
// named from the fixed criterion vocabulary); determinism (compute twice, identical payload);
// refusal semantics (broken definitions flag AAL_DEFINITION_INSUFFICIENT with meets_target false
// and achieved null, never a shortfall); monotonicity (adding a non-restricted authenticator
// never lowers the achieved level's index and never un-mets a met target); differential
// re-derivation of AAL_RESTRICTED_AUTHENTICATOR_USED from the pp; and ULP-boundary forcing on
// the interval compares at exact-equal (passes) and one-ULP-over (exceeds), plus the missing-
// session found:null case.
// Zero external dependencies -- Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-826-authenticator-assurance-level.proptest.mjs

import { compute } from '../art-826-authenticator-assurance-level.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-826-authenticator-assurance-level';

const rand = mulberry32(0x823A1);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const CRITERION_NAMES = new Set([
  'min_factors', 'required_factor_kinds', 'phishing_resistant_required',
  'verifier_impersonation_resistant_required', 'hardware_bound_required',
  'dynamic_authentication_required', 'max_reauth_interval_minutes',
  'max_idle_minutes', 'restricted_authenticator_kinds',
]);

const KINDS = ['password', 'otp_device', 'otp_sms', 'crypto_software', 'crypto_hardware',
  'passkey_synced', 'passkey_device_bound', 'biometric_local'];
const FACTOR_KINDS = ['knowledge', 'possession', 'inherent'];

// ---------- shared fixture-framework shapes (same data as the fixtures file) ----------
function nistLevels() {
  return [
    { level_id: 'aal1', min_factors: 1, max_reauth_interval_minutes: 43200 },
    { level_id: 'aal2', min_factors: 2, required_factor_kinds: ['possession'], max_reauth_interval_minutes: 1440, max_idle_minutes: 60, restricted_authenticator_kinds: ['otp_sms'] },
    { level_id: 'aal3', min_factors: 2, required_factor_kinds: ['possession'], phishing_resistant_required: true, verifier_impersonation_resistant_required: true, hardware_bound_required: true, max_reauth_interval_minutes: 720, max_idle_minutes: 15, restricted_authenticator_kinds: ['otp_sms'] },
  ];
}
function eidasLevels() {
  return [
    { level_id: 'low', min_factors: 1 },
    { level_id: 'substantial', min_factors: 2, dynamic_authentication_required: true },
    { level_id: 'high', min_factors: 2, dynamic_authentication_required: true, hardware_bound_required: true },
  ];
}

function randomAuthenticator(rng, { restricted = false } = {}) {
  const kind = pick(rng, KINDS.filter((k) => (restricted ? k === 'otp_sms' : k !== 'otp_sms')));
  const fk = FACTOR_KINDS.filter(() => rng() < 0.5);
  return {
    kind,
    factor_kinds: fk.length ? fk : [pick(rng, FACTOR_KINDS)],
    phishing_resistant: rng() < 0.5,
    hardware_bound: rng() < 0.5,
    verifier_impersonation_resistant: rng() < 0.5,
    dynamic: rng() < 0.5,
    ...(restricted ? { restricted: true } : {}),
  };
}
function randomPP(rng) {
  const nist = rng() < 0.5;
  const levels = nist ? nistLevels() : eidasLevels();
  const n = Math.floor(rng() * 4);
  const authenticators = [];
  for (let i = 0; i < n; i++) authenticators.push(randomAuthenticator(rng));
  const session = rng() < 0.15 ? null : {
    reauth_interval_minutes: Math.floor(rng() * 50000),
    idle_timeout_minutes: Math.floor(rng() * 90),
  };
  return {
    framework: { id: nist ? 'nist-example' : 'eidas-example', version: 'test', levels },
    target_level: pick(rng, levels.map((l) => l.level_id)),
    authenticators,
    ...(session ? { session } : {}),
  };
}

const TRIALS = 4000;

// ---------- P1: output shape + boundedness ----------
function checkP1_outputShape() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.undecidable_count > output_payload.criteria_evaluated) violations++;
    if (output_payload.undecidable.length !== output_payload.undecidable_count) violations++;
    for (const u of output_payload.unmet_criteria) {
      const keys = Object.keys(u);
      if (keys.length !== 3 || !keys.includes('criterion') || !keys.includes('required') || !keys.includes('found')) violations++;
      if (!CRITERION_NAMES.has(u.criterion)) violations++;
    }
    if (output_payload.framework_ref.id !== pp.framework.id || output_payload.framework_ref.version !== pp.framework.version) violations++;
    if (output_payload.authenticator_count !== pp.authenticators.length) violations++;
    if (output_payload.levels_defined !== pp.framework.levels.length) violations++;
  }
  return { name: 'P1_output_shape_boundedness', checked, violations };
}

// ---------- P2: determinism ----------
function checkP2_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 800; i++) {
    const pp = randomPP(rand);
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(pp));
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P2_determinism', checked, violations };
}

// ---------- P3: refusal vs shortfall, never conflated ----------
function checkP3_refusalSemantics() {
  let violations = 0, checked = 0;
  const broken = [
    { framework: { id: 'x', version: '1', levels: [] }, target_level: 'aal1', authenticators: [] },
    { framework: { id: 'x', version: '1', levels: nistLevels() }, target_level: 'nonexistent', authenticators: [] },
    { framework: { version: '1', levels: nistLevels() }, target_level: 'aal1', authenticators: [] },
    { framework: { id: 'x', levels: nistLevels() }, target_level: 'aal1', authenticators: [] },
    { framework: { id: 'x', version: '1', levels: nistLevels() }, target_level: 'aal1', authenticators: [{ kind: 'yubi-like-unknown', factor_kinds: ['possession'] }] },
    { target_level: 'aal1', authenticators: [] },
  ];
  for (const pp of broken) {
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (output_payload.meets_target !== false) violations++;
    if (output_payload.achieved_level !== null) violations++;
    if (!compliance_flags.includes('AAL_DEFINITION_INSUFFICIENT')) violations++;
  }
  // well-formed definition + failing data => SHORTFALL, never INSUFFICIENT
  const failing = {
    framework: { id: 'x', version: '1', levels: [{ level_id: 'l1', min_factors: 3 }] },
    target_level: 'l1',
    authenticators: [{ kind: 'password', factor_kinds: ['knowledge'] }],
  };
  {
    const { output_payload, compliance_flags } = compute(failing);
    checked++;
    if (output_payload.meets_target !== false) violations++;
    if (output_payload.unmet_criteria.length !== 1) violations++;
    if (!compliance_flags.includes('AAL_SHORTFALL')) violations++;
    if (compliance_flags.includes('AAL_DEFINITION_INSUFFICIENT')) violations++;
  }
  return { name: 'P3_refusal_vs_shortfall_distinct', checked, violations };
}

// ---------- P4: monotonicity under capability-superset authenticator sets ----------
function checkP4_monotonicity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const base = compute(pp);
    const targetIdx = pp.framework.levels.findIndex((l) => l.level_id === pp.target_level);
    const banned = pp.framework.levels[targetIdx].restricted_authenticator_kinds || [];
    if (pp.authenticators.some((a) => banned.includes(a.kind) || a.restricted === true)) continue; // skip restriction-tainted bases
    const extra = randomAuthenticator(rand); // never otp_sms => never newly restricted
    const grown = compute({ ...pp, authenticators: [...pp.authenticators, extra] });
    checked++;
    const baseIdx = pp.framework.levels.findIndex((l) => l.level_id === base.output_payload.achieved_level);
    const grownIdx = pp.framework.levels.findIndex((l) => l.level_id === grown.output_payload.achieved_level);
    if (base.output_payload.meets_target && !grown.output_payload.meets_target) violations++;
    if (baseIdx >= 0 && grownIdx >= 0 && grownIdx < baseIdx) violations++;
  }
  return { name: 'P4_monotonicity_superset', checked, violations };
}

// ---------- P5: differential re-derivation of the restricted flag ----------
function checkP5_restricted_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload, compliance_flags } = compute(pp);
    const targetIdx = pp.framework.levels.findIndex((l) => l.level_id === pp.target_level);
    const banned = new Set(pp.framework.levels[targetIdx].restricted_authenticator_kinds || []);
    const expected = pp.authenticators.some((a) => banned.has(a.kind) || a.restricted === true);
    checked++;
    if (compliance_flags.includes('AAL_RESTRICTED_AUTHENTICATOR_USED') !== expected) violations++;
    if (expected && !output_payload.unmet_criteria.some((u) => u.criterion === 'restricted_authenticator_kinds')) violations++;
  }
  return { name: 'P5_restricted_flag_differential', checked, violations };
}

// ---------- P6: ULP-boundary forcing on the interval compares (float_sensitive: yes) ----------
function checkP6_ulp_boundaries() {
  let violations = 0, checked = 0;
  const base = {
    framework: { id: 'x', version: '1', levels: [{ level_id: 'l1', max_reauth_interval_minutes: 720, max_idle_minutes: 15 }] },
    target_level: 'l1',
    authenticators: [{ kind: 'passkey_device_bound', factor_kinds: ['possession', 'inherent'] }],
  };
  const cases = [
    { s: { reauth_interval_minutes: 720, idle_timeout_minutes: 15 }, exceeded: false }, // exact boundary passes
    { s: { reauth_interval_minutes: 720 + Number.EPSILON * 512, idle_timeout_minutes: 15 }, exceeded: true }, // one ULP over at 720's binade (ULP = EPSILON * 512) exceeds
    { s: { reauth_interval_minutes: 0, idle_timeout_minutes: 0 }, exceeded: false }, // zero is a valid instant policy
    { s: { reauth_interval_minutes: -0, idle_timeout_minutes: 15 }, exceeded: false }, // negative zero == 0
    { s: {}, exceeded: true }, // missing session values are found:null shortfalls
  ];
  for (const c of cases) {
    const { output_payload, compliance_flags } = compute({ ...base, session: c.s });
    checked++;
    const flagged = compliance_flags.includes('AAL_REAUTH_INTERVAL_EXCEEDED');
    if (flagged !== c.exceeded) violations++;
    const u = output_payload.unmet_criteria.find((x) => x.criterion === 'max_reauth_interval_minutes');
    if (c.exceeded && !u) violations++;
    if (!c.exceeded && u) violations++;
  }
  { // NaN session value coerces to found:null shortfall -- must still be a shortfall, never a pass
    const { output_payload, compliance_flags } = compute({ ...base, session: { reauth_interval_minutes: NaN, idle_timeout_minutes: 15 } });
    checked++;
    if (!compliance_flags.includes('AAL_REAUTH_INTERVAL_EXCEEDED')) violations++;
    if (!output_payload.unmet_criteria.some((x) => x.criterion === 'max_reauth_interval_minutes' && x.found === null)) violations++;
  }
  return { name: 'P6_ulp_interval_boundaries', checked, violations };
}

// ---------- P7: vacuous level (no criteria) is met; walk-down picks the highest met level ----------
function checkP7_vacuous_and_walkdown() {
  let violations = 0, checked = 0;
  const pp = {
    framework: {
      id: 'x', version: '1',
      levels: [
        { level_id: 'l0' }, // no criteria: vacuously met
        { level_id: 'l1', min_factors: 2 },
        { level_id: 'l2', min_factors: 9 }, // unreachable
      ],
    },
    target_level: 'l2',
    authenticators: [{ kind: 'password', factor_kinds: ['knowledge'] }, { kind: 'otp_device', factor_kinds: ['possession'] }],
  };
  {
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (output_payload.achieved_level !== 'l1') violations++;
    if (output_payload.meets_target !== false) violations++;
    if (!compliance_flags.includes('AAL_SHORTFALL')) violations++;
  }
  {
    const { output_payload } = compute({ ...pp, target_level: 'l0' });
    checked++;
    if (output_payload.meets_target !== true || output_payload.achieved_level !== 'l0') violations++;
  }
  return { name: 'P7_vacuous_and_walkdown', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_outputShape(),
  checkP2_determinism(),
  checkP3_refusalSemantics(),
  checkP4_monotonicity(),
  checkP5_restricted_differential(),
  checkP6_ulp_boundaries(),
  checkP7_vacuous_and_walkdown(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
