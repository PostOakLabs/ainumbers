// art-361-camera-provenance-check.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C16-1).
// kernel_digest_at_authoring: sha256:66a38ec12dbba452a125bf4d8d7e48439c603c7307af287f274e17bac14aa6eb
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — pure string/regex/Set-membership/array-search
// logic; zero arithmetic anywhere in compute(), no ULP-boundary claim made or needed — forced
// categorical boundary cases used instead).
// Checks: fixture-oracle gate, termination (missing_elements.length is bounded by the fixed
// 3-item checklist; labels/actions_list are single linear passes over the caller-supplied
// assertions array, no recursion), boundedness (capture_chain_field is null if and only if
// rejected is true, and non-null otherwise with the same manifest_digest echoed back), a
// differential re-derivation of manifest_valid/provenance_label from the source's own
// digitalSourceType classification logic, an early-reject metamorphic identity (once
// manifest_digest is raw-data-shaped, the rejection is unconditional — mutating claim/
// assertions/signature after that point never changes the rejected verdict), and forced
// categorical boundary cases at the looksLikeDigest length/shape edges (15 vs 16 hex chars,
// with/without the sha256: prefix, malformed characters) and the digitalSourceType category
// boundary (trainedAlgorithmicMedia vs digitalCapture vs an unrecognized value).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-361-camera-provenance-check.proptest.mjs

import { compute } from '../art-361-camera-provenance-check.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-361-camera-provenance-check.fixtures.json');
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
const rand = mulberry32(0x36100);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const SOURCE_TYPES = [
  'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture',
  'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia',
  'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia',
  'http://cv.iptc.org/newscodes/digitalsourcetype/unknown',
  null,
];

function randomAssertions(rng) {
  const assertions = [];
  if (rng() < 0.8) assertions.push({ label: 'c2pa.hash.data' });
  if (rng() < 0.2) assertions.push({ label: 'c2pa.hash.bmff' });
  if (rng() < 0.85) {
    const sourceType = pick(rng, SOURCE_TYPES);
    assertions.push({ label: 'c2pa.actions', actions: sourceType ? [{ action: 'c2pa.captured', digitalSourceType: sourceType }] : [] });
  }
  return assertions;
}

function randomPP(rng) {
  const validDigest = rng() < 0.7;
  return {
    manifest_digest: validDigest ? 'sha256:' + '9'.repeat(64) : (rng() < 0.5 ? 'raw-image-bytes-not-a-digest-shape!!' : null),
    claim_generator: rng() < 0.85 ? 'Pixel Camera App 3.2' : (rng() < 0.5 ? '' : undefined),
    claim: { format: rng() < 0.85 ? 'image/jpeg' : undefined, instanceID: rng() < 0.85 ? 'xmp:iid:1001' : undefined },
    assertions: randomAssertions(rng),
    signature: rng() < 0.8 ? { present: true, alg: 'ES256' } : {},
  };
}

const TRIALS = 4000;

// ---------- P1: termination — missing_elements bounded by the fixed 3-item checklist ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (!o.rejected && o.missing_elements.length > 3) violations++;
  }
  return { name: 'P1_termination_missing_elements_bounded_by_fixed_checklist', trials: checked, violations };
}

// ---------- P2: boundedness — capture_chain_field null iff rejected ----------
function checkP2_capture_chain_field_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.rejected && o.capture_chain_field !== null) violations++;
    if (!o.rejected && o.capture_chain_field === null) violations++;
    if (!o.rejected && pp.manifest_digest && o.capture_chain_field.manifest_digest !== String(pp.manifest_digest).trim()) violations++;
  }
  return { name: 'P2_capture_chain_field_null_iff_rejected', trials: checked, violations };
}

