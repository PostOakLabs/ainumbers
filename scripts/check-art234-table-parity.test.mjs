#!/usr/bin/env node
// check-art234-table-parity.test.mjs — mutation controls for REGZ-TABLE-SINGLE-WRITER-3
// (SO #40b pairing: a gate that has only ever been observed green has not been observed at all).
//
// Drives checkPage() with in-memory strings — no temp files, no touching the real page.
// Cases:
//   1. GREEN  — the exact generated block passes.
//   2. RED    — one dollar value mutated inside the generated region (the divergence class:
//               page carries a wrong constant).
//   3. RED    — a hand-written second `var HOEPA_PF =` copy outside the region (the
//               duplication this row closes).
//   4. RED    — markers missing (region deleted).
//   5. RED    — stale region: block generated from a DIFFERENT (older) constants object,
//               i.e. the kernel changed without --write riding along (the pre-#1862 2025
//               floor $1,345 stands in for the stale value).

import { checkPage, expectedBlock } from './check-art234-table-parity.mjs';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const page = readFileSync(resolve(ROOT, 'chaingraph/art-234-test-hoepa-high-cost.html'), 'utf8');

const REAL_TABLES = (await import(pathToFileURL(resolve(ROOT, 'chaingraph/kernels/art-234-test-hoepa-high-cost.kernel.mjs')).href)).THRESHOLD_TABLES;

let failures = 0;
function assert(cond, name) {
  if (cond) console.log('  PASS ' + name);
  else { console.error('  FAIL ' + name); failures++; }
}

const good = expectedBlock(REAL_TABLES);

console.log('case 1: generated block passes');
assert(checkPage(good, good).ok, 'GREEN: byte-equal region passes');

console.log('case 2: mutated dollar value inside region fails');
const mutated = good.replace('trigger_floor: 1380', 'trigger_floor: 1385');
assert(mutated !== good, 'mutation actually applied');
assert(!checkPage(mutated, good).ok, 'RED: value drift fails');

console.log('case 3: second hand-written HOEPA_PF copy fails');
const dup = good + '\nvar HOEPA_PF = { 2026: {} };\n';
assert(!checkPage(dup, good).ok, 'RED: duplicated table fails');

console.log('case 4: missing markers fail');
assert(!checkPage('var HOEPA_PF = {};', good).ok, 'RED: no generated region fails');

console.log('case 5: stale region (kernel moved, page did not) fails');
const staleTables = JSON.parse(JSON.stringify(REAL_TABLES));
staleTables['2025'].trigger_floor = 1345; // the pre-#1862 wrong 2025 floor
const stale = expectedBlock(staleTables);
assert(stale !== good, 'stale block actually differs');
assert(!checkPage(stale, good).ok, 'RED: stale kernel constants fail');

if (failures > 0) { console.error('ART234-TABLE-PARITY-TEST: RED (' + failures + ' failures)'); process.exit(1); }
console.log('ART234-TABLE-PARITY-TEST: GREEN (mutation controls all behave)');
