// art-609-jwks-pinned-directory-check.proptest.mjs — FV property-test FLOOR (FVFLOOR-BACKFILL-0811-1).
// kernel_digest_at_authoring: sha256:c2d3b27062a33c356a19c8e65db737fe59d34ad93c8ed44ecde8e960cd22813b
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md section 3, class B -- JCS-canon + SHA-256
// digest comparison, straight-line arithmetic). NOT a proof, NOT Dafny.
// float_sensitive: NO -- every operation is byte/string comparison and hashing; no division, no
// fractional arithmetic anywhere in compute().
//
// Checks: fixture-oracle gate (P0), totality/never-throws over hostile inputs (P1), a differential
// re-derivation of the JCS canonicalization + SHA-256 digest against Node's own WebCrypto (P2 -- the
// kernel's self-check IIFE already proves its OWN 3 known vectors at import time; this floor extends
// that same differential idea across many RANDOM directory shapes, not just the 3 fixed vectors), the
// canonicalization invariant that key ORDER never changes the digest (P3, JCS's defining property --
// re-keying an object must not move its canonical byte form), a metamorphic determinism + single-
// byte-tamper-changes-digest property (P4), and forced categorical boundary cases (P5: missing
// pinned_digest, malformed hex, case-insensitive comparison, key_count echoing).

import { compute } from '../art-609-jwks-pinned-directory-check.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

// ---------- P0: fixture oracle ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-609-jwks-pinned-directory-check.fixtures.json');
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
const rand = mulberry32(0x609B0A7);

// independent reference JCS canon (recursive key-sort), built in THIS file
const refCanon = (v) =>
  Array.isArray(v) ? v.map(refCanon)
  : (v && typeof v === 'object')
    ? Object.keys(v).sort().reduce((o, k) => (o[k] = refCanon(v[k]), o), {})
    : v;
async function refDigestHex(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(refCanon(value)));
  const d = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function randJwk(rng, i) {
  return { kty: 'OKP', crv: 'Ed25519', kid: `key-${i}`, x: Array.from({ length: 8 }, () => rng().toString(16).slice(2, 4)).join('') };
}

// ---------- P1: totality ----------
function checkP1_totality() {
  let violations = 0, checked = 0;
  const hostileInputs = [
    null, undefined, {}, [], 'a string', 42, true,
    { directory_jwks: null }, { directory_jwks: 'not-an-object' }, { directory_jwks: [] },
    { directory_jwks: { keys: 'not-an-array' } }, { directory_jwks: { keys: [null, 42, {}] } },
    { pinned_digest: null }, { pinned_digest: 42 }, { pinned_digest: '' },
    { pinned_digest: 'not-hex-at-all' },
    { pinned_digest: 'g'.repeat(64) }, // hex-length but invalid characters
  ];
  for (const pp of hostileInputs) {
    checked++;
    let out;
    try { out = compute(pp); } catch (e) { violations++; continue; }
    const o = out.output_payload;
    if (typeof o.computed_digest !== 'string' || !/^[0-9a-f]{64}$/.test(o.computed_digest)) violations++;
    if (typeof o.digest_match !== 'boolean') violations++;
    if (typeof o.key_count !== 'number') violations++;
    if (!Array.isArray(out.compliance_flags) || out.compliance_flags.length === 0) violations++;
  }
  return { name: 'P1_totality_never_throws_well_formed_shape', trials: checked, violations };
}

// ---------- P2: differential — computed_digest matches an independently re-derived JCS-canon
// SHA-256 across many RANDOM directory shapes, extending the kernel's own 3-vector self-check ----------
async function checkP2_differential_digest_vs_webcrypto() {
  let violations = 0, checked = 0;
  for (let trial = 0; trial < 60; trial++) {
    checked++;
    const n = Math.floor(rand() * 5);
    const directory_jwks = { keys: Array.from({ length: n }, (_, i) => randJwk(rand, i)) };
    const { output_payload: o } = compute({ directory_jwks });
    const expected = await refDigestHex(directory_jwks);
    if (o.computed_digest !== expected) violations++;
  }
  // non-ASCII field values (kty/kid with unicode) -- exercises the kernel's inlined UTF-8 encoder
  const unicodeSamples = [
    { keys: [{ kty: 'OKP', kid: 'ключ-1', x: 'abc' }] },
    { keys: [{ kty: 'OKP', kid: '密钥🔑', x: 'xyz' }] },
  ];
  for (const directory_jwks of unicodeSamples) {
    checked++;
    const { output_payload: o } = compute({ directory_jwks });
    const expected = await refDigestHex(directory_jwks);
    if (o.computed_digest !== expected) violations++;
  }
  return { name: 'P2_differential_digest_vs_independent_jcs_canon_and_webcrypto', trials: checked, violations };
}

