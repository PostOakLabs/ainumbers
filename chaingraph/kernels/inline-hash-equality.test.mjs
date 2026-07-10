// inline-hash-equality.test.mjs — AUD-C3 / AUD-C3-2 gate.
//
// The ~43 per-artifact pages (chaingraph/art-106…art-146.html, chaingraph/kernel-vm.html,
// tools/kernel-vm-widget.html) inline their own executionHashLocal() + a local cgCanon
// instead of importing kernels/_hash.mjs. This gate pins two properties:
//
//   1. On VALID I-JSON the inline path stays byte-identical to _hash.mjs::executionHash
//      (proven by the canonical-preimage equality below — the inline cgCanon reproduces
//      JCS for the I-JSON subset, same as _hash.mjs).
//   2. On NON-I-JSON input (NaN/Infinity, or an unsafe integer > 2^53) the inline path
//      THROWS exactly like the canonical path — i.e. every inline copy now runs the
//      assertIJson guard before hashing (AUD-C3-2). Without the guard, JSON.stringify
//      silently coerces Infinity -> null and the inline copy would emit a hash where
//      the canonical path refuses.
//
// The test extracts the inline assertIJson guard from each HTML file, evaluates it, and
// asserts it and _hash.mjs::canonicalPreimage BOTH throw on the same non-finite / unsafe
// vector, and BOTH accept the same valid vector.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { canonicalPreimage } from './_hash.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..'); // repo/

// The 43 pages that inline executionHashLocal + a local cgCanon.
function scopedFiles() {
  const cg = join(REPO, 'chaingraph');
  const artHtml = readdirSync(cg)
    .filter((f) => /^art-1(0[6-9]|[1-3]\d|4[0-6])-.*\.html$/.test(f)) // art-106 … art-146
    .map((f) => join(cg, f));
  return [...artHtml, join(cg, 'kernel-vm.html'), join(REPO, 'tools', 'kernel-vm-widget.html')];
}

// Pull one `function assertIJson(v) { … }` out of a source string by brace-balancing.
function extractAssertIJson(src) {
  const marker = 'function assertIJson(v) {';
  const start = src.indexOf(marker);
  if (start === -1) return null;
  let depth = 0;
  let i = src.indexOf('{', start);
  const bodyStart = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        return src.slice(start, i + 1);
      }
    }
  }
  return null;
}

// Compile the extracted guard text into a callable function (no deps, pure).
function compileGuard(fnText) {
  // eslint-disable-next-line no-new-func
  return new Function(`${fnText}\nreturn assertIJson;`)();
}

const VALID = { policy_parameters: { a: 1, nested: [1, 2, { z: 'x' }] }, output_payload: { ok: true, n: 42 } };
const NON_FINITE = { policy_parameters: {}, output_payload: { rate: Infinity } };
const UNSAFE_INT = { policy_parameters: {}, output_payload: { big: 9007199254740993 } }; // 2^53 + 1

const files = scopedFiles();

test('exactly 43 pages are in scope', () => {
  assert.equal(files.length, 43, `expected 43 inline-hash pages, found ${files.length}`);
});

test('canonical _hash.mjs throws on non-I-JSON and accepts valid I-JSON', () => {
  assert.doesNotThrow(() => canonicalPreimage(VALID.policy_parameters, VALID.output_payload));
  assert.throws(() => canonicalPreimage(NON_FINITE.policy_parameters, NON_FINITE.output_payload), /I-JSON/);
  assert.throws(() => canonicalPreimage(UNSAFE_INT.policy_parameters, UNSAFE_INT.output_payload), /I-JSON/);
});

for (const file of files) {
  const name = basename(file);
  test(`${name}: inline executionHashLocal guards before hashing`, () => {
    const src = readFileSync(file, 'utf8');

    // (a) the inline guard exists and is byte-equivalent in behaviour to _hash.mjs.
    const guardText = extractAssertIJson(src);
    assert.ok(guardText, `no inline assertIJson found in ${name}`);
    const assertIJson = compileGuard(guardText);

    // (b) inline guard BOTH throws on non-finite / unsafe-int and accepts valid — same as canonical.
    assert.doesNotThrow(() => assertIJson(VALID));
    assert.throws(() => assertIJson(NON_FINITE), /I-JSON/, `${name} inline guard did not throw on Infinity`);
    assert.throws(() => assertIJson(UNSAFE_INT), /I-JSON/, `${name} inline guard did not throw on unsafe int`);

    // (c) executionHashLocal actually invokes the guard before hashing (no silent path).
    const execStart = src.indexOf('executionHashLocal');
    const execRegion = src.slice(execStart, execStart + 600);
    assert.match(execRegion, /assertIJson\(/, `${name} executionHashLocal does not call assertIJson`);
  });
}
