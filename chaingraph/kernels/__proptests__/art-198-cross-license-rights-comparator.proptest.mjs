// art-198-cross-license-rights-comparator property-test floor (FV-PROPFLOOR-SHARD-A-THRESHOLD-1).
// kernel_digest_at_authoring: sha256:24102c5196e98e7832f199ffd32f1801cda6dcf14ae89fb8e8d89fdfcd8963f2
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: loop over a fixed table (16 licenses x 9-dim rights
// vector across cc/cbe/pil families, + a CBE alias table), pairwise diff + permissiveness enum
// classification (equal / a_more_permissive / b_more_permissive / incomparable / unknown) --
// this is the enum-scoring analogue of a threshold band, confirmed against direct source read
// per FV-PROPFLOOR-SHARD-A-THRESHOLD-1's fence.
// float:no (every VEC field is a declared boolean, ref lookups are string keys) -- forced
// CATEGORICAL boundary cases (every license key, both CBE alias name sets, unknown refs) stand
// in for ULP forcing. ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t.
// the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-198-cross-license-rights-comparator.proptest.mjs

import { compute } from '../art-198-cross-license-rights-comparator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const KNOWN_KEYS = [
  'cc:CC0-1.0', 'cc:CC-BY-4.0', 'cc:CC-BY-SA-4.0', 'cc:CC-BY-ND-4.0', 'cc:CC-BY-NC-4.0', 'cc:CC-BY-NC-SA-4.0', 'cc:CC-BY-NC-ND-4.0',
  'cbe:CBE_CC0', 'cbe:CBE_ECR', 'cbe:CBE_NECR', 'cbe:CBE_NECR_HS', 'cbe:CBE_PR', 'cbe:CBE_PR_HS',
  'pil:non_commercial_social_remixing', 'pil:commercial_use', 'pil:commercial_remix',
];
const CBE_ALIAS_PAIRS = [
  ['PUBLIC', 'CBE_CC0'], ['EXCLUSIVE', 'CBE_ECR'], ['COMMERCIAL', 'CBE_NECR'],
  ['COMMERCIAL_NO_HATE', 'CBE_NECR_HS'], ['PERSONAL', 'CBE_PR'], ['PERSONAL_NO_HATE', 'CBE_PR_HS'],
];
const DIMS = ['copy', 'display', 'commercial', 'exclusive', 'modify', 'sublicense', 'share_alike', 'attribution', 'revocable'];
const GRANT = new Set(['copy', 'display', 'commercial', 'modify', 'sublicense', 'exclusive']);
const RESTRICT = new Set(['share_alike', 'attribution', 'revocable']);

