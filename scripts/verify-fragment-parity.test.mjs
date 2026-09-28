#!/usr/bin/env node
/**
 * scripts/verify-fragment-parity.test.mjs — VERIFY-FRAGMENT-INTAKE-1's drift gate.
 *
 * WHY THIS EXISTS: chaingraph/verify.html reads the same `#a=v1.<encoded>`
 * fragment that ledger/index.html writes, using a COPY of the ledger's codec.
 * The copy is deliberate — every page in this repo is self-contained (CONTRACT
 * §1: inline CSS/JS only, no shared module), so there is no import to share.
 * The cost of a copy is drift: a ledger-side fix to the codec would silently
 * leave the verifier decoding by the old rules, and a receipt link would open
 * on one page and fail on the other with nothing red anywhere.
 *
 * WHAT IT ASSERTS: for each function of the codec pair, the source text in
 * ledger/index.html and in chaingraph/verify.html is IDENTICAL. Whitespace
 * included — "byte-identical apart from the comment header" is the row's fence,
 * and comment headers live outside the extracted function bodies.
 *
 * WHEN IT GOES RED: someone changed one copy. The fix is to change BOTH, never
 * to relax this assertion.
 *
 * Run: node --test --test-reporter=dot scripts/verify-fragment-parity.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = join(REPO, 'ledger', 'index.html');
const VERIFIER = join(REPO, 'chaingraph', 'verify.html');

/** The codec functions that must stay in lockstep across the two pages. */
const CODEC_FUNCTIONS = ['gunzip', 'b64uDec', 'decodeFragment'];

/**
 * Extract one top-level function declaration's full source text, from the
 * `function` keyword through its matching closing brace.
 *
 * Brace counting is naive by design: it does not track braces inside string or
 * regex literals. That is safe here and ONLY here, because the three codec
 * functions contain no brace characters inside any literal. If a future edit
 * introduces one, this extractor must be replaced with a real parser rather
 * than patched — a silently short extraction would make the gate pass on a
 * partial comparison, which is worse than no gate at all.
 */
function extractFunction(source, name) {
  const re = new RegExp(String.raw`^(?:async\s+)?function\s+${name}\s*\(`, 'm');
  const m = re.exec(source);
  assert.ok(m, `function ${name} not found`);
  const start = m.index;
  const open = source.indexOf('{', start);
  assert.notStrictEqual(open, -1, `function ${name} has no body`);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  assert.fail(`function ${name} body is unbalanced`);
}

const ledgerSrc = readFileSync(LEDGER, 'utf8');
const verifierSrc = readFileSync(VERIFIER, 'utf8');

for (const name of CODEC_FUNCTIONS) {
  test(`${name}() is identical in ledger/index.html and chaingraph/verify.html`, () => {
    const fromLedger = extractFunction(ledgerSrc, name);
    const fromVerifier = extractFunction(verifierSrc, name);
    assert.strictEqual(
      fromVerifier,
      fromLedger,
      `${name}() has drifted between the two pages. Fix BOTH copies, never this assertion.`
    );
  });
}

test('the verifier names the ledger as the source of its copy', () => {
  // A copied block with no pointer back to its origin is how the next session
  // "fixes" one side and never learns the other exists.
  assert.match(
    verifierSrc,
    /ledger\/index\.html/,
    'chaingraph/verify.html must cite ledger/index.html as the source of the copied codec.'
  );
  assert.match(
    verifierSrc,
    /verify-fragment-parity\.test\.mjs/,
    'chaingraph/verify.html must name this gate so a reader knows the copy is checked.'
  );
});

test('the verifier reads the fragment and never a query string', () => {
  assert.match(verifierSrc, /addEventListener\('hashchange'/, 'no hashchange wiring found');
  assert.match(verifierSrc, /location\.hash/, 'no location.hash read found');
  assert.doesNotMatch(
    verifierSrc,
    /URLSearchParams\s*\(\s*(?:window\.)?location\.search/,
    'the artifact must travel in the fragment only, never in a query string'
  );
});
