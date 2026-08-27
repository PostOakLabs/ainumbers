#!/usr/bin/env node
/**
 * scripts/witness-checkpoint-424-tamper.test.mjs
 * AV-REJECT-FIX-1: checkpoint root/origin tamper gate for
 * chaingraph/art-424-witness-cosignature-verifier.html (WITNESS-VERIFY-1 +
 * the AV-CONSISTENCY-1 consistency-proof mode).
 *
 * ── WHAT THIS GATE CLAIMS, AND WHAT IT DOES NOT ──────────────────────────────
 * CLAIMS: the SHIPPED checkpoint-note parser (`parseNote`) and the SHIPPED
 * precondition set (`computeSync`) reject a tampered note root, an equivocating
 * log origin, a malformed note, a missing anchored_hash, and an out-of-range
 * threshold — and that the shipped verdict still derives root/origin agreement
 * from exactly the expressions replayed here.
 * DOES NOT CLAIM: that any witness COSIGNATURE was verified. The Ed25519 and
 * ML-DSA-44 legs of the shipped `computeVerifier` (`verifyOneWitness`,
 * `verifyEd25519`, `verifyMldsa44`, and the `valid_witness_count >= threshold`
 * test) are NOT executed by this gate — the ML-DSA path needs the page's
 * vendored ml-dsa44 module. This file was previously labelled "proven-to-reject",
 * which claimed a signature rejection it never performed; the label is now
 * "checkpoint root/origin tamper (signature legs NOT exercised)"
 * (TAMPER-GATE-SHIPPED-SOURCE-1). Retitling is the fix here; actually exercising
 * signature verification is separate, unbuilt work.
 *
 * ANCHORED TO SHIPPED SOURCE (TAMPER-GATE-SHIPPED-SOURCE-1, audit finding E-3).
 * This gate carries NO copy of the parser or the precondition logic. It
 * brace-extracts the REAL `_str` / `_int` / `_arr` / `b64decode` / `toHex` /
 * `parseNote` / `computeSync` out of the shipped page via the shared
 * extract-and-diff helper `scripts/lib-extract-shipped.mjs` (the AUD-C3-2
 * extractor from chaingraph/kernels/inline-hash-equality.test.mjs), and pins the
 * two comparison expressions the shipped `computeVerifier` uses for its verdict
 * so a drift there reds this gate instead of passing unnoticed. Before this
 * change the gate ran a private replica: art-424 could regress arbitrarily and
 * every assertion below stayed green.
 *
 * SELF-PROVING (SO #34c / SO #40b): every run also TAMPERS the shipped source in
 * memory (pinning `b64decode` to the golden root bytes, so a tampered note root
 * would decode clean) and requires the suite to go red on it. If the mutation
 * point moves, `mutateSource` throws rather than quietly disarming the self-proof.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { buildShipped, mutateSource, assertSourceContains } from './lib-extract-shipped.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const SHIPPED_REL = 'chaingraph/art-424-witness-cosignature-verifier.html';

// The extraction contract: exactly the shipped symbols the structural/root leg is made of.
const EXTRACT_SPEC = {
  file: SHIPPED_REL,
  prelude: 'var ED25519_NOTE_ALG = 0x01, MLDSA44_NOTE_ALG = 0xf0;',   // note-alg bytes computeSync does not read
  fns: ['_str', '_int', '_arr', 'b64decode', 'toHex', 'parseNote', 'computeSync'],
};

// The two expressions the SHIPPED computeVerifier derives its root/origin verdict from.
// This gate replays them (it cannot run computeVerifier without the vendored ml-dsa44
// module), so it pins them: if the shipped comparison changes, this gate reds.
const PINNED_VERDICT_EXPRESSIONS = [
  'var anchored_hash_match = parsed.rootHex === anchored_hash;',
  'var origin_match = !log_origin || parsed.origin === log_origin;',
  // Declares the leg this gate deliberately does NOT exercise. If the shipped PASS
  // verdict stops requiring a witness threshold, that is a change this gate must not sit on.
  'var pass = anchored_hash_match && origin_match && valid_witness_count >= threshold;',
];

// ── Golden checkpoint (matches PRESETS.pass in art-424, minus witness sig verify) ──
const GOLDEN_ROOT_B64 = 'GkiUhySwSREs/yRnVhq1MHz3a2DdEbY4R0SdrxVcVIU=';
const GOLDEN_PP = {
  anchored_hash: 'sha256:1a48948724b049112cff2467561ab5307cf76b60dd11b63847449daf155c5485',
  log_origin: 'witness-verify-1-fixture-log.example.org',
  checkpoint_note: 'witness-verify-1-fixture-log.example.org\n42\n' + GOLDEN_ROOT_B64 + '\n\n— witness-ed25519-1 ug/AhAAAAABobWYAaccGWkwwp5YCyD1NxFIT3tTt3sa+GKUYMe5QfPIbsGhNlhVvMOYbOyFwWb4Ie4qmw1veCD/8fadoGxyR72/XAg==\n',
  witness_keys: [{ name: 'witness-ed25519-1', algorithm: 'ed25519', public_key_b64: '0fN6s6H2ctimNrsDRNlBLbK1wST+50DANLqoPidppTY=' }],
  threshold: 1,
};

// Replays the shipped computeVerifier's root/origin verdict over the shipped computeSync
// output. The expressions replayed here are pinned against shipped source above.
function rootOriginVerdict(V, pp) {
  const sync = V.computeSync(pp);
  if (!sync.preconditionsOk)
    return { witness_verification_result: 'FAIL', reason: 'preconditions failed', checks: sync.checks };
  const anchored_hash_match = sync.parsed.rootHex === sync.anchored_hash;
  const origin_match = !sync.log_origin || sync.parsed.origin === sync.log_origin;
  return {
    witness_verification_result: (anchored_hash_match && origin_match) ? 'ROOT_ORIGIN_OK' : 'FAIL',
    anchored_hash_match, origin_match,
  };
}

// ── The tamper suite, run against whichever parser it is handed ────────────────
// Returns a list of failure messages (empty = suite passed for that parser).
function runCheckpointSuite(V) {
  const fails = [];
  const check = (name, fn) => {
    try { fn(); } catch (e) { fails.push(name + ': ' + e.message); }
  };
  const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

  check('golden checkpoint: root matches anchored_hash and origin matches', () => {
    const r = rootOriginVerdict(V, GOLDEN_PP);
    assert(r.anchored_hash_match === true, 'Expected anchored_hash_match=true');
    assert(r.origin_match === true, 'Expected origin_match=true');
    assert(r.witness_verification_result === 'ROOT_ORIGIN_OK', 'Expected ROOT_ORIGIN_OK, got ' + r.witness_verification_result);
  });

  check('tampered checkpoint root (different base64 root line): anchored_hash_match FAILS', () => {
    const tampered = { ...GOLDEN_PP, checkpoint_note: GOLDEN_PP.checkpoint_note.replace(GOLDEN_ROOT_B64, 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=') };
    const r = rootOriginVerdict(V, tampered);
    assert(r.anchored_hash_match === false, 'Expected anchored_hash_match=false after root tamper');
    assert(r.witness_verification_result === 'FAIL', 'Expected FAIL, got ' + r.witness_verification_result);
  });

  check('tampered anchored_hash (caller pinned a root the note does not carry): FAILS', () => {
    const tampered = { ...GOLDEN_PP, anchored_hash: 'sha256:' + 'ab'.repeat(32) };
    const r = rootOriginVerdict(V, tampered);
    assert(r.anchored_hash_match === false, 'Expected anchored_hash_match=false when the pinned anchor differs from the note root');
    assert(r.witness_verification_result === 'FAIL', 'Expected FAIL, got ' + r.witness_verification_result);
  });

  check('tampered log_origin (equivocating log claim): origin_match FAILS', () => {
    const tampered = { ...GOLDEN_PP, log_origin: 'attacker-controlled-log.example.org' };
    const r = rootOriginVerdict(V, tampered);
    assert(r.origin_match === false, 'Expected origin_match=false after origin tamper');
    assert(r.witness_verification_result === 'FAIL', 'Expected FAIL, got ' + r.witness_verification_result);
  });

  check('malformed checkpoint note (missing blank-line separator): precondition FAILS', () => {
    const tampered = { ...GOLDEN_PP, checkpoint_note: 'no-separator-here\n42\n' + GOLDEN_ROOT_B64 + '\n' };
    const r = rootOriginVerdict(V, tampered);
    assert(r.witness_verification_result === 'FAIL', 'Expected FAIL for a note with no header/signature separator');
  });

  check('missing anchored_hash: precondition FAILS', () => {
    const r = rootOriginVerdict(V, { ...GOLDEN_PP, anchored_hash: '' });
    assert(r.witness_verification_result === 'FAIL', 'Expected FAIL for a missing anchored_hash');
  });

  check('threshold above the pinned key count: precondition FAILS', () => {
    const r = rootOriginVerdict(V, { ...GOLDEN_PP, threshold: 5 });
    assert(r.witness_verification_result === 'FAIL', 'Expected FAIL when threshold exceeds the number of pinned witness keys');
  });

  check('shipped parseNote reads origin, size and witness signature lines', () => {
    const parsed = V.parseNote(GOLDEN_PP.checkpoint_note);
    assert(!parsed.error, 'golden note must parse: ' + parsed.error);
    assert(parsed.origin === 'witness-verify-1-fixture-log.example.org', 'wrong origin: ' + parsed.origin);
    assert(parsed.size === 42, 'wrong size: ' + parsed.size);
    assert(parsed.sigLines.length === 1 && parsed.sigLines[0].name === 'witness-ed25519-1',
      'expected one witness signature line named witness-ed25519-1, got ' + JSON.stringify(parsed.sigLines.map(s => s.name)));
  });

  return fails;
}

// ── Runner ─────────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function report(name, failures) {
  if (failures.length === 0) { console.log('  ✓ ' + name); passed++; return; }
  console.error('  ✗ ' + name);
  for (const f of failures) console.error('    ' + f);
  failed++;
}
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}

console.log('witness-checkpoint-424-tamper.test.mjs — checkpoint root/origin tamper');
console.log('  SHIPPED source: ' + SHIPPED_REL);
console.log('  NOT exercised here: Ed25519 / ML-DSA-44 witness cosignature verification.\n');

// ── 1. Build the parser from the SHIPPED page and run the tamper suite ────────
const shippedSrc = readFileSync(join(REPO, SHIPPED_REL), 'utf8');
const V = buildShipped(shippedSrc, EXTRACT_SPEC);   // throws (red) if a symbol is gone
test('extraction: shipped checkpoint parser + preconditions located in ' + SHIPPED_REL, () => {
  for (const n of EXTRACT_SPEC.fns) {
    if (typeof V[n] !== 'function') throw new Error('shipped `' + n + '` did not extract as a function');
  }
});

test('shipped computeVerifier still derives its verdict from the pinned expressions', () => {
  const missing = assertSourceContains(shippedSrc, 'computeVerifier', PINNED_VERDICT_EXPRESSIONS);
  if (missing.length) {
    throw new Error(
      'the shipped verdict logic moved away from what this gate replays:\n      ' + missing.join('\n      ') +
      '\n    Re-read computeVerifier and update both the replay and these pins.'
    );
  }
});

report('shipped checkpoint parser + preconditions: full tamper suite (8 assertions)', runCheckpointSuite(V));

// ── 2. Self-proving: TAMPER THE SHIPPED SOURCE, in process, and require the RED ──
const TAMPER_NEEDLE = "var bin = atob(String(s || '').trim());";
const tamperedSrc = mutateSource(shippedSrc, SHIPPED_REL, TAMPER_NEEDLE,
  "var bin = atob('" + GOLDEN_ROOT_B64 + "'); /* TAMPERED IN MEMORY: every note root decodes to the golden root */");
const tamperedFails = runCheckpointSuite(buildShipped(tamperedSrc, { ...EXTRACT_SPEC, file: SHIPPED_REL + ' <tampered-in-memory>' }));
test(`self-test: tampering the SHIPPED note decoder reds the suite (${tamperedFails.length} assertion failures caught)`, () => {
  if (tamperedFails.length === 0)
    throw new Error('suite stayed green with the shipped note decoder pinned to the golden root — it is not reading shipped source, or the assertions do not discriminate');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