// ---------- P3: differential — provenance_label / manifest_valid re-derivation ----------
function checkP3_provenance_label_differential() {
  let violations = 0, checked = 0;
  const TRAINED = new Set([
    'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia',
    'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia',
  ]);
  const CAPTURE = new Set(['http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.rejected) continue;
    const labels = pp.assertions.map((a) => a && a.label).filter(Boolean);
    const has_hard_binding = labels.includes('c2pa.hash.data') || labels.includes('c2pa.hash.bmff');
    const has_actions = labels.some((l) => l === 'c2pa.actions' || l === 'c2pa.actions.v2');
    const claim_well_formed = typeof pp.claim_generator === 'string' && pp.claim_generator.length > 0
      && typeof pp.claim.format === 'string' && typeof pp.claim.instanceID === 'string';
    const sig_ref_present = !!pp.signature && (pp.signature.present === true || typeof pp.signature.alg === 'string');
    const manifest_valid = claim_well_formed && has_hard_binding && sig_ref_present;
    if (o.manifest_valid !== manifest_valid) violations++;
    if (o.has_hard_binding !== has_hard_binding) violations++;
    const actionsAssertion = pp.assertions.find((a) => a && (a.label === 'c2pa.actions' || a.label === 'c2pa.actions.v2'));
    const actionsList = actionsAssertion && Array.isArray(actionsAssertion.actions) ? actionsAssertion.actions : [];
    const dst = (actionsList.length && actionsList[0] && actionsList[0].digitalSourceType) || null;
    const trained = TRAINED.has(dst);
    const captureAsserted = CAPTURE.has(dst);
    let expectedLabel = 'indeterminate';
    if (trained) expectedLabel = 'ai_generated_flagged';
    else if (captureAsserted && manifest_valid) expectedLabel = 'genuine_capture_asserted';
    if (o.provenance_label !== expectedLabel) violations++;
  }
  return { name: 'P3_provenance_label_manifest_valid_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — once rejected on digest shape, mutating everything else never un-rejects ----------
function checkP4_early_reject_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 800; i++) {
    const pp = randomPP(rand);
    const badDigest = { ...pp, manifest_digest: 'this-is-clearly-raw-image-pixel-data-not-a-digest!!!' };
    const r1 = compute(badDigest).output_payload;
    checked++;
    if (r1.rejected !== true) violations++;
    const mutated = { ...badDigest, claim_generator: 'Different App', assertions: [{ label: 'c2pa.hash.data' }], signature: { present: true } };
    const r2 = compute(mutated).output_payload;
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  return { name: 'P4_early_reject_metamorphic_identity', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no — categorical, not ULP) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // looksLikeDigest length boundary: 15 vs 16 hex chars
  {
    const short = compute({ manifest_digest: 'a'.repeat(15) }).output_payload;
    checked++;
    if (short.rejected !== true) violations++;
    const long16 = compute({ manifest_digest: 'a'.repeat(16) }).output_payload;
    checked++;
    if (long16.rejected !== false) violations++;
  }
  // with/without sha256: prefix, both valid shapes
  {
    const withPrefix = compute({ manifest_digest: 'sha256:' + 'b'.repeat(64) }).output_payload;
    const withoutPrefix = compute({ manifest_digest: 'b'.repeat(64) }).output_payload;
    checked++;
    if (withPrefix.rejected !== false || withoutPrefix.rejected !== false) violations++;
  }
  // digitalSourceType category boundary: trainedAlgorithmicMedia vs digitalCapture vs unrecognized
  {
    const trained = compute({ manifest_digest: null, claim_generator: 'App', claim: { format: 'image/jpeg', instanceID: 'x' }, assertions: [{ label: 'c2pa.hash.data' }, { label: 'c2pa.actions', actions: [{ digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia' }] }], signature: { present: true } }).output_payload;
    checked++;
    if (trained.provenance_label !== 'ai_generated_flagged') violations++;
    const capture = compute({ manifest_digest: null, claim_generator: 'App', claim: { format: 'image/jpeg', instanceID: 'x' }, assertions: [{ label: 'c2pa.hash.data' }, { label: 'c2pa.actions', actions: [{ digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture' }] }], signature: { present: true } }).output_payload;
    checked++;
    if (capture.provenance_label !== 'genuine_capture_asserted') violations++;
    const unknown = compute({ manifest_digest: null, claim_generator: 'App', claim: { format: 'image/jpeg', instanceID: 'x' }, assertions: [{ label: 'c2pa.hash.data' }, { label: 'c2pa.actions', actions: [{ digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/unrecognized' }] }], signature: { present: true } }).output_payload;
    checked++;
    if (unknown.provenance_label !== 'indeterminate') violations++;
  }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_capture_chain_field_boundedness());
results.properties.push(checkP3_provenance_label_differential());
results.properties.push(checkP4_early_reject_metamorphic());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-361-camera-provenance-check',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
