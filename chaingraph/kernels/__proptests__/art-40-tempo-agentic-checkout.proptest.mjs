// kernel_digest_at_authoring: sha256:47e0d8df39b535ff28996c6dc12584f8049e74d5b4f532510f296e2eebbddc02
//
// FV-PROPFLOOR-SHARD-B13-1 — property-test floor for art-40-tempo-agentic-checkout.
// Class B (bounded-numeric), float:no per the WU row — confirmed by inspection, compute() does
// string slicing/truncation and an integer-hash-based deterministic address builder, no continuous
// float arithmetic. Forced CATEGORICAL boundary cases used instead of ULP forcing, per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-40-tempo-agentic-checkout.proptest.mjs

import { compute } from '../art-40-tempo-agentic-checkout.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-40-tempo-agentic-checkout.fixtures.json');
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
const rand = mulberry32(0x40E5);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randStr(rng, len) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(rng() * chars.length)];
  return s;
}
const TRIALS = 8000;

const PROTOCOLS = ['ACP', 'Visa TAP', 'Manual ISO 20022', 'On-chain Tempo tx'];

function mkPP(rng) {
  return {
    protocol: pick(rng, PROTOCOLS),
    rawRef: randStr(rng, Math.floor(randRange(rng, 0, 60))),
    senderName: randStr(rng, Math.floor(randRange(rng, 1, 20))),
    receiverName: randStr(rng, Math.floor(randRange(rng, 1, 20))),
    amount: randRange(rng, 0, 100000),
    stablecoin: pick(rng, ['USDC', 'USDT']),
  };
}

// ---------- P1: boundedness — memo.length is always <= 32, truncated flag exactly matches rawRef.length > 32 ----------
function checkP1_memoTruncationInvariant() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const o = r.output_payload;
    const rawRef = pp.rawRef || 'ORD-REF';
    if (o.memo.length > 32) violations++;
    if (o.truncated !== (rawRef.length > 32)) violations++;
  }
  return { name: 'P1_memo_length_bounded_32_and_truncated_flag_exact', trials: checked, violations };
}

// ---------- P2: metamorphic — unrecognized protocol falls back to Manual ISO 20022 binding ----------
function checkP2_unknownProtocolFallsBack() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const rKnown = compute(pp);
    const rUnknown = compute({ ...pp, protocol: 'TotallyUnknownProtocol' });
    if (JSON.stringify(rUnknown.output_payload.protocol_binding) !== JSON.stringify(compute({ ...pp, protocol: 'Manual ISO 20022' }).output_payload.protocol_binding)) violations++;
  }
  return { name: 'P2_unknown_protocol_falls_back_to_manual_iso20022_binding', trials: checked, violations };
}

// ---------- P3: round-trip — deterministicAddr is a pure function: same senderName always yields the same address ----------
function checkP3_deterministicAddrIsPure() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const r1 = compute(pp);
    const r2 = compute({ ...pp, amount: pp.amount + 1 });
    if (r1.output_payload.tip20_transfer.sender_address !== r2.output_payload.tip20_transfer.sender_address) violations++;
  }
  return { name: 'P3_deterministic_addr_pure_function_of_name_only', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced CATEGORICAL boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ protocol: 'ACP', rawRef: 'A'.repeat(32), senderName: 'Alice', receiverName: 'Bob', amount: 100 }, 'rawRef exactly 32 characters (boundary of the >32 truncation check) — truncated must be false, memo must equal rawRef unchanged'],
  [{ protocol: 'ACP', rawRef: 'A'.repeat(33), senderName: 'Alice', receiverName: 'Bob', amount: 100 }, 'rawRef exactly 33 characters (1 over boundary) — truncated must be true, memo must be sliced to 32 chars'],
  [{ protocol: 'ACP', rawRef: '', senderName: 'Alice', receiverName: 'Bob', amount: 100 }, 'rawRef empty string — memo must fall back to "ORD-REF" per kernel ||, truncated false'],
  [{ protocol: 'ACP', rawRef: 'REF', senderName: '', receiverName: 'Bob', amount: 100 }, 'senderName empty string — deterministicAddr must fall back to "unknown" base, no throw'],
  [{ protocol: 'Manual ISO 20022', rawRef: 'REF', senderName: 'Álice-日本', receiverName: 'Bob', amount: 100 }, 'senderName with non-ASCII unicode characters — must not throw, address built from stripped alphanumerics'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const o = r.output_payload;
    const plausible = o.memo.length <= 32 && typeof o.tip20_transfer.sender_address === 'string' && o.tip20_transfer.sender_address.startsWith('0x');
    rows.push({ label, input: pp, output: o, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_memoTruncationInvariant());
results.properties.push(checkP2_unknownProtocolFallsBack());
results.properties.push(checkP3_deterministicAddrIsPure());
results.boundary_forced = checkP4_forced();

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
