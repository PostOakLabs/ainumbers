#!/usr/bin/env node
// check-art234-table-parity.mjs — REGZ-TABLE-SINGLE-WRITER-3 (page-vs-kernel constants parity).
//
// WHY THIS EXISTS
// ---------------
// The art-234 node page hand-maintains a SECOND copy of the kernel's version-pinned HOEPA
// points-and-fees trigger table inside `var HOEPA_PF = {...}`. ART234-HOEPA-2025-FIX-1
// (PR #1862) corrected the 2025 trigger ($1,348, FR 2024-27553) in the kernel AND on the page,
// but nothing ties the two surfaces together: the next constant change can fix one and leave the
// other stale, which is exactly the art-220 divergence class (page table disagreeing with its own
// sealed kernel on historical years). This gate makes the kernel the single writer: the page's
// HOEPA_PF block is generated from the kernel's own exported THRESHOLD_TABLES by this script, and
// any hand-edit or kernel change that does not ride through `--write` reds preflight. The 2025
// trigger value is #1862's; this row adds the mechanism without re-deriving it.
//
// MECHANISM: replicated from scripts/check-art220-table-parity.mjs (ART220-TABLE-SINGLE-WRITER-1,
// PR #1679) — same shape, this node's export/page/var names. Do not invent a second pattern.
//
// SO #34 (INDEPENDENT DERIVATION): the expected block is RECOMPUTED by importing the
// kernel module and serializing its live table objects. Nothing is read back out of the
// page to construct the expectation — the page is only the artifact under test.
//
// Paired with scripts/check-art234-table-parity.test.mjs (RED-before-GREEN mutation
// proof, SO #40b pairing).
//
// Usage:
//   node scripts/check-art234-table-parity.mjs            check (exit 1 on any mismatch)
//   node scripts/check-art234-table-parity.mjs --write    regenerate the page block from the kernel

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const KERNEL = await import(pathToFileURL(resolve(ROOT, 'chaingraph/kernels/art-234-test-hoepa-high-cost.kernel.mjs')).href);
const PAGE_PATH = resolve(ROOT, 'chaingraph/art-234-test-hoepa-high-cost.html');

const BEGIN = '// TABLES-GENERATED-FROM-KERNEL art-234-test-hoepa-high-cost BEGIN (single writer: scripts/check-art234-table-parity.mjs --write; hand edits red the parity gate)';
const END = '// TABLES-GENERATED-FROM-KERNEL art-234-test-hoepa-high-cost END';

function fmtVal(v) {
  if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  return String(v);
}
function fmtRow(row) {
  return '{ ' + Object.entries(row).map(([k, v]) => k + ': ' + fmtVal(v)).join(', ') + ' }';
}
export function serializeTables(tables) {
  const lines = ['var HOEPA_PF = {'];
  const years = Object.keys(tables).map(Number).sort((a, b) => b - a);
  for (const y of years) lines.push('  ' + y + ': ' + fmtRow(tables[String(y)]) + ',');
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
    problems.push('generated HOEPA_PF region (BEGIN/END markers) missing or out of order');
  } else if (pageText.slice(bi, ei + END.length) !== expected) {
    problems.push('page HOEPA_PF region does not equal the block generated from the kernel THRESHOLD_TABLES export');
  }
  const varCount = (pageText.match(/var HOEPA_PF\s*=/g) || []).length;
  if (varCount !== 1) {
    problems.push('expected exactly 1 `var HOEPA_PF =` assignment (generated region), found ' + varCount + ' — a hand-written second copy is forbidden');
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
    console.log('WROTE generated HOEPA_PF region into ' + PAGE_PATH);
    process.exit(0);
  }

  const { ok, problems } = checkPage(page, expected);
  if (!ok) {
    console.error('ART234-TABLE-PARITY: RED');
    for (const p of problems) console.error('  - ' + p);
    console.error('  regenerate with: node scripts/check-art234-table-parity.mjs --write');
    process.exit(1);
  }
  console.log('ART234-TABLE-PARITY: GREEN (page HOEPA_PF region byte-equal to kernel THRESHOLD_TABLES export, ' + Object.keys(KERNEL.THRESHOLD_TABLES).length + ' years)');
}
