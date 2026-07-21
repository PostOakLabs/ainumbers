#!/usr/bin/env node
/**
 * scripts/ocg-verify-hash-tamper.test.mjs
 * AV-REJECT-FIX-1: tamper-negative fixture for chaingraph/verify.html — the
 * core OCG artifact hash verifier. A verifier never observed to reject
 * isn't known to verify.
 *
 * Inlines the same cgCanon/canonicalPreimage/executionHash logic from
 * chaingraph/verify.html so this test never opens a second canon impl.
 */

function assertIJson(v) {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error('Non-finite number is not valid I-JSON.');
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) throw new Error('Integer exceeds 2^53 — not safe I-JSON.');
  } else if (Array.isArray(v)) {
    v.forEach(assertIJson);
  } else if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) assertIJson(v[k]);
  }
}

function cgCanon(v) {
  if (Array.isArray(v)) return v.map(cgCanon);
  if (v && typeof v === 'object') {
    return Object.keys(v).sort().reduce((o, k) => { o[k] = cgCanon(v[k]); return o; }, {});
  }
  return v;
}

function canonicalPreimage(policy_parameters, output_payload) {
  const obj = { policy_parameters, output_payload };
  assertIJson(obj);
  return JSON.stringify(cgCanon(obj));
}

async function executionHash(policy_parameters, output_payload) {
  const bytes = new TextEncoder().encode(canonicalPreimage(policy_parameters, output_payload));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizeHash(h) { return typeof h === 'string' ? h.replace(/^sha256:/i, '').toLowerCase() : h; }

async function runVerify(artifact) {
  const { policy_parameters, output_payload, execution_hash: storedHash } = artifact;
  const computedHex = await executionHash(policy_parameters, output_payload);
  const storedHex = normalizeHash(storedHash);
  return { pass: storedHex === computedHex, computedHex };
}

// ── Golden artifact (mirrors verify.html's own shape) ──
const GOLDEN = {
  policy_parameters: { activity: 'av_reject_fix_1_fixture', jurisdiction: 'US', amount_usd: 12000 },
  output_payload: { decision: 'approve', risk_score: 0.2 },
};

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

console.log('ocg-verify-hash-tamper.test.mjs (chaingraph/verify.html)');

const goldenHash = await executionHash(GOLDEN.policy_parameters, GOLDEN.output_payload);

await (async () => {
  const clean = { ...GOLDEN, execution_hash: goldenHash };
  const result = await runVerify(clean);
  test('golden artifact: hash verify PASSES', () => {
    assert(result.pass === true, 'Expected pass=true, got ' + result.pass);
  });
})();

await (async () => {
  const tampered = { ...GOLDEN, output_payload: { ...GOLDEN.output_payload, decision: 'DENY' }, execution_hash: goldenHash };
  const result = await runVerify(tampered);
  test('tampered output_payload (stale hash): hash verify FAILS', () => {
    assert(result.pass === false, 'Expected pass=false after tampering output_payload, got ' + result.pass);
  });
})();

await (async () => {
  const tampered = { ...GOLDEN, policy_parameters: { ...GOLDEN.policy_parameters, amount_usd: 999999 }, execution_hash: goldenHash };
  const result = await runVerify(tampered);
  test('tampered policy_parameters (stale hash): hash verify FAILS', () => {
    assert(result.pass === false, 'Expected pass=false after tampering policy_parameters, got ' + result.pass);
  });
})();

await (async () => {
  const clean = { ...GOLDEN, execution_hash: 'sha256:' + goldenHash };
  const result = await runVerify(clean);
  test('sha256: prefix on stored hash: still PASSES (normalization)', () => {
    assert(result.pass === true, 'Expected pass=true with sha256: prefix, got ' + result.pass);
  });
})();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
