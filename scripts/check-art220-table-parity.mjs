#!/usr/bin/env node
// check-art220-table-parity.mjs — ART220-TABLE-SINGLE-WRITER-1 (page-vs-kernel constants parity).
//
// WHY THIS EXISTS
// ---------------
// The art-220 node page historically hand-maintained a SECOND copy of the kernel's
// version-pinned threshold tables inside `var TABLES = {...}`. Measured 2026-09-02/03
// (RECEIPT-REDTEAM S1 + verifier CS-13): the page copy disagreed with the sealed kernel
// on every historical year and cited a third phantom Federal Register document family —
// three independently wrong copies of one table (kernel, page, and the law). This gate
// makes the kernel the single writer: the page's TABLES block is generated from the
// kernel's own exported THRESHOLD_TABLES by this script, and any hand-edit or kernel
// change that does not ride through `--write` reds preflight.
//
// SO #34 (INDEPENDENT DERIVATION): the expected block is RECOMPUTED by importing the
// kernel module and serializing its live table objects. Nothing is read back out of the
// page to construct the expectation — the page is only the artifact under test.
//
// Paired with scripts/check-art220-table-parity.test.mjs (RED-before-GREEN mutation
// proof, SO #40b pairing).
//
// Usage:
//   node scripts/check-art220-table-parity.mjs            check (exit 1 on any mismatch)
//   node scripts/check-art220-table-parity.mjs --write    regenerate the page block from the kernel

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const KERNEL = await import(pathToFileURL(resolve(ROOT, 'chaingraph/kernels/art-220-reg-z-threshold-lookup.kernel.mjs')).href);
const PAGE_PATH = resolve(ROOT, 'chaingraph/art-220-reg-z-threshold-lookup.html');
const PAGE_TABLES = ['qm_points_fees', 'hoepa']; // the two tables the page exposes

const BEGIN = '// TABLES-GENERATED-FROM-KERNEL art-220-reg-z-threshold-lookup BEGIN (single writer: scripts/check-art220-table-parity.mjs --write; hand edits red the parity gate)';
const END = '// TABLES-GENERATED-FROM-KERNEL art-220-reg-z-threshold-lookup END';

function fmtVal(v) {
  if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  return String(v);
}
function fmtRow(row) {
  return '{ ' + Object.entries(row).map(([k, v]) => k + ': ' + fmtVal(v)).join(', ') + ' }';
}
export function serializeTables(tables) {
  const lines = ['var TABLES = {'];
  for (const t of PAGE_TABLES) {
    lines.push('  ' + t + ': {');
    const years = Object.keys(tables[t]).map(Number).sort((a, b) => b - a);
    for (const y of years) lines.push('    ' + y + ': ' + fmtRow(tables[t][y]) + ',');
    lines.push('  },');
  }
  lines.push('};');
  return lines.join('\n');
}
export function expectedBlock(tables) {
  return BEGIN + '\n' + serializeTables(tables) + '\n' + END;
}

// checkPage(pageText, expected) -> { ok, problems[] } — exported so the mutation test can
// drive it with in-memory strings instead of touching the real page.
export function checkPage(pageText, expected) {
  const problems = [];
  const bi = pageText.indexOf(BEGIN);
  const ei = pageText.indexOf(END);
  if (bi === -1 || ei === -1 || ei < bi) {
    problems.push('generated TABLES region (BEGIN/END markers) missing or out of order');
  } else if (pageText.slice(bi, ei + END.length) !== expected) {
    problems.push('page TABLES region does not equal the block generated from the kernel THRESHOLD_TABLES export');
  }
  const varCount = (pageText.match(/var TABLES\s*=/g) || []).length;
  if (varCount !== 1) {
    problems.push('expected exactly 1 `var TABLES =` assignment (generated region), found ' + varCount + ' — a hand-written second copy is forbidden');
  }
  return { ok: problems.length === 0, problems };
}

const mode = process.argv[2] || '--check';

// CLI guard: the paired test imports this module for checkPage/expectedBlock; only run
// the gate itself when executed directly.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const page = readFileSync(PAGE_PATH, 'utf8');
  const expected = expectedBlock(KERNEL.THRESHOLD_TABLES);

  if (mode === '--write') {
    const bi = page.indexOf(BEGIN);
    const ei = page.indexOf(END);
    if (bi === -1 || ei === -1 || ei < bi) {
      console.error('WRITE-FAIL: BEGIN/END markers not found in page; refusing to guess insertion point.');
      process.exit(1);
    }
    const next = page.slice(0, bi) + expected + page.slice(ei + END.length);
    writeFileSync(PAGE_PATH, next, 'utf8');
    console.log('WROTE generated TABLES region into ' + PAGE_PATH);
    process.exit(0);
  }

  const { ok, problems } = checkPage(page, expected);
  if (!ok) {
    console.error('ART220-TABLE-PARITY: RED');
    for (const p of problems) console.error('  - ' + p);
    console.error('  regenerate with: node scripts/check-art220-table-parity.mjs --write');
    process.exit(1);
  }
  console.log('ART220-TABLE-PARITY: GREEN (page TABLES region byte-equal to kernel THRESHOLD_TABLES export; qm_points_fees + hoepa, ' + Object.keys(KERNEL.THRESHOLD_TABLES.qm_points_fees).length + ' years)');
}

