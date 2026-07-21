#!/usr/bin/env node
/**
 * scripts/witness-checkpoint-424-tamper.test.mjs
 * AV-REJECT-FIX-1: tamper-negative fixture for
 * chaingraph/art-424-witness-cosignature-verifier.html (WITNESS-VERIFY-1 +
 * the AV-CONSISTENCY-1 consistency-proof mode) — the checkpoint-note parse
 * and anchored_hash/root cross-check that gates every witness cosignature
 * verdict. A verifier never observed to reject isn't known to verify.
 *
 * Inlines the SAME parseNote/_str/_int/_arr/b64decode/toHex logic as
 * art-424 (byte-identical) plus the anchored_hash_match / origin_match
 * checks from its computeSync/computeVerifier. Does not re-verify the
 * Ed25519/ML-DSA-44 witness signatures themselves (that requires the
 * page's vendored ml-dsa44 module) — this test proves the structural/root
 * tamper-rejection path, which every cosignature check depends on.
 */

function _str(v) { return typeof v === 'string' ? v : ''; }
function _int(v) { return Number.isInteger(v) ? v : null; }
function _arr(v) { return Array.isArray(v) ? v : []; }
function b64decode(s) { return new Uint8Array(Buffer.from(String(s || '').trim(), 'base64')); }
function toHex(bytes) { let out = ''; for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0'); return out; }

function parseNote(text) {
  const raw = _str(text);
  const sep = raw.indexOf('\n\n');
  if (sep < 0) return { error: 'note has no header/signature separator (blank line)' };
  const header = raw.slice(0, sep);
  const sigBlock = raw.slice(sep + 2);
  const headerLines = header.split('\n').filter(l => l.length > 0);
  if (headerLines.length < 3) return { error: 'note header needs origin, size, and root lines' };
  const origin = headerLines[0], sizeStr = headerLines[1], rootB64 = headerLines[2];
  const size = Number(sizeStr);
  if (!Number.isInteger(size) || size < 0) return { error: 'note size line is not a non-negative integer' };
  let rootBytes;
  try { rootBytes = b64decode(rootB64); } catch (e) { return { error: 'note root line is not valid base64' }; }
  const noteText = header + '\n';
  const sigLines = sigBlock.split('\n')
    .filter(l => l.indexOf('— ') === 0 || l.indexOf('- ') === 0)
    .map(l => { const body = l.slice(2); const spaceAt = body.indexOf(' '); if (spaceAt < 0) return null; return { name: body.slice(0, spaceAt), blob_b64: body.slice(spaceAt + 1).trim() }; })
    .filter(Boolean);
  return { origin, size, rootHex: toHex(rootBytes), noteText, sigLines };
}

// ── computeSync's precondition checks (byte-identical logic) ──────────────
function computeSync(pp) {
  pp = pp || {};
  const checks = [];
  const anchored_hash = _str(pp.anchored_hash).trim().replace(/^sha256:/, '').toLowerCase();
  const log_origin = _str(pp.log_origin).trim();
  const witness_keys = _arr(pp.witness_keys);
  let threshold = _int(pp.threshold); if (threshold === null) threshold = 1;

  checks.push({ check: 'anchored_hash_present', pass: /^[0-9a-f]{64}$/.test(anchored_hash) });
  checks.push({ check: 'witness_keys_present', pass: witness_keys.length > 0 });
  checks.push({ check: 'threshold_valid', pass: threshold >= 1 && threshold <= witness_keys.length });

  const parsed = parseNote(_str(pp.checkpoint_note));
  checks.push({ check: 'checkpoint_note_parses', pass: !parsed.error });

  return { preconditionsOk: checks.every(c => c.pass), checks, parsed, anchored_hash, log_origin, witness_keys, threshold };
}

function verdict(pp) {
  const sync = computeSync(pp);
  if (!sync.preconditionsOk) return { witness_verification_result: 'FAIL', reason: 'preconditions failed', checks: sync.checks };
  const anchored_hash_match = sync.parsed.rootHex === sync.anchored_hash;
  const origin_match = !sync.log_origin || sync.parsed.origin === sync.log_origin;
  // Without re-verifying signatures, PASS requires at minimum that the root and origin the
  // caller trusts actually match what the checkpoint note claims — this is the tamper gate.
  return { witness_verification_result: (anchored_hash_match && origin_match) ? 'ROOT_ORIGIN_OK' : 'FAIL', anchored_hash_match, origin_match };
}

// ── Golden checkpoint (matches PRESETS.pass in art-424, minus witness sig verify) ──
const GOLDEN_PP = {
  anchored_hash: 'sha256:1a48948724b049112cff2467561ab5307cf76b60dd11b63847449daf155c5485',
  log_origin: 'witness-verify-1-fixture-log.example.org',
  checkpoint_note: 'witness-verify-1-fixture-log.example.org\n42\nGkiUhySwSREs/yRnVhq1MHz3a2DdEbY4R0SdrxVcVIU=\n\n— witness-ed25519-1 ug/AhAAAAABobWYAaccGWkwwp5YCyD1NxFIT3tTt3sa+GKUYMe5QfPIbsGhNlhVvMOYbOyFwWb4Ie4qmw1veCD/8fadoGxyR72/XAg==\n',
  witness_keys: [{ name: 'witness-ed25519-1', algorithm: 'ed25519', public_key_b64: '0fN6s6H2ctimNrsDRNlBLbK1wST+50DANLqoPidppTY=' }],
  threshold: 1,
};

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log('  ✓ ' + name); passed++; } catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

