#!/usr/bin/env node
// check-retired-ap2-version.test.mjs — paired fixture proof for
// check-retired-ap2-version.mjs (GATE-SELFTEST-META-1 / SO #34 mutation discipline).
//
// Drives the exported lineHits() on in-memory fixtures — never touches the real
// kernels/manifests/exporters trees — proving the checker CAN go red on an
// ap2_version EMIT shape, stays green on the sanctioned shapes (property reads,
// field lists, descriptors, prose), and that `chaingraph_version` (the sole legal
// envelope version) never trips it. The emit-shape-vs-mention distinction is the
// gate's load-bearing premise (art-17's validator is lawful tolerance code).
//
// Usage: node scripts/check-retired-ap2-version.test.mjs
// Exit 0 = every assertion passed. Exit 1 = a fixture assertion failed.

import { lineHits, EMIT_SHAPE } from './check-retired-ap2-version.mjs';

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.log(`✗ ${msg}`); }
  else console.log(`✓ ${msg}`);
}

// ── RED: an ap2_version emit-shape trips the gate ────────────────────────
assert(lineHits(`const m={ap2_version:"1.0",mandate_id:"x"};`), 'RED: bare-JS object-key emit (ap2_version:"1.0") trips the gate');
assert(lineHits(`ap2_version:'1.0',`), 'RED: single-quoted JS object-key emit trips the gate');
assert(lineHits(`"ap2_version": "1.0"`), 'RED: JSON quoted-key emit trips the gate');
console.log('  [quotable] RED   — lineHits(`const m={ap2_version:"1.0",...}`) => true (an envelope emit)');

// ── GREEN: sanctioned shapes pass — mention is not emission ─────────────
assert(!lineHits(`if (obj.ap2_version === '1.0.0') {`), 'GREEN: a validator PROPERTY READ (art-17 tolerance code) passes');
assert(!lineHits(`required_fields: ['ap2_version', 'mandate_id', 'issued_at'],`), 'GREEN: a required-fields LIST MEMBER passes (comma, not colon)');
assert(!lineHits(`{field:'ap2_version',required:false, type:'string'},`), 'GREEN: a field DESCRIPTOR passes');
assert(!lineHits(`versionRow.detail = 'ap2_version must be "1.0" (string), not "1.0.0".';`), 'GREEN: a validator MESSAGE STRING passes');
assert(!lineHits(`chaingraph_version:'0.4.0',`), 'GREEN: chaingraph_version — the sole legal envelope version — passes');
console.log('  [quotable] GREEN — lineHits(`if (obj.ap2_version === ...`) => false (mention/tolerance, not emission)');

// ── CONTROLS ─────────────────────────────────────────────────────────────
assert(EMIT_SHAPE.source === "['\"]?ap2_version['\"]?\\s*:", 'CONTROL: the emit-shape regex is exactly the quoted-or-bare object-key form');
assert(lineHits(`const row={ 'ap2_version' : "1.0" }`), 'CONTROL: spaced JSON spelling also trips (whitespace tolerance)');

if (failures) {
  console.error(`\n✗ check-retired-ap2-version.test.mjs: ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\n✓ check-retired-ap2-version.test.mjs: all fixture assertions passed (RED and GREEN both proven).');
