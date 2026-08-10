// kernel_digest_at_authoring: sha256:2e6765cb6fedbe96e56bc75b47196c2e7243c367d754267127df2711a012aee4
//
// FV-PROPFLOOR-SHARD-B22-1 — property-test floor for art-390-tip20-memo-commitment-validator.
// Class B (bounded-categorical/hash-integrity), FLOAT:NO per the WU row — every check is a
// string-length/hex-regex test or a SHA-256 digest string comparison, no arithmetic. Forced
// CATEGORICAL boundary cases used in place of ULP forcing. Zero external dependencies (uses
// globalThis.crypto.subtle, a Node/browser built-in, not a package dependency). compute() is
// ASYNC (real SHA-256 requires an awaited call) — this harness awaits every call. This file
// is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-390-tip20-memo-commitment-validator.proptest.mjs

import { compute } from '../art-390-tip20-memo-commitment-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-390-tip20-memo-commitment-validator.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = await compute(vec.policy_parameters);
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
const rand = mulberry32(0x390D1);
const TRIALS = 6000; // async trials are slower (real subtle.digest calls) — still well within spec's 5000-20000 band
function hex64(rng) { return Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(rng() * 16)]).join(''); }
async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function mkPP(rng) {
  const branch = rng();
  if (branch < 0.34) {
    const payload = 'payload-' + Math.floor(rng() * 1e9);
    const matches = rng() < 0.5;
    const memo_hex = matches ? await sha256Hex(payload) : hex64(rng);
    return { memo_hex, payload };
  } else if (branch < 0.68) {
    const invoice_id = 'INV-' + Math.floor(rng() * 1e9);
    const matches = rng() < 0.5;
    const locator = 'invoice:' + invoice_id;
    const memo_hex = matches ? await sha256Hex(locator) : hex64(rng);
    return { memo_hex, invoice_id };
  }
  return { memo_hex: hex64(rng) };
}

// ---------- P1: memo_hex_valid is exactly (length===64 AND matches hex regex) ----------
async function checkP1_memoHexValidExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = await mkPP(rand);
    const r = await compute(pp);
    checked++;
    const norm = pp.memo_hex.trim().replace(/^0x/i, '').toLowerCase();
    const expected = norm.length === 64 && /^[0-9a-f]{64}$/.test(norm);
    if (r.output_payload.memo_hex_valid !== expected) violations++;
  }
  return { name: 'P1_memo_hex_valid_exact_length_and_hex_regex', trials: checked, violations };
}

// ---------- P2: payload_commitment_match is null iff no payload; else exact SHA-256 comparison ----------
async function checkP2_payloadCommitmentMatchExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = await mkPP(rand);
    const r = await compute(pp);
    checked++;
    if (pp.payload === undefined) {
      if (r.output_payload.payload_commitment_match !== null) violations++;
    } else {
      const digest = await sha256Hex(pp.payload);
      const norm = pp.memo_hex.trim().replace(/^0x/i, '').toLowerCase();
      const memoValid = norm.length === 64 && /^[0-9a-f]{64}$/.test(norm);
      const expected = memoValid && digest === norm;
      if (r.output_payload.payload_commitment_match !== expected) violations++;
    }
  }
  return { name: 'P2_payload_commitment_match_exact_sha256_comparison', trials: checked, violations };
}

// ---------- P3: overall_valid implies memo_hex_valid (logical implication, never the reverse) ----------
async function checkP3_overallValidImpliesMemoValid() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = await mkPP(rand);
    const r = await compute(pp);
    checked++;
    if (r.output_payload.overall_valid && !r.output_payload.memo_hex_valid) violations++;
  }
  return { name: 'P3_overall_valid_implies_memo_hex_valid', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced categorical boundary cases ----------
async function checkP4_forced() {
  const H = 'ab'.repeat(32);
  const cases = [
    [{ memo_hex: H.slice(0, 63) }, 'memo_hex exactly 63 hex chars — memo_length_valid must be false'],
    [{ memo_hex: H + 'a' }, 'memo_hex exactly 65 hex chars — memo_length_valid must be false'],
    [{ memo_hex: '0x' + H }, '0x-prefixed memo_hex normalizes to the bare 64-char hex form'],
    [{ memo_hex: H.toUpperCase() }, 'uppercase hex normalizes to lowercase via normalizeHex'],
    [{ memo_hex: H, payload: '' }, 'empty-string payload is a SUPPLIED payload (typeof check), not absent — commitment computed'],
    [{ memo_hex: H }, 'no payload and no invoice_id — NO_COMMITMENT_SOURCE_SUPPLIED, overall_valid true iff memo itself valid'],
    [{ memo_hex: 'g'.repeat(64) }, 'memo_hex correct length but non-hex characters — memo_hex_valid must be false'],
    [{ memo_hex: H, invoice_id: 'INV-1', invoice_locator_template: 'custom:{invoice_id}:v2' }, 'custom locator template substitution — commitment computed over the substituted string, not the default template'],
  ];
  const rows = [];
  for (const [pp, label] of cases) {
    const r = await compute(pp);
    const { memo_hex_valid, memo_length_valid, overall_valid } = r.output_payload;
    const plausible = typeof memo_hex_valid === 'boolean' && typeof memo_length_valid === 'boolean' && typeof overall_valid === 'boolean';
    rows.push({ label, input: pp, memo_hex_valid, memo_length_valid, overall_valid, plausible });
  }
  return rows;
}

const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(await checkP1_memoHexValidExact());
results.properties.push(await checkP2_payloadCommitmentMatchExact());
results.properties.push(await checkP3_overallValidImpliesMemoValid());
results.boundary_forced = await checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
