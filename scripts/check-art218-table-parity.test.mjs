#!/usr/bin/env node
// check-art218-table-parity.test.mjs — mutation controls for REGZ-TABLE-SINGLE-WRITER-3
// (SO #40b pairing: a gate that has only ever been observed green has not been observed at all).
//
// Drives checkPage() with in-memory strings — no temp files, no touching the real page.
// Cases:
//   1. GREEN  — the exact generated block passes.
//   2. RED    — one dollar value mutated inside the generated region (the divergence class:
//               page carries a wrong constant).
//   3. RED    — a hand-written second `var QM_TABLES =` copy outside the region (the
//               duplication this row deletes).
//   4. RED    — markers missing (region deleted).
//   5. RED    — stale region: block generated from a DIFFERENT (older) constants object,
//               i.e. the kernel changed without --write riding along.

import { checkPage, expectedBlock } from './check-art218-table-parity.mjs';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const page = readFileSync(resolve(ROOT, 'chaingraph/art-218-qm-points-and-fees.html'), 'utf8');

const REAL_TABLES = (await import(pathToFileURL(resolve(ROOT, 'chaingraph/kernels/art-218-qm-points-and-fees.kernel.mjs')).href)).THRESHOLD_TABLES;

let failures = 0;
function assert(cond, name) {
  if (cond) console.log('  PASS ' + name);
  else { console.error('  FAIL ' + name); failures++; }
}

const good = expectedBlock(REAL_TABLES);

console.log('case 1: generated block passes');
assert(checkPage(good, good).ok, 'GREEN: byte-equal region passes');

console.log('case 2: mutated dollar value inside region fails');
const mutated = good.replace('threshold_min: 134841', 'threshold_min: 134500'); // the pre-fix wrong 2025 value
assert(mutated !== good, 'mutation actually applied');
assert(!checkPage(mutated, good).ok, 'RED: value drift fails');

console.log('case 3: second hand-written QM_TABLES copy fails');
const dup = good + '\nvar QM_TABLES = { 2026: {} };\n';
assert(!checkPage(dup, good).ok, 'RED: duplicated table fails');

console.log('case 4: missing markers fail');
assert(!checkPage('var QM_TABLES = {};', good).ok, 'RED: no generated region fails');

console.log('case 5: stale region (kernel moved, page did not) fails');
const staleTables = JSON.parse(JSON.stringify(REAL_TABLES));
staleTables['2025'].tiers[1].limit_fixed = 4035; // the pre-fix wrong 2025 value
const stale = expectedBlock(staleTables);
assert(stale !== good, 'stale block actually differs');
assert(!checkPage(stale, good).ok, 'RED: stale kernel constants fail');

if (failures > 0) { console.error('ART218-TABLE-PARITY-TEST: RED (' + failures + ' failures)'); process.exit(1); }
console.log('ART218-TABLE-PARITY-TEST: GREEN (mutation controls all behave)');
