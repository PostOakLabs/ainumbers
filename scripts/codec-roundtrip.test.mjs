#!/usr/bin/env node
/**
 * scripts/codec-roundtrip.test.mjs
 * Gate: the fragment codec (gzip + base64url encode → decode + gunzip) must
 * produce byte-identical JSON after a round-trip.
 *
 * Uses Node.js zlib streams to replicate the browser CompressionStream logic
 * (same gzip algorithm, same base64url alphabet).
 */
import { gzipSync, gunzipSync } from 'node:zlib';

// ── Test vectors ─────────────────────────────────────────────────────────────
// Minimal valid OCG artifact envelope (frozen v0.4 required fields)
const ARTIFACT_MINIMAL = {
  '@context': 'https://ainumbers.co/chaingraph/standard/v0.4',
  chaingraph_version: '0.4.0',
  execution_hash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  chain: 'test-chain',
  tool_id: 'chaingraph/chains/test-chain',
  mandate_type: 'test',
  generated_at: '2026-07-06T00:00:00.000Z',
  policy_parameters: { test_param: 'hello' },
  output_payload: { result: 'ok', decisions: [] },
  audit_signature: {
    server_side_executed: true,
    zero_pii_verified: true,
    deterministic_run: true
  }
};

// A gated composite artifact with decisions[]
const ARTIFACT_GATED = {
  '@context': 'https://ainumbers.co/chaingraph/standard/v0.4',
  chaingraph_version: '0.4.0',
  execution_hash: 'deadbeef1234567890deadbeef1234567890deadbeef1234567890deadbeef12',
  chain: 'mortgage-compliance-preflight',
  tool_id: 'chaingraph/chains/mortgage-compliance-preflight',
  mandate_type: 'mortgage_compliance',
  generated_at: '2026-07-06T01:23:45.678Z',
  policy_parameters: { loan_amount: 425000, apor: 6.5, apr: 8.7 },
  output_payload: {
    composite: true,
    steps: [
      { tool_id: 'art-215-conforming-loan-limit', execution_hash: 'aaa000', mandate_type: 'rule', output_payload: { conforming: true } },
      { tool_id: 'art-216-qm-apr-apor-spread', execution_hash: 'bbb000', mandate_type: 'rule', output_payload: { spread_bps: 220 } }
    ],
    decisions: [
      { step_id: 'art-216-qm-apr-apor-spread', input_pointer: '/spread_bps', observed_value: 220, op: 'gt', value: 150, next: 'art-217-check-points' }
    ],
    path_taken: ['art-215-conforming-loan-limit', 'art-216-qm-apr-apor-spread', 'art-217-check-points']
  },
  audit_signature: { server_side_executed: true, zero_pii_verified: true, deterministic_run: true }
};

// ── Codec (mirrors browser CompressionStream logic) ───────────────────────────
function b64uEnc(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64uDec(str) {
  const p = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - p.length % 4) % 4;
  return Buffer.from(p + '='.repeat(pad), 'base64');
}

function encode(artifact) {
  const json = JSON.stringify(artifact);
  const compressed = gzipSync(Buffer.from(json, 'utf8'));
  return '#a=v1.' + b64uEnc(compressed);
}

function decode(frag) {
  if (!frag.startsWith('#a=v1.')) throw new Error('Unknown fragment prefix: ' + frag.slice(0, 10));
  const compressed = b64uDec(frag.slice(6));
  const json = gunzipSync(compressed).toString('utf8');
  return JSON.parse(json);
}

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  ✓ ' + name);
    passed++;
  } catch (e) {
    console.error('  ✗ ' + name + '\n    ' + e.message);
    failed++;
  }
}

function assertEqual(a, b, msg) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error((msg || 'assertEqual failed') + '\n    expected: ' + sb.slice(0, 200) + '\n    got:      ' + sa.slice(0, 200));
}

console.log('codec-roundtrip.test.mjs');

test('minimal artifact: encode produces #a=v1. prefix', () => {
  const frag = encode(ARTIFACT_MINIMAL);
  if (!frag.startsWith('#a=v1.')) throw new Error('Fragment does not start with #a=v1. — got: ' + frag.slice(0, 20));
});

test('minimal artifact: decode(encode(x)) === x', () => {
  const frag = encode(ARTIFACT_MINIMAL);
  const decoded = decode(frag);
  assertEqual(decoded, ARTIFACT_MINIMAL, 'minimal artifact round-trip not byte-identical');
});

test('gated composite: decode(encode(x)) === x', () => {
  const frag = encode(ARTIFACT_GATED);
  const decoded = decode(frag);
  assertEqual(decoded, ARTIFACT_GATED, 'gated composite round-trip not byte-identical');
});

test('execution_hash preserved after round-trip', () => {
  const frag = encode(ARTIFACT_GATED);
  const decoded = decode(frag);
  if (decoded.execution_hash !== ARTIFACT_GATED.execution_hash)
    throw new Error('execution_hash changed: ' + decoded.execution_hash);
});

test('decisions[] preserved after round-trip', () => {
  const frag = encode(ARTIFACT_GATED);
  const decoded = decode(frag);
  assertEqual(decoded.output_payload.decisions, ARTIFACT_GATED.output_payload.decisions, 'decisions[] not preserved');
});

test('fragment is deterministic (same input = same output)', () => {
  const f1 = encode(ARTIFACT_MINIMAL);
  const f2 = encode(ARTIFACT_MINIMAL);
  if (f1 !== f2) throw new Error('Non-deterministic encoding: ' + f1.slice(0,30) + ' vs ' + f2.slice(0,30));
});

test('mutated artifact != original after round-trip', () => {
  const mutated = JSON.parse(JSON.stringify(ARTIFACT_MINIMAL));
  mutated.execution_hash = '0000000000000000000000000000000000000000000000000000000000000000';
  const frag = encode(mutated);
  const decoded = decode(frag);
  if (decoded.execution_hash === ARTIFACT_MINIMAL.execution_hash)
    throw new Error('Mutation not preserved in round-trip');
});

test('base64url alphabet: no +, /, = in fragment', () => {
  const frag = encode(ARTIFACT_GATED);
  const payload = frag.slice(3);
  if (/[+/=]/.test(payload)) throw new Error('Fragment contains +, / or = — not base64url: ' + payload.slice(0,30));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
