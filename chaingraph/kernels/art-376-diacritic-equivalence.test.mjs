// art-376-diacritic-equivalence.test.mjs — ART376-FIX-1 port-equivalence gate.
//
// stripDiacritics() in art-376-score-payee-name-match.kernel.mjs was rewritten
// from Unicode-string OBJECT-KEY indexing (DIACRITIC_MAP[ch]) to a paired
// string+array scan (DIACRITIC_KEYS.indexOf(ch) / DIACRITIC_VALS[idx]) — a
// speedup for the QuickJS proving guest (ART376-PROFILE-1), NOT a behavior
// change. This gate proves output-identical over EVERY key in DIACRITIC_MAP
// (not just the 7 shipped golden-parity fixtures) plus the miss path, so a
// silent divergence can't hide in an untested diacritic.
//
// Usage: node art-376-diacritic-equivalence.test.mjs

import { __test__ } from './art-376-score-payee-name-match.kernel.mjs';

const { DIACRITIC_MAP, stripDiacritics } = __test__;

let fail = 0, checked = 0;

// hit path — every one of the ~90 DIACRITIC_MAP keys must map exactly as the
// old object-lookup table declares, both standalone and inside a string.
for (const [ch, expected] of Object.entries(DIACRITIC_MAP)) {
  const got = stripDiacritics(ch);
  if (got !== expected) {
    console.error(`✗ hit '${ch}' (U+${ch.codePointAt(0).toString(16)}): expected '${expected}', got '${got}'`);
    fail++;
  } else checked++;

  const gotInWord = stripDiacritics(`pre${ch}post`);
  const expectedInWord = `pre${expected}post`;
  if (gotInWord !== expectedInWord) {
    console.error(`✗ hit-in-context '${ch}': expected '${expectedInWord}', got '${gotInWord}'`);
    fail++;
  } else checked++;
}

const mapKeyCount = Object.keys(DIACRITIC_MAP).length;
if (mapKeyCount < 80) {
  console.error(`✗ DIACRITIC_MAP has only ${mapKeyCount} keys — expected ~90; table shrank unexpectedly.`);
  fail++;
}

// miss path — plain ASCII, digits, whitespace, punctuation, and non-Latin
// script characters (not in the map) must pass through unchanged.
const missChars = [
  ...'abcdefghijklmnopqrstuvwxyz',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'0123456789',
  ' ', '-', "'", '.', ',',
  'и', 'в', 'а', 'н', // Cyrillic — out of scope, must pass through untouched
  '中', '文', // CJK — out of scope, must pass through untouched
];
for (const ch of missChars) {
  const got = stripDiacritics(ch);
  if (got !== ch) {
    console.error(`✗ miss '${ch}': expected passthrough '${ch}', got '${got}'`);
    fail++;
  } else checked++;
}

// mixed string — hits and misses interleaved, matches char-by-char reference.
const referenceMap = (ch) => (Object.prototype.hasOwnProperty.call(DIACRITIC_MAP, ch) ? DIACRITIC_MAP[ch] : ch);
const mixedSamples = ['José García', 'Iван Ivanov', 'Müller-Schäfer, Inc.', 'plain ascii only', ''];
for (const sample of mixedSamples) {
  const expected = [...sample].map(referenceMap).join('');
  const got = stripDiacritics(sample);
  if (got !== expected) {
    console.error(`✗ mixed '${sample}': expected '${expected}', got '${got}'`);
    fail++;
  } else checked++;
}

if (fail === 0) {
  console.log(`✓ art-376 diacritic port-equivalence clean — ${checked} check(s), ${mapKeyCount} DIACRITIC_MAP keys + miss path, all output-identical.`);
  process.exit(0);
}
console.error(`\n✗ ${fail} art-376 diacritic equivalence failure(s).`);
process.exit(1);