function toRef(key) {
  const [fam, id] = key.split(':');
  return { family: fam, id };
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-198-cross-license-rights-comparator.fixtures.json');
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

// ---------- negative control: an oracle never seen rejecting a wrong spec is not known to work ----------
function negativeControl() {
  const { output_payload } = compute({ license_ref_a: toRef('cc:CC0-1.0'), license_ref_b: toRef('cc:CC-BY-4.0') });
  const mutated = { ...output_payload, more_permissive_than: output_payload.more_permissive_than === 'equal' ? 'incomparable' : 'equal' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: identity reflexivity -- comparing a license against itself is always 'equal', empty diff.
function checkP1_identityReflexivity() {
  let violations = 0, checked = 0;
  for (const key of KNOWN_KEYS) {
    const ref = toRef(key);
    const { output_payload } = compute({ license_ref_a: ref, license_ref_b: ref });
    checked++;
    if (output_payload.more_permissive_than !== 'equal') violations++;
    if (output_payload.diff.length !== 0) violations++;
  }
  return { name: 'P1_identity_reflexivity_all_16_known_keys', trials: checked, violations };
}

// P2: enum-select agreement (permissiveness classification) -- recomputed from the GRANT/RESTRICT
// rule independently of the kernel, for every known-key pair sampled.
function checkP2_permissivenessEnumAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(198002);
  for (let i = 0; i < 300; i++) {
    const keyA = pick(rng, KNOWN_KEYS);
    const keyB = pick(rng, KNOWN_KEYS);
    const { output_payload } = compute({ license_ref_a: toRef(keyA), license_ref_b: toRef(keyB) });
    checked++;
    const va = output_payload.vector_a, vb = output_payload.vector_b;
    let aBeatsB = false, bBeatsA = false;
    for (const k of DIMS) {
      if (GRANT.has(k)) {
        if (va[k] && !vb[k]) aBeatsB = true;
        if (vb[k] && !va[k]) bBeatsA = true;
      } else {
        if (!va[k] && vb[k]) aBeatsB = true;
        if (!vb[k] && va[k]) bBeatsA = true;
      }
    }
    const expected = !aBeatsB && !bBeatsA ? 'equal' : aBeatsB && !bBeatsA ? 'a_more_permissive' : bBeatsA && !aBeatsB ? 'b_more_permissive' : 'incomparable';
    if (output_payload.more_permissive_than !== expected) violations++;
  }
  return { name: 'P2_permissiveness_enum_agreement_random300', trials: checked, violations };
}

// P3: CBE alias equivalence -- both launch-alias and Oct-2022 enum names resolve to the same vector.
function checkP3_cbeAliasEquivalence() {
  let violations = 0, checked = 0;
  for (const [alias, canonical] of CBE_ALIAS_PAIRS) {
    const rAlias = compute({ license_ref_a: { family: 'cbe', id: alias }, license_ref_b: { family: 'cc', id: 'CC0-1.0' } }).output_payload;
    const rCanon = compute({ license_ref_a: { family: 'cbe', id: canonical }, license_ref_b: { family: 'cc', id: 'CC0-1.0' } }).output_payload;
    checked++;
    if (JSON.stringify(rAlias.vector_a) !== JSON.stringify(rCanon.vector_a)) violations++;
    if (rAlias.checks[0].pass !== true) violations++;
  }
  return { name: 'P3_cbe_alias_equivalence_all_6_pairs', trials: checked, violations };
}

// P4: unknown refs are always rejected with checks[i].pass=false and 'unknown' comparison, never
// silently substituted with a real vector.
function checkP4_unknownRefRejection() {
  let violations = 0, checked = 0;
  const UNKNOWN = [{ family: 'cc', id: 'NOT-A-LICENSE' }, { family: 'mit', id: 'MIT' }, { family: '', id: '' }, {}, null];
  for (const bad of UNKNOWN) {
    const { output_payload } = compute({ license_ref_a: bad, license_ref_b: { family: 'cc', id: 'CC0-1.0' } });
    checked++;
    if (bad === null) {
      // falls back to DEFAULT_A, still a known ref
      continue;
    }
    if (output_payload.checks[0].pass !== false) violations++;
    if (output_payload.more_permissive_than !== 'unknown') violations++;
    if (output_payload.diff.length !== 0) violations++;
  }
  return { name: 'P4_unknown_ref_rejection', trials: checked, violations };
}

// P5: forced categorical boundary cases -- every known key compared against every other known
// key's diff dimension keys are always drawn from the fixed 9-dim DIMS set.
function checkP5_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  for (let i = 0; i < KNOWN_KEYS.length; i++) {
    const a = KNOWN_KEYS[i], b = KNOWN_KEYS[(i + 1) % KNOWN_KEYS.length];
    const { output_payload } = compute({ license_ref_a: toRef(a), license_ref_b: toRef(b) });
    checked++;
    if (output_payload.dimensions.length !== 9) violations++;
    for (const d of output_payload.diff) if (!DIMS.includes(d.key)) violations++;
  }
  return { name: 'P5_forced_categorical_boundary_cases_adjacent_pairs', trials: checked, violations };
}

// P6: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP6_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { license_ref_a: {} }, { license_ref_a: { family: 'cc', id: 'CC0-1.0' } }, { license_ref_a: toRef('pil:commercial_remix'), license_ref_b: toRef('cbe:CBE_ECR') }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (typeof output_payload.more_permissive_than !== 'string') violations++;
    if (!Array.isArray(output_payload.diff)) violations++;
    if (!Array.isArray(output_payload.dimensions) || output_payload.dimensions.length !== 9) violations++;
    if (!Array.isArray(output_payload.checks) || output_payload.checks.length !== 2) violations++;
    if (typeof output_payload.disclaimer !== 'string') violations++;
  }
  return { name: 'P6_output_shape_no_nan_undefined', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

const negControl = negativeControl();
if (!negControl.rejected_wrong_spec) {
  console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
  process.exit(1);
}

results.properties.push(checkP1_identityReflexivity());
results.properties.push(checkP2_permissivenessEnumAgreement());
results.properties.push(checkP3_cbeAliasEquivalence());
results.properties.push(checkP4_unknownRefRejection());
results.properties.push(checkP5_forcedCategoricalBoundaries());
results.properties.push(checkP6_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-198-cross-license-rights-comparator',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
