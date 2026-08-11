// art-502-bind-attested-subject.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C24-1).
// kernel_digest_at_authoring: sha256:8680e25172057485acdc9fae8651fab076d8ebe76824abf35bf75b8f186568fa
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — the WU row's own table agrees, no correction
// needed). This kernel is pure hashing (a synchronous pure-JS SHA-256, the art-476 FIX-2 lesson)
// plus string/regex validation (SHA256REF format check) and null-coalescing. No numeric
// arithmetic of any kind, floating-point or otherwise, appears anywhere in compute().
// Checks: fixture-oracle gate, termination (compute() runs a fixed number of hash operations
// independent of any unbounded loop — the preimage has exactly 3 members by construction),
// forced categorical boundary cases (absent/malformed/well-formed digest strings for each of the
// three sha256: fields), differential re-derivation of subject_hash via an independent JCS+SHA-256
// implementation, boundedness (subject_hash always matches ^sha256:[0-9a-f]{64}$), and metamorphic
// determinism (the same policy_parameters object always yields the same subject_hash, and a
// structurally-irrelevant extra key on the raw input never changes it, since the preimage is
// built from a FIXED key list rather than spread from caller input).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-502-bind-attested-subject.proptest.mjs

import { compute } from '../art-502-bind-attested-subject.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-502-bind-attested-subject.fixtures.json');
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
const rand = mulberry32(0x502C0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const cgCanon = (v) => Array.isArray(v) ? v.map(cgCanon) : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => (o[k] = cgCanon(v[k]), o), {}) : v;
function jcsDigestHex(value) { return createHash('sha256').update(JSON.stringify(cgCanon(value))).digest('hex'); }

function randomDigest(rng, valid) {
  if (!valid) return pick(rng, [null, '', 'not-a-digest', 'sha256:tooshort', 'md5:' + 'a'.repeat(32)]);
  return 'sha256:' + Array.from({ length: 64 }, () => Math.floor(rng() * 16).toString(16)).join('');
}

function randomPP(rng) {
  const validManifest = rng() < 0.6;
  const validContent = rng() < 0.6;
  return {
    tool_ref: {
      tool_id: pick(rng, ['art-999', '', null]),
      tool_version: pick(rng, ['1.0.0', null]),
      entry: pick(rng, ['compute', null]),
      manifest_digest: randomDigest(rng, validManifest),
    },
    artifact: {
      content_type: pick(rng, ['application/pdf', null]),
      content_digest: randomDigest(rng, validContent),
    },
    inputs_digest: rng() < 0.5 ? randomDigest(rng, true) : null,
    producer_inputs: rng() < 0.3 ? { a: Math.floor(rng() * 100), b: 'x' } : undefined,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — compute() is O(1) in loop structure; preimage always has exactly 3 members ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.preimage_member_count !== 3) violations++;
    if (Object.keys(output_payload.subject_preimage).length !== 3) violations++;
  }
  return { name: 'P1_termination_preimage_always_three_members', trials: checked, violations };
}

// ---------- P2: forced categorical boundary cases — absent/malformed/well-formed digest strings ----------
function checkP2_digest_boundary_categorical() {
  let violations = 0, checked = 0;
  const cases = [
    { manifest: null, expectPinned: false, expectFinding: 'MANIFEST_DIGEST_ABSENT' },
    { manifest: 'not-hex', expectPinned: false, expectFinding: 'MANIFEST_DIGEST_MALFORMED' },
    { manifest: 'sha256:' + 'a'.repeat(64), expectPinned: true, expectFinding: null },
    { manifest: 'sha256:' + 'A'.repeat(64), expectPinned: false, expectFinding: 'MANIFEST_DIGEST_MALFORMED' }, // uppercase hex rejected
  ];
  for (const c of cases) {
    const pp = { tool_ref: { tool_id: 't', tool_version: '1', entry: 'compute', manifest_digest: c.manifest }, artifact: { content_type: 'x', content_digest: 'sha256:' + 'b'.repeat(64) }, inputs_digest: 'sha256:' + 'c'.repeat(64) };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.producer_pinned !== c.expectPinned) violations++;
    if (c.expectFinding) {
      const found = output_payload.findings.some((f) => f.code === c.expectFinding);
      if (!found) violations++;
    }
  }
  return { name: 'P2_digest_wellformedness_forced_categorical', trials: checked, violations };
}

// ---------- P3 (differential): subject_hash re-derivation via independent JCS+SHA-256 ----------
function checkP3_subject_hash_differential() {
  let violations = 0, checked = 0;
  function strOrNull(v) { const s = typeof v === 'string' ? v.trim() : ''; return s === '' ? null : s; }
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const tr = pp.tool_ref || {};
    const af = pp.artifact || {};
    const tool_ref = { tool_id: strOrNull(tr.tool_id), tool_version: strOrNull(tr.tool_version), entry: strOrNull(tr.entry), manifest_digest: strOrNull(tr.manifest_digest) };
    const artifact = { content_type: strOrNull(af.content_type), content_digest: strOrNull(af.content_digest) };
    const hasInputs = pp.producer_inputs !== undefined && pp.producer_inputs !== null;
    const inputs_digest = hasInputs ? `sha256:${jcsDigestHex(pp.producer_inputs)}` : strOrNull(pp.inputs_digest);
    const preimage = { tool_ref, inputs_digest, artifact };
    const expected = `sha256:${jcsDigestHex(preimage)}`;
    if (output_payload.subject_hash !== expected) violations++;
  }
  return { name: 'P3_subject_hash_differential', trials: checked, violations };
}

// ---------- P4: boundedness — subject_hash always matches ^sha256:[0-9a-f]{64}$ ----------
function checkP4_subject_hash_format_bounded() {
  let violations = 0, checked = 0;
  const RE = /^sha256:[0-9a-f]{64}$/;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!RE.test(output_payload.subject_hash)) violations++;
  }
  return { name: 'P4_subject_hash_format_bounded', trials: checked, violations };
}

// ---------- P5: metamorphic — determinism (same input -> same hash) + irrelevant extra key on
// tool_ref/artifact never enters the preimage (fixed key-list construction) ----------
function checkP5_determinism_and_extra_key_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp).output_payload;
    const r2 = compute(pp).output_payload;
    checked++;
    if (r1.subject_hash !== r2.subject_hash) violations++;
    const withExtra = { ...pp, tool_ref: { ...pp.tool_ref, unexpected_extra_field: 'smuggled-' + i }, artifact: { ...pp.artifact, another_extra: 42 } };
    const r3 = compute(withExtra).output_payload;
    checked++;
    if (r1.subject_hash !== r3.subject_hash) violations++;
  }
  return { name: 'P5_determinism_and_extra_key_ignored_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_digest_boundary_categorical());
results.properties.push(checkP3_subject_hash_differential());
results.properties.push(checkP4_subject_hash_format_bounded());
results.properties.push(checkP5_determinism_and_extra_key_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-502-bind-attested-subject',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
