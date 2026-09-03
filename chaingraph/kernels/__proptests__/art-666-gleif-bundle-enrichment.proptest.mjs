// art-666-gleif-bundle-enrichment.proptest.mjs -- class-A property-test FLOOR (FV-PBT-FLOOR-BUILD-SPEC.md).
// kernel_digest_at_authoring: sha256:c5add6d4113fa1b0a8122f515da39a8d00b607b1e3bf9b1ca2526049f148f8d0
// spec: BUNDLE-ENRICH-BUILD-SPEC.md §4, §7 WU -GLEIF-1.
// human_sign_off: PENDING
//
// SCOPE: floor tier only, NOT a proof, NOT Dafny. float_sensitive: NO -- no arithmetic in this
// kernel at all beyond byte counting; the digest/checksum logic is the SAME code already
// running live under art-599 (copied verbatim, per the spec's reuse instruction), so this
// floor targets the scoping logic this node actually adds: the bundle_asserts_lei_identity
// tri-state and its interaction with gleif_enrichment.
//
// Checks: fixture-oracle gate, determinism, output-shape (no NaN/undefined anywhere),
// a differential re-derivation of the "applicable" flag from the raw tri-state input, a
// differential re-derivation of source_bytes from the raw source_text (UTF-8 byte length,
// independent of the kernel's own _utf8Bytes), and the never-guess invariant over nasty
// values for bundle_asserts_lei_identity.
//
// Run: node chaingraph/kernels/__proptests__/art-666-gleif-bundle-enrichment.proptest.mjs

import { compute } from '../art-666-gleif-bundle-enrichment.kernel.mjs';
import { runFixtureOracle, summarize, findShapeViolations, mulberry32, pick, pickNasty } from './_pbt-common.mjs';

const KERNEL_ID = 'art-666-gleif-bundle-enrichment';
const rand = mulberry32(0x666A11);

const BUNDLE_TYPES = ['counterparty-onboarding-pack', 'aml-screening-pack', 'workpaper-bundle', ''];
const LEIS = ['5493001KJTIIGC8Y1R12', 'AAAAAAAAAAAAAAAAAAAA', 'NOTALEI', '', undefined];
const XML_SPECIMEN = '<LEIRecord><LEI>5493001KJTIIGC8Y1R12</LEI><Entity><LegalName>SPECIMEN ENTITY</LegalName></Entity><Registration><LastUpdateDate>2026-06-30T12:00:00.000Z</LastUpdateDate><RegistrationStatus>ISSUED</RegistrationStatus></Registration></LEIRecord>';
const SOURCE_TEXTS = ['', XML_SPECIMEN, 'plain csv row, no xml element', 'unicode: éèê café 😀'];

function randomDeclared(rng) {
  const r = rng();
  if (r < 0.34) return true;
  if (r < 0.68) return false;
  return pickNasty(rng); // undeclared class: undefined, null, strings, NaN, etc -- never true/false
}

function randomPP(rng) {
  return {
    bundle_type: pick(rng, BUNDLE_TYPES),
    bundle_asserts_lei_identity: randomDeclared(rng),
    lei: pick(rng, LEIS),
    source_text: pick(rng, SOURCE_TEXTS),
    source_format: pick(rng, ['xml', 'csv', 'other', 'bogus', undefined]),
    captured_at: pick(rng, ['2026-08-30T00:00:00Z', '', undefined]),
    golden_copy_as_of: pick(rng, ['2026-06-30', '', undefined]),
    last_update_date: pick(rng, ['2026-06-30T12:00:00.000Z', '', undefined]),
  };
}

const TRIALS = 1500;

// ---------- P1: determinism -- same policy_parameters -> byte-identical output_payload ----------
function checkP1_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const a = JSON.stringify(compute(pp).output_payload);
    const b = JSON.stringify(compute(pp).output_payload);
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P1_determinism', checked, violations };
}

// ---------- P2: output shape -- no NaN/undefined anywhere in output_payload ----------
function checkP2_output_shape() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (findShapeViolations(output_payload).length > 0) violations++;
  }
  return { name: 'P2_output_shape_no_nan_undefined', checked, violations };
}

// ---------- P3 (differential): applicable === (bundle_asserts_lei_identity === true), re-derived ----------
function checkP3_applicable_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expectApplicable = pp.bundle_asserts_lei_identity === true;
    if (output_payload.applicable !== expectApplicable) violations++;
    // never-guess: bundle_asserts_lei_identity strictly tri-state in the output too.
    const declaredOut = output_payload.bundle_asserts_lei_identity;
    if (declaredOut !== true && declaredOut !== false && declaredOut !== null) violations++;
    if (pp.bundle_asserts_lei_identity !== true && pp.bundle_asserts_lei_identity !== false && declaredOut !== null) violations++;
  }
  return { name: 'P3_applicable_and_tristate_differential', checked, violations };
}

// ---------- P4: gleif_enrichment is non-null iff applicable (never partial) ----------
function checkP4_enrichment_presence() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const hasEnrichment = output_payload.gleif_enrichment !== null;
    if (hasEnrichment !== output_payload.applicable) violations++;
    if (output_payload.applicable && output_payload.inapplicable_reason !== null) violations++;
    if (!output_payload.applicable && output_payload.inapplicable_reason === null) violations++;
  }
  return { name: 'P4_enrichment_presence_matches_applicable', checked, violations };
}

// ---------- P5 (differential): source_bytes re-derived from source_text UTF-8 byte length ----------
function checkP5_source_bytes_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!output_payload.applicable) continue;
    const text = typeof pp.source_text === 'string' ? pp.source_text : '';
    const expectedBytes = new TextEncoder().encode(text).length;
    if (output_payload.gleif_enrichment.source_bytes !== expectedBytes) violations++;
    const expectedCaptured = text.length > 0;
    if (output_payload.gleif_enrichment.snapshot_captured !== expectedCaptured) violations++;
    if (expectedCaptured === false && output_payload.gleif_enrichment.source_sha256 !== null) violations++;
  }
  return { name: 'P5_source_bytes_and_capture_differential', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_determinism(),
  checkP2_output_shape(),
  checkP3_applicable_differential(),
  checkP4_enrichment_presence(),
  checkP5_source_bytes_differential(),
];
console.log(`[${KERNEL_ID}] class-A floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