// ---------- P3: canonicalization invariant — key ORDER never changes the digest (JCS's defining
// property), at every nesting level the directory shape exercises ----------
async function checkP3_key_order_invariance() {
  let violations = 0, checked = 0;
  for (let trial = 0; trial < 40; trial++) {
    checked++;
    const key = { kty: 'OKP', crv: 'Ed25519', kid: `k${trial}`, x: `val${trial}`, use: 'sig' };
    const reordered = { use: key.use, x: key.x, kid: key.kid, crv: key.crv, kty: key.kty };
    const a = compute({ directory_jwks: { keys: [key] } }).output_payload;
    const b = compute({ directory_jwks: { keys: [reordered] } }).output_payload;
    if (a.computed_digest !== b.computed_digest) violations++;

    // top-level key reordering (keys array position preserved, but sibling top-level fields reordered)
    const dirA = { keys: [key], extra_field: 'x', another: 1 };
    const dirB = { another: 1, extra_field: 'x', keys: [key] };
    const ca = compute({ directory_jwks: dirA }).output_payload;
    const cb = compute({ directory_jwks: dirB }).output_payload;
    if (ca.computed_digest !== cb.computed_digest) violations++;
  }
  return { name: 'P3_jcs_key_order_never_changes_digest', trials: checked, violations };
}

// ---------- P4: metamorphic — determinism, single-byte-tamper changes digest, pinned_digest
// case-insensitivity ----------
function checkP4_metamorphic() {
  let violations = 0, checked = 0;
  for (let trial = 0; trial < 40; trial++) {
    checked++;
    const directory_jwks = { keys: [randJwk(rand, trial)] };
    const pp = { directory_jwks };
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;

    // tamper one key field -> digest must change
    const tampered = { keys: [{ ...directory_jwks.keys[0], x: directory_jwks.keys[0].x + 'Z' }] };
    const t = compute({ directory_jwks: tampered }).output_payload;
    if (t.computed_digest === a.computed_digest) violations++;

    // pinned_digest matching, uppercase -> still matches (case-insensitive comparison, lowercase emitted)
    const pinned = compute({ directory_jwks, pinned_digest: a.computed_digest.toUpperCase() }).output_payload;
    if (pinned.digest_match !== true) violations++;
    if (pinned.pinned_digest !== a.computed_digest.toUpperCase()) violations++; // echoed verbatim
  }
  return { name: 'P4_metamorphic_determinism_tamper_changes_digest_case_insensitive_pin', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // no pinned_digest -> PINNED_DIGEST_MISSING flag, digest_match false
  { checked++;
    const { output_payload: o, compliance_flags } = compute({ directory_jwks: { keys: [] } });
    if (o.digest_match !== false) violations++;
    if (!compliance_flags.includes('PINNED_DIGEST_MISSING')) violations++; }
  // malformed pinned_digest (wrong length) -> PINNED_DIGEST_MALFORMED flag
  { checked++;
    const { compliance_flags } = compute({ directory_jwks: { keys: [] }, pinned_digest: 'abc123' });
    if (!compliance_flags.includes('PINNED_DIGEST_MALFORMED')) violations++; }
  // well-formed but wrong digest -> MISMATCH flag, no MALFORMED flag
  { checked++;
    const { output_payload: o, compliance_flags } = compute({ directory_jwks: { keys: [] }, pinned_digest: '0'.repeat(64) });
    if (o.digest_match !== false) violations++;
    if (!compliance_flags.includes('JWKS_PINNED_DIGEST_MISMATCH')) violations++;
    if (compliance_flags.includes('PINNED_DIGEST_MALFORMED')) violations++; }
  // empty directory -> key_count 0
  { checked++;
    const { output_payload: o } = compute({ directory_jwks: {} });
    if (o.key_count !== 0) violations++; }
  // keys array with N entries -> key_count === N
  { checked++;
    const { output_payload: o } = compute({ directory_jwks: { keys: [{ kty: 'OKP' }, { kty: 'RSA' }, { kty: 'EC' }] } });
    if (o.key_count !== 3) violations++; }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_totality());
results.properties.push(await checkP2_differential_digest_vs_webcrypto());
results.properties.push(await checkP3_key_order_invariance());
results.properties.push(checkP4_metamorphic());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-609-jwks-pinned-directory-check',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