console.log('witness-checkpoint-424-tamper.test.mjs (chaingraph/art-424-witness-cosignature-verifier.html)');

test('golden checkpoint: root matches anchored_hash and origin matches', () => {
  const r = verdict(GOLDEN_PP);
  assert(r.anchored_hash_match === true, 'Expected anchored_hash_match=true');
  assert(r.origin_match === true, 'Expected origin_match=true');
  assert(r.witness_verification_result === 'ROOT_ORIGIN_OK', 'Expected ROOT_ORIGIN_OK, got ' + r.witness_verification_result);
});

test('tampered checkpoint root (different base64 root line): anchored_hash_match FAILS', () => {
  const tampered = { ...GOLDEN_PP, checkpoint_note: GOLDEN_PP.checkpoint_note.replace('GkiUhySwSREs/yRnVhq1MHz3a2DdEbY4R0SdrxVcVIU=', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=') };
  const r = verdict(tampered);
  assert(r.anchored_hash_match === false, 'Expected anchored_hash_match=false after root tamper');
  assert(r.witness_verification_result === 'FAIL', 'Expected FAIL, got ' + r.witness_verification_result);
});

test('tampered log_origin (equivocating log claim): origin_match FAILS', () => {
  const tampered = { ...GOLDEN_PP, log_origin: 'attacker-controlled-log.example.org' };
  const r = verdict(tampered);
  assert(r.origin_match === false, 'Expected origin_match=false after origin tamper');
  assert(r.witness_verification_result === 'FAIL', 'Expected FAIL, got ' + r.witness_verification_result);
});

test('malformed checkpoint note (missing blank-line separator): precondition FAILS', () => {
  const tampered = { ...GOLDEN_PP, checkpoint_note: 'no-separator-here\n42\nGkiUhySwSREs/yRnVhq1MHz3a2DdEbY4R0SdrxVcVIU=\n' };
  const r = verdict(tampered);
  assert(r.witness_verification_result === 'FAIL', 'Expected FAIL for a note with no header/signature separator');
});

test('missing anchored_hash: precondition FAILS', () => {
  const tampered = { ...GOLDEN_PP, anchored_hash: '' };
  const r = verdict(tampered);
  assert(r.witness_verification_result === 'FAIL', 'Expected FAIL for a missing anchored_hash');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
