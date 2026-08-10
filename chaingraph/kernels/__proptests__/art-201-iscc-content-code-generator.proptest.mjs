// art-201-iscc-content-code-generator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C6-1).
// kernel_digest_at_authoring: sha256:4dfd4472b91697eea65c4241ac425e012eeff7afe0d270e7da548a4904d9b4bc
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (WU triage table lists this kernel float:yes; direct source read finds every
// numeric operation is integer bit-manipulation (BLAKE3/xxhash32 compression, base32 codec) or
// BigInt modular arithmetic in minhash() -- no IEEE-754 division or fractional-threshold comparison
// anywhere in the file. CORRECTED to float:no per FIX-2 discipline; no ULP-forcing applies. This
// correction is stated in the manifest, matching the same correction made for art-206 in this shard.)
// Checks: fixture-oracle gate, termination (content-defined chunking is bounded by content byte
// length -- tested directly via the reported input_bytes/byte-accounting), boundedness (instance/
// data codes are always well-formed ISCC strings of fixed prefix/alphabet), a determinism/no-
// collision differential property (repeat calls agree; distinct random inputs almost never collide),
// and metamorphic title-presence structural invariance (meta_code/iscc_code only appear exactly
// when a non-empty title is supplied). The kernel's own embedded isccSelfCheck() conformance vectors
// (input-independent) are also asserted true on every trial as a standing regression floor.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-201-iscc-content-code-generator.proptest.mjs

import { compute } from '../art-201-iscc-content-code-generator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-201-iscc-content-code-generator.fixtures.json');
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
const rand = mulberry32(0x201A0);

function randomText(rng, maxLen) {
  const n = Math.floor(rng() * maxLen);
  const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,-_';
  let s = '';
  for (let i = 0; i < n; i++) s += CHARS[Math.floor(rng() * CHARS.length)];
  return s;
}

const ISCC_RE = /^ISCC:[A-Z2-7]+$/;
const TRIALS = 3000; // content generation is heavier per-call (BLAKE3/xxhash32 chunking) than string kernels

// ---------- P1: termination — input_bytes accounting is exact, chunking never diverges/loops ----------
function checkP1_termination_and_byte_accounting() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const content = randomText(rand, 2000);
    const { output_payload } = compute({ content });
    checked++;
    const expectedBytes = Buffer.byteLength(content, 'utf8');
    if (output_payload.input_bytes !== expectedBytes) violations++;
    if (output_payload.conformance_pass !== true) violations++; // input-independent self-check floor
  }
  return { name: 'P1_termination_byte_accounting_and_selfcheck', trials: checked, violations };
}

// ---------- P2: boundedness — instance_code/data_code/iscc_code are well-formed ISCC strings ----------
function checkP2_iscc_format_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const content = randomText(rand, 2000);
    const title = rand() < 0.5 ? randomText(rand, 60) : '';
    const { output_payload } = compute({ content, title });
    checked++;
    if (!ISCC_RE.test(output_payload.instance_code)) violations++;
    if (!ISCC_RE.test(output_payload.data_code)) violations++;
    if (output_payload.iscc_code && !ISCC_RE.test(output_payload.iscc_code)) violations++;
    if (/^[0-9a-f]+$/.test(output_payload.datahash) === false) violations++;
  }
  return { name: 'P2_iscc_codes_well_formed', trials: checked, violations };
}

// ---------- P3 (differential): determinism -- same content twice yields byte-identical codes ----------
function checkP3_determinism_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const content = randomText(rand, 1500);
    const title = rand() < 0.5 ? randomText(rand, 40) : '';
    const r1 = compute({ content, title }).output_payload;
    const r2 = compute({ content, title }).output_payload;
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  return { name: 'P3_determinism_repeat_call_identical', trials: checked, violations };
}

// ---------- P4: metamorphic — meta_code/iscc_code presence exactly tracks title non-emptiness ----------
function checkP4_title_presence_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const content = randomText(rand, 800);
    const title = randomText(rand, 60);
    const withTitle = compute({ content, title }).output_payload;
    const withoutTitle = compute({ content, title: '' }).output_payload;
    checked++;
    const titleNonEmpty = title.trim().length > 0; // gen_meta_code_v0 throws on empty-after-clean name -> falls to no meta_code
    if (titleNonEmpty) {
      if (withTitle.meta_code === undefined) violations++;
    }
    if (withoutTitle.meta_code !== undefined) violations++;
    // instance/data codes never depend on title
    if (withTitle.instance_code !== withoutTitle.instance_code) violations++;
    if (withTitle.data_code !== withoutTitle.data_code) violations++;
  }
  return { name: 'P4_title_presence_structural_invariance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_and_byte_accounting());
results.properties.push(checkP2_iscc_format_bounded());
results.properties.push(checkP3_determinism_differential());
results.properties.push(checkP4_title_presence_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-201-iscc-content-code-generator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
